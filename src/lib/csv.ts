/// Minimal RFC-4180 CSV writer (M26 exports): quotes cells containing
/// separators/quotes/newlines, CRLF line endings.
export function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Array<Array<unknown>>): string {
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
