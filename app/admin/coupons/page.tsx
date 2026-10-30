"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Coupon = {
  _id: string;
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  description?: string;
  minSubtotal?: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usedCount?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  enabled: boolean;
};

type FormState = {
  code: string;
  type: string;
  value: string;
  description: string;
  minSubtotal: string;
  maxDiscount: string;
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  enabled: boolean;
};

const emptyForm: FormState = {
  code: "",
  type: "percent",
  value: "",
  description: "",
  minSubtotal: "",
  maxDiscount: "",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  enabled: true,
};

// Stored dates are Kenya time (UTC+3); show them back as YYYY-MM-DD.
const toDateInput = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
};

const fmtDate = (v?: string | null) =>
  v
    ? new Date(v).toLocaleDateString("en-GB", {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

const kes = (n: number) => `KES ${Number(n).toLocaleString()}`;

function describe(c: Coupon) {
  if (c.type === "percent") {
    return `${c.value}% off${c.maxDiscount ? ` (max ${kes(c.maxDiscount)})` : ""}`;
  }
  if (c.type === "fixed") return `${kes(c.value)} off`;
  return "Free delivery";
}

function statusOf(c: Coupon) {
  const now = Date.now();
  const gray = "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200";
  if (!c.enabled) return { label: "Disabled", cls: gray };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now)
    return { label: "Expired", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now)
    return { label: "Scheduled", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  if (c.usageLimit && (c.usedCount || 0) >= c.usageLimit)
    return { label: "Used up", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
}

const selectCls =
  "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      const data = await res.json();
      setCoupons(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const toForm = (c: Coupon): FormState => ({
    code: c.code,
    type: c.type,
    value: c.value ? String(c.value) : "",
    description: c.description || "",
    minSubtotal: c.minSubtotal ? String(c.minSubtotal) : "",
    maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "",
    usageLimit: c.usageLimit ? String(c.usageLimit) : "",
    startsAt: toDateInput(c.startsAt),
    expiresAt: toDateInput(c.expiresAt),
    enabled: c.enabled,
  });

  const save = async (id: string | null, body: FormState, okMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch(id ? `/api/admin/coupons/${id}` : "/api/admin/coupons", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to save coupon");
        return false;
      }
      toast.success(okMsg);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const ok = await save(editingId, form, editingId ? "Coupon updated" : "Coupon created");
    if (ok) {
      reset();
      load();
    }
  };

  const toggle = async (c: Coupon) => {
    const ok = await save(
      c._id,
      { ...toForm(c), enabled: !c.enabled },
      c.enabled ? "Coupon disabled" : "Coupon enabled",
    );
    if (ok) load();
  };

  const edit = (c: Coupon) => {
    setEditingId(c._id);
    setForm(toForm(c));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}? Past orders keep their discount record.`)) return;
    const res = await fetch(`/api/admin/coupons/${c._id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Coupon deleted");
      if (editingId === c._id) reset();
      load();
    } else {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-white">Coupons</h1>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h3 className="mb-3 font-semibold dark:text-white">
          {editingId ? "Edit coupon" : "Add coupon"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Code</Label>
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, ""))}
              placeholder="WELCOME10"
            />
          </div>
          <div>
            <Label>Type</Label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className={selectCls}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off (KES)</option>
              <option value="free_shipping">Free delivery</option>
            </select>
          </div>
          {form.type !== "free_shipping" && (
            <div>
              <Label>{form.type === "percent" ? "Percentage (1-100)" : "Amount (KES)"}</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={form.type === "percent" ? "10" : "500"}
              />
            </div>
          )}
          {form.type === "percent" && (
            <div>
              <Label>Max discount (KES, optional)</Label>
              <Input
                type="number"
                value={form.maxDiscount}
                onChange={(e) => set("maxDiscount", e.target.value)}
                placeholder="1000"
              />
            </div>
          )}
          <div>
            <Label>Minimum spend (KES)</Label>
            <Input
              type="number"
              value={form.minSubtotal}
              onChange={(e) => set("minSubtotal", e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Usage limit (blank = unlimited)</Label>
            <Input
              type="number"
              value={form.usageLimit}
              onChange={(e) => set("usageLimit", e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <Label>Starts (optional)</Label>
            <Input type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </div>
          <div>
            <Label>Expires (optional)</Label>
            <Input type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Label>Note (internal)</Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Instagram giveaway, October"
            />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm dark:text-neutral-200">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800"
          />
          Enabled
        </label>
        <div className="mt-3 flex gap-2">
          <Button onClick={submit} disabled={saving}>
            <Plus className="mr-1 h-4 w-4" />
            {saving ? "Saving..." : editingId ? "Update coupon" : "Add coupon"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-4 py-3 text-left font-medium dark:text-white">Code</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Discount</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Min spend</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Used</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Valid</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Status</th>
                <th className="px-4 py-3 text-right font-medium dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, k) => (
                      <td key={k} className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                coupons.map((c) => {
                  const st = statusOf(c);
                  return (
                    <tr key={c._id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold dark:text-white">{c.code}</p>
                        {c.description && (
                          <p className="text-xs text-neutral-500">{c.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 dark:text-neutral-200">{describe(c)}</td>
                      <td className="px-4 py-3 dark:text-neutral-200">
                        {c.minSubtotal ? kes(c.minSubtotal) : "-"}
                      </td>
                      <td className="px-4 py-3 dark:text-neutral-200">
                        {c.usedCount || 0} / {c.usageLimit || "\u221E"}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {c.startsAt || c.expiresAt
                          ? `${fmtDate(c.startsAt) || "Now"} - ${fmtDate(c.expiresAt) || "No expiry"}`
                          : "Always"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggle(c)}>
                            {c.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => edit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(c)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && coupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                    No coupons yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
