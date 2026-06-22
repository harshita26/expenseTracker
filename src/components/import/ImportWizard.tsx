import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { parseUploadedFile, parsePastedText, type ParsedSheet } from "@/lib/import/parsing";
import { detectImportType, type DetectResult } from "@/lib/import/detect";
import {
  commitImport, mapRowsToTransactions, mapRowsToMonthlySummaries, mapRowsToMonthlyCategorySummaries,
} from "@/lib/import/mapping";
import { BANK_PRESETS, applyPreset, matchPreset, type BankPreset } from "@/lib/import/presets";
import { getCompiledRules } from "@/lib/import/rules";
import { db } from "@/db/dexie";
import type { ImportType } from "@/types";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { Upload, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pasteMode?: boolean;
}

type Step = "source" | "preview" | "detect" | "map" | "rules" | "confirm";

const NONE = "__none__";
const NO_PRESET = "__none__";

export function ImportWizard({ open, onOpenChange, pasteMode }: Props) {
  const [step, setStep] = useState<Step>("source");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [pasted, setPasted] = useState("");
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [type, setType] = useState<ImportType>("detailed_transactions");
  const [fieldMap, setFieldMap] = useState<NonNullable<DetectResult["fieldMap"]>>({});
  const [fallbackYear, setFallbackYear] = useState<number>(new Date().getFullYear());
  const [dateRule, setDateRule] = useState<"summary" | "first_of_month" | "last_of_month">("summary");
  const [presetId, setPresetId] = useState<string>(NO_PRESET);
  const [defaultAccount, setDefaultAccount] = useState<string>("");
  const [applyRules, setApplyRules] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [parsing, setParsing] = useState(false);

  const sheet = sheets[sheetIdx];
  const currentPreset = useMemo<BankPreset | null>(
    () => BANK_PRESETS.find((p) => p.id === presetId) ?? null,
    [presetId],
  );

  useEffect(() => {
    if (!open) {
      setStep("source"); setFileName(""); setSheets([]); setSheetIdx(0);
      setPasted(""); setDetect(null); setFieldMap({}); setType("detailed_transactions");
      setPresetId(NO_PRESET); setDefaultAccount(""); setApplyRules(true); setDedupe(true);
    }
  }, [open]);

  async function handleFile(f: File) {
    try {
      setParsing(true);
      const parsed = await parseUploadedFile(f);
      setSheets(parsed.sheets);
      setSheetIdx(0);
      setFileName(f.name);
      setStep("preview");
    } catch (e) {
      toast.error("Failed to parse file");
      console.error(e);
    } finally {
      setParsing(false);
    }
  }

  function handlePasted() {
    if (!pasted.trim()) return toast.error("Paste some text first");
    const parsed = parsePastedText(pasted);
    const headers = parsed.rows.length ? Object.keys(parsed.rows[0]).filter((h) => h !== "raw") : [];
    setSheets([{ name: "Pasted", headers, rows: parsed.rows.map((r) => { const { raw, ...rest } = r; return rest; }), rawRows: [] }]);
    setFileName("Pasted text");
    setSheetIdx(0);
    setStep("preview");
  }

  function runDetect() {
    if (!sheet) return;
    const matched = matchPreset(sheet.headers, fileName);
    if (matched) {
      const r = applyPreset(matched, sheet.headers);
      setDetect(r);
      setType(r.type);
      setFieldMap(r.fieldMap ?? {});
      setPresetId(matched.id);
      if (matched.defaultAccount) setDefaultAccount(matched.defaultAccount);
    } else {
      const r = detectImportType(sheet.headers);
      setDetect(r);
      setType(r.type);
      setFieldMap(r.fieldMap ?? {});
    }
    setStep("detect");
  }

  function pickPreset(id: string) {
    setPresetId(id);
    if (id === NO_PRESET || !sheet) return;
    const preset = BANK_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const r = applyPreset(preset, sheet.headers);
    setType(r.type);
    setFieldMap(r.fieldMap ?? {});
    if (preset.defaultAccount) setDefaultAccount(preset.defaultAccount);
    setDetect({ ...r, notes: `Applied preset: ${preset.name}` });
  }

  function next() {
    if (step === "preview") runDetect();
    else if (step === "detect") setStep("map");
    else if (step === "map") setStep("rules");
    else if (step === "rules") setStep("confirm");
  }
  function back() {
    if (step === "preview") setStep("source");
    else if (step === "detect") setStep("preview");
    else if (step === "map") setStep("detect");
    else if (step === "rules") setStep("map");
    else if (step === "confirm") setStep("rules");
  }

  async function commit() {
    if (!sheet) return;
    const batchId = uuid();
    const compiled = applyRules ? await getCompiledRules() : [];
    let existingHashes = new Set<string>();
    if (dedupe && type === "detailed_transactions") {
      const all = await db.transactions.toArray();
      existingHashes = new Set(all.map((t) => t.dedupeHash).filter(Boolean) as string[]);
    }
    let importedCount = 0, skippedCount = 0, duplicates = 0;
    const opts = {
      fieldMap, fallbackYear, dateRule,
      defaultAccount: defaultAccount || undefined,
      rules: compiled,
      dedupe,
      existingHashes,
    };

    if (type === "detailed_transactions") {
      const res = mapRowsToTransactions(sheet.rows, opts, batchId);
      importedCount = res.rows.length; skippedCount = res.skipped.length;
      duplicates = res.duplicates ?? 0;
      await commitImport({
        fileName, importType: type, rowCount: sheet.rows.length, importedCount, skippedCount,
        transactions: res.rows,
        detectedFormat: currentPreset?.name,
      });
    } else if (type === "monthly_summary") {
      const res = mapRowsToMonthlySummaries(sheet.rows, opts, batchId);
      importedCount = res.rows.length; skippedCount = res.skipped.length;
      await commitImport({
        fileName, importType: type, rowCount: sheet.rows.length, importedCount, skippedCount,
        summaries: res.rows,
      });
    } else if (type === "monthly_category_summary") {
      const res = mapRowsToMonthlyCategorySummaries(sheet.rows, opts, batchId);
      importedCount = res.categoryRows.length + res.summaryRows.length; skippedCount = res.skipped.length;
      await commitImport({
        fileName, importType: type, rowCount: sheet.rows.length, importedCount, skippedCount,
        summaries: res.summaryRows, categorySummaries: res.categoryRows,
      });
    } else {
      const res = mapRowsToMonthlySummaries(sheet.rows, opts, batchId);
      importedCount = res.rows.length; skippedCount = res.skipped.length;
      await commitImport({
        fileName, importType: "manual_mapping", rowCount: sheet.rows.length, importedCount, skippedCount,
        summaries: res.rows,
      });
    }
    const dupNote = duplicates > 0 ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : "";
    toast.success(`Imported ${importedCount} row${importedCount === 1 ? "" : "s"} · ${skippedCount - duplicates} other skipped${dupNote}`);
    onOpenChange(false);
  }

  const previewRows = useMemo(() => sheet?.rows.slice(0, 10) ?? [], [sheet]);
  const headers = sheet?.headers ?? [];
  const headerOptions = [NONE, ...headers];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Wizard — {labelForStep(step)}</DialogTitle>
        </DialogHeader>

        {step === "source" && (
          <div className="space-y-4">
            {!pasteMode && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-10 hover:bg-muted/50">
                {parsing
                  ? <FileText className="h-8 w-8 animate-pulse text-muted-foreground" />
                  : <Upload className="h-8 w-8 text-muted-foreground" />}
                <div className="text-sm">{parsing ? "Parsing file…" : "Click to select Excel, CSV or PDF statement"}</div>
                <div className="text-xs text-muted-foreground">.xlsx · .xls · .csv · .pdf</div>
                <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]; if (f) handleFile(f);
                }} />
              </label>
            )}
            <div>
              <Label>Or paste rows directly</Label>
              <Textarea
                rows={8}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={"Jan 2026 Salary 54000 Expense 32000 Cashback 350 Interest 500\nFeb 2026 Salary 54000 Expense 30000 Cashback 280 Interest 510"}
              />
              <Button onClick={handlePasted} className="mt-2">Parse pasted text</Button>
            </div>
          </div>
        )}

        {step === "preview" && sheet && (
          <div className="space-y-3">
            {sheets.length > 1 && (
              <div className="flex items-center gap-2">
                <Label>Sheet</Label>
                <Select value={String(sheetIdx)} onValueChange={(v) => setSheetIdx(+v)}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((s, i) => <SelectItem key={s.name} value={String(i)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="overflow-auto rounded-lg border border-border/60">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>{headers.map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {headers.map((h) => <td key={h} className="px-2 py-1.5">{String(r[h] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground">{sheet.rows.length} total rows · showing first {previewRows.length}</div>
          </div>
        )}

        {step === "detect" && detect && (
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="text-sm font-medium text-primary">{describeType(detect.type)}</div>
              <div className="text-xs text-muted-foreground">{detect.notes}</div>
            </div>
            <div>
              <Label>Bank / card preset</Label>
              <Select value={presetId} onValueChange={pickPreset}>
                <SelectTrigger><SelectValue placeholder="No preset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRESET}>— No preset (auto-map) —</SelectItem>
                  {BANK_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentPreset?.notes && <p className="mt-1 text-xs text-muted-foreground">{currentPreset.notes}</p>}
            </div>
            <div>
              <Label>Override format</Label>
              <Select value={type} onValueChange={(v) => setType(v as ImportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="detailed_transactions">Detailed transactions</SelectItem>
                  <SelectItem value="monthly_summary">Monthly summary (no dates)</SelectItem>
                  <SelectItem value="monthly_category_summary">Monthly category summary</SelectItem>
                  <SelectItem value="manual_mapping">Manual mapping</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="grid grid-cols-2 gap-3">
            {type === "detailed_transactions" ? (
              <>
                <MapField label="Date column" value={fieldMap.date} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, date: v })} />
                <MapField label="Description" value={fieldMap.description} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, description: v })} />
                <MapField label="Amount" value={fieldMap.amount} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, amount: v })} />
                <MapField label="Category (optional)" value={fieldMap.category} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, category: v })} />
                <div className="col-span-2">
                  <Label>Default account name</Label>
                  <Input value={defaultAccount} onChange={(e) => setDefaultAccount(e.target.value)} placeholder="e.g. HDFC Bank" />
                  <p className="mt-1 text-xs text-muted-foreground">All imported transactions will be tagged to this account unless a rule overrides it.</p>
                </div>
              </>
            ) : (
              <>
                <MapField label="Month / Period" value={fieldMap.month} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, month: v })} />
                <MapField label="Salary" value={fieldMap.salary} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, salary: v })} />
                <MapField label="Other income" value={fieldMap.otherIncome} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, otherIncome: v })} />
                <MapField label="Expense" value={fieldMap.expense} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, expense: v })} />
                <MapField label="Savings" value={fieldMap.savings} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, savings: v })} />
                <MapField label="Cashback" value={fieldMap.cashback} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, cashback: v })} />
                <MapField label="Interest" value={fieldMap.interest} options={headerOptions} onChange={(v) => setFieldMap({ ...fieldMap, interest: v })} />
                {type === "monthly_category_summary" && (
                  <div className="col-span-2">
                    <Label>Category columns (comma-separated header names)</Label>
                    <Input
                      value={(fieldMap.categoryColumns ?? []).join(", ")}
                      onChange={(e) => setFieldMap({ ...fieldMap, categoryColumns: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Auto-suggested: {(detect?.fieldMap?.categoryColumns ?? []).join(", ") || "—"}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === "rules" && (
          <div className="space-y-4">
            {type === "detailed_transactions" && (
              <>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
                  <div>
                    <Label className="text-sm">Auto-categorize using rules</Label>
                    <p className="text-xs text-muted-foreground">Match merchants like Swiggy, Amazon, Netflix to the right category. Edit rules from the Rules page.</p>
                  </div>
                  <Switch checked={applyRules} onCheckedChange={setApplyRules} />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
                  <div>
                    <Label className="text-sm">Skip duplicate transactions</Label>
                    <p className="text-xs text-muted-foreground">Compare date + amount + description against existing transactions. Safe to re-import the same statement.</p>
                  </div>
                  <Switch checked={dedupe} onCheckedChange={setDedupe} />
                </div>
              </>
            )}
            <div>
              <Label>Fallback year (used when month name has no year)</Label>
              <Input type="number" value={fallbackYear} onChange={(e) => setFallbackYear(+e.target.value || new Date().getFullYear())} />
            </div>
            {type !== "detailed_transactions" && (
              <div>
                <Label>When dates are missing</Label>
                <Select value={dateRule} onValueChange={(v) => setDateRule(v as typeof dateRule)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Store as monthly summary (recommended)</SelectItem>
                    <SelectItem value="first_of_month">Also create one synthetic txn on 1st of month</SelectItem>
                    <SelectItem value="last_of_month">Also create one synthetic txn on last of month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-2 text-sm">
            <div>File: <span className="font-medium">{fileName}</span></div>
            <div>Format: <span className="font-medium">{describeType(type)}</span></div>
            {currentPreset && <div>Preset: <span className="font-medium">{currentPreset.name}</span></div>}
            <div>Rows: <span className="font-medium">{sheet?.rows.length ?? 0}</span></div>
            {type === "detailed_transactions" && (
              <div className="flex gap-4 text-xs">
                <span>{applyRules ? "✓ Auto-categorize" : "✗ Skip auto-categorize"}</span>
                <span>{dedupe ? "✓ Skip duplicates" : "✗ Allow duplicates"}</span>
              </div>
            )}
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              We never overwrite existing transactions. Duplicates are detected by date + amount + description and silently skipped when enabled.
            </div>
          </div>
        )}

        <DialogFooter>
          {step !== "source" && <Button variant="outline" onClick={back}>Back</Button>}
          {step === "source" ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          ) : step === "confirm" ? (
            <Button onClick={commit}>Confirm import</Button>
          ) : (
            <Button onClick={next} disabled={step === "preview" && !sheet}>Next</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MapField({ label, value, options, onChange }: { label: string; value: string | undefined; options: string[]; onChange: (v: string | undefined) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o === NONE ? "— None —" : o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function labelForStep(s: Step) {
  return ({ source: "Select source", preview: "Preview", detect: "Detect format", map: "Map columns", rules: "Rules & duplicates", confirm: "Confirm" } as const)[s];
}
function describeType(t: ImportType) {
  return ({
    detailed_transactions: "Detailed transactions (per-row dated entries)",
    monthly_summary: "Monthly summary (one row per month)",
    monthly_category_summary: "Monthly category summary (per-category totals)",
    manual_mapping: "Manual mapping",
    text_import: "Text import",
  } as Record<ImportType, string>)[t];
}
