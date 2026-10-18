// Export CSV (séparateur « ; », BOM UTF-8 pour Excel, neutralisation des formules).

import type { Response } from 'express';

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Une cellule commençant par = + - @ serait interprétée comme formule par un tableur.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  return [columns.join(';'), ...rows.map((r) => columns.map((c) => cell(r[c])).join(';'))].join('\r\n');
}

export function sendCsv(res: Response, filename: string, columns: string[], rows: Record<string, unknown>[]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${toCsv(columns, rows)}`);
}
