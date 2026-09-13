"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ScriptLocation = "head" | "body_start" | "body_end";
type ScriptType = "js" | "css" | "html";

type ScriptSnippet = {
  id: string;
  name: string;
  code: string;
  location: ScriptLocation;
  type: ScriptType;
  enabled: boolean;
};

type PaymentMethod = {
  id: "cash_on_delivery" | "mpesa";
  name: string;
  description: string;
  enabled: boolean;
};

type SettingsData = {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  whatsappPhone: string;
  storeAddress: string;
  currency: string;
  country: string;
  metaTitle: string;
  metaDescription: string;
  shopMetaTitle: string;
  shopMetaDescription: string;
  shippingCost: number;
  freeShippingThreshold: number;
  shippingNote: string;
  deliveryMethods: { id: string; name: string; description: string; price: number; enabled: boolean }[];
  deliveryRegions: string;
  logoUrl: string;
  logoIconUrl: string;
  faviconUrl: string;
  showLogoIcon: boolean;
  primaryColor: string;
  announcementBar: boolean;
  announcementText: string;
  announcementLink: string;
  heroEnabled: boolean;
  heroMode: "text" | "image";
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroImageUrls: string[];
  heroAutoplayInterval: 3000 | 5000;
  heroButtonText: string;
  heroButtonLink: string;
  heroBgColor: string;
  facebookPixelId: string;
  scripts: ScriptSnippet[];
  navbarDark: boolean;
  paymentMethods: PaymentMethod[];
  ctaButtons: {
    addToCart: { enabled: boolean; text: string; style: "pill" | "rectangle" };
    call: { enabled: boolean; text: string; style: "pill" | "rectangle" };
    whatsapp: { enabled: boolean; text: string; style: "pill" | "rectangle" };
  };
};

