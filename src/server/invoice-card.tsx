import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";
import { estimateLines } from "@/lib/invoice-card";

/**
 * Renders the shareable invoice card: a PNG with only the essentials (total,
 * where it comes from, the period summary). Satori only supports flexbox, so
 * every block is a flex container with explicit sizes: the canvas has a fixed
 * height, computed from the content below.
 */

export interface CardRow {
  label: string;
  /** Quantity and rate, e.g. `42h 30m × R$ 100/h`. */
  detail: string | null;
  /** Formatted amount. */
  amount: string;
  cents: number;
}

export interface CardModel {
  theme: "light" | "dark";
  project: { name: string; client: string; initials: string; logo: string | null };
  invoice: { label: string; name: string; period: string };
  total: { label: string; value: string };
  stats: { value: string; label: string }[];
  summary: { label: string; headline: string; points: string[] } | null;
  breakdown: { label: string; rows: CardRow[] };
  footer: { brand: string; issued: string };
}

// App tokens (src/app/globals.css) as hex, since Satori does not parse oklch.
const PALETTES = {
  light: {
    canvas: "#f5f5f5",
    card: "#ffffff",
    foreground: "#0a0a0a",
    muted: "#737373",
    tile: "#f5f5f5",
    border: "#e5e5e5",
    series: ["#f5ba26", "#2a78d6", "#10a37f", "#8b5cf6", "#e5484d", "#64748b"],
  },
  dark: {
    canvas: "#0a0a0a",
    card: "#171717",
    foreground: "#fafafa",
    muted: "#a1a1a1",
    tile: "#262626",
    border: "#2e2e2e",
    series: ["#f5ba26", "#3987e5", "#2cc4a0", "#a78bfa", "#f2686d", "#94a3b8"],
  },
} as const;

const BRAND = "#f5ba26";
const BRAND_FOREGROUND = "#2d1f01";
const NEGATIVE = "#94a3b8";

// Layout, in pixels.
const WIDTH = 1080;
const OUTER = 28;
const PADDING = 56;
const CONTENT_WIDTH = WIDTH - 2 * OUTER - 2 * PADDING;
const SECTION_GAP = 44;
const HEADER_HEIGHT = 88;
const HERO_HEIGHT = 356;
const HERO_HEIGHT_NO_STATS = 244;
const FOOTER_HEIGHT = 48;
const HEADLINE = { size: 40, line: 50, maxLines: 2 };
const POINT = { size: 28, line: 38, maxLines: 2, gap: 14, indent: 36 };
const LABEL_BLOCK = 28 + 20; // section label + gap below it
const BAR_BLOCK = 20 + 16;
const ROW_HEIGHT = 88;

type Style = CSSProperties & { lineClamp?: number };

