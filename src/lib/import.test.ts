import { describe, expect, it } from "vitest";
import { detectDateFormat, parseCsv, parseDateTime, parseInvoiceRows, parseTimeRows } from "./import";

const TZ = "America/Sao_Paulo";

describe("CSV import", () => {
  it("parses a Brazilian Google Sheets export", () => {
    const table = parseCsv(
      [
        "Início,Fim,Horas,Taxa",
        '15/01/2026 23:30:00,16/01/2026 01:00:00,"1,5","R$ 100,00"',
        "16/01/2026 09:00:00,16/01/2026 10:00:00,1,\"R$ 120,00\"",
        "16/01/2026 09:30:00,16/01/2026 09:45:00,0.25,100",
        "17/01/2026 09:00:00,,,100",
        "31/02/2026 09:00:00,31/02/2026 10:00:00,1,100",
      ].join("\n"),
    );
    const format = detectDateFormat(table.rows.map((row) => row[0]));
    expect(format).toBe("dmy");

    const { rows, issues } = parseTimeRows(table, { start: 0, end: 1, rate: 3 }, { format, timeZone: TZ, defaultRate: 0 });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ startedAt: Date.UTC(2026, 0, 16, 2, 30), rate: 10000 });
    expect(rows[1].rate).toBe(12000);
    expect(issues).toEqual([
      { line: 4, key: "overlap" },
      { line: 5, key: "missingEnd" },
      { line: 6, key: "invalidDate" },
    ]);
  });

  it("parses ISO timestamps", () => {
    expect(parseDateTime("2026-01-15T10:00", "iso", "UTC")).toBe(Date.UTC(2026, 0, 15, 10));
    expect(parseDateTime("2026-01-15 10:00:30", "iso", "UTC")).toBe(Date.UTC(2026, 0, 15, 10, 0, 30));
  });

  it("parses invoice dates and rejects duplicates", () => {
    const table = parseCsv("Data,Descrição\n15/02/2026,Fevereiro\n15/01/2026,Janeiro\n15/01/2026,Dup\n");
    const { rows, issues } = parseInvoiceRows(table, { date: 0, name: 1 }, { format: "dmy" });
    expect(rows.map((row) => row.date)).toEqual(["2026-01-15", "2026-02-15"]);
    expect(issues).toEqual([{ line: 4, key: "duplicateDate" }]);
  });
});
