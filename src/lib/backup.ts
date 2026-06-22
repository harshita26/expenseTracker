import { db } from "@/db/dexie";

export async function exportAllJSON(): Promise<string> {
  const [transactions, monthly_summaries, monthly_category_summaries, accounts, categories, import_batches, app_settings] =
    await Promise.all([
      db.transactions.toArray(),
      db.monthly_summaries.toArray(),
      db.monthly_category_summaries.toArray(),
      db.accounts.toArray(),
      db.categories.toArray(),
      db.import_batches.toArray(),
      db.app_settings.toArray(),
    ]);
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { transactions, monthly_summaries, monthly_category_summaries, accounts, categories, import_batches, app_settings },
  }, null, 2);
}

export async function importBackupJSON(text: string) {
  const parsed = JSON.parse(text);
  const d = parsed.data;
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
    if (d.transactions) await db.transactions.bulkAdd(d.transactions);
    if (d.monthly_summaries) await db.monthly_summaries.bulkAdd(d.monthly_summaries);
    if (d.monthly_category_summaries) await db.monthly_category_summaries.bulkAdd(d.monthly_category_summaries);
    if (d.accounts) await db.accounts.bulkAdd(d.accounts);
    if (d.categories) await db.categories.bulkAdd(d.categories);
    if (d.import_batches) await db.import_batches.bulkAdd(d.import_batches);
    if (d.app_settings) await db.app_settings.bulkAdd(d.app_settings);
  });
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadFile(name: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