const fontsPromise = (async () => {
  const dir = join(process.cwd(), "assets", "fonts");
  const [regular, medium, semibold] = await Promise.all(
    ["Geist-Regular.ttf", "Geist-Medium.ttf", "Geist-SemiBold.ttf"].map((file) => readFile(join(dir, file))),
  );
  return [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: medium, weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
})();

function summaryHeights(summary: NonNullable<CardModel["summary"]>) {
  const headline = summary.headline
    ? estimateLines(summary.headline, HEADLINE.size, CONTENT_WIDTH, HEADLINE.maxLines) * HEADLINE.line
    : 0;
  const points = summary.points.map(
    (point) => estimateLines(point, POINT.size, CONTENT_WIDTH - POINT.indent, POINT.maxLines) * POINT.line,
  );
  return { headline, points };
}

function summaryBlockHeight(summary: NonNullable<CardModel["summary"]>): number {
  const { headline, points } = summaryHeights(summary);
  const pointsTotal = points.reduce((sum, height) => sum + height, 0) + Math.max(0, points.length - 1) * POINT.gap;
  const gap = headline && points.length ? 20 : 0;
  return LABEL_BLOCK + headline + gap + pointsTotal;
}

/** The share bar compares sources, so it needs at least two of them. */
function hasShareBar(rows: CardRow[]): boolean {
  return rows.filter((row) => row.cents > 0).length >= 2;
}

function cardHeight(model: CardModel): number {
  const hasBar = hasShareBar(model.breakdown.rows);
  const sections = [
    HEADER_HEIGHT,
    model.stats.length ? HERO_HEIGHT : HERO_HEIGHT_NO_STATS,
    ...(model.summary ? [summaryBlockHeight(model.summary)] : []),
    LABEL_BLOCK + (hasBar ? BAR_BLOCK : 0) + model.breakdown.rows.length * ROW_HEIGHT,
    FOOTER_HEIGHT,
  ];
  const gaps = (sections.length - 1) * SECTION_GAP;
  return 2 * OUTER + 2 * PADDING + sections.reduce((sum, height) => sum + height, 0) + gaps;
}

/** Large amounts shrink so they always fit on one line. */
function totalFontSize(value: string): number {
  if (value.length <= 11) return 120;
  if (value.length <= 14) return 96;
  return 76;
}

function TimerIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

function SectionLabel({ children, color }: { children: string; color: string }) {
  return (
    <div style={{ display: "flex", height: 28, marginBottom: 20, fontSize: 22, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color }}>
      {children}
    </div>
  );
}

function Card({ model }: { model: CardModel }) {
  const palette = PALETTES[model.theme];
  const hasBar = hasShareBar(model.breakdown.rows);
  const dot = (index: number, cents: number) => (cents > 0 ? palette.series[index % palette.series.length] : NEGATIVE);
  const summary = model.summary;
  const summarySizes = summary ? summaryHeights(summary) : null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", padding: OUTER, backgroundColor: palette.canvas, fontFamily: "Geist", color: palette.foreground }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: PADDING,
          gap: SECTION_GAP,
          backgroundColor: palette.card,
          border: `2px solid ${palette.border}`,
          borderRadius: 44,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: HEADER_HEIGHT, gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, minWidth: 0 }}>
            {model.project.logo ? (
              <div style={{ display: "flex", width: 88, height: 88, borderRadius: 20, backgroundColor: "#ffffff", border: `2px solid ${palette.border}`, padding: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
                <img src={model.project.logo} width={72} height={72} alt="" style={{ objectFit: "contain" }} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 88, height: 88, borderRadius: 20, backgroundColor: palette.tile, border: `2px solid ${palette.border}`, color: palette.muted, fontSize: 32, fontWeight: 600 }}>
                {model.project.initials}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 600, lineHeight: 1.2, lineClamp: 1 } as Style}>{model.project.name}</div>
              {model.project.client ? (
                <div style={{ display: "flex", fontSize: 24, color: palette.muted, lineHeight: 1.3, lineClamp: 1 } as Style}>{model.project.client}</div>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: palette.muted }}>{model.invoice.label}</div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 600, lineHeight: 1.25 }}>{model.invoice.name}</div>
            <div style={{ display: "flex", fontSize: 22, color: palette.muted }}>{model.invoice.period}</div>
          </div>
        </div>

        {/* Hero total */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            height: model.stats.length ? HERO_HEIGHT : HERO_HEIGHT_NO_STATS,
            padding: 44,
            borderRadius: 36,
            overflow: "hidden",
            color: BRAND_FOREGROUND,
            backgroundImage: "linear-gradient(135deg, #f8c94d 0%, #f5ba26 55%, #eda312 100%)",
          }}
        >
          <div style={{ position: "absolute", right: -90, top: -150, width: 420, height: 420, borderRadius: 210, border: "44px solid rgba(255,255,255,0.18)" }} />
          <div style={{ position: "absolute", right: 120, top: -210, width: 300, height: 300, borderRadius: 150, border: "30px solid rgba(255,255,255,0.12)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7 }}>{model.total.label}</div>
            <div style={{ display: "flex", fontSize: totalFontSize(model.total.value), fontWeight: 600, letterSpacing: -3, lineHeight: 1.1 }}>{model.total.value}</div>
          </div>
          {model.stats.length ? (
            <div style={{ display: "flex", paddingTop: 28, borderTop: "2px solid rgba(45,31,1,0.16)" }}>
              {model.stats.map((stat, index) => (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    paddingLeft: index === 0 ? 0 : 32,
                    borderLeft: index === 0 ? "none" : "2px solid rgba(45,31,1,0.16)",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 600, lineHeight: 1.2 }}>{stat.value}</div>
                  <div style={{ display: "flex", fontSize: 22, opacity: 0.7 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Period summary */}
        {summary && summarySizes ? (
          <div style={{ display: "flex", flexDirection: "column", height: summaryBlockHeight(summary) }}>
            <SectionLabel color={palette.muted}>{summary.label}</SectionLabel>
            {summary.headline ? (
              <div style={{ display: "flex", height: summarySizes.headline, fontSize: HEADLINE.size, fontWeight: 600, lineHeight: `${HEADLINE.line}px`, letterSpacing: -0.5, lineClamp: HEADLINE.maxLines } as Style}>
                {summary.headline}
              </div>
            ) : null}
            {summary.points.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: POINT.gap, marginTop: summary.headline ? 20 : 0 }}>
                {summary.points.map((point, index) => (
                  <div key={index} style={{ display: "flex", height: summarySizes.points[index], alignItems: "flex-start" }}>
                    <div style={{ display: "flex", width: POINT.indent, height: POINT.line, alignItems: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND }} />
                    </div>
                    <div style={{ display: "flex", flex: 1, fontSize: POINT.size, lineHeight: `${POINT.line}px`, color: palette.muted, lineClamp: POINT.maxLines } as Style}>
                      {point}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Where the total comes from */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionLabel color={palette.muted}>{model.breakdown.label}</SectionLabel>
          {hasBar ? (
            <div style={{ display: "flex", height: 20, gap: 4, marginBottom: 16 }}>
              {model.breakdown.rows.map((row, index) =>
                row.cents > 0 ? (
                  <div key={index} style={{ display: "flex", flexGrow: row.cents, flexBasis: 0, height: 20, borderRadius: 10, backgroundColor: dot(index, row.cents) }} />
                ) : null,
              )}
            </div>
          ) : null}
          {model.breakdown.rows.map((row, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: ROW_HEIGHT,
                gap: 24,
                borderTop: index === 0 ? "none" : `2px solid ${palette.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0, flex: 1 }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, backgroundColor: dot(index, row.cents) }} />
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", fontSize: 30, fontWeight: 500, lineHeight: 1.25, lineClamp: 1 } as Style}>{row.label}</div>
                  {row.detail ? <div style={{ display: "flex", fontSize: 23, lineHeight: 1.3, color: palette.muted }}>{row.detail}</div> : null}
                </div>
              </div>
              <div style={{ display: "flex", flexShrink: 0, fontSize: 32, fontWeight: 600 }}>{row.amount}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: FOOTER_HEIGHT, marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, backgroundColor: BRAND }}>
              <TimerIcon size={29} color={BRAND_FOREGROUND} />
            </div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>{model.footer.brand}</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: palette.muted }}>{model.footer.issued}</div>
        </div>
      </div>
    </div>
  );
}

/** Renders the card as a PNG response. Never cached by shared caches. */
export async function renderInvoiceCard(model: CardModel, filename: string): Promise<Response> {
  return new ImageResponse(<Card model={model} />, {
    width: WIDTH,
    height: cardHeight(model),
    fonts: await fontsPromise,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