const defaultSettings: SettingsData = {
  storeName: "ACME Store",
  storeEmail: "",
  storePhone: "",
  whatsappPhone: "",
  storeAddress: "",
  currency: "KES",
  country: "Kenya",
  metaTitle: "",
  metaDescription: "",
  shopMetaTitle: "",
  shopMetaDescription: "",
  shippingCost: 200,
  freeShippingThreshold: 5000,
  shippingNote: "",
  deliveryMethods: [
    { id: "standard", name: "Standard Delivery", description: "2-3 business days", price: 200, enabled: true },
    { id: "express", name: "Express Delivery", description: "Same day / next day", price: 500, enabled: true },
    { id: "pickup", name: "Pick Up", description: "Collect from our location", price: 0, enabled: true },
  ],
  deliveryRegions: "",
  logoUrl: "",
  logoIconUrl: "",
  faviconUrl: "",
  showLogoIcon: true,
  primaryColor: "#2563eb",
  announcementBar: false,
  announcementText: "",
  announcementLink: "",
  heroEnabled: false,
  heroMode: "text",
  heroTitle: "",
  heroSubtitle: "",
  heroImageUrl: "",
  heroImageUrls: [],
  heroAutoplayInterval: 3000,
  heroButtonText: "Shop Now",
  heroButtonLink: "",
  heroBgColor: "#f5f5dc",
  facebookPixelId: "",
  scripts: [],
  navbarDark: false,
  ctaButtons: {
    addToCart: { enabled: true, text: "Add To Cart", style: "pill" as const },
    call: { enabled: true, text: "Call to Order", style: "pill" as const },
    whatsapp: { enabled: true, text: "WhatsApp", style: "pill" as const },
  },
  paymentMethods: [
    {
      id: "cash_on_delivery",
      name: "Cash on Delivery",
      description: "Pay when your order arrives.",
      enabled: true,
    },
    {
      id: "mpesa",
      name: "M-Pesa (Receive Prompt)",
      description: "Receive an M-Pesa STK push prompt on your phone.",
      enabled: true,
    },
  ],
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("store");
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);

  // Account fields
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [updatingAccount, setUpdatingAccount] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoIcon, setUploadingLogoIcon] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
        } else {
          setSettings({
            ...defaultSettings,
            ...data,
            heroImageUrls: Array.isArray(data.heroImageUrls)
              ? data.heroImageUrls
              : data.heroImageUrl
                ? [data.heroImageUrl]
                : [],
            heroAutoplayInterval:
              data.heroAutoplayInterval === 5000 ? 5000 : 3000,
            shippingCost: data.shippingCost ?? 200,
            freeShippingThreshold: data.freeShippingThreshold ?? 5000,
            faviconUrl: data.faviconUrl ?? "",
            logoIconUrl: data.logoIconUrl ?? "",
            showLogoIcon: data.showLogoIcon ?? true,
            shopMetaTitle: data.shopMetaTitle ?? "",
            shopMetaDescription: data.shopMetaDescription ?? "",
            facebookPixelId: data.facebookPixelId ?? "",
            deliveryRegions: Array.isArray(data.deliveryRegions)
              ? data.deliveryRegions.join(", ")
              : data.deliveryRegions || "",
            scripts: Array.isArray(data.scripts) ? data.scripts : [],
            paymentMethods: Array.isArray(data.paymentMethods)
              ? data.paymentMethods
              : defaultSettings.paymentMethods,
          });
        }
      })
      .catch(() => {
        toast.error("Failed to load settings");
      });

    fetch("/api/admin/account")
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          setAdminName(data.name || "");
          setAdminEmail(data.email || "");
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...settings,
      heroImageUrl: settings.heroImageUrls[0] || "",
      faviconUrl: settings.faviconUrl,
      logoIconUrl: settings.logoIconUrl,
      showLogoIcon: settings.showLogoIcon,
      shippingCost: Number(settings.shippingCost) || 0,
      freeShippingThreshold: Number(settings.freeShippingThreshold) || 0,
      deliveryRegions: settings.deliveryRegions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      scripts: settings.scripts,
    };
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Settings saved successfully");
        setSettings((prev) => ({
          ...prev,
          deliveryRegions: Array.isArray(data.deliveryRegions)
            ? data.deliveryRegions.join(", ")
            : prev.deliveryRegions,
        }));
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!adminEmail) {
      toast.error("Email is required");
      return;
    }
    setUpdatingAccount(true);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adminName, email: adminEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Account updated successfully");
      } else {
        toast.error(data.error || "Failed to update account");
      }
    } catch {
      toast.error("Failed to update account");
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Failed to change password");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const updateField = (
    field: keyof SettingsData,
    value: string | boolean | number | string[],
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    field: "logoUrl" | "faviconUrl" | "logoIconUrl",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading =
      field === "logoUrl"
        ? setUploadingLogo
        : field === "logoIconUrl"
          ? setUploadingLogoIcon
          : setUploadingFavicon;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.url) {
        updateField(field, data.url);
        const label =
          field === "logoUrl"
            ? "Logo uploaded"
            : field === "logoIconUrl"
              ? "Logo icon uploaded"
              : "Favicon uploaded";
        toast.success(label);
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const tabs = [
    { id: "store", label: "Store" },
    { id: "shipping", label: "Delivery Cost" },
    { id: "cta", label: "CTA Buttons" },
    { id: "appearance", label: "Appearance" },
    { id: "payments", label: "Payments" },
    { id: "scripts", label: "Scripts & Tracking" },
    { id: "account", label: "Account" },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "store" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Store name</Label>
              <Input
                value={settings.storeName}
                onChange={(e) => updateField("storeName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Store email</Label>
              <Input
                type="email"
                value={settings.storeEmail}
                onChange={(e) => updateField("storeEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Store phone</Label>
              <Input
                value={settings.storePhone}
                onChange={(e) => updateField("storePhone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp phone</Label>
              <Input
                value={settings.whatsappPhone}
                onChange={(e) => updateField("whatsappPhone", e.target.value)}
                placeholder="Leave blank to use store phone"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={settings.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Store address</Label>
            <Textarea
              value={settings.storeAddress}
              onChange={(e) => updateField("storeAddress", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input
              value={settings.country}
              onChange={(e) => updateField("country", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Meta title (SEO)</Label>
            <Input
              value={settings.metaTitle}
              onChange={(e) => updateField("metaTitle", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Meta description (SEO)</Label>
            <Textarea
              value={settings.metaDescription}
              onChange={(e) => updateField("metaDescription", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Shop page meta title (SEO)</Label>
            <Input
              value={settings.shopMetaTitle}
              onChange={(e) => updateField("shopMetaTitle", e.target.value)}
              placeholder="Shop All Watches in Kenya | Browse Premium Timepieces"
            />
          </div>
          <div className="space-y-2">
            <Label>Shop page meta description (SEO)</Label>
            <Textarea
              value={settings.shopMetaDescription}
              onChange={(e) =>
                updateField("shopMetaDescription", e.target.value)
              }
              placeholder="Browse our full catalog of watches in Kenya..."
            />
          </div>
        </div>
      )}

      {activeTab === "shipping" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default delivery cost</Label>
              <Input
                type="number"
                value={settings.shippingCost}
                onChange={(e) => updateField("shippingCost", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Free delivery cost threshold</Label>
              <Input
                type="number"
                value={settings.freeShippingThreshold}
                onChange={(e) =>
                  updateField("freeShippingThreshold", e.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Delivery cost note (shown at checkout)</Label>
            <Textarea
              value={settings.shippingNote}
              onChange={(e) => updateField("shippingNote", e.target.value)}
              placeholder="Delivery within 2-3 business days"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Delivery Methods</Label>
              <button
                type="button"
                onClick={() => {
                  const next = [...(settings.deliveryMethods || []), { id: Date.now().toString(), name: "", description: "", price: 0, enabled: true }];
                  updateField("deliveryMethods", next);
                }}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                + Add Method
              </button>
            </div>
            {(settings.deliveryMethods || []).map((method, index) => (
              <div key={method.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-3 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide dark:text-neutral-400">Method {index + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={method.enabled}
                        onChange={(e) => {
                          const next = [...settings.deliveryMethods];
                          next[index] = { ...next[index], enabled: e.target.checked };
                          updateField("deliveryMethods", next);
                        }}
                        className="rounded"
                      />
                      Enabled
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = settings.deliveryMethods.filter((_, i) => i !== index);
                        updateField("deliveryMethods", next);
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={method.name}
                      onChange={(e) => {
                        const next = [...settings.deliveryMethods];
                        next[index] = { ...next[index], name: e.target.value };
                        updateField("deliveryMethods", next);
                      }}
                      placeholder="e.g. Standard Delivery"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price (KES)</Label>
                    <Input
                      type="number"
                      value={method.price}
                      onChange={(e) => {
                        const next = [...settings.deliveryMethods];
                        next[index] = { ...next[index], price: Number(e.target.value) };
                        updateField("deliveryMethods", next);
                      }}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description (shown at checkout)</Label>
                  <Input
                    value={method.description}
                    onChange={(e) => {
                      const next = [...settings.deliveryMethods];
                      next[index] = { ...next[index], description: e.target.value };
                      updateField("deliveryMethods", next);
                    }}
                    placeholder="e.g. 2-3 business days"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            ))}
            {(!settings.deliveryMethods || settings.deliveryMethods.length === 0) && (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">No delivery methods yet. Add one above.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "cta" && (
        <div className="space-y-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Control the Call-to-Action buttons shown on product pages. Changes apply to both mobile sticky bar and desktop layout.</p>
          {(["addToCart", "call", "whatsapp"] as const).map((key) => {
            const labels: Record<string, string> = { addToCart: "Add to Cart", call: "Call Button", whatsapp: "WhatsApp Button" };
            const btn = settings.ctaButtons?.[key] || { enabled: true, text: "", style: "pill" };
            return (
              <div key={key} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{labels[key]}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Enabled</span>
                    <input
                      type="checkbox"
                      checked={btn.enabled}
                      onChange={(e) => updateField("ctaButtons", { ...settings.ctaButtons, [key]: { ...btn, enabled: e.target.checked } })}
                      className="h-4 w-4 rounded"
                    />
                  </label>
                </div>
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Button Text</Label>
                    <Input
                      value={btn.text}
                      onChange={(e) => updateField("ctaButtons", { ...settings.ctaButtons, [key]: { ...btn, text: e.target.value } })}
                      placeholder="Button label..."
                      className="h-8 text-sm"
                      disabled={!btn.enabled}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shape</Label>
                    <select
                      value={btn.style}
                      onChange={(e) => updateField("ctaButtons", { ...settings.ctaButtons, [key]: { ...btn, style: e.target.value } })}
                      disabled={!btn.enabled}
                      className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      <option value="pill">Pill (rounded)</option>
                      <option value="rectangle">Rectangle (square)</option>
                    </select>
                  </div>
                </div>
                {/* Preview */}
                {btn.enabled && (
                  <div className="pt-1">
                    <Label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 block">Preview</Label>
                    <button
                      type="button"
                      className={`px-5 py-2 text-sm font-medium text-white ${
                        key === "whatsapp" ? "bg-green-600" : key === "call" ? "bg-neutral-900" : "bg-blue-600"
                      } ${btn.style === "pill" ? "rounded-full" : "rounded-[4px]"}`}
                    >
                      {btn.text || labels[key]}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "appearance" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Store name (shown in navbar)</Label>
            <Input
              value={settings.storeName}
              onChange={(e) => updateField("storeName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Logo URL</Label>
            {settings.logoUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="flex h-14 w-24 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-black">
                  <img
                    src={settings.logoUrl}
                    alt="Logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                  {settings.logoUrl}
                </p>
              </div>
            ) : null}
            <Input
              value={settings.logoUrl}
              onChange={(e) => updateField("logoUrl", e.target.value)}
              placeholder="https://..."
            />
            <Input
              type="file"
              accept="image/*"
              disabled={uploadingLogo}
              onChange={(e) => handleImageUpload(e, "logoUrl")}
            />
            {uploadingLogo && (
              <p className="text-xs text-neutral-500">Uploading logo...</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Logo icon URL</Label>
            <p className="text-xs text-neutral-500">
              Small icon shown next to the text logo (separate from favicon)
            </p>
            {settings.logoIconUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-black">
                  <img
                    src={settings.logoIconUrl}
                    alt="Logo icon preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                  {settings.logoIconUrl}
                </p>
              </div>
            ) : null}
            <Input
              value={settings.logoIconUrl}
              onChange={(e) => updateField("logoIconUrl", e.target.value)}
              placeholder="https://..."
            />
            <Input
              type="file"
              accept="image/*"
              disabled={uploadingLogoIcon}
              onChange={(e) => handleImageUpload(e, "logoIconUrl")}
            />
            {uploadingLogoIcon && (
              <p className="text-xs text-neutral-500">Uploading logo icon...</p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.showLogoIcon}
                onChange={(e) => updateField("showLogoIcon", e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
              />
              Show logo icon in navbar
            </label>
          </div>
          <div className="space-y-2">
            <Label>Favicon URL</Label>
            {settings.faviconUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-black">
                  <img
                    src={settings.faviconUrl}
                    alt="Favicon preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-neutral-500">
                    {settings.faviconUrl}
                  </p>
                  {settings.faviconUrl === "/favicon.ico" ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Current app favicon
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <Input
              value={settings.faviconUrl}
              onChange={(e) => updateField("faviconUrl", e.target.value)}
              placeholder="/favicon.ico or https://..."
            />
            <Input
              type="file"
              accept="image/*,.ico"
              disabled={uploadingFavicon}
              onChange={(e) => handleImageUpload(e, "faviconUrl")}
            />
            {uploadingFavicon && (
              <p className="text-xs text-neutral-500">Uploading favicon...</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Primary color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => updateField("primaryColor", e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-neutral-300 p-0"
              />
              <Input
                value={settings.primaryColor}
                onChange={(e) => updateField("primaryColor", e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <div>
              <p className="font-medium">Navbar dark mode</p>
              <p className="text-sm text-neutral-500">When enabled the navbar will use a dark theme (black background) with white icons and text.</p>
            </div>
            <Switch
              checked={settings.navbarDark}
              onCheckedChange={(checked) => updateField("navbarDark", checked)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <div>
              <p className="font-medium">Show announcement banner</p>
              <p className="text-sm text-neutral-500">
                Display a banner below the navbar
              </p>
            </div>
            <Switch
              checked={settings.announcementBar}
              onCheckedChange={(checked) =>
                updateField("announcementBar", checked)
              }
            />
          </div>
          {settings.announcementBar && (
            <>
              <div className="space-y-2">
                <Label>Banner text</Label>
                <Input
                  value={settings.announcementText}
                  onChange={(e) =>
                    updateField("announcementText", e.target.value)
                  }
                  placeholder="Free delivery over KES 5,000"
                />
              </div>
              <div className="space-y-2">
                <Label>Banner link (optional)</Label>
                <Input
                  value={settings.announcementLink}
                  onChange={(e) =>
                    updateField("announcementLink", e.target.value)
                  }
                  placeholder="https://... or /shop/..."
                />
              </div>
            </>
          )}

          <div className="border-t border-neutral-200 pt-6 dark:border-neutral-700">
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
              <div>
                <p className="font-medium">Show hero banner</p>
                <p className="text-sm text-neutral-500">
                  Display a large promotional banner on the homepage
                </p>
              </div>
              <Switch
                checked={settings.heroEnabled}
                onCheckedChange={(checked) =>
                  updateField("heroEnabled", checked)
                }
              />
            </div>
            {settings.heroEnabled && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Banner type</Label>
                  <div className="flex gap-2">
                    {(["text", "image"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateField("heroMode", mode)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${
                          settings.heroMode === mode
                            ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                {settings.heroMode === "text" && (
                  <>
                    <div className="space-y-2">
                      <Label>Hero title</Label>
                      <Input
                        value={settings.heroTitle}
                        onChange={(e) =>
                          updateField("heroTitle", e.target.value)
                        }
                        placeholder="Grab Up to 50% Off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hero subtitle</Label>
                      <Input
                        value={settings.heroSubtitle}
                        onChange={(e) =>
                          updateField("heroSubtitle", e.target.value)
                        }
                        placeholder="On Selected Headphone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Background color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.heroBgColor}
                          onChange={(e) =>
                            updateField("heroBgColor", e.target.value)
                          }
                          className="h-10 w-10 cursor-pointer rounded border border-neutral-300 p-0 dark:border-neutral-600"
                        />
                        <Input
                          value={settings.heroBgColor}
                          onChange={(e) =>
                            updateField("heroBgColor", e.target.value)
                          }
                          className="w-32"
                        />
                      </div>
                    </div>
                  </>
                )}

                {settings.heroMode === "image" && (
                  <div className="space-y-2">
                    <Label>Hero image</Label>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
                      <p className="font-medium">Recommended banner size</p>
                      <p className="mt-1">
                        Upload a wide image at{" "}
                        <span className="font-semibold">1920 × 480 px</span> or
                        <span className="font-semibold"> 1600 × 400 px</span>.
                        Keep the same{" "}
                        <span className="font-semibold">4:1 aspect ratio</span>{" "}
                        to fill the banner without side gaps.
                      </p>
                      <p className="mt-1 text-xs">
                        For best clarity, use JPG, PNG, or WebP at 2× size and
                        keep important text away from the edges.
                      </p>
                    </div>
                                        {settings.heroImageUrls.length > 0 ? (
                      <div className="space-y-3">
                        {settings.heroImageUrls.slice(0, 1).map((url, index) => (
                          <div
                            key={`${url}-${index}`}
                            className="relative aspect-[4/1] w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
                          >
                            <img
                              src={url}
                              alt={`Hero preview ${index + 1}`}
                              className="h-full w-full object-contain"
                            />
                            <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                              Banner
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const next = settings.heroImageUrls.filter(
                                  (_, i) => i !== index,
                                );
                                updateField("heroImageUrls", next);
                                updateField("heroImageUrl", next[0] || "");
                              }}
                              className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={uploadingHero}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingHero(true);
                        try {
                          const form = new FormData();
                          form.append("file", file);
                          const res = await fetch("/api/admin/upload", {
                            method: "POST",
                            body: form,
                          });
                          const data = await res.json();
                          if (data.url) {
                            updateField("heroImageUrls", [data.url]);
                            updateField("heroImageUrl", data.url);
                            toast.success("Hero image uploaded");
                          } else {
                            toast.error(data.error || "Upload failed");
                          }
                        } catch {
                          toast.error("Upload failed");
                        } finally {
                          setUploadingHero(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    {uploadingHero && (
                      <p className="text-xs text-neutral-500">Uploading...</p>
                    )}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Button text</Label>
                    <Input
                      value={settings.heroButtonText}
                      onChange={(e) =>
                        updateField("heroButtonText", e.target.value)
                      }
                      placeholder="Shop Now"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Button link</Label>
                    <Input
                      value={settings.heroButtonLink}
                      onChange={(e) =>
                        updateField("heroButtonLink", e.target.value)
                      }
                      placeholder="/shop/..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "scripts" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="space-y-2">
              <Label>Meta Pixel ID</Label>
              <Input
                value={settings.facebookPixelId}
                onChange={(e) =>
                  updateField(
                    "facebookPixelId",
                    e.target.value.replace(/\D/g, ""),
                  )
                }
                placeholder="1357195202908067"
                inputMode="numeric"
              />
              <p className="text-xs text-neutral-500">
                Enter only the numeric Pixel ID. Do not paste the full Meta
                Pixel script here.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Scripts &amp; Tracking</h3>
              <p className="text-sm text-neutral-500">
                Add custom non-Meta-Pixel scripts and tracking codes. Toggle
                on/off or drag to reorder.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                  JS wraps in &lt;script&gt;
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-purple-600" />
                  CSS wraps in &lt;style&gt;
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                  HTML is raw
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const id =
                  Date.now().toString(36) + Math.random().toString(36).slice(2);
                setSettings((prev) => ({
                  ...prev,
                  scripts: [
                    ...prev.scripts,
                    {
                      id,
                      name: "New Script",
                      code: "",
                      location: "head",
                      type: "js",
                      enabled: true,
                    },
                  ],
                }));
                setExpandedScriptId(id);
              }}
            >
              + Add Script
            </Button>
          </div>

          {settings.scripts.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
              <p className="text-neutral-500">
                No scripts added yet. Click "Add Script" to create one.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {settings.scripts.map((script, index) => {
              const isExpanded = expandedScriptId === script.id;
              return (
                <div
                  key={script.id}
                  className={`rounded-lg border transition-opacity dark:border-neutral-700 ${
                    script.enabled ? "opacity-100" : "opacity-60"
                  } ${isExpanded ? "p-4" : "px-4 py-3"}`}
                >
                  {isExpanded ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${
                              script.type === "js"
                                ? "bg-blue-600"
                                : script.type === "css"
                                  ? "bg-purple-600"
                                  : "bg-orange-500"
                            }`}
                          >
                            {script.type}
                          </span>
                          <Input
                            value={script.name}
                            onChange={(e) => {
                              const name = e.target.value;
                              setSettings((prev) => {
                                const next = [...prev.scripts];
                                next[index] = { ...next[index], name } as ScriptSnippet;
                                return { ...prev, scripts: next };
                              });
                            }}
                            placeholder="Script name"
                            className="font-medium"
                          />
                        </div>
                        <select
                          value={script.type}
                          onChange={(e) => {
                            const type = e.target.value as ScriptType;
                            setSettings((prev) => {
                              const next = [...prev.scripts];
                              next[index] = { ...next[index], type } as ScriptSnippet;
                              return { ...prev, scripts: next };
                            });
                          }}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 [&>option]:dark:bg-neutral-900 [&>option]:dark:text-neutral-100"
                          title="Script type"
                        >
                          <option value="js">JS</option>
                          <option value="css">CSS</option>
                          <option value="html">HTML</option>
                        </select>
                        <select
                          value={script.location}
                          onChange={(e) => {
                            const location = e.target.value as ScriptLocation;
                            setSettings((prev) => {
                              const next = [...prev.scripts];
                              next[index] = { ...next[index], location } as ScriptSnippet;
                              return { ...prev, scripts: next };
                            });
                          }}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 [&>option]:dark:bg-neutral-900 [&>option]:dark:text-neutral-100"
                        >
                          <option value="head">Head</option>
                          <option value="body_start">Body Start</option>
                          <option value="body_end">Body End</option>
                        </select>
                        <Switch
                          checked={script.enabled}
                          onCheckedChange={(checked) => {
                            setSettings((prev) => {
                              const next = [...prev.scripts];
                                                            next[index] = {
                                ...next[index],
                                enabled: checked,
                              } as ScriptSnippet;
                              return { ...prev, scripts: next };
                            });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setExpandedScriptId(null)}
                          className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        >
                          Collapse
                        </button>
                      </div>

                      <Textarea
                        value={script.code}
                        onChange={(e) => {
                          const code = e.target.value;
                          setSettings((prev) => {
                            const next = [...prev.scripts];
                            next[index] = { ...next[index], code } as ScriptSnippet;
                            return { ...prev, scripts: next };
                          });
                        }}
                        placeholder="Paste your script, pixel, or tracking code here..."
                        rows={5}
                        className="font-mono text-sm"
                      />

                      <div className="flex items-center gap-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                                                            setSettings((prev) => {
                                const next = [...prev.scripts];
                                const temp = next[index - 1]!;
                                next[index - 1] = next[index]!;
                                next[index] = temp;
                                return { ...prev, scripts: next };
                              });
                            }}
                            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                          >
                            Move up
                          </button>
                        )}
                        {index < settings.scripts.length - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                                                            setSettings((prev) => {
                                const next = [...prev.scripts];
                                const temp = next[index]!;
                                next[index] = next[index + 1]!;
                                next[index + 1] = temp;
                                return { ...prev, scripts: next };
                              });
                            }}
                            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                          >
                            Move down
                          </button>
                        )}
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setSettings((prev) => ({
                              ...prev,
                              scripts: prev.scripts.filter(
                                (_, i) => i !== index,
                              ),
                            }));
                            if (expandedScriptId === script.id) {
                              setExpandedScriptId(null);
                            }
                          }}
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="mt-0.5 flex flex-col gap-0.5 text-neutral-400">
                        <button
                          type="button"
                          onClick={() => {
                            if (index === 0) return;
                            setSettings((prev) => {
                              const next = [...prev.scripts];
                              const temp = next[index - 1]!;
                              next[index - 1] = next[index]!;
                              next[index] = temp;
                              return { ...prev, scripts: next };
                            });
                          }}
                          disabled={index === 0}
                          className="leading-none hover:text-neutral-600 disabled:opacity-20 dark:hover:text-neutral-200"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (index === settings.scripts.length - 1) return;
                            setSettings((prev) => {
                              const next = [...prev.scripts];
                              const temp = next[index]!;
                              next[index] = next[index + 1]!;
                              next[index + 1] = temp;
                              return { ...prev, scripts: next };
                            });
                          }}
                          disabled={index === settings.scripts.length - 1}
                          className="leading-none hover:text-neutral-600 disabled:opacity-20 dark:hover:text-neutral-200"
                        >
                          ▼
                        </button>
                      </div>

                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${
                          script.type === "js"
                            ? "bg-blue-600"
                            : script.type === "css"
                              ? "bg-purple-600"
                              : "bg-orange-500"
                        }`}
                      >
                        {script.type}
                      </span>

                      <button
                        type="button"
                        onClick={() => setExpandedScriptId(script.id)}
                        className="min-w-0 flex-1 text-left font-medium hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        {script.name}
                      </button>

                      <span className="shrink-0 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        {script.location === "head"
                          ? "Head"
                          : script.location === "body_start"
                            ? "Body Start"
                            : "Body End"}
                      </span>

                      <Switch
                        checked={script.enabled}
                        onCheckedChange={(checked) => {
                          setSettings((prev) => {
                            const next = [...prev.scripts];
                            next[index] = { ...next[index], enabled: checked } as ScriptSnippet;
                            return { ...prev, scripts: next };
                          });
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setSettings((prev) => ({
                            ...prev,
                            scripts: prev.scripts.filter((_, i) => i !== index),
                          }));
                        }}
                        className="shrink-0 text-sm text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Payment Methods</h3>
            <p className="text-sm text-neutral-500">
              Enable, disable, and rename the payment options shown at checkout.
            </p>
          </div>

          <div className="space-y-4">
            {settings.paymentMethods.map((method, index) => (
              <div
                key={method.id}
                className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`payment-name-${method.id}`}>
                        Display name
                      </Label>
                      <Input
                        id={`payment-name-${method.id}`}
                        value={method.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setSettings((prev) => {
                            const next = [...prev.paymentMethods];
                            next[index] = { ...next[index]!, name } as PaymentMethod;
                            return { ...prev, paymentMethods: next };
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`payment-desc-${method.id}`}>
                        Description
                      </Label>
                      <Input
                        id={`payment-desc-${method.id}`}
                        value={method.description}
                        onChange={(e) => {
                          const description = e.target.value;
                          setSettings((prev) => {
                            const next = [...prev.paymentMethods];
                            next[index] = {
                              ...next[index]!,
                              description,
                            } as PaymentMethod;
                            return { ...prev, paymentMethods: next };
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={method.enabled}
                      onCheckedChange={(checked) => {
                        setSettings((prev) => {
                          const next = [...prev.paymentMethods];
                          next[index] = {
                            ...next[index]!,
                            enabled: checked,
                          } as PaymentMethod;
                          return { ...prev, paymentMethods: next };
                        });
                      }}
                    />
                    <span className="text-sm text-neutral-600">
                      {method.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {settings.paymentMethods.length === 0 && (
              <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
                <p className="text-neutral-500">
                  No payment methods configured.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "account" && (
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Admin Profile</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Admin Name</Label>
                <Input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Admin name"
                />
              </div>
              <div className="space-y-2">
                <Label>Admin Email</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
            </div>
            <Button
              onClick={handleUpdateAccount}
              disabled={updatingAccount}
              variant="outline"
            >
              {updatingAccount ? "Updating..." : "Update profile"}
            </Button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Change password</h3>
            <div className="space-y-2">
              <Label>Current password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              variant="outline"
            >
              {changingPassword ? "Changing..." : "Change password"}
            </Button>
          </div>
        </div>
      )}

      {activeTab !== "account" && (
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full md:w-auto"
        >
          {saving ? "Saving..." : "Save settings"}
        </Button>
      )}
    </div>
  );
}

