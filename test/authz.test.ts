/**
 * Authorization matrix: every Server Action is called as the owner, as a
 * client of another project, as a client of the same project, as a stranger
 * and anonymously, against a real (in-memory) database.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/session";

process.env.OWNER_EMAIL = "owner@example.com";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.GOOGLE_CLIENT_ID = "test";
process.env.GOOGLE_CLIENT_SECRET = "test";
process.env.TIMEZONE = "America/Sao_Paulo";

let currentViewer: Viewer | null = null;
vi.mock("@/lib/session", () => ({ getViewer: async () => currentViewer }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { openDatabase, migrateDatabase, setDbForTesting, getDb } = await import("@/db");
const schema = await import("@/db/schema");
const timer = await import("@/server/actions/timer");
const intervalActions = await import("@/server/actions/intervals");
const projectActions = await import("@/server/actions/projects");
const invoiceActions = await import("@/server/actions/invoices");
const importActions = await import("@/server/actions/import");
const gitlabActions = await import("@/server/actions/gitlab");
const aiActions = await import("@/server/actions/ai");
const { requireProjectAccess } = await import("@/lib/authz");

const owner: Viewer = { id: "u-owner", email: "owner@example.com", name: "Owner", image: null, isOwner: true };
const clientA: Viewer = { id: "u-client-a", email: "client-a@example.com", name: "Client A", image: null, isOwner: false };
const stranger: Viewer = { id: "u-stranger", email: "stranger@example.com", name: "Stranger", image: null, isOwner: false };

const HOUR = 3_600_000;
let projectA: string;
let projectB: string;
let intervalA: string;
let invoiceA: string;

/** Next.js `notFound()` / `redirect()` errors carry these digests. */
async function expectDenied(promise: Promise<unknown>, kind: "notFound" | "redirect" = "notFound") {
  const error = await promise.then(
    () => null,
    (e: unknown) => e as { digest?: string },
  );
  expect(error, "expected the call to be rejected").not.toBeNull();
  expect(error?.digest).toMatch(kind === "notFound" ? /404/ : /NEXT_REDIRECT/);
}

beforeAll(() => {
  const db = openDatabase(":memory:");
  migrateDatabase(db);
  setDbForTesting(db);

  const [a, b] = db
    .insert(schema.projects)
    .values([
      { name: "Project A", hourlyRate: 10000 },
      { name: "Project B", hourlyRate: 20000 },
    ])
    .returning({ id: schema.projects.id })
    .all();
  projectA = a.id;
  projectB = b.id;
  db.insert(schema.projectMembers).values({ projectId: projectA, email: clientA.email }).run();

  const start = Date.UTC(2026, 0, 5, 12);
  const [interval] = db
    .insert(schema.intervals)
    .values([
      { projectId: projectA, startedAt: start, endedAt: start + HOUR, rate: 10000 },
      { projectId: projectA, startedAt: start + 30 * 24 * HOUR, endedAt: start + 31 * 24 * HOUR - 22 * HOUR, rate: 10000 },
    ])
    .returning({ id: schema.intervals.id })
    .all();
  const [invoice] = db
    .insert(schema.invoices)
    .values({ projectId: projectA, date: "2026-01-10", name: "January", durationMs: HOUR, subtotal: 10000, extrasTotal: 0, total: 10000 })
    .returning({ id: schema.invoices.id })
    .all();
  intervalA = interval.id;
  invoiceA = invoice.id;
});

beforeEach(() => {
  currentViewer = null;
});

/** Every mutation, bound to project A. */
const mutations = (): [string, () => Promise<unknown>][] => [
  ["startTimer", () => timer.startTimer(projectA)],
  ["stopTimer", () => timer.stopTimer()],
  ["createInterval", () => intervalActions.createInterval({ projectId: projectA, start: "2026-02-20T10:00", duration: "1:00", rate: "100" })],
  ["updateInterval", () => intervalActions.updateInterval(intervalA, { projectId: projectA, start: "2026-02-20T10:00", duration: "1:00", rate: "100" })],
  ["deleteInterval", () => intervalActions.deleteInterval(projectA, intervalA)],
  ["updateProject", () => projectActions.updateProject(projectA, { name: "Hacked", currency: "USD", hourlyRate: "1" })],
  ["setEstimatedInvoiceDate", () => projectActions.setEstimatedInvoiceDate(projectA, "2026-12-31")],
  ["uploadLogo", () => projectActions.uploadLogo(projectA, new FormData())],
  ["removeLogo", () => projectActions.removeLogo(projectA)],
  ["setProjectArchived", () => projectActions.setProjectArchived(projectA, true)],
  ["deleteProject", () => projectActions.deleteProject(projectA, "Project A")],
  ["addMember", () => projectActions.addMember(projectA, "evil@example.com")],
  ["removeMember", () => projectActions.removeMember(projectA, "any")],
  ["addRepository", () => projectActions.addRepository(projectA, "group/repo")],
  ["removeRepository", () => projectActions.removeRepository(projectA, "any")],
  ["previewInvoice", () => invoiceActions.previewInvoice(projectA, "2026-02-01", [])],
  ["createInvoice", () => invoiceActions.createInvoice({ projectId: projectA, date: "2026-02-01", name: "x", items: [] })],
  ["deleteInvoice", () => invoiceActions.deleteInvoice(projectA, invoiceA)],
  ["saveInvoiceSummary", () => invoiceActions.saveInvoiceSummary(projectA, invoiceA, { scope: "overall", content: "pwned" })],
  ["importData", () => importActions.importData(projectA, { intervals: [], invoices: [] })],
  ["syncCommits", () => gitlabActions.syncCommits(projectA)],
  ["generateInvoiceSummaries", () => aiActions.generateInvoiceSummaries(projectA, invoiceA)],
  ["createProject", () => projectActions.createProject({ name: "New", currency: "BRL", hourlyRate: "1" })],
];

