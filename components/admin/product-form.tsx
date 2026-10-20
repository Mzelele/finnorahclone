"use client";

import RichTextEditor from "@/components/admin/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import clsx from "clsx";
import { Camera, ChevronDown, Loader2, Plus, Sparkles, Star, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Category {
  _id: string;
  name: string;
}

interface Variant {
  _id?: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
  images: string[];
  enabled: boolean;
}

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  productHighlights: string;
  type: "simple" | "variable";
  status: "draft" | "active" | "archived";
  price: number;
  comparePrice: number;
  cost: number;
  sku: string;
  stock: number;
  images: string[];
  featuredImage?: string;
  categories: string[];
  variants: Variant[];
  defaultVariant: string;
}

export default function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
        const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("simple");

    // AI generation state
  const [aiRawText, setAiRawText] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProducts, setAiProducts] = useState<{ name: string; description: string; keyFeatures: string[] }[]>([]);
  const [aiSelectedIndex, setAiSelectedIndex] = useState(0);
  const [aiProductPickerOpen, setAiProductPickerOpen] = useState(false);

        const [form, setForm] = useState<ProductFormData>({
    name: "",
    slug: "",
    description: "",
    productHighlights: "",
    type: "simple",
    status: "active",
    price: 0,
    comparePrice: 0,
    cost: 0,
    sku: "",
    stock: 1000,
    images: [],
    featuredImage: undefined,
    categories: [],
    variants: [],
    defaultVariant: "",
  });

  const [attributes, setAttributes] = useState<{ name: string; values: string[] }[]>([]);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);
    const [variantImageModal, setVariantImageModal] = useState<number | null>(null);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Close category dropdown on outside click
  useEffect(() => {
    if (!categoryOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCategoryOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
    }, [categoryOpen]);

  const generateSKU = (name: string) => {
    // Extract first letter of each of the first 4 words, pad with "X" if needed
    const initials = name
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z]/g, "")[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 4)
      .padEnd(4, "X");
    // 8 random numerals (10000000 – 99999999)
    const numerals = Math.floor(10000000 + Math.random() * 90000000).toString();
    return `${initials}${numerals}`;
  };

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then(setCategories);

    if (productId) {
      setLoading(true);
      fetch(`/api/admin/products/${productId}`)
        .then((r) => r.json())
        .then((data) => {
          setForm({
            name: data.name || "",
            slug: data.slug || "",
            description: data.description || "",
            productHighlights: data.productHighlights || data.keyFeatures || data.shortDescription || "",
            type: data.type || "simple",
            status: data.status || "active",
            price: data.price || 0,
            comparePrice: data.comparePrice || data.compareAtPrice || 0,
            cost: data.cost || 0,
            sku: data.sku || "",
            stock: data.stock || 0,
            images: data.images || [],
            featuredImage: data.featuredImage,
            categories: Array.isArray(data.categories)
              ? data.categories.map((c: any) => c._id?.toString() || c.toString())
              : data.category
                ? [data.category._id?.toString() || data.category.toString()]
                : [],
            variants: data.variants || [],
            defaultVariant: data.defaultVariant || "",
          });
          setActiveTab(data.type || "simple");
          if (data.variants?.length) {
            setAttributes(extractAttributesFromVariants(data.variants));
          }
          setLoading(false);
        });
    }
  }, [productId]);

  const generateSlug = (name: string) =>
    name.toLowerCase().trim()
      .replace(/[''']/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");

    const buildPayload = (statusOverride?: ProductFormData["status"]) => {
    const payload = {
      ...form,
      status: statusOverride || form.status,
      type: activeTab as "simple" | "variable",
      categories: form.categories,
      compareAtPrice: form.comparePrice,  // sync with import field name
    };
    // Remove old single-category field
    delete (payload as any).category;
        return payload;
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEdited ? prev.slug : generateSlug(name),
      sku: skuManuallyEdited ? prev.sku : generateSKU(name),
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const uploads = await Promise.all(
      fileArray.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
        const data = await res.json();
        return data.url as string | undefined;
      })
    );

    const urls = uploads.filter((url): url is string => !!url);
    if (urls.length) {
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    }
  };

  const removeImage = (index: number) => {
    setForm((prev) => {
      const removedUrl = prev.images[index];
      const nextImages = prev.images.filter((_, i) => i !== index);
      const nextFeatured = prev.featuredImage === removedUrl ? undefined : prev.featuredImage;
      return { ...prev, images: nextImages, featuredImage: nextFeatured };
    });
  };

  const setFeaturedImage = (url: string) => {
    setForm((prev: ProductFormData) => ({ ...prev, featuredImage: url }));
  };

  const reorderImages = (fromIndex: number, toIndex: number) => {
    setForm((prev) => {
      const next = [...prev.images];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved!);
      return { ...prev, images: next };
    });
  };

  const addAttribute = () => {
    setAttributes([...attributes, { name: "SELECT COLOR", values: [] }]);
  };

  const buildVariantName = (attrs: Record<string, string>) =>
    Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(", ");

  const updateAttributeName = (idx: number, name: string) => {
    const next = [...attributes];
    if (!next[idx]) return;
    const oldName = next[idx].name;
    next[idx] = { ...next[idx], name };
    setAttributes(next);

    if (oldName === name) return;

    setForm((prev: ProductFormData) => {
      const updatedVariants = prev.variants.map((v: Variant) => {
        if (!v.attributes || !(oldName in v.attributes)) return v;
        const newAttrs = { ...v.attributes };
        delete newAttrs[oldName];
        newAttrs[name] = v.attributes[oldName]!;
        const newName = buildVariantName(newAttrs);
        return { ...v, attributes: newAttrs, name: newName };
      });
      const nameMap = new Map<string, string>();
      for (const oldV of prev.variants) {
        if (!oldV.attributes || !(oldName in oldV.attributes)) continue;
        const newAttrs = { ...oldV.attributes };
        delete newAttrs[oldName];
        newAttrs[name] = oldV.attributes[oldName]!;
        nameMap.set(oldV.name, buildVariantName(newAttrs));
      }
      const newDefault = nameMap.get(prev.defaultVariant) ?? prev.defaultVariant;
      return { ...prev, variants: updatedVariants, defaultVariant: newDefault };
    });
  };

  const addAttributeValue = (idx: number, value: string) => {
    const next = [...attributes];
    if (!next[idx]) return;
    const trimmed = value.trim();
    if (!trimmed || next[idx].values.includes(trimmed)) return;
    next[idx] = { ...next[idx], values: [...next[idx].values, trimmed] };
    setAttributes(next);
  };

  const removeAttributeValue = (idx: number, value: string) => {
    const next = [...attributes];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], values: next[idx].values.filter((v: string) => v !== value) };
    setAttributes(next);
  };

  const removeLastAttributeValue = (idx: number) => {
    const next = [...attributes];
    if (!next[idx] || next[idx].values.length === 0) return;
    next[idx] = { ...next[idx], values: next[idx].values.slice(0, -1) };
    setAttributes(next);
  };

  const extractAttributesFromVariants = (variants: Variant[]) => {
    const attrMap = new Map<string, Set<string>>();
    for (const v of variants) {
      if (!v.attributes) continue;
      for (const [key, val] of Object.entries(v.attributes)) {
        if (!attrMap.has(key)) attrMap.set(key, new Set());
        attrMap.get(key)!.add(val);
      }
    }
    return Array.from(attrMap.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  };

  const generateVariants = () => {
    if (attributes.length === 0) return;

    const combos: Record<string, string>[] = [{}];
    for (const attr of attributes) {
      if (!attr.name || attr.values.length === 0) continue;
      const newCombos: Record<string, string>[] = [];
      for (const combo of combos) {
        for (const value of attr.values) {
          newCombos.push({ ...combo, [attr.name]: value });
        }
      }
      combos.length = 0;
      combos.push(...newCombos);
    }

    if (combos.length === 0) return;

    // Preserve existing variants that match a combo by attributes
    const existingMap = new Map<string, Variant>();
    for (const v of form.variants) {
      if (!v.attributes) continue;
      existingMap.set(JSON.stringify(v.attributes), v);
    }

    const newVariants: Variant[] = combos.map((attrs, i) => {
      const key = JSON.stringify(attrs);
      const existing = existingMap.get(key);
      if (existing) return existing;
      return {
        name: buildVariantName(attrs),
        sku: `${form.sku || form.slug}${(i + 1).toString().padStart(2, '0')}`,
        price: form.price,
        stock: 1000,
        attributes: attrs,
        images: [],
        enabled: true,
      };
    });

    setForm((prev) => {
      const validDefault = newVariants.some((v) => v.name === prev.defaultVariant)
        ? prev.defaultVariant
        : (newVariants[0]?.name ?? "");
      return {
        ...prev,
        variants: newVariants,
        defaultVariant: validDefault,
      };
    });
  };

  const updateVariant = (index: number, field: keyof Variant, value: unknown) => {
    const next = [...form.variants];
    if (!next[index]) return;
    next[index] = { ...next[index], [field]: value } as Variant;
    setForm((prev) => ({ ...prev, variants: next }));
  };

  const removeVariant = (index: number) => {
    const next = form.variants.filter((_, i) => i !== index);
    const removed = form.variants[index];
    setForm((prev) => ({
      ...prev,
      variants: next,
      defaultVariant: prev.defaultVariant === removed?.name ? (next[0]?.name ?? "") : prev.defaultVariant,
    }));
  };

        const handleSubmit = async () => {
    setSaving(true);
    const payload = buildPayload();

    const url = productId
      ? `/api/admin/products/${productId}`
      : "/api/admin/products";
    const method = productId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(productId ? "Product updated" : "Product created");
      router.push("/admin/products");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to save product");
    }
    setSaving(false);
  };

    const handleAiGenerate = async () => {
    if (!aiRawText.trim()) {
      toast.error("Please paste some raw text or a WhatsApp message first.");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await fetch("/api/generate-product-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: aiRawText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI generation failed");
      }

      const products = data.products;
      if (!Array.isArray(products) || products.length === 0) {
        toast.error("AI could not extract any product info. Try different text.");
        return;
      }

      // Store all products from the response
      setAiProducts(products);

      // Populate form with the first product
      const product = products[0];
      setForm((prev) => ({
        ...prev,
                name: product.name || prev.name,
        description: product.description || prev.description,
        productHighlights: Array.isArray(product.keyFeatures)
          ? product.keyFeatures.map((f: string) => "• " + f).join("\n")
          : prev.productHighlights,
        slug: generateSlug(product.name || ""),
        sku: generateSKU(product.name || ""),
      }));
      setAiSelectedIndex(0);

      // If multiple products returned, show a picker dialog
      if (products.length > 1) {
        setAiProductPickerOpen(true);
      } else {
        toast.success("AI generated product details! Review and adjust as needed.");
      }

      setSlugManuallyEdited(false);
      setSkuManuallyEdited(false);
    } catch (error: any) {
      console.error("[ai-generate]", error);
      toast.error(error.message || "Failed to generate product info from AI.");
    } finally {
      setAiGenerating(false);
    }
  };

  const applyAiProduct = (index: number) => {
    const product = aiProducts[index];
    if (!product) return;
    setForm((prev) => ({
      ...prev,
      name: product.name || prev.name,
      description: product.description || prev.description,
      productHighlights: Array.isArray(product.keyFeatures)
        ? product.keyFeatures.map((f) => "• " + f).join("\n")
        : prev.productHighlights,
      slug: generateSlug(product.name || ""),
      sku: generateSKU(product.name || ""),
    }));
    setAiSelectedIndex(index);
    setSlugManuallyEdited(false);
    setSkuManuallyEdited(false);
  };

  if (loading) {
    return <div className="py-8 text-center">Loading product...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "simple" | "variable")}>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="max-w-full">
            <TabsTrigger value="simple">Simple Product</TabsTrigger>
                        <TabsTrigger value="variable">Variable Product</TabsTrigger>
          </TabsList>
        </div>

                <TabsContent value="simple" className="space-y-4">
          {/* AI Generate Section */}
          <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between border-dashed border-neutral-700 bg-[#0d0d0d] text-neutral-300 hover:bg-[#1a1a1a] hover:text-neutral-100"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  Generate with AI
                </span>
                <ChevronDown className={clsx("h-4 w-4 transition-transform", aiOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="rounded-lg border border-neutral-800 bg-[#0d0d0d] p-4">
                <p className="mb-2 text-xs text-neutral-500">
                  Paste a WhatsApp broadcast, social media caption, or inventory description. The AI will
                  extract product details and fill in the fields below.
                </p>
                <textarea
                  className="w-full rounded-md border border-neutral-700 bg-[#0d0d0d] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  rows={5}
                  placeholder="e.g. MENS CHRONOGRAPH WATCH – Stainless steel case, genuine leather strap, 50m water resistance. Available in black and brown..."
                  value={aiRawText}
                  onChange={(e) => setAiRawText(e.target.value)}
                  disabled={aiGenerating}
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    AI will extract name, description &amp; features only — no prices or contact info are saved.
                  </span>
                  <Button
                    size="sm"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiRawText.trim()}
                    className="gap-2"
                  >
                    {aiGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

                                                                                {/* Title + Category */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
                                                        <div className="relative" ref={categoryRef}>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-white p-1.5 min-h-[38px] dark:border-neutral-700 dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-neutral-950 focus-within:ring-offset-2">
                  {/* Display selected categories as badges */}
                  {form.categories.map((categoryId) => {
                    const category = categories.find((c) => c._id === categoryId);
                    return category ? (
                      <Badge
                        key={categoryId}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1 cursor-pointer"
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            categories: p.categories.filter((id) => id !== categoryId),
                          }));
                        }}
                      >
                        {category.name}
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                  <input
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    onFocus={() => setCategoryOpen(true)}
                    className="flex-1 min-w-[80px] bg-transparent outline-none border-none text-sm text-neutral-900 placeholder:text-neutral-500 dark:text-neutral-100 dark:placeholder:text-neutral-400 px-1 h-7"
                  />
                </div>
                {categoryOpen && (
                  <div className="scrollbar-thin absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800 max-h-[220px] overflow-y-auto py-1">
                    {filteredCategories.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-400 dark:text-neutral-500">No categories found</div>
                    ) : (
                      filteredCategories.map((c) => (
                        <button
                          key={c._id}
                          type="button"
                          onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      setForm((p) => {
                                                        const current = Array.isArray(p.categories) ? [...p.categories] : [];
                                                        const idx = current.indexOf(c._id);
                                                        if (idx >= 0) {
                                                          current.splice(idx, 1);
                                                        } else {
                                                          current.push(c._id);
                                                        }
                                                        return { ...p, categories: current };
                                                      });
                                                      setCategoryOpen(false);
                                                      setCategorySearch("");
                                                    }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                            (Array.isArray(form.categories) ? form.categories : []).includes(c._id)
                              ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                              : "text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                            </div>
            </div>
          </div>

          {/* Images */}
          <ImageSection images={form.images} featuredImage={form.featuredImage} onUpload={handleImageUpload} onRemove={removeImage} onSetFeatured={setFeaturedImage} onReorder={reorderImages} />

          {/* Key Features */}
          <div className="space-y-2">
            <Label>Key Features</Label>
            <RichTextEditor
              id="simple-key-features"
              value={form.productHighlights}
              onChange={(productHighlights) => setForm((p) => ({ ...p, productHighlights }))}
              placeholder="Key features or selling points..."
              rows={4}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor
              id="simple-description"
              value={form.description}
              onChange={(description) => setForm((p) => ({ ...p, description }))}
              placeholder="Product description..."
              rows={8}
            />
          </div>

          {/* Price, Compare */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price (KES)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Compare-at Price</Label>
              <Input type="number" value={form.comparePrice} onChange={(e) => setForm((p) => ({ ...p, comparePrice: Number(e.target.value) }))} />
            </div>
          </div>

          {/* Advanced Settings */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" type="button" className="w-full justify-between">
                Advanced Settings
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input type="number" value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cost</Label>
                  <Input type="number" value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <div className="flex gap-2">
                    <Input value={form.slug} onChange={(e) => { setSlugManuallyEdited(true); setForm((p) => ({ ...p, slug: e.target.value })); }} />
                    <Button variant="outline" size="sm" type="button" onClick={() => { setSlugManuallyEdited(false); setForm((prev) => ({ ...prev, slug: generateSlug(prev.name) })); }}>Auto</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <div className="flex gap-2">
                    <Input value={form.sku} onChange={(e) => { setSkuManuallyEdited(true); setForm((p) => ({ ...p, sku: e.target.value })); }} />
                    <Button variant="outline" size="sm" type="button" onClick={() => { setSkuManuallyEdited(false); setForm((prev) => ({ ...prev, sku: generateSKU(prev.name) })); }}>Auto</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

                <TabsContent value="variable" className="space-y-4">
          {/* AI Generate Section */}
          <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between border-dashed border-neutral-700 bg-[#0d0d0d] text-neutral-300 hover:bg-[#1a1a1a] hover:text-neutral-100"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  Generate with AI
                </span>
                <ChevronDown className={clsx("h-4 w-4 transition-transform", aiOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="rounded-lg border border-neutral-800 bg-[#0d0d0d] p-4">
                <p className="mb-2 text-xs text-neutral-500">
                  Paste a WhatsApp broadcast, social media caption, or inventory description. The AI will
                  extract product details and fill in the fields below.
                </p>
                <textarea
                  className="w-full rounded-md border border-neutral-700 bg-[#0d0d0d] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  rows={5}
                  placeholder="e.g. MENS CHRONOGRAPH WATCH – Stainless steel case, genuine leather strap, 50m water resistance. Available in black and brown..."
                  value={aiRawText}
                  onChange={(e) => setAiRawText(e.target.value)}
                  disabled={aiGenerating}
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    AI will extract name, description &amp; features only — no prices or contact info are saved.
                  </span>
                  <Button
                    size="sm"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiRawText.trim()}
                    className="gap-2"
                  >
                    {aiGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

                    {/* Title + Category */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
                                    <div className="relative" ref={categoryRef}>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-white p-1.5 min-h-[38px] dark:border-neutral-700 dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-neutral-950 focus-within:ring-offset-2">
                  {/* Display selected categories as badges */}
                  {form.categories.map((categoryId) => {
                    const category = categories.find((c) => c._id === categoryId);
                    return category ? (
                      <Badge
                        key={categoryId}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1 cursor-pointer"
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            categories: p.categories.filter((id) => id !== categoryId),
                          }));
                        }}
                      >
                        {category.name}
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                  <input
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    onFocus={() => setCategoryOpen(true)}
                    className="flex-1 min-w-[80px] bg-transparent outline-none border-none text-sm text-neutral-900 placeholder:text-neutral-500 dark:text-neutral-100 dark:placeholder:text-neutral-400 px-1 h-7"
                  />
                </div>
                {categoryOpen && (
                  <div className="scrollbar-thin absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800 max-h-[220px] overflow-y-auto py-1">
                    {filteredCategories.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-400 dark:text-neutral-500">No categories found</div>
                    ) : (
                      filteredCategories.map((c) => (
                        <button
                          key={c._id}
                          type="button"
                          onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      setForm((p) => {
                                                        const current = Array.isArray(p.categories) ? [...p.categories] : [];
                                                        const idx = current.indexOf(c._id);
                                                        if (idx >= 0) {
                                                          current.splice(idx, 1);
                                                        } else {
                                                          current.push(c._id);
                                                        }
                                                        return { ...p, categories: current };
                                                      });
                                                      setCategoryOpen(false);
                                                      setCategorySearch("");
                                                    }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                            (Array.isArray(form.categories) ? form.categories : []).includes(c._id)
                              ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                              : "text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                            </div>
            </div>
          </div>

          {/* Images */}
          <ImageSection images={form.images} featuredImage={form.featuredImage} onUpload={handleImageUpload} onRemove={removeImage} onSetFeatured={setFeaturedImage} onReorder={reorderImages} />

          {/* Key Features */}
          <div className="space-y-2">
            <Label>Key Features</Label>
            <RichTextEditor
              id="variable-key-features"
              value={form.productHighlights}
              onChange={(productHighlights) => setForm((p) => ({ ...p, productHighlights }))}
              placeholder="Key features or selling points..."
              rows={4}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor
              id="variable-description"
              value={form.description}
              onChange={(description) => setForm((p) => ({ ...p, description }))}
              placeholder="Product description..."
              rows={8}
            />
          </div>

          {/* Base Price, Compare-at */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Price (KES)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Compare-at Price</Label>
              <Input type="number" value={form.comparePrice} onChange={(e) => setForm((p) => ({ ...p, comparePrice: Number(e.target.value) }))} />
            </div>
          </div>

          {/* Attributes */}
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <h3 className="mb-3 font-semibold">Attributes</h3>
            {attributes.map((attr, idx) => (
              <AttributeValuesInput
                key={idx}
                attr={attr}
                idx={idx}
                onNameChange={updateAttributeName}
                onAddValue={addAttributeValue}
                onRemoveValue={removeAttributeValue}
                onRemoveLastValue={removeLastAttributeValue}
                onRemoveAttribute={() => setAttributes(attributes.filter((_, i) => i !== idx))}
              />
            ))}
            <Button variant="outline" size="sm" onClick={addAttribute}>
              <Plus className="mr-1 h-4 w-4" />
              Add Attribute
            </Button>
            <Button className="ml-2" size="sm" onClick={generateVariants}>
              Generate Variants
            </Button>
          </div>

          {/* Advanced Settings */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" type="button" className="w-full justify-between">
                Advanced Settings
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cost</Label>
                  <Input type="number" value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <div className="flex gap-2">
                    <Input value={form.slug} onChange={(e) => { setSlugManuallyEdited(true); setForm((p) => ({ ...p, slug: e.target.value })); }} />
                    <Button variant="outline" size="sm" type="button" onClick={() => { setSlugManuallyEdited(false); setForm((prev) => ({ ...prev, slug: generateSlug(prev.name) })); }}>Auto</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <div className="flex gap-2">
                    <Input value={form.sku} onChange={(e) => { setSkuManuallyEdited(true); setForm((p) => ({ ...p, sku: e.target.value })); }} />
                    <Button variant="outline" size="sm" type="button" onClick={() => { setSkuManuallyEdited(false); setForm((prev) => ({ ...prev, sku: generateSKU(prev.name) })); }}>Auto</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Variants */}
          {form.variants.length > 0 && (
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
              <h3 className="mb-3 font-semibold">Variants</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-neutral-700">
                      <th className="pb-2 text-left">Default</th>
                      <th className="pb-2 text-left">Variant</th>
                      <th className="pb-2 text-left">Image</th>
                      <th className="pb-2 text-left">SKU</th>
                      <th className="pb-2 text-left">Price</th>
                      <th className="pb-2 text-left">Stock</th>
                      <th className="pb-2 text-left">Enabled</th>
                      <th className="pb-2 text-left"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.variants.map((variant, idx) => (
                      <tr key={idx} className="border-b dark:border-neutral-800">
                        <td className="py-2">
                          <input
                            type="radio"
                            name="defaultVariant"
                            checked={form.defaultVariant === variant.name}
                            onChange={() => setForm((prev) => ({ ...prev, defaultVariant: variant.name }))}
                            title="Set as default variant"
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            className="h-8 w-40"
                            value={variant.name}
                            onChange={(e) => updateVariant(idx, "name", e.target.value)}
                          />
                        </td>
                        <td className="py-2">
                          {variant.images?.[0] ? (
                            <div className="relative h-12 w-12">
                              <img src={variant.images[0]} alt="" className="h-12 w-12 rounded object-cover" />
                              <button
                                type="button"
                                onClick={() => updateVariant(idx, "images", [])}
                                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setVariantImageModal(idx)}
                              className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-neutral-300 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-400"
                            >
                              <Camera className="h-4 w-4 text-neutral-400" />
                            </button>
                          )}
                        </td>
                        <td className="py-2">
                          <Input
                            className="h-8 w-32"
                            value={variant.sku}
                            onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            className="h-8 w-24"
                            type="number"
                            value={variant.price}
                            onChange={(e) => updateVariant(idx, "price", Number(e.target.value))}
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            className="h-8 w-20"
                            type="number"
                            value={variant.stock}
                            onChange={(e) => updateVariant(idx, "stock", Number(e.target.value))}
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={variant.enabled}
                            onChange={(e) => updateVariant(idx, "enabled", e.target.checked)}
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => removeVariant(idx)}
                            title="Delete variant"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Product Picker Dialog — shown when multiple products are returned */}
                    <Dialog open={aiProductPickerOpen} onOpenChange={setAiProductPickerOpen}>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Select Product to Fill Form</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-neutral-500">
                          The AI found {aiProducts.length} products. Choose which one to populate the form with.
                        </p>
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                          {aiProducts.map((product, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                applyAiProduct(idx);
                                setAiProductPickerOpen(false);
                                toast.success("Applied product details! Review and adjust as needed.");
                              }}
                              className={clsx(
                                "w-full rounded-lg border p-3 text-left transition-colors hover:border-neutral-400 dark:hover:border-neutral-500",
                                idx === aiSelectedIndex
                                  ? "border-neutral-900 bg-neutral-100 dark:border-neutral-400 dark:bg-neutral-800"
                                  : "border-neutral-200 dark:border-neutral-700"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                  {product.name || "Unnamed Product"}
                                </span>
                                {idx === aiSelectedIndex ? (
                                  <Badge variant="secondary" className="text-xs">Current</Badge>
                                ) : null}
                              </div>
                              {product.keyFeatures?.length ? (
                                <ul className="mt-1 list-disc space-y-0 pl-4 text-xs text-neutral-500">
                                  {product.keyFeatures.slice(0, 3).map((f, i) => (
                                    <li key={i} className="truncate">{f}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={variantImageModal !== null}
                      onOpenChange={(open) => !open && setVariantImageModal(null)}
                    >
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Select Variant Image</DialogTitle>
                        </DialogHeader>
              <Tabs defaultValue="existing">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Product Images</TabsTrigger>
                  <TabsTrigger value="upload">Upload New</TabsTrigger>
                </TabsList>
                <TabsContent value="existing">
                  {form.images.length === 0 ? (
                    <p className="text-sm text-neutral-400">
                      No images uploaded yet — upload product images first
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {form.images.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="aspect-square w-full cursor-pointer rounded object-cover hover:ring-2 hover:ring-neutral-950"
                          onClick={() => {
                            if (variantImageModal !== null) {
                              updateVariant(variantImageModal, "images", [url]);
                              setVariantImageModal(null);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="upload">
                  <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 p-8 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-400">
                    <Upload className="mb-2 h-8 w-8 text-neutral-400" />
                    <span className="text-sm text-neutral-400">Click to upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch("/api/admin/upload", {
                          method: "POST",
                          body: fd,
                        });
                        const { url } = await res.json();
                        if (url && variantImageModal !== null) {
                          updateVariant(variantImageModal, "images", [url]);
                          setVariantImageModal(null);
                        }
                      }}
                    />
                  </label>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

            <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : productId ? "Update Product" : "Create Product"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AttributeValuesInput({
  attr,
  idx,
  onNameChange,
  onAddValue,
  onRemoveValue,
  onRemoveLastValue,
  onRemoveAttribute,
}: {
  attr: { name: string; values: string[] };
  idx: number;
  onNameChange: (idx: number, name: string) => void;
  onAddValue: (idx: number, value: string) => void;
  onRemoveValue: (idx: number, value: string) => void;
  onRemoveLastValue: (idx: number) => void;
  onRemoveAttribute: () => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = inputValue.trim();
      if (val) {
        onAddValue(idx, val);
        setInputValue("");
      }
    }
    if (e.key === "Backspace" && inputValue === "") {
      onRemoveLastValue(idx);
    }
  };

  const handleBlur = () => {
    const val = inputValue.trim();
    if (val) {
      onAddValue(idx, val);
      setInputValue("");
    }
  };

  return (
    <div className="mb-3 flex gap-3 items-start">
      <Input
        placeholder="Attribute name (e.g. Color)"
        value={attr.name}
        onChange={(e) => onNameChange(idx, e.target.value)}
        className="shrink-0 w-40"
      />
      <div className="flex-1 min-w-0">
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-neutral-950 focus-within:ring-offset-2"
        >
          {attr.values.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {value}
              <button
                type="button"
                onClick={() => onRemoveValue(idx, value)}
                className="rounded-full p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={attr.values.length === 0 ? "Type value & press Enter" : ""}
            className="flex-1 min-w-[80px] bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 py-1"
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={onRemoveAttribute}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ImageSection({
  images,
  featuredImage,
  onUpload,
  onRemove,
  onSetFeatured,
  onReorder,
}: {
  images: string[];
  featuredImage?: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
  onSetFeatured: (url: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      <Label>Images</Label>
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => {
          const isFeatured = featuredImage === url;
          return (
            <div
              key={url}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== i) {
                  onReorder(dragIndex, i);
                }
                setDragIndex(null);
              }}
              className={clsx(
                "relative cursor-move rounded",
                isFeatured && "ring-2 ring-blue-500"
              )}
            >
              <img src={url} alt="" className="h-20 w-20 rounded object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onSetFeatured(url)}
                className={clsx(
                  "absolute -bottom-1 -right-1 rounded-full p-0.5",
                  isFeatured ? "bg-blue-500 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-blue-500 hover:text-white"
                )}
                title={isFeatured ? "Cover image" : "Set as cover image"}
              >
                <Star className="h-3 w-3" fill={isFeatured ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })}
        <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
          <Plus className="h-6 w-6 text-neutral-400" />
          <input type="file" multiple accept="image/*" className="hidden" onChange={onUpload} />
        </label>
      </div>
      <p className="text-xs text-neutral-500">Drag images to reorder. Click the star to set the cover/thumbnail.</p>
    </div>
  );
}