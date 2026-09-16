import { describe, expect, it } from "vitest";
import { parseMoney } from "./money";
import {
  addIsoDays,
  formatClock,
  formatDuration,
  fromDateTimeLocal,
  isIsoDate,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  parseDuration,
  weekStartOf,
} from "./time";

describe("time helpers", () => {
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-02-01")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addIsoDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addIsoDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds the Monday of a week", () => {
    expect(weekStartOf("2026-01-11")).toBe("2026-01-05"); // Sunday
    expect(weekStartOf("2026-01-12")).toBe("2026-01-12"); // Monday
  });

  it("parses durations", () => {
    expect(parseDuration("1:30")).toBe(90 * MS_PER_MINUTE);
    expect(parseDuration("2h")).toBe(2 * MS_PER_HOUR);
    expect(parseDuration("1h 15m")).toBe(75 * MS_PER_MINUTE);
    expect(parseDuration("45m")).toBe(45 * MS_PER_MINUTE);
    expect(parseDuration("1,5")).toBe(1.5 * MS_PER_HOUR);
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });

  it("parses datetime-local values in a timezone", () => {
    expect(fromDateTimeLocal("2026-01-15T21:00", "America/Sao_Paulo")).toBe(Date.UTC(2026, 0, 16, 0, 0));
    expect(fromDateTimeLocal("2026-02-31T10:00", "UTC")).toBeNull();
  });

  it("formats durations", () => {
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatDuration(3_725_000)).toBe("1h 02m");
  });
});

describe("parseMoney", () => {
  it.each([
    ["85", 8500],
    ["85.5", 8550],
    ["85,50", 8550],
    ["R$ 1.234,56", 123456],
    ["$1,234.56", 123456],
    ["1.000", 100000],
    ["0", 0],
  ])("parses %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it("rejects empty input", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});
