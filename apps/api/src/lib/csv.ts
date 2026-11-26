/**
 * CSV for spreadsheet apps (Excel, Google Sheets, LibreOffice).
 * - CSV/formula injection: a cell starting with = + - @ (or tab/CR, which some apps strip first) is run as a
 *   formula when the file is opened. Such cells are prefixed with an apostrophe so they show as plain text.
 * - Quotes, commas and line breaks are quoted per RFC 4180.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows → CSV text with a UTF-8 BOM (so Excel shows Sinhala/Tamil names correctly) and CRLF line ends. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
