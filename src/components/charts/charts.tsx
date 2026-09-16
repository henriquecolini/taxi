"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

/**
 * Single-series charts. Styling follows the dataviz spec: one series color
 * (`--chart-1`), thin marks with 4px rounded data-ends, hairline horizontal
 * grid, recessive axes, and a hover tooltip. Text always uses text tokens.
 */

export interface ChartPoint {
  /** Short axis label, e.g. `15 Jan`. */
  label: string;
  /** Tooltip heading, e.g. `Thu, 15 Jan 2026`. */
  title: string;
  value: number;
  /** Pre-formatted value for the tooltip, e.g. `3h 20m` or `R$ 250,00`. */
  display: string;
}

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
const HEIGHT = 220;

function ChartTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const point = active ? (payload?.[0]?.payload as ChartPoint | undefined) : undefined;
  if (!point) return null;
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="text-muted-foreground">{point.title}</p>
      <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold tabular-nums">
        <span className="size-2 rounded-full bg-chart-1" aria-hidden />
        {point.display}
      </p>
    </div>
  );
}

interface ChartProps {
  data: ChartPoint[];
  /** Formats y-axis ticks. */
  formatTick: "hours" | "compact";
  locale: string;
  ariaLabel: string;
}

function tickFormatter(kind: ChartProps["formatTick"], locale: string) {
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return (value: number) => (kind === "hours" ? `${compact.format(value)}h` : compact.format(value));
}

export function ColumnChart({ data, formatTick, locale, ariaLabel }: ChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <BarChart data={data} height={HEIGHT} responsive style={{ width: "100%" }} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={tickFormatter(formatTick, locale)} allowDecimals={false} />
        <Tooltip content={ChartTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
        <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}

export function CumulativeChart({ data, formatTick, locale, ariaLabel }: ChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <AreaChart data={data} height={HEIGHT} responsive style={{ width: "100%" }} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={tickFormatter(formatTick, locale)} />
        <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="var(--chart-1)"
          fillOpacity={0.1}
          activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
          // A single point has no line to show, so draw its marker.
          dot={data.length === 1 ? { r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 } : false}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  );
}