describe("anonymous visitors", () => {
  it.each(mutations())("cannot call %s", async (_name, call) => {
    await expectDenied(call(), "redirect");
  });
});

describe("strangers (signed in, not invited)", () => {
  it.each(mutations())("cannot call %s", async (_name, call) => {
    currentViewer = stranger;
    await expectDenied(call());
  });

  it("cannot read any project", async () => {
    currentViewer = stranger;
    await expectDenied(requireProjectAccess(projectA));
    await expectDenied(requireProjectAccess(projectB));
  });
});

describe("clients", () => {
  it.each(mutations())("cannot call %s, even on their own project", async (_name, call) => {
    currentViewer = clientA;
    await expectDenied(call());
  });

  it("can read their project as a client, but not other projects", async () => {
    currentViewer = clientA;
    await expect(requireProjectAccess(projectA)).resolves.toMatchObject({ role: "client" });
    await expectDenied(requireProjectAccess(projectB));
  });

  it("nothing was changed by the rejected calls", () => {
    const project = getDb().select().from(schema.projects).all().find((p) => p.id === projectA)!;
    expect(project.name).toBe("Project A");
    expect(project.estimatedInvoiceDate).toBeNull();
    expect(getDb().select().from(schema.projectMembers).all()).toHaveLength(1);
    expect(getDb().select().from(schema.intervals).all()).toHaveLength(2);
  });
});

describe("owner business rules", () => {
  it("cannot edit or delete an invoiced interval", async () => {
    currentViewer = owner;
    await expect(intervalActions.deleteInterval(projectA, intervalA)).resolves.toEqual({ ok: false, error: "locked" });
  });

  it("cannot add time inside an invoiced period", async () => {
    currentViewer = owner;
    const result = await intervalActions.createInterval({ projectId: projectA, start: "2026-01-08T10:00", duration: "1:00", rate: "100" });
    expect(result).toEqual({ ok: false, error: "locked" });
  });

  it("rejects overlapping time", async () => {
    currentViewer = owner;
    const result = await intervalActions.createInterval({ projectId: projectB, start: "2026-02-04T09:30", duration: "1:00", rate: "100" });
    expect(result).toEqual({ ok: false, error: "overlap" });
  });

  it("creates an invoice that includes intervals started on the invoice date", async () => {
    currentViewer = owner;
    const result = await invoiceActions.createInvoice({ projectId: projectA, date: "2026-02-04", name: "February", items: [{ description: "Ops", amount: "50" }] });
    expect(result.ok).toBe(true);
    const invoice = getDb().select().from(schema.invoices).all().find((row) => row.name === "February")!;
    expect(invoice).toMatchObject({ durationMs: 2 * HOUR, subtotal: 20000, extrasTotal: 5000, total: 25000 });
  });

  it("only deletes the latest invoice", async () => {
    currentViewer = owner;
    await expect(invoiceActions.deleteInvoice(projectA, invoiceA)).resolves.toEqual({ ok: false, error: "invoiceNotLatest" });
  });

  it("only estimates invoice dates after the latest invoice", async () => {
    currentViewer = owner;
    await expect(projectActions.setEstimatedInvoiceDate(projectA, "2026-01-10")).resolves.toEqual({
      ok: false,
      error: "invoiceDateNotAfterPrevious",
    });
    await expect(projectActions.setEstimatedInvoiceDate(projectA, "not-a-date")).resolves.toEqual({ ok: false, error: "invalidInput" });
  });

  it("never invites the owner as a client", async () => {
    currentViewer = owner;
    await expect(projectActions.addMember(projectA, "OWNER@example.com")).resolves.toEqual({ ok: false, error: "memberIsOwner" });
  });

  it("rejects SVG logos", async () => {
    currentViewer = owner;
    const form = new FormData();
    form.set("logo", new File(['<svg onload="alert(1)"/>'], "logo.svg", { type: "image/svg+xml" }));
    await expect(projectActions.uploadLogo(projectA, form)).resolves.toEqual({ ok: false, error: "invalidLogo" });
  });

  it("keeps a single running timer across projects", async () => {
    currentViewer = owner;
    expect((await timer.startTimer(projectB)).ok).toBe(true);
    expect((await timer.startTimer(projectA)).ok).toBe(true);
    const running = getDb().select().from(schema.intervals).all().filter((row) => row.endedAt === null);
    expect(running).toHaveLength(1);
    expect(running[0].projectId).toBe(projectA);
    expect((await timer.stopTimer()).ok).toBe(true);
  });
});
