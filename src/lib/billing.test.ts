import { describe, expect, it } from "vitest";
import {
  estimateInvoice,
  isDateInPeriod,
  isLocked,
  periodBounds,
  periodFor,
  rangesOverlap,
  summarize,
  validateInvoiceDate,
} from "./billing";
import { MS_PER_HOUR, toIsoDate, zonedInstant } from "./time";

const TZ = "America/Sao_Paulo"; // UTC-3, no DST since 2019

const at = (date: string, time = "00:00:00") => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  return zonedInstant({ year, month, day, hour, minute, second }, TZ);
};

describe("invoice periods (start date, inclusive invoice date)", () => {
  const period = periodFor("2025-12-15", "2026-01-15");
  const { start, end } = periodBounds(period, TZ);
  const inPeriod = (startedAt: number) =>
    (start === null || startedAt >= start) && startedAt < end;

  it("includes an interval starting at 23:59:59 on the invoice date", () => {
    const startedAt = at("2026-01-15", "23:59:59");
    expect(inPeriod(startedAt)).toBe(true);
    expect(isDateInPeriod(toIsoDate(startedAt, TZ), period)).toBe(true);
  });

  it("includes an interval that starts on the invoice date and crosses midnight", () => {
    const interval = { startedAt: at("2026-01-15", "23:30:00"), endedAt: at("2026-01-16", "01:00:00"), rate: 10000 };
    expect(inPeriod(interval.startedAt)).toBe(true);
    const summary = summarize([interval], { timeZone: TZ, now: 0 });
    expect(summary.durationMs).toBe(1.5 * MS_PER_HOUR);
    expect(summary.days.map((d) => d.date)).toEqual(["2026-01-15"]);
  });

  it("excludes an interval starting at 00:00 the day after the invoice date", () => {
    const startedAt = at("2026-01-16", "00:00:00");
    expect(inPeriod(startedAt)).toBe(false);
    expect(isDateInPeriod(toIsoDate(startedAt, TZ), period)).toBe(false);
  });

  it("excludes intervals on the previous invoice date and includes the day after", () => {
    expect(inPeriod(at("2025-12-15", "23:59:59"))).toBe(false);
    expect(inPeriod(at("2025-12-16", "00:00:00"))).toBe(true);
  });

  it("uses the app timezone, not UTC, to find the start date", () => {
    // 01:30 UTC on Jan 16 is still 22:30 on Jan 15 in São Paulo.
    const startedAt = Date.UTC(2026, 0, 16, 1, 30);
    expect(toIsoDate(startedAt, TZ)).toBe("2026-01-15");
    expect(inPeriod(startedAt)).toBe(true);
    expect(toIsoDate(startedAt, "UTC")).toBe("2026-01-16");
  });

  it("has no lower bound for the first invoice", () => {
    const first = periodBounds(periodFor(null, "2026-01-15"), TZ);
    expect(first.start).toBeNull();
  });
});

describe("isLocked", () => {
  it("locks intervals starting on or before the latest invoice date", () => {
    expect(isLocked(at("2026-01-15", "23:59:59"), "2026-01-15", TZ)).toBe(true);
    expect(isLocked(at("2026-01-16", "00:00:00"), "2026-01-15", TZ)).toBe(false);
    expect(isLocked(at("2026-01-01"), null, TZ)).toBe(false);
  });
});

