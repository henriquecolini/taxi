/**
 * The invoice card route: access control, and that it renders a PNG for
 * every shape of invoice. Set `CARD_DUMP_DIR` to write the PNGs for review.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/session";

process.env.OWNER_EMAIL = "owner@example.com";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.GOOGLE_CLIENT_ID = "test";
process.env.GOOGLE_CLIENT_SECRET = "test";
process.env.TIMEZONE = "America/Sao_Paulo";

let currentViewer: Viewer | null = null;
let locale: "en" | "pt-BR" = "en";
let theme: string | undefined;

vi.mock("@/lib/session", () => ({ getViewer: async () => currentViewer }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "theme" && theme ? { value: theme } : undefined) }),
}));
vi.mock("next-intl/server", async () => {
  const messages = {
    en: (await import("../messages/en.json")).default,
    "pt-BR": (await import("../messages/pt-BR.json")).default,
  };
  return {
    getLocale: async () => locale,
    getTranslations: async (namespace: string) =>
      createTranslator({ locale, messages: messages[locale], namespace } as never) as unknown,
  };
});

const { openDatabase, migrateDatabase, setDbForTesting } = await import("@/db");
const schema = await import("@/db/schema");
const { GET } = await import("@/app/api/projects/[projectId]/invoices/[invoiceId]/card/route");

const owner: Viewer = { id: "u-owner", email: "owner@example.com", name: "Owner", image: null, isOwner: true };
const client: Viewer = { id: "u-client", email: "client@example.com", name: "Client", image: null, isOwner: false };
const stranger: Viewer = { id: "u-stranger", email: "stranger@example.com", name: "Stranger", image: null, isOwner: false };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let rich: { projectId: string; invoiceId: string };
let minimal: { projectId: string; invoiceId: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const dumpDir = process.env.CARD_DUMP_DIR;

function request({ projectId, invoiceId }: { projectId: string; invoiceId: string }) {
  return GET(new Request("http://localhost/card"), {
    params: Promise.resolve({ projectId, invoiceId }),
  } as never);
}

async function pngOf(response: Response) {
  expect(response.status).toBe(200);
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE);
  const view = new DataView(bytes.buffer);
  return { bytes, width: view.getUint32(16), height: view.getUint32(20) };
}

function dump(name: string, bytes: Uint8Array) {
  if (!dumpDir) return;
  mkdirSync(dumpDir, { recursive: true });
  writeFileSync(join(dumpDir, `${name}.png`), bytes);
}

beforeAll(async () => {
  const db = openDatabase(":memory:");
  migrateDatabase(db);
  setDbForTesting(db);

  const logo = process.env.CARD_LOGO ? (await import("node:fs")).readFileSync(process.env.CARD_LOGO) : null;
  const [a, b] = db
    .insert(schema.projects)
    .values([
      { name: "Acme Storefront", clientName: "Acme Corp", currency: "BRL", hourlyRate: 12000, logo, logoMime: logo ? "image/png" : null },
      { name: "Quiet project", currency: "USD", hourlyRate: 5000 },
    ])
    .returning({ id: schema.projects.id })
    .all();
  db.insert(schema.projectMembers).values({ projectId: a.id, email: client.email }).run();

  // Rich: two rates, a discount and many extras, an AI-style summary.
  const start = Date.UTC(2026, 0, 5, 12);
  db.insert(schema.intervals)
    .values([
      ...Array.from({ length: 9 }, (_, i) => ({ projectId: a.id, startedAt: start + i * DAY, endedAt: start + i * DAY + 5 * HOUR + 30 * 60_000, rate: 12000 })),
      ...Array.from({ length: 3 }, (_, i) => ({ projectId: a.id, startedAt: start + (10 + i) * DAY, endedAt: start + (10 + i) * DAY + 2 * HOUR, rate: 15000 })),
    ])
    .run();
  const richHours = 9 * 5.5 * 12000 + 3 * 2 * 15000;
  const extras = [
    { description: "Hosting and operational costs", amount: 15000 },
    { description: "Design assets license", amount: 8900 },
    { description: "Third-party API usage for the March campaign", amount: 4590 },
    { description: "Domain renewal", amount: 6000 },
    { description: "Loyalty discount", amount: -10000 },
    { description: "Stock photos", amount: 2500 },
    { description: "Error monitoring", amount: 3000 },
  ];
  const extrasTotal = extras.reduce((sum, item) => sum + item.amount, 0);
  const [inv] = db
    .insert(schema.invoices)
    .values({ projectId: a.id, date: "2026-01-20", name: "January 2026", durationMs: 9 * 5.5 * HOUR + 6 * HOUR, subtotal: richHours, extrasTotal, total: richHours + extrasTotal })
    .returning({ id: schema.invoices.id })
    .all();
  db.insert(schema.invoiceItems).values(extras.map((item, position) => ({ ...item, invoiceId: inv.id, position }))).run();
  db.insert(schema.invoiceSummaries)
    .values({
      invoiceId: inv.id,
      scope: "overall",
      headline: "Checkout rebuilt, payments now run through the new gateway",
      content:
        "- Rebuilt the **checkout** flow with the new payment gateway, including retries and a clearer error state for declined cards\n- Fixed the cart sync bug on mobile\n- Added order confirmation emails\n- A fourth point that is not shown",
    })
    .run();
  rich = { projectId: a.id, invoiceId: inv.id };

  // Minimal: one rate, no extras, no summary, no logo, no client name.
  const s2 = Date.UTC(2026, 1, 3, 12);
  db.insert(schema.intervals).values({ projectId: b.id, startedAt: s2, endedAt: s2 + 90 * 60_000, rate: 5000 }).run();
  const [inv2] = db
    .insert(schema.invoices)
    .values({ projectId: b.id, date: "2026-02-10", name: "February", durationMs: 90 * 60_000, subtotal: 7500, extrasTotal: 0, total: 7500 })
    .returning({ id: schema.invoices.id })
    .all();
  minimal = { projectId: b.id, invoiceId: inv2.id };
});

beforeEach(() => {
  currentViewer = owner;
  locale = "en";
  theme = undefined;
});

describe("access", () => {
  it("sends anonymous visitors to the login page", async () => {
    currentViewer = null;
    await expect(request(rich)).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_REDIRECT/) });
  });

  it("hides the invoice from strangers", async () => {
    currentViewer = stranger;
    await expect(request(rich)).rejects.toMatchObject({ digest: expect.stringMatching(/404/) });
  });

  it("does not leak invoices across projects", async () => {
    await expect(request({ projectId: rich.projectId, invoiceId: minimal.invoiceId })).rejects.toMatchObject({
      digest: expect.stringMatching(/404/),
    });
  });

  it("lets the project's client download it", async () => {
    currentViewer = client;
    await pngOf(await request(rich));
  });
});

describe("rendering", () => {
  it("renders a full invoice, privately and as a download", async () => {
    const response = await request(rich);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="acme-storefront-january-2026.png"');
    const { bytes, width } = await pngOf(response);
    expect(width).toBe(1080);
    dump("rich-en-light", bytes);
  });

  it("renders in dark mode and in Portuguese", async () => {
    theme = "dark";
    locale = "pt-BR";
    dump("rich-pt-dark", (await pngOf(await request(rich))).bytes);
  });

  it("renders a bare invoice, shorter than a full one", async () => {
    const full = await pngOf(await request(rich));
    const bare = await pngOf(await request(minimal));
    expect(bare.height).toBeLessThan(full.height);
    dump("minimal-en-light", bare.bytes);
  });
});
