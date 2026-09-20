"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "components/cart/cart-context";
import Price from "components/price";
import { ChevronDown, Pencil } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNotes, setShowNotes] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Selected payment method: "mpesa" triggers the M-Pesa STK push flow;
  // "cash_on_delivery" is the default and requires no online payment.
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "mpesa">(
    "cash_on_delivery"
  );
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<string>("standard");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    region: "",
    country: "Kenya",
    notes: "",
    website: "", // honeypot anti-spam field (hidden from humans)
  });

  const [settings, setSettings] = useState<{
    shippingCost: number;
    freeShippingThreshold: number;
    shippingNote: string;
    currency: string;
    deliveryMethods: { id: string; name: string; description: string; price: number; enabled: boolean }[];
    paymentMethods: { id: "cash_on_delivery" | "mpesa"; name: string; description: string; enabled: boolean }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/storefront/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          const paymentMethods = Array.isArray(data.paymentMethods)
            ? data.paymentMethods
            : [
                {
                  id: "cash_on_delivery",
                  name: "Cash on Delivery",
                  description: "Pay on delivery.",
                  enabled: true,
                },
                {
                  id: "mpesa",
                  name: "M-Pesa (Receive Prompt)",
                  description: "You'll receive an M-Pesa prompt on your phone after placing your order.",
                  enabled: true,
                },
              ];
          const deliveryMethods = Array.isArray(data.deliveryMethods) && data.deliveryMethods.length > 0
            ? data.deliveryMethods
            : [{ id: "standard", name: "Standard Delivery", description: "2-3 business days", price: data.shippingCost ?? 200, enabled: true }];
          setSettings({
            shippingCost: data.shippingCost ?? 200,
            freeShippingThreshold: data.freeShippingThreshold ?? 5000,
            shippingNote: data.shippingNote || "",
            currency: data.currency || "KES",
            deliveryMethods,
            paymentMethods,
          });
          const enabledDelivery = deliveryMethods.filter((m: any) => m.enabled);
          if (enabledDelivery.length > 0) setSelectedDeliveryMethod(enabledDelivery[0].id);
          const enabled = paymentMethods.filter((m: any) => m.enabled);
          if (enabled.length > 0) {
            setPaymentMethod(enabled[0].id);
          }
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  if (cart === undefined) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-neutral-500">Loading checkout…</p>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-neutral-500">Your cart is empty.</p>
      </div>
    );
  }

  const subtotal = Number(cart.cost.subtotalAmount.amount);
  const isFreeShipping = (settings?.freeShippingThreshold ?? 5000) > 0 && subtotal >= (settings?.freeShippingThreshold ?? 5000);
  const activeDelivery = (settings?.deliveryMethods ?? []).find((m) => m.id === selectedDeliveryMethod);
  const shippingCost = isFreeShipping ? 0 : (activeDelivery ? activeDelivery.price : settings?.shippingCost ?? 200);
  const total = subtotal + shippingCost;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required";
    if (!form.phone.trim()) errs.phone = "Phone number is required";
    if (!form.email.trim()) {
      // email is optional
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Please enter a valid email address";
    }
    return errs;
  };

  // Scroll back up to the phone field and focus it so the customer can edit
  // the number that will receive the M-Pesa prompt.
  const editPhone = () => {
    const el = document.getElementById("phoneInput");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement).focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const items = cart.lines.map((line) => {
      const unitPrice = Number(line.cost.totalAmount.amount) / line.quantity;
      const isSimpleProduct = line.merchandise.id === line.merchandise.product.id;
      return {
        productId: line.merchandise.product.id,
        variantId: isSimpleProduct ? undefined : line.merchandise.id,
        quantity: line.quantity,
        price: unitPrice,
        name: line.merchandise.title && line.merchandise.title !== "Default Title" && !isSimpleProduct ? `${line.merchandise.product.title} — ${line.merchandise.title}` : line.merchandise.product.title,
        sku: line.merchandise.sku || line.merchandise.product.sku || "",
        image:
          line.merchandise.product.image?.url ||
          line.merchandise.product.featuredImage?.url ||
          "",
      };
    });

    try {
      const res = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shippingAddress: {
            fullName: form.fullName,
            phone: form.phone,
            email: form.email,
            address: form.address,
            city: form.city,
            region: form.region,
            country: form.country,
            notes: form.notes,
          },
          // Send the chosen payment method so the order-creation route knows
          // whether to trigger the M-Pesa STK push.
          paymentMethod,
          deliveryMethod: selectedDeliveryMethod,
          deliveryMethodName: activeDelivery?.name || "",
          subtotal,
          shippingCost,
          total,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to place order");

            localStorage.removeItem("cart");
      window.dispatchEvent(new Event("cart-updated"));

      // Save customer data for account page
      localStorage.setItem("customerEmail", form.email || `${form.phone}@placeholder.local`);
      localStorage.setItem("customerPhone", form.phone);
      localStorage.setItem("customerName", form.fullName);

      // Pass both the order id and (for M-Pesa) the CheckoutRequestID so the
      // success page can begin live-polling the payment result.
      const cid = data.checkoutRequestId
        ? `&checkoutRequestId=${encodeURIComponent(data.checkoutRequestId)}`
        : "";
      router.push(`/checkout/success?orderId=${data.orderId}${cid}`);
    } catch (err: any) {
      setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const orderSummaryBody = (
    <>
      <div className="space-y-2 bg-neutral-50/70 px-4 py-3">
        {cart.lines.map((line, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-2 py-2 shadow-sm min-w-0">
            <div className="relative h-12 w-12 flex-none overflow-hidden rounded border border-neutral-200 bg-white">
              <Image
                src={
                  line.merchandise.product.image?.url ||
                  line.merchandise.product.featuredImage?.url ||
                  ""
                }
                alt={line.merchandise.product.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900">
                {line.merchandise.product.title}
              </p>
              {line.merchandise.title && line.merchandise.title !== "Default Title" ? (
                <p className="text-xs text-neutral-500">{line.merchandise.title}</p>
              ) : (
                <p className="text-xs text-neutral-500">Qty: {line.quantity}</p>
              )}
            </div>
            <Price
              className="flex-none text-sm text-neutral-900"
              amount={line.cost.totalAmount.amount}
              currencyCode={line.cost.totalAmount.currencyCode}
            />
          </div>
        ))}
      </div>
      <div className="px-4 pb-1 pt-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("cart:item-added"))}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          ← Edit Cart
        </button>
      </div>
      <div className="border-t border-neutral-200 bg-white px-4 py-3 space-y-1.5 text-sm">
        {(settings?.shippingNote ?? "") && (
          <p className="text-xs text-neutral-500">{settings?.shippingNote ?? ""}</p>
        )}
        <div className="flex justify-between">
          <span className="text-neutral-600">Subtotal</span>
          <Price amount={subtotal.toString()} currencyCode={cart.cost.subtotalAmount.currencyCode} />
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600">Delivery</span>
          {shippingCost === 0 ? (
            <span className="text-sm font-medium text-green-600">Free</span>
          ) : (
            <Price amount={shippingCost.toString()} currencyCode={cart.cost.subtotalAmount.currencyCode} />
          )}
        </div>
        <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-bold text-neutral-900">
          <span>Total</span>
          <Price amount={total.toString()} currencyCode={cart.cost.subtotalAmount.currencyCode} />
        </div>
      </div>
    </>
  );

  // Grab the first cart item's image for the trigger thumbnail
  const firstLine = cart.lines[0];
  const firstImage =
    firstLine?.merchandise.product.image?.url ||
    firstLine?.merchandise.product.featuredImage?.url ||
    "";

  return (
    <div className="grid gap-6 md:gap-8 md:grid-cols-2 items-start">
      <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
        {errors.form && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
            {errors.form}
          </div>
        )}

        {/* Delivery Information Card */}
        <div className="rounded-lg border border-neutral-200 bg-white shadow-md overflow-hidden flex flex-col">
          {/* Mobile: Checkout header */}
          <div className="bg-neutral-50/80 px-4 py-3 border-b border-neutral-200 md:hidden">
            <h2 className="text-base font-semibold text-neutral-900">Delivery Info</h2>
          </div>

          <div className="space-y-4 p-4 flex-1">
            <div className="space-y-2">
              <Input
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Full names"
              />
              {errors.fullName && <p className="text-xs text-red-500">{errors.fullName}</p>}
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Input
                  id="phoneInput"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone number"
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Input
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="City/Town"
                />
                {errors.city && <p className="text-xs text-red-500">{errors.city}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Input
                type="email"
                autoComplete="email"
                name="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email address (Optional)"
              />
            </div>

            <div className="space-y-2">
              <Textarea
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Street address, apartment, suite..."
                className="min-h-10 bg-neutral-50"
              />
              {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
            </div>

          </div>

          <div className="border-t border-neutral-200 p-4 space-y-4">
            {/* Delivery method selection */}
            {settings && (settings?.deliveryMethods ?? []).filter((m) => m.enabled).length > 0 && !isFreeShipping && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700">Delivery method</p>
                <div className="space-y-2">
                  {(settings?.deliveryMethods ?? []).filter((m) => m.enabled).map((method) => {
                    const isSelected = selectedDeliveryMethod === method.id;
                    return (
                      <label
                        key={method.id}
                        className={`block rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                          isSelected ? "border-neutral-900 bg-neutral-100" : "border-neutral-200 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="deliveryMethod"
                              value={method.id}
                              checked={isSelected}
                              onChange={() => setSelectedDeliveryMethod(method.id)}
                              className="h-4 w-4 text-neutral-900"
                            />
                            <span className="text-sm font-medium">{method.name}</span>
                          </span>
                          <span className="text-sm font-semibold text-neutral-900">
                            {method.price === 0 ? <span className="text-green-600">Free</span> : `KES ${method.price.toLocaleString()}`}
                          </span>
                        </span>
                        {method.description && (
                          <span className="mt-1 block pl-6 text-xs text-neutral-500">{method.description}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {isFreeShipping && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5">
                <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-green-700">You&apos;re eligible for free delivery!</span>
              </div>
            )}

            {/* Payment method selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Payment method</p>
              <div className="space-y-2">
                {settings && (settings?.paymentMethods ?? [])
                  .filter((m) => m.enabled)
                  .map((method) => {
                    const isSelected = paymentMethod === method.id;
                    return (
                      <label
                        key={method.id}
                        className={`block rounded-md border px-3 py-2.5 cursor-pointer ${
                          isSelected
                            ? method.id === "mpesa"
                              ? "border-emerald-600 bg-emerald-50"
                              : "border-neutral-900 bg-neutral-100"
                            : "border-neutral-200 bg-white"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.id}
                            checked={isSelected}
                            onChange={() => setPaymentMethod(method.id)}
                            className={`h-4 w-4 ${
                              method.id === "mpesa"
                                ? "text-emerald-600"
                                : "text-neutral-900"
                            }`}
                          />
                          <span className="text-sm font-medium">
                            {method.name}
                          </span>
                        </span>
                        {isSelected && method.id === "mpesa" && (
                          <span className="mt-1.5 flex items-center pl-6 text-xs text-neutral-500">
                            Send prompt to&nbsp;
                            <span className="font-medium text-neutral-700">
                              {form.phone || "your number"}
                            </span>
                            <button
                              type="button"
                              onClick={editPhone}
                              className="ml-1 inline-flex items-center align-middle text-neutral-400 hover:text-neutral-900"
                              title="Edit phone number"
                              aria-label="Edit phone number"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                        {isSelected && method.description && method.id !== "mpesa" && (
                          <span className="mt-1.5 block pl-6 text-xs text-neutral-500">
                            {method.description}
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Mobile order summary - immediately above place order button */}
            <div className="md:hidden border border-neutral-200 rounded-lg overflow-hidden">
              <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                <CollapsibleTrigger className="group flex w-full items-center gap-3 bg-neutral-100/60 px-4 py-3 text-left transition-colors hover:bg-neutral-100 data-[state=open]:bg-white">
                  {firstImage && !summaryOpen && (
                    <div className="relative h-10 w-10 flex-none overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
                      <Image
                        src={firstImage}
                        alt={firstLine?.merchandise.product.title ?? ""}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <span className="flex flex-1 flex-col leading-tight">
                    <span className="text-sm font-semibold text-neutral-900">
                      {summaryOpen ? "Order Summary" : "Total"}
                    </span>
                    {!summaryOpen && (
                      <span className="text-xs text-neutral-500">
                        {cart.lines.length} {cart.lines.length === 1 ? "item" : "items"}
                      </span>
                    )}
                  </span>
                  {!summaryOpen && (
                    <Price
                      className="flex-none text-sm font-semibold text-neutral-900"
                      amount={total.toString()}
                      currencyCode={cart.cost.subtotalAmount.currencyCode}
                    />
                  )}
                  <ChevronDown
                    className={`h-4 w-4 flex-none text-neutral-500 transition-transform ${
                      summaryOpen ? "rotate-180" : ""
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>{orderSummaryBody}</CollapsibleContent>
              </Collapsible>
            </div>

            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? "Placing Order..." : "Place Order"}
            </Button>
          </div>
        </div>
      </form>

      {/* Order Summary - desktop */}
      <div className="hidden md:block rounded-lg border border-neutral-200 bg-white shadow-sm min-w-0 overflow-hidden">
        <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
          <h2 className="text-base font-semibold text-neutral-900">Order Summary</h2>
        </div>
        {orderSummaryBody}
      </div>
    </div>
  );
}
