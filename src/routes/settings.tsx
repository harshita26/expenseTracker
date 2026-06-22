import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/db/dexie";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { downloadFile, exportAllJSON, importBackupJSON, toCSV } from "@/lib/backup";
import { clearDemoData, wipeAll } from "@/lib/seed";
import { toast } from "sonner";
import { Download, Upload, Sparkles, Shield, Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — My Money" }, { name: "description", content: "Backup, export and privacy settings." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useLiveQuery(() => db.app_settings.get("app"), []);

  async function update<K extends keyof NonNullable<typeof settings>>(k: K, v: NonNullable<typeof settings>[K]) {
    if (!settings) return;
    await db.app_settings.put({ ...settings, [k]: v });
  }

  async function exportTxnsCsv() {
    const rows = await db.transactions.toArray();
    downloadFile(`my-money-transactions-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows as unknown as Record<string, unknown>[]), "text/csv");
  }
  async function exportSummariesCsv() {
    const rows = await db.monthly_summaries.toArray();
    downloadFile(`my-money-monthly-summaries-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows as unknown as Record<string, unknown>[]), "text/csv");
  }
  async function exportJson() {
    const json = await exportAllJSON();
    downloadFile(`my-money-backup-${new Date().toISOString().slice(0, 10)}.json`, json, "application/json");
  }
  async function onRestore(f: File) {
    if (!confirm("This will replace ALL existing data. Continue?")) return;
    const text = await f.text();
    try {
      await importBackupJSON(text);
      toast.success("Backup restored");
    } catch (e) {
      console.error(e);
      toast.error("Failed to restore backup");
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Backup, privacy and preferences" />
      <main className="flex-1 grid gap-6 p-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Preferences</h2>
          <div className="mt-3 grid gap-3">
            <div>
              <Label>Currency</Label>
              <Input value={settings?.currency ?? "INR"} onChange={(e) => update("currency", e.target.value)} />
            </div>
            <div>
              <Label>Default account</Label>
              <Input value={settings?.defaultAccount ?? ""} onChange={(e) => update("defaultAccount", e.target.value)} placeholder="HDFC Bank" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-savings" />
            <h2 className="font-display text-lg font-semibold">Privacy</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Your data stays on your device unless you choose to export or sync it. There is no server. Clearing browser storage will erase all data — back up regularly.
          </p>
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            App lock (PIN) is coming soon. For now use your device lock.
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Export</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" onClick={exportTxnsCsv} className="gap-2"><Download className="h-4 w-4" /> Transactions CSV</Button>
            <Button variant="outline" onClick={exportSummariesCsv} className="gap-2"><Download className="h-4 w-4" /> Summaries CSV</Button>
            <Button onClick={exportJson} className="gap-2"><Download className="h-4 w-4" /> Full backup (JSON)</Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Restore backup</h2>
          <p className="mt-1 text-sm text-muted-foreground">Replace all data from a previously exported JSON file.</p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> Choose JSON
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestore(f); }} />
          </label>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Demo data</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => { await clearDemoData(); toast.success("Demo data cleared"); }} className="gap-2">
              <Sparkles className="h-4 w-4" /> Clear demo data
            </Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirm("Delete ALL transactions, summaries and imports? This cannot be undone.")) return;
              await wipeAll();
              toast.success("All data deleted");
            }} className="gap-2"><Trash2 className="h-4 w-4" /> Erase all data</Button>
          </div>
        </section>
      </main>
    </>
  );
}
