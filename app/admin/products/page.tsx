"use client";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import clsx from "clsx";
import { Check, Copy, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface Product {
  _id: string;
  name: string;
  slug: string;
  sku?: string;
  type: string;
  price: number;
  stock: number;
  status: string;
  images: string[];
  featuredImage?: string;
  categories?: any[];
  category?: { name: string };
}

interface CategoryOption {
  _id: string;
  name: string;
}

interface ProductCounts {
  active: number;
  draft: number;
  archived: number;
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<ProductCounts>({ active: 0, draft: 0, archived: 0 });
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "active");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [type, setType] = useState(searchParams.get("type") || "all");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkField, setBulkField] = useState<"status" | "stock" | "price" | "category" | null>(null);
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [limit, setLimit] = useState(20);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deletePermanent, setDeletePermanent] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (category !== "all") params.set("category", category);
    if (type !== "all") params.set("type", type);
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    const res = await fetch(`/api/admin/products?${params.toString()}`);
    const data = await res.json();
    setProducts(data.products || []);
    setTotal(data.total || 0);
    setCounts(data.counts || { active: 0, draft: 0, archived: 0 });
    setLoading(false);
  }, [search, status, category, type, page, limit]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const openDeleteDialog = (product: Product | null, permanent = false) => {
    setDeleteTarget(product);
    setDeletePermanent(permanent);
    setDeleteOpen(true);
  };

  const executeDelete = async () => {
    setDeleteLoading(true);
    try {
      if (deleteTarget) {
        const url = `/api/admin/products/${deleteTarget._id}${deletePermanent ? "?permanent=true" : ""}`;
        await fetch(url, { method: "DELETE" });
        toast.success(deletePermanent ? "Product permanently deleted" : "Product archived");
      } else {
        const ids = Array.from(selected);
        await Promise.all(
          ids.map((id) => fetch(`/api/admin/products/${id}${deletePermanent ? "?permanent=true" : ""}`, { method: "DELETE" }))
        );
        toast.success(`${ids.length} product(s) ${deletePermanent ? "permanently deleted" : "archived"}`);
        setSelected(new Set());
      }
      setDeleteOpen(false);
      fetchProducts();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openBulk = (field: "status" | "stock" | "price" | "category") => {
    setBulkField(field);
    setBulkValue("");
    setBulkOpen(true);
  };

  const handleBulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    setBulkLoading(true);
    try {
      const updates: any = {};
      if (bulkField === "status") updates.status = bulkValue;
      if (bulkField === "stock") updates.stock = Number(bulkValue);
      if (bulkField === "price") updates.price = Number(bulkValue);
      if (bulkField === "category") updates.category = bulkValue;

      const res = await fetch("/api/admin/products/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), updates }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Updated");
        setSelected(new Set());
        setBulkOpen(false);
        fetchProducts();
      } else {
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const res = await fetch("/api/admin/products/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product._id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Product duplicated");
        fetchProducts();
      } else {
        toast.error(data.error || "Failed to duplicate");
      }
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === products.length && products.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p._id)));
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

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/admin/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-neutral-900 dark:text-white">Page {page} of {totalPages || 1}</span>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <button
            type="button"
            onClick={() => { setStatus("all"); setPage(1); }}
            className={clsx("hover:underline", status === "all" ? "font-semibold text-blue-600 underline underline-offset-4" : "text-neutral-600 dark:text-neutral-300")}
          >
            All: {counts.active + counts.draft + counts.archived}
          </button>
          <button
            type="button"
            onClick={() => { setStatus("active"); setPage(1); }}
            className={clsx("hover:underline", status === "active" ? "font-semibold text-emerald-600 underline underline-offset-4" : "text-emerald-700 dark:text-emerald-400")}
          >
            Active: {counts.active}
          </button>
          <button
            type="button"
            onClick={() => { setStatus("draft"); setPage(1); }}
            className={clsx("hover:underline", status === "draft" ? "font-semibold text-amber-500 underline underline-offset-4" : "text-amber-700 dark:text-amber-400")}
          >
            Drafts: {counts.draft}
          </button>
          <button
            type="button"
            onClick={() => { setStatus("archived"); setPage(1); }}
            className={clsx("hover:underline", status === "archived" ? "font-semibold text-neutral-900 underline underline-offset-4 dark:text-white" : "text-neutral-500")}
          >
            Archived: {counts.archived}
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <span className="text-neutral-600 dark:text-neutral-300">Showing {products.length} of {total}</span>
        </div>
        <div className="relative w-full xl:min-w-[260px] xl:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="simple">Simple</SelectItem>
              <SelectItem value="variable">Variable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <Select value="" onValueChange={(v) => v && openBulk(v as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Bulk Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Update Status</SelectItem>
                <SelectItem value="stock">Update Stock</SelectItem>
                <SelectItem value="price">Update Price</SelectItem>
                <SelectItem value="category">Assign Category</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(null)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Archive {selected.size}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-4 py-3 text-left font-medium dark:text-white">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selected.size === products.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Image</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Name</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">SKU</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Type</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Category</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Price</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Stock</th>
                <th className="px-4 py-3 text-left font-medium dark:text-white">Status</th>
                <th className="px-4 py-3 text-right font-medium dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-10 w-10" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))
              ) : (
                products.map((product) => (
                  <tr
                    key={product._id}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(product._id)}
                        onChange={() => toggleSelect(product._id)}
                        className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {(product.featuredImage || product.images?.[0]) ? (
                        <img
                          src={product.featuredImage || product.images?.[0]}
                          alt={product.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-neutral-200 dark:bg-neutral-700" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium dark:text-white">{product.name}</td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-300">{product.sku || "—"}</td>
                    <td className="px-4 py-3 capitalize dark:text-white">{product.type}</td>
                    <td className="px-4 py-3 dark:text-white">
                      {Array.isArray(product.categories) && product.categories.length > 0
                        ? product.categories.map((c: any) => (typeof c === 'object' ? c.name : c)).filter(Boolean).join(", ")
                        : product.category?.name || "—"
                      }
                    </td>
                    <td className="px-4 py-3 dark:text-white">KES {product.price}</td>
                    <td className="px-4 py-3 dark:text-white">{product.stock}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          product.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : product.status === "draft"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <a href={`/product/${product.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="View on store">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </a>
                        <Link href={`/admin/products/${product._id}`}>
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(product)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(product)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-neutral-500">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <p className="text-sm text-neutral-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Per page:</span>
              <Select
                value={limit.toString()}
                onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}
              >
                <SelectTrigger className="h-8 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={bulkOpen} onOpenChange={(v) => { setBulkOpen(v); if (!v) setCategorySearch(""); }}>
        <DialogContent className="dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Bulk Update {bulkField ? bulkField.charAt(0).toUpperCase() + bulkField.slice(1) : ""}</DialogTitle>
            <DialogDescription>
              This will update {selected.size} selected product(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {bulkField === "status" && (
              <div>
                <Label>New Status</Label>
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {bulkField === "stock" && (
              <div>
                <Label>New Stock Quantity</Label>
                <Input
                  type="number"
                  placeholder="Enter stock quantity"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                />
              </div>
            )}
            {bulkField === "price" && (
              <div>
                <Label>New Price (KES)</Label>
                <Input
                  type="number"
                  placeholder="Enter price"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                />
              </div>
            )}
            {bulkField === "category" && (
              <div>
                <Label>Category</Label>
                <div className="mt-1 space-y-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="h-9 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700">
                    {categories
                      .filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((c) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setBulkValue(c._id)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            bulkValue === c._id
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : "text-neutral-900 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {bulkValue === c._id && <Check className="h-3.5 w-3.5 shrink-0" />}
                          {bulkValue !== c._id && <span className="h-3.5 w-3.5 shrink-0" />}
                          {c.name}
                        </button>
                      ))}
                    {categories.filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-sm text-neutral-400">No categories found</p>
                    )}
                  </div>
                  {bulkValue && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Selected: <span className="font-medium text-neutral-900 dark:text-white">{categories.find(c => c._id === bulkValue)?.name}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkUpdate} disabled={!bulkValue || bulkLoading}>
              {bulkLoading ? "Updating..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget
                ? deleteTarget.status === "archived"
                  ? "Permanently Delete Product"
                  : "Archive Product"
                : "Archive Selected Products"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? deleteTarget.status === "archived"
                  ? `This will permanently delete "${deleteTarget.name}". This action cannot be undone.`
                  : `This will archive "${deleteTarget.name}". You can permanently delete it later.`
                : `This will archive ${selected.size} selected product(s).`}
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
              Permanently delete (skip archive)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : deletePermanent ? "Permanently Delete" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-neutral-200 rounded animate-pulse" />
        <div className="h-10 w-28 bg-neutral-200 rounded animate-pulse" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="h-10 flex-1 min-w-[200px] bg-neutral-200 rounded animate-pulse" />
        <div className="h-10 w-[160px] bg-neutral-200 rounded animate-pulse" />
        <div className="h-10 w-[160px] bg-neutral-200 rounded animate-pulse" />
      </div>
      <div className="h-96 bg-neutral-200 rounded animate-pulse" />
    </div>}>
      <ProductsContent />
    </Suspense>
  );
}


