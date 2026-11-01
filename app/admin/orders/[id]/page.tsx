"use client";

import OrderStatusBadge from "@/components/admin/order-status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Copy, Download, Loader2, Printer } from "lucide-react";
import { downloadDocument, printDocument } from "@/lib/order-documents";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const orderStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

function DocActions({ order }: { order: any }) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: "receipt" | "label", mode: "print" | "download") => {
    setBusy(`${kind}-${mode}`);
    try {
      if (mode === "print") await printDocument(kind, order);
      else await downloadDocument(kind, order);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the PDF");
    } finally {
      setBusy(null);
    }
  };


  const groups = [
    { kind: "receipt" as const, title: "Receipt" },
    { kind: "label" as const, title: "Label" },
  ];

  return (
    <div className="flex items-center gap-2">
      {groups.map((g) => (
        <div
          key={g.kind}
          className="flex items-center gap-0.5 rounded-md border border-neutral-200 py-0.5 pl-2 pr-0.5 dark:border-neutral-700"
        >
          <span className="mr-0.5 text-xs font-medium text-neutral-500">{g.title}</span>
          {(["print", "download"] as const).map((mode) => {
            const loading = busy === `${g.kind}-${mode}`;
            const Icon = loading ? Loader2 : mode === "print" ? Printer : Download;
            return (
              <button
                key={mode}
                type="button"
                title={`${mode === "print" ? "Print" : "Download PDF of"} ${g.title.toLowerCase()}`}
                aria-label={`${mode === "print" ? "Print" : "Download"} ${g.title.toLowerCase()}`}
                onClick={() => run(g.kind, mode)}
                disabled={busy !== null}
                className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
              >
                <Icon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{mode === "print" ? "Print" : "PDF"}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/orders/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data);
        setAdminNotes(data.adminNotes || "");
        setLoading(false);
      });
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrder(data);
      toast.success(`Status updated to ${newStatus}`);
    }
    setSaving(false);
  };

  const updatePaymentStatus = async (newStatus: string) => {
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: newStatus }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrder(data);
      toast.success(`Payment status updated to ${newStatus}`);
    }
    setSaving(false);
  };

  const saveAdminNotes = async () => {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrder(data);
      toast.success("Notes saved");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return <div>Order not found</div>;

    return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 truncate text-lg font-bold sm:text-2xl">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <DocActions order={order} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-3 text-lg font-semibold">Customer</h2>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{order.customer?.name || "Guest"}</p>
          <p className="text-neutral-500">{order.customer?.email}</p>
          <div className="flex items-center gap-2 text-neutral-500">
            <p>{order.customer?.phone}</p>
            {order.customer?.phone && (
              <button
                onClick={() => copyToClipboard(order.customer.phone, "customerPhone")}
                className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                title="Copy phone"
              >
                {copiedField === "customerPhone" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only Delivery Details */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 lg:hidden dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-3 text-lg font-semibold">Delivery Details</h2>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{order.shippingAddress?.fullName}</p>
          <div className="flex items-center gap-2">
            <p>{order.shippingAddress?.address}</p>
            {order.shippingAddress?.address && (
              <button
                onClick={() => copyToClipboard(order.shippingAddress.address, "address")}
                className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                title="Copy address"
              >
                {copiedField === "address" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <p>
            {order.shippingAddress?.city}, {order.shippingAddress?.region}
          </p>
          <p>{order.shippingAddress?.country}</p>
          <div className="flex items-center gap-2 text-neutral-500">
            <p>{order.shippingAddress?.phone}</p>
            {order.shippingAddress?.phone && (
              <button
                onClick={() => copyToClipboard(order.shippingAddress.phone, "phone")}
                className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                title="Copy phone"
              >
                {copiedField === "phone" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          {order.shippingAddress?.notes && (
            <p className="mt-2 italic text-neutral-500">{order.shippingAddress.notes}</p>
          )}
        </div>
      </div>

            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 space-y-6">
                    <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="mb-4 text-lg font-semibold">Items</h2>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-neutral-700">
                    <th className="pb-2 pr-3 text-left">Product</th>
                    <th className="pb-2 pr-3 text-left">Variant</th>
                    <th className="pb-2 pr-3 text-left">SKU</th>
                    <th className="pb-2 pr-3 text-left">Qty</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b dark:border-neutral-800">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                          )}
                          <span className="line-clamp-2">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">{item.variantId || "—"}</td>
                      <td className="py-3 pr-3">{item.sku || "—"}</td>
                      <td className="py-3 pr-3">{item.quantity}</td>
                      <td className="py-3 text-right font-medium">
                        KES {(item.quantity * item.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile stacked cards */}
            <div className="space-y-3 md:hidden">
              {order.items.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0 dark:border-neutral-800"
                >
                  {item.image && (
                    <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{item.name}</p>
                    <p className="mt-0.5 break-words text-xs text-neutral-500">
                      {[
                        item.variantId && `Variant: ${item.variantId}`,
                        item.sku && `SKU: ${item.sku}`,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      KES {(item.quantity * item.price).toFixed(2)}
                    </p>
                    <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

                    <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="mb-4 text-lg font-semibold">Status Timeline</h2>
            <div className="space-y-4">
              {(order.statusHistory || []).map((entry: any, i: number) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                    {i < (order.statusHistory || []).length - 1 && (
                      <div className="mt-1 w-0.5 flex-1 bg-neutral-200 dark:bg-neutral-700" />
                    )}
                  </div>
                  <div className="min-w-0 pb-4">
                    <p className="font-medium capitalize">{entry.status}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(entry.changedAt).toLocaleString()}
                    </p>
                    {entry.note && (
                      <p className="mt-1 break-words text-sm text-neutral-600">{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
              {(order.statusHistory || []).length === 0 && (
                <p className="text-neutral-500">No status history yet</p>
              )}
            </div>
          </div>

        </div>

                <div className="min-w-0 space-y-6">
          <div className="hidden rounded-lg border border-neutral-200 bg-white p-4 lg:block dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="mb-3 text-lg font-semibold">Delivery Details</h2>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{order.shippingAddress?.fullName}</p>
              <div className="flex items-center gap-2">
                <p>{order.shippingAddress?.address}</p>
                {order.shippingAddress?.address && (
                  <button
                    onClick={() => copyToClipboard(order.shippingAddress.address, "address")}
                    className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    title="Copy address"
                  >
                    {copiedField === "address" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              <p>
                {order.shippingAddress?.city}, {order.shippingAddress?.region}
              </p>
              <p>{order.shippingAddress?.country}</p>
              <div className="flex items-center gap-2 text-neutral-500">
                <p>{order.shippingAddress?.phone}</p>
                {order.shippingAddress?.phone && (
                  <button
                    onClick={() => copyToClipboard(order.shippingAddress.phone, "phone")}
                    className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    title="Copy phone"
                  >
                    {copiedField === "phone" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              {order.shippingAddress?.notes && (
                <p className="mt-2 italic text-neutral-500">{order.shippingAddress.notes}</p>
              )}
            </div>
          </div>

                    <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Subtotal</span>
                <span className="shrink-0">KES {order.subtotal}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">
                    Discount{order.coupon?.code ? ` (${order.coupon.code})` : ""}
                  </span>
                  <span className="shrink-0 text-green-600">- KES {order.discount}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Delivery Cost</span>
                <span className="shrink-0">KES {order.shippingCost}</span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-700">
                <span className="font-medium">Total</span>
                <span className="shrink-0 font-bold">KES {order.total}</span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Order Status</label>
                <Select value={order.status} onValueChange={updateStatus} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Payment Status</label>
                <Select
                  value={order.paymentStatus}
                  onValueChange={updatePaymentStatus}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="collected">Collected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-3 text-lg font-semibold">Admin Notes</h2>
        <textarea
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          rows={4}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          onBlur={saveAdminNotes}
          placeholder="Add internal notes about this order..."
        />
      </div>
    </div>
  );
}
