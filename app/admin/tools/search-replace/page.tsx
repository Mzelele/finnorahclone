"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Plus, Trash2, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Rule = {
  id: string;
  search: string;
  replace: string;
  enabled: boolean;
  caseSensitive: boolean;
  fields: string[];
};

type ResultSummary = {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
};

const ALL_FIELDS = ["name", "description", "keyFeatures", "shortDescription"];

const DEFAULT_RULES: Rule[] = [
  {
    id: "1",
    search: "254mobiles|254 mobiles|254MOBILES|254 MOBILES|254Mobiles",
    replace: "Kings Tech",
    enabled: true,
    caseSensitive: false,
    fields: ["name", "description", "keyFeatures", "shortDescription"],
  },
  {
    id: "2",
    search: "\\+?254\\s?111\\s?503\\s?604",
    replace: "254 142 652 388",
    enabled: true,
    caseSensitive: false,
    fields: ["name", "description", "keyFeatures", "shortDescription"],
  },
  {
    id: "3",
    search: "https?:\\/\\/254-mobiles\\.co\\.ke\\/?",
    replace: "https://kings-techs.co.ke/",
    enabled: true,
    caseSensitive: false,
    fields: ["description", "keyFeatures", "shortDescription"],
  },
  {
    id: "4",
    search: "https?:\\/\\/254mobiles\\.co\\.ke\\/?",
    replace: "https://kings-techs.co.ke/",
    enabled: true,
    caseSensitive: false,
    fields: ["description", "keyFeatures", "shortDescription"],
  },
  {
    id: "5",
    search: "https?:\\/\\/kings(%20|\\s)tech\\.co\\.ke\\/?",
    replace: "https://kings-techs.co.ke/",
    enabled: true,
    caseSensitive: false,
    fields: ["description", "keyFeatures", "shortDescription"],
  },
  {
    id: "6",
    search: "3rd Floor",
    replace: "6th Floor",
    enabled: true,
    caseSensitive: false,
    fields: ["description", "keyFeatures", "shortDescription"],
  },
  {
    id: "7",
    search: "https?:\\/\\/254-mobiles\\.co\\.ke\\/wp-content\\/uploads\\/",
    replace: "https://kings-techs.co.ke/wp-content/uploads/",
    enabled: true,
    caseSensitive: false,
    fields: ["description", "keyFeatures", "shortDescription"],
  },
  {
    id: "8",
    search: "https?:\\/\\/254mobiles\\.co\\.ke\\/wp-content\\/uploads\\/",
    replace: "https://kings-techs.co.ke/wp-content/uploads/",
    enabled: true,
    caseSensitive: false,
    fields: ["description", "keyFeatures", "shortDescription"],
  },
];

export default function SearchReplacePage() {
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResultSummary | null>(null);
  const [dryRun, setDryRun] = useState(true);

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        search: "",
        replace: "",
        enabled: true,
        caseSensitive: false,
        fields: ["name", "description", "keyFeatures", "shortDescription"],
      },
    ]);
  };

  const updateRule = (id: string, patch: Partial<Rule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleField = (ruleId: string, field: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        const fields = r.fields.includes(field)
          ? r.fields.filter((f) => f !== field)
          : [...r.fields, field];
        return { ...r, fields };
      })
    );
  };

  const runReplace = async () => {
    const activeRules = rules.filter((r) => r.enabled && r.search.trim());
    if (!activeRules.length) {
      toast.error("No active rules with a search term.");
      return;
    }
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/search-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: activeRules, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setResult(data);
      toast.success(dryRun ? `Dry run complete — ${data.updated} products would be updated.` : `Done — ${data.updated} products updated.`);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Search & Replace</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Find and replace text across all product fields. Supports plain text and regex patterns.
        </p>
      </div>

      {/* Rules */}
      <div className="space-y-4">
        {rules.map((rule, idx) => (
          <div key={rule.id} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Rule {idx + 1}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(v) => updateRule(rule.id, { enabled: v })}
                  />
                  <span className="text-xs text-neutral-500">{rule.enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <button onClick={() => removeRule(rule.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Search (text or regex)</Label>
                <Input
                  value={rule.search}
                  onChange={(e) => updateRule(rule.id, { search: e.target.value })}
                  placeholder="e.g. 254mobiles|254 mobiles or \+254\d+"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Replace with (leave empty to delete)</Label>
                <Input
                  value={rule.replace}
                  onChange={(e) => updateRule(rule.id, { replace: e.target.value })}
                  placeholder="Replacement text or leave blank"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.caseSensitive}
                  onCheckedChange={(v) => updateRule(rule.id, { caseSensitive: v })}
                />
                <span className="text-xs text-neutral-500">Case sensitive</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500">Fields:</span>
                {ALL_FIELDS.map((field) => (
                  <button
                    key={field}
                    onClick={() => toggleField(rule.id, field)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      rule.fields.includes(field)
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-neutral-300 text-neutral-500 hover:border-neutral-500 dark:border-neutral-600"
                    }`}
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addRule}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-700 dark:hover:border-neutral-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {/* Run */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={dryRun} onCheckedChange={setDryRun} />
          <div>
            <p className="text-sm font-semibold dark:text-white">Dry Run Mode</p>
            <p className="text-xs text-neutral-500">Preview matches without saving changes</p>
          </div>
        </div>
        <Button
          onClick={runReplace}
          disabled={running}
          className="flex items-center gap-2"
          style={{ backgroundColor: dryRun ? "#6366f1" : "#16a34a" }}
        >
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Running..." : dryRun ? "Preview Changes" : "Apply Changes"}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center gap-2 mb-4">
            {result.errors > 0 ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <h2 className="text-sm font-bold dark:text-white">
              {dryRun ? "Dry Run Results" : "Results"}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Total Products", value: result.total, color: "text-neutral-900 dark:text-white" },
              { label: dryRun ? "Would Update" : "Updated", value: result.updated, color: "text-green-600" },
              { label: "No Match", value: result.skipped, color: "text-neutral-400" },
              { label: "Errors", value: result.errors, color: "text-red-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-neutral-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
