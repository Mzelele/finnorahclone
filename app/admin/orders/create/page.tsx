"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Product { _id: string; name: string; sku: string; price: number; images: string[]; variants?: any[] }
interface LineItem { product: Product; variant: string; qty: number; price: number }

export default function CreateOrderPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState({
    fullName: "", phone: "", email: "", address: "", city: "",
    paymentStatus: "unpaid", status: "pending", note: "",
  });

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(search)}&limit=8`);
      const data = await res.json();
      setResults(data.products || []);
      setSearching(false);
    }, 300);
  }, [search]);

  const addItem = (p: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product._id === p._id && i.variant === "");
      if (existing) return prev.map((i) => i.product._id === p._id && i.variant === "" ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product: p, variant: "", qty: 1, price: p.price }];
    });
    setSearch(""); setResults([]);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateQty = (idx: number, qty: number) => { if (qty < 1) return; setItems((prev) => prev.map((it, i) => i === idx ? { ...it, qty } : it)); };
  const updatePrice = (idx: number, price: number) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, price } : it));

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  const submit = async () => {
    if (!form.fullName || !form.phone) { toast.error("Name and phone are required"); return; }
    if (items.length === 0) { toast.error("Add at least one product"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shippingAddress: { fullName: form.fullName, phone: form.phone, email: form.email, address: form.address, city: form.city },
          items: items.map((i) => ({ product: i.product._id, name: i.product.name, variant: i.variant, qty: i.qty, price: i.price })),
          total: subtotal,
          status: form.status,
          paymentStatus: form.paymentStatus,
          note: form.note,
          source: "admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Order created");
      router.push(`/admin/orders/${data._id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Create Order</h1>
        <Link href="/admin/orders"><Button variant="outline">Cancel</Button></Link>
      </div>
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700 space-y-4">
        <h2 className="font-semibold">Customer Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Full Name *</Label><Input value={form.fullName} onChange={e => setForm(f => ({...f, fullName: e.target.value}))} placeholder="Full name" /></div>
          <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="Phone number" /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="Email (optional)" /></div>
          <div><Label>City / Town</Label><Input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="City" /></div>
          <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Street address" /></div>
        </div>
      </div>
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700 space-y-4">
        <h2 className="font-semibold">Products</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input className="pl-9" placeholder="Search products to add..." value={search} onChange={e => setSearch(e.target.value)} />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              {results.map(p => (
                <button key={p._id} onClick={() => addItem(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  {p.images?.[0] && <img src={p.images[0]} className="h-8 w-8 rounded object-cover" alt="" />}
                  <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-neutral-500">KES {p.price?.toLocaleString()}</p></div>
                  <Plus className="h-4 w-4 text-neutral-400" />
                </button>
              ))}
            </div>
          )}
          {searching && <p className="mt-1 text-xs text-neutral-400">Searching...</p>}
        </div>
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 dark:border-neutral-700 text-left text-xs text-neutral-500"><th className="pb-2">Product</th><th className="pb-2 w-24">Qty</th><th className="pb-2 w-28">Price (KES)</th><th className="pb-2 w-8"></th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-2 font-medium truncate max-w-[180px]">{it.product.name}</td>
                  <td className="py-2"><div className="flex items-center gap-1"><button onClick={() => updateQty(idx, it.qty - 1)} className="rounded p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"><Minus className="h-3 w-3" /></button><span className="w-6 text-center">{it.qty}</span><button onClick={() => updateQty(idx, it.qty + 1)} className="rounded p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"><Plus className="h-3 w-3" /></button></div></td>
                  <td className="py-2"><Input type="number" value={it.price} onChange={e => updatePrice(idx, Number(e.target.value))} className="h-7 w-24 text-sm" /></td>
                  <td className="py-2"><button onClick={() => removeItem(idx)} className="text-neutral-400 hover:text-red-500"><X className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > 0 && <div className="text-right font-semibold">Total: KES {subtotal.toLocaleString()}</div>}
      </div>
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700 space-y-4">
        <h2 className="font-semibold">Order Settings</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Order Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["pending","confirmed","processing","shipped","delivered","cancelled"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Payment Status</Label>
            <Select value={form.paymentStatus} onValueChange={v => setForm(f => ({...f, paymentStatus: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["unpaid","paid","refunded"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Internal Note</Label><Textarea value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))} placeholder="Optional note..." rows={2} /></div>
      </div>
      <Button className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? "Creating..." : "Create Order"}
      </Button>
    </div>
  );
}