describe("summarize", () => {
  it("computes a weighted sum by rate, weekly and daily breakdowns", () => {
    const summary = summarize(
      [
        // Monday 2026-01-05, 2h at 100.00
        { startedAt: at("2026-01-05", "09:00:00"), endedAt: at("2026-01-05", "11:00:00"), rate: 10000 },
        // Sunday 2026-01-11, 30min at 120.00 — same week
        { startedAt: at("2026-01-11", "10:00:00"), endedAt: at("2026-01-11", "10:30:00"), rate: 12000 },
        // Monday 2026-01-12, 1h at 100.00 — next week
        { startedAt: at("2026-01-12", "09:00:00"), endedAt: at("2026-01-12", "10:00:00"), rate: 10000 },
      ],
      { timeZone: TZ, now: 0, extras: [{ description: "Ops", amount: 5000 }] },
    );

    expect(summary.durationMs).toBe(3.5 * MS_PER_HOUR);
    expect(summary.byRate).toEqual([
      { rate: 12000, durationMs: 0.5 * MS_PER_HOUR, amount: 6000 },
      { rate: 10000, durationMs: 3 * MS_PER_HOUR, amount: 30000 },
    ]);
    expect(summary.subtotal).toBe(36000);
    expect(summary.extrasTotal).toBe(5000);
    expect(summary.total).toBe(41000);
    expect(summary.weeks.map((w) => [w.weekStart, w.amount])).toEqual([
      ["2026-01-05", 26000],
      ["2026-01-12", 10000],
    ]);
    expect(summary.days).toHaveLength(3);
  });

  it("uses `now` for a running interval", () => {
    const startedAt = at("2026-01-05", "09:00:00");
    const summary = summarize([{ startedAt, endedAt: null, rate: 6000 }], {
      timeZone: TZ,
      now: startedAt + 20 * 60_000,
    });
    expect(summary.subtotal).toBe(2000);
  });

  it("rounds per rate group so the line items add up to the subtotal", () => {
    const startedAt = at("2026-01-05", "09:00:00");
    const oneMinute = { startedAt, endedAt: startedAt + 60_000, rate: 10000 }; // 166.67 cents
    const summary = summarize([oneMinute, { ...oneMinute }, { ...oneMinute }], { timeZone: TZ, now: 0 });
    expect(summary.subtotal).toBe(500);
    expect(summary.byRate.reduce((sum, r) => sum + r.amount, 0)).toBe(summary.subtotal);
  });
});

describe("validateInvoiceDate", () => {
  const base = { latestInvoiceDate: "2026-01-15", today: "2026-02-20", runningStartedAt: null, timeZone: TZ };

  it("accepts a date after the previous invoice up to today", () => {
    expect(validateInvoiceDate({ ...base, date: "2026-02-15" })).toBeNull();
    expect(validateInvoiceDate({ ...base, date: "2026-02-20" })).toBeNull();
  });

  it("rejects dates on or before the previous invoice", () => {
    expect(validateInvoiceDate({ ...base, date: "2026-01-15" })).toBe("invoiceDateNotAfterPrevious");
  });

  it("rejects future dates", () => {
    expect(validateInvoiceDate({ ...base, date: "2026-02-21" })).toBe("invoiceDateInFuture");
  });

  it("rejects when a timer that started on or before the date is running", () => {
    expect(
      validateInvoiceDate({ ...base, date: "2026-02-15", runningStartedAt: at("2026-02-15", "23:00:00") }),
    ).toBe("invoiceRunningTimer");
    expect(
      validateInvoiceDate({ ...base, date: "2026-02-15", runningStartedAt: at("2026-02-16", "08:00:00") }),
    ).toBeNull();
  });
});

describe("rangesOverlap", () => {
  it("treats ranges as half-open", () => {
    expect(rangesOverlap({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(rangesOverlap({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true);
  });
});

describe("estimateInvoice", () => {
  const base = { latestInvoiceDate: "2026-09-01", firstWorkedDate: "2026-09-02", chosenDate: null };

  it("ends 30 days after the latest invoice by default", () => {
    // 10 of 30 days elapsed (Sep 2–11): the amount so far is tripled.
    expect(estimateInvoice({ ...base, today: "2026-09-11", subtotal: 100_000 })).toEqual({
      date: "2026-10-01",
      custom: false,
      amount: 300_000,
    });
  });

  it("uses the owner's date while it is after the latest invoice", () => {
    expect(estimateInvoice({ ...base, today: "2026-09-11", chosenDate: "2026-09-20", subtotal: 100_000 })).toEqual({
      date: "2026-09-20",
      custom: true,
      amount: 190_000,
    });
    expect(estimateInvoice({ ...base, today: "2026-09-11", chosenDate: "2026-09-01", subtotal: 100_000 })).toMatchObject({
      date: "2026-10-01",
      custom: false,
    });
  });

  it("keeps the amount so far once the date has passed", () => {
    expect(estimateInvoice({ ...base, today: "2026-10-05", subtotal: 100_000 }).amount).toBe(100_000);
  });

  it("starts on the first worked day before the first invoice", () => {
    expect(
      estimateInvoice({ latestInvoiceDate: null, firstWorkedDate: "2026-09-10", chosenDate: null, today: "2026-09-12", subtotal: 30_000 }),
    ).toEqual({ date: "2026-10-09", custom: false, amount: 300_000 });
    expect(
      estimateInvoice({ latestInvoiceDate: null, firstWorkedDate: null, chosenDate: null, today: "2026-09-12", subtotal: 0 }),
    ).toEqual({ date: "2026-10-11", custom: false, amount: 0 });
  });
});
