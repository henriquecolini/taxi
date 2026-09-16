/**
 * Money helpers. Amounts are integer cents (hundredths of the currency unit)
 * to avoid floating point drift. Currencies are display-only: no conversion.
 */

export const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY"] as const;

export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Cents as a plain decimal string for form inputs, e.g. `8550` → `85.50`. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parses a user-entered amount into cents.
 * Accepts `85`, `85.5`, `85,50`, `1.234,56`, `1,234.56` and currency symbols.
 */
export function parseMoney(input: string): number | null {
  let value = input.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(value)) return null;

  const hasDot = value.includes(".");
  const hasComma = value.includes(",");

  if (hasDot && hasComma) {
    // Both present: the last one is the decimal separator.
    const decimal = value.lastIndexOf(".") > value.lastIndexOf(",") ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    value = value.split(thousands).join("").replace(decimal, ".");
  } else if (hasDot || hasComma) {
    const separator = hasDot ? "." : ",";
    const parts = value.split(separator);
    // Repeated separators, or one followed by exactly three digits, group thousands (`1.000`).
    const isThousands = parts.length > 2 || parts[1].length === 3;
    value = parts.join(isThousands ? "" : ".");
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}
