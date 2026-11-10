import { describe, expect, it } from "vitest";
import { estimateLines, splitSources, stripMarkdown, summaryPoints } from "./invoice-card";

describe("stripMarkdown", () => {
  it("removes emphasis, code, links and headings", () => {
    expect(stripMarkdown("## **Fixed** the `login` [flow](https://x.test)")).toBe("Fixed the login flow");
  });
});

describe("summaryPoints", () => {
  it("reads one point per list item", () => {
    expect(summaryPoints("- Built the **invoice** page\n- Fixed sync\n* Added tests")).toEqual([
      "Built the invoice page",
      "Fixed sync",
      "Added tests",
    ]);
  });

  it("reads numbered lists and paragraphs", () => {
    expect(summaryPoints("1. First\n2) Second\n\nA paragraph")).toEqual(["First", "Second", "A paragraph"]);
  });

  it("limits the number of points", () => {
    expect(summaryPoints("- a\n- b\n- c\n- d\n- e")).toEqual(["a", "b", "c"]);
    expect(summaryPoints("- a\n- b\n- c", 2)).toEqual(["a", "b"]);
  });

  it("is empty for blank content", () => {
    expect(summaryPoints("  \n\n- \n")).toEqual([]);
  });
});

describe("estimateLines", () => {
  it("is at least one line, even for empty text", () => {
    expect(estimateLines("", 30, 900, 2)).toBe(1);
  });

  it("grows with the text and is capped", () => {
    expect(estimateLines("short", 30, 900, 2)).toBe(1);
    expect(estimateLines("x".repeat(80), 30, 900, 3)).toBe(2);
    expect(estimateLines("x".repeat(5000), 30, 900, 2)).toBe(2);
  });
});

describe("splitSources", () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8];

  it("keeps everything when it fits", () => {
    expect(splitSources(rows.slice(0, 6), 6)).toEqual({ shown: [1, 2, 3, 4, 5, 6], rolledUp: [] });
  });

  it("rolls up the overflow, leaving room for the summary row", () => {
    expect(splitSources(rows, 6)).toEqual({ shown: [1, 2, 3, 4, 5], rolledUp: [6, 7, 8] });
  });
});
