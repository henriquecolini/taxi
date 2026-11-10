/**
 * Pure helpers for the shareable invoice card (a PNG with only the essentials).
 * The card is rendered on a canvas of fixed size, so text that may wrap has to
 * be measured up front: these helpers keep that logic testable.
 */

/** Most source rows shown on the card; extra rows are rolled up into one. */
export const MAX_SOURCE_ROWS = 6;
/** Most summary points shown on the card. */
export const MAX_SUMMARY_POINTS = 3;

/** Removes the markdown a summary may contain, leaving readable plain text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // bold
    .replace(/(\*|_)(.+?)\1/g, "$2") // italic
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/^#{1,6}\s+/, "") // headings
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The points of a markdown summary as plain text: one per list item, or one
 * per paragraph when the text is not a list. Empty lines are skipped.
 */
export function summaryPoints(markdown: string, max = MAX_SUMMARY_POINTS): string[] {
  const points: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const item = trimmed.match(/^(?:[-*+•]|\d+[.)])(?:\s+(.*))?$/);
    const text = stripMarkdown(item ? (item[1] ?? "") : trimmed);
    if (text) points.push(text);
  }
  return points.slice(0, max);
}

/**
 * Conservative number of lines `text` takes when wrapped into `widthPx`, capped
 * at `maxLines`. Overestimating only leaves some spare room; underestimating
 * would overlap the next block, so average glyph width is deliberately wide.
 */
export function estimateLines(text: string, fontSizePx: number, widthPx: number, maxLines: number): number {
  const AVERAGE_GLYPH_EM = 0.58;
  const charsPerLine = Math.max(1, Math.floor(widthPx / (fontSizePx * AVERAGE_GLYPH_EM)));
  const lines = text.split(/\r?\n/).reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / charsPerLine)), 0);
  return Math.min(maxLines, Math.max(1, lines));
}

/**
 * Splits rows into the ones shown and the ones rolled up into a single
 * "other items" row, so that at most `max` rows are displayed.
 */
export function splitSources<T>(rows: T[], max = MAX_SOURCE_ROWS): { shown: T[]; rolledUp: T[] } {
  if (rows.length <= max) return { shown: rows, rolledUp: [] };
  return { shown: rows.slice(0, max - 1), rolledUp: rows.slice(max - 1) };
}
