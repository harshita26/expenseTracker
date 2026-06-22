import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { db } from "@/db/dexie";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { Trash2, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { useState } from "react";
import { ImportWizard } from "@/components/import/ImportWizard";
import { rollbackImport } from "@/lib/import/mapping";
import { toast } from "sonner";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import Center — My Money" },
      { name: "description", content: "Import historical Excel, CSV or pasted data into your dashboard." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const batches = useLiveQuery(() => db.import_batches.orderBy("createdAt").reverse().toArray(), []) ?? [];

  return (
    <>
      <PageHeader
        title="Import Center"
        description="Bring in historical data from Excel, CSV or pasted text"
        actions={
          <>
            <Button variant="outline" onClick={() => { setTextMode(true); setWizardOpen(true); }} className="gap-2"><FileText className="h-4 w-4" />Paste text</Button>
            <Button onClick={() => { setTextMode(false); setWizardOpen(true); }} className="gap-2"><Upload className="h-4 w-4" />Import file</Button>
          </>
        }
      />
      <main className="flex-1 space-y-4 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon={<FileSpreadsheet className="h-5 w-5" />} title="Excel, CSV & PDF" desc="Bank & credit-card statements supported. PDF text extraction parses HDFC, ICICI, SBI, Axis, Amex and similar layouts automatically." />
          <FeatureCard icon={<FileText className="h-5 w-5" />} title="Auto-categorize & dedupe" desc="Merchants like Swiggy, Amazon, Netflix get categorized via rules. Re-importing the same statement won't create duplicates." />
          <FeatureCard icon={<Upload className="h-5 w-5" />} title="Bank presets & dateless history" desc="Pick a preset for one-click column mapping. Month-wise summary files without dates stay as summaries — never doubled with transactions." />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card">
          <div className="border-b border-border/60 p-4 font-display text-lg font-semibold">Import history</div>
          <div className="divide-y divide-border/60">
            {batches.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No imports yet.</div>}
            {batches.map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{b.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleString()} · {b.importType} · {b.importedCount} imported · {b.skippedCount} skipped
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Delete this import and all its data?")) return;
                  await rollbackImport(b.id);
                  toast.success("Import rolled back");
                }}><Trash2 className="h-4 w-4 text-expense" /></Button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <ImportWizard open={wizardOpen} onOpenChange={setWizardOpen} pasteMode={textMode} />
    </>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</div>
      <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
