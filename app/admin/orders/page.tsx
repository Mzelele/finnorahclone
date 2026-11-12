"use client";

import OrderStatusBadge from "@/components/admin/order-status-badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Eye, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface Order {
  _id: string;
  orderNumber: string;
  createdAt: string;
  customer?: { name: string; email: string };
  items: any[];
  total: number;
  paymentStatus: string;
  status: string;
  deletedAt?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePermanent, setDeletePermanent] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const limit = 25;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    const res = await fetch(`/api/admin/orders?${params.toString()}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [search, status, paymentStatus, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const exportCSV = () => {
    const headers = ["Order #", "Date", "Customer", "Total", "Status", "Payment"];
    const rows = orders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleDateString(),
      o.customer?.name || "Guest",
      o.total,
      o.status,
      o.paymentStatus,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const toggleSelectAll = () => {
    if (selected.size === orders.length && orders.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o._id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const openDeleteDialog = () => {
    setDeletePermanent(false);
    setDeleteOpen(true);
  };

  const executeDelete = async () => {
    setDeleteLoading(true);
    try {
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((id) => fetch(`/api/admin/orders/${id}${deletePermanent ? "?permanent=true" : ""}`, { method: "DELETE" }))
      );
      setSelected(new Set());
      setDeleteOpen(false);
      fetchOrders();
      toast.success(`${ids.length} order(s) ${deletePermanent ? "permanently deleted" : "moved to trash"}`);
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    );
    setSelected(new Set());
    fetchOrders();
    toast.success(`${ids.length} order(s) updated to ${newStatus}`);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Orders</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/admin/orders/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by order # or customer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-3">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Order Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentStatus} onValueChange={(v) => { setPaymentStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="collected">Collected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500">{selected.size} selected</span>
          <Select value="" onValueChange={(v) => v && handleBulkStatusUpdate(v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Update Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" onClick={openDeleteDialog}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {selected.size}
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-4 py-3 text-left font-medium dark:text-white">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selected.size === orders.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Order #</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Date</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Customer</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Items</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Total</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Payment</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Status</th>
                <th className="px-4 py-3 text-right font-medium dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  </tr>
                ))
              ) : (
                orders.map((order) => (
                  <tr
                    key={order._id}
                    className={`border-b border-neutral-100 dark:border-neutral-800 ${order.deletedAt ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(order._id)}
                        onChange={() => toggleSelect(order._id)}
                        className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {order.orderNumber}
                      {order.deletedAt && (
                        <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Deleted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{order.customer?.name || "Guest"}</td>
                    <td className="px-4 py-3">{order.items?.length || 0}</td>
                    <td className="px-4 py-3">KES {order.total}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/orders/${order._id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <p className="text-sm text-neutral-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Orders</DialogTitle>
            <DialogDescription>
              This will move {selected.size} selected order(s) to trash.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deletePermanent}
                onChange={(e) => setDeletePermanent(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800"
              />
              Permanently delete (skip trash)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : deletePermanent ? "Permanently Delete" : "Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


