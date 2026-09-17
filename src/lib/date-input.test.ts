import { describe, expect, it } from "vitest";
import {
  datePlaceholder,
  formatDateInput,
  formatTimeInput,
  maskDateInput,
  parseDateInput,
  parseTimeInput,
  uses12HourClock,
} from "./date-input";
import { centsToInput } from "./money";

describe("date inputs follow the app locale", () => {
  it("formats day/month/year for pt-BR and month/day/year for en", () => {
    expect(formatDateInput("2026-09-16", "pt-BR")).toBe("16/09/2026");
    expect(formatDateInput("2026-09-16", "en")).toBe("09/16/2026");
  });

  it("parses in the locale's order", () => {
    expect(parseDateInput("16/09/2026", "pt-BR")).toBe("2026-09-16");
    expect(parseDateInput("09/16/2026", "en")).toBe("2026-09-16");
    expect(parseDateInput("5/9/2026", "pt-BR")).toBe("2026-09-05");
    expect(parseDateInput("09/16/2026", "pt-BR")).toBeNull(); // month 16
    expect(parseDateInput("31/02/2026", "pt-BR")).toBeNull();
    expect(parseDateInput("16/09/26", "pt-BR")).toBeNull();
  });

  it("inserts separators while typing", () => {
    expect(maskDateInput("16", "pt-BR")).toBe("16");
    expect(maskDateInput("16/", "pt-BR")).toBe("16/");
    expect(maskDateInput("1609", "pt-BR")).toBe("16/09");
    expect(maskDateInput("16092026", "pt-BR")).toBe("16/09/2026");
    expect(maskDateInput("160920261", "pt-BR")).toBe("16/09/2026");
  });

  it("builds localized placeholders", () => {
    expect(datePlaceholder("pt-BR", { day: "dd", month: "mm", year: "aaaa" })).toBe("dd/mm/aaaa");
    expect(datePlaceholder("en", { day: "dd", month: "mm", year: "yyyy" })).toBe("mm/dd/yyyy");
  });
});

describe("time inputs follow the app locale", () => {
  it("uses a 24-hour clock for pt-BR and 12-hour for en", () => {
    expect(uses12HourClock("pt-BR")).toBe(false);
    expect(uses12HourClock("en")).toBe(true);
    expect(formatTimeInput("14:05", "pt-BR")).toBe("14:05");
    expect(formatTimeInput("14:05", "en")).toBe("2:05 PM");
    expect(formatTimeInput("00:30", "en")).toBe("12:30 AM");
  });

  it("parses 24-hour and AM/PM times", () => {
    expect(parseTimeInput("14:05")).toBe("14:05");
    expect(parseTimeInput("9:5")).toBeNull();
    expect(parseTimeInput("0905")).toBe("09:05");
    expect(parseTimeInput("2:05 PM")).toBe("14:05");
    expect(parseTimeInput("12:30 am")).toBe("00:30");
    expect(parseTimeInput("2pm")).toBe("14:00");
    expect(parseTimeInput("14h30")).toBe("14:30");
    expect(parseTimeInput("24:00")).toBeNull();
    expect(parseTimeInput("13:00 PM")).toBeNull();
  });
});

describe("decimal inputs follow the app locale", () => {
  it("uses a comma for pt-BR", () => {
    expect(centsToInput(12050, "pt-BR")).toBe("120,50");
    expect(centsToInput(12050, "en")).toBe("120.50");
    expect(centsToInput(123456789, "pt-BR")).toBe("1234567,89");
  });
});
