"use client";

import { BanknotesIcon, MapPinIcon, ShoppingCartIcon, TruckIcon } from "@heroicons/react/24/outline";
import { baseUrl } from "lib/utils";
import clsx from "clsx";
import { useCart } from "components/cart/cart-context";
import { useProduct } from "components/product/product-context";
import { Product, ProductVariant } from "lib/sfcc/types";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type CtaBtn = { enabled: boolean; text: string; mobileText?: string; style: "pill" | "rectangle"; fontWeight?: "normal" | "semibold" | "bold"; bgColor?: string; textColor?: string };
type CtaButtons = { addToCart: CtaBtn; call: CtaBtn; whatsapp: CtaBtn; buyNow: CtaBtn };

const defaultCta: CtaButtons = {
  addToCart: { enabled: true, text: "Add To Cart", mobileText: "", style: "pill", fontWeight: "bold", bgColor: "#2563eb", textColor: "#ffffff" },
  call: { enabled: true, text: "Call to Order", mobileText: "", style: "pill", fontWeight: "semibold", bgColor: "#ffffff", textColor: "#111827" },
  whatsapp: { enabled: true, text: "WhatsApp", mobileText: "", style: "pill", fontWeight: "semibold", bgColor: "#16a34a", textColor: "#ffffff" },
  buyNow: { enabled: true, text: "Buy It Now", style: "rectangle", fontWeight: "bold" },
};

export function ProductActions({
  product,
  whatsappPhone,
  storePhone,
  ctaButtons,
}: {
  product: Product;
  whatsappPhone?: string;
  storePhone?: string;
  ctaButtons?: Partial<CtaButtons>;
}) {
  const [cta] = useState<CtaButtons>({ ...defaultCta, ...ctaButtons });
  const { variants, availableForSale } = product;
  // Defensive: tolerate missing/empty variants.
  const safeVariants = variants || [];
  const { addCartItem, cart } = useCart();
  const { state } = useProduct();

  const variant = safeVariants.find((variant: ProductVariant) =>
    (variant.selectedOptions || []).every(
      (option) => option.value === state[option.name.toLowerCase()],
    ),
  );
  const defaultVariant = product.defaultVariant
    ? safeVariants.find((v) => v.title === product.defaultVariant)
    : safeVariants.length === 1 ? safeVariants[0] : undefined;
  const defaultVariantId = defaultVariant?.id;
  const selectedVariantId = variant?.id || defaultVariantId;
  const finalVariant = safeVariants.find(
    (variant) => variant.id === selectedVariantId,
  ) || safeVariants[0];

  const router = useRouter();
  const ctaRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    let hasScrolled = false;
    const onScroll = () => { hasScrolled = true; };
    window.addEventListener("scroll", onScroll, { once: true });
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (hasScrolled) setStickyVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);

  const handleAdd = () => {
    if (!finalVariant) return;
    const alreadyInCart = cart?.lines.some(
      (item) => item.merchandise.id === finalVariant.id
    );
    if (alreadyInCart) { setShowDuplicateModal(true); return; }
    addCartItem(finalVariant, product);
  };

  const handleBuyNow = () => {
    if (!finalVariant) return;
    const alreadyInCart = cart?.lines.some(
      (item) => item.merchandise.id === finalVariant.id
    );
    if (!alreadyInCart) addCartItem(finalVariant, product);
    // Small delay to let cart state persist to localStorage before navigation
    setTimeout(() => router.push("/checkout"), 80);
  };

  const renderBuyNow = (className?: string, mobile?: boolean) => {
    const base = clsx(
      "flex w-full items-center justify-center gap-2 tracking-wide",
      shapeClass(resolvedCta.buyNow?.style || "rectangle"),
      weightClass(resolvedCta.buyNow?.fontWeight),
      !className && "p-4",
      className
    );
    if (!availableForSale || !selectedVariantId) return null;
    return (
      <button onClick={handleBuyNow} style={{ backgroundColor: resolvedCta.buyNow?.bgColor || "#f97316", color: resolvedCta.buyNow?.textColor || "#ffffff" }} className={clsx(base, "hover:opacity-90")} type="button">
        {mobile ? (resolvedCta.buyNow?.mobileText || resolvedCta.buyNow?.text || "Buy It Now") : (resolvedCta.buyNow?.text || "Buy It Now")}
      </button>
    );
  };

  const phone = whatsappPhone?.trim() || "";
  const cleanPhone = phone.replace(/\D/g, "");

  // Build URL from context state so it always matches the selected variant
  const params = new URLSearchParams();
  Object.entries(state).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0 && key !== "image" && !key.startsWith("_")) {
      params.set(key, value);
    }
  });
  if (state.image) params.set("image", state.image);
  const search = params.toString();
  const productUrl = typeof window !== "undefined"
    ? `${window.location.origin}/product/${product.handle}${search ? `?${search}` : ""}`
    : `${baseUrl}/product/${product.handle}`;

  const variantName = finalVariant?.title || finalVariant?.selectedOptions?.map((o) => o.value).join(" / ") || "";
  const price = finalVariant?.price?.amount
    ? `${product.currencyCode} ${Number(finalVariant.price.amount).toFixed(2)}/=`
    : "";
  const whatsappText = encodeURIComponent(
    `Hi, I want to buy:\n\n*${product.title}*\n*Url:* ${productUrl}\n*Variant:* ${variantName}\n*Price:* ${price}\n\nThank you.`,
  );
  const whatsappLink = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${whatsappText}`
    : "#";

  const [showPhone, setShowPhone] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const cartButtonClasses =
      "flex w-full items-center justify-center gap-2 rounded-[4px] bg-blue-600 tracking-wide text-white";
  const disabledClasses = "cursor-not-allowed opacity-60 hover:opacity-60";

  const storePhoneClean = storePhone?.trim() || "";
  const telLink = storePhoneClean ? `tel:${storePhoneClean.replace(/\D/g, "")}` : "#";

  const resolvedCta = cta || defaultCta;
  const shapeClass = (style: string) => style === "rectangle" ? "rounded-[4px]" : "rounded-full";
  const weightClass = (w?: string) => w === "bold" ? "font-bold" : w === "semibold" ? "font-semibold" : "font-normal";

  const renderAddToCart = (className?: string, mobile?: boolean) => {
    const base = clsx(
      "flex w-full items-center justify-center gap-2 tracking-wide",
      shapeClass(resolvedCta.addToCart.style),
      weightClass(resolvedCta.addToCart.fontWeight),
      !className && "p-4",
      className
    );
    const btnStyle = { backgroundColor: resolvedCta.addToCart.bgColor || "#2563eb", color: resolvedCta.addToCart.textColor || "#ffffff" };
    if (!availableForSale) {
      return (
        <button disabled style={btnStyle} className={clsx(base, disabledClasses)}>
          Out Of Stock
        </button>
      );
    }
    if (!selectedVariantId) {
      return (
        <button disabled style={btnStyle} className={clsx(base, disabledClasses)}>
          <ShoppingCartIcon className="h-4 w-4 shrink-0" />
          {mobile ? (resolvedCta.addToCart.mobileText || resolvedCta.addToCart.text || "Add To Cart") : (resolvedCta.addToCart.text || "Add To Cart")}
        </button>
      );
    }
    return (
      <button onClick={handleAdd} style={btnStyle} className={clsx(base, "hover:opacity-90")} type="button">
        <ShoppingCartIcon className="h-4 w-4 shrink-0" />
        {mobile ? (resolvedCta.addToCart.mobileText || resolvedCta.addToCart.text || "Add To Cart") : (resolvedCta.addToCart.text || "Add To Cart")}
      </button>
    );
  };

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden space-y-2 md:block md:space-y-3">
        {renderAddToCart()}
        {resolvedCta.buyNow?.enabled && renderBuyNow()}
        {storePhoneClean && resolvedCta.call.enabled && (
          <button
            onClick={() => { if (showPhone) { window.location.href = telLink; } else { setShowPhone(true); } }}
            className={`relative flex w-full items-center justify-center border-2 p-4 tracking-wide transition-colors ${shapeClass(resolvedCta.call.style)} ${weightClass(resolvedCta.call.fontWeight)}`}
            style={{ borderColor: resolvedCta.call.bgColor || "#111827", color: resolvedCta.call.textColor === "#ffffff" ? (resolvedCta.call.bgColor || "#111827") : (resolvedCta.call.textColor || "#111827"), backgroundColor: "transparent" }}
            type="button"
          >
            {showPhone ? storePhoneClean : (resolvedCta.call.text || "Call to Order")}
          </button>
        )}
        {phone && resolvedCta.whatsapp.enabled && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative flex w-full items-center justify-center p-4 tracking-wide transition-colors hover:opacity-90 ${shapeClass(resolvedCta.whatsapp.style)} ${weightClass(resolvedCta.whatsapp.fontWeight)}`}
            style={{ backgroundColor: resolvedCta.whatsapp.bgColor || "#16a34a", color: resolvedCta.whatsapp.textColor || "#ffffff" }}
          >
            {resolvedCta.whatsapp.text || "WhatsApp"}
          </a>
        )}
      </div>

            {/* Mobile inline CTAs — observed to show/hide sticky bar */}
      <div ref={ctaRef} className="md:hidden flex flex-col gap-2 mt-2">
        {renderAddToCart("p-3 text-sm")}
        {resolvedCta.buyNow?.enabled && renderBuyNow("p-3 text-sm")}
        {phone && resolvedCta.whatsapp.enabled && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex w-full items-center justify-center gap-1.5 p-3 text-sm ${shapeClass(resolvedCta.whatsapp.style)} ${weightClass(resolvedCta.whatsapp.fontWeight)}`}
            style={{ backgroundColor: resolvedCta.whatsapp.bgColor || "#16a34a", color: resolvedCta.whatsapp.textColor || "#ffffff" }}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.284A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {resolvedCta.whatsapp.text || "WhatsApp"}
          </a>
        )}
        {storePhoneClean && resolvedCta.call.enabled && (
          <a
            href={telLink}
            className={`flex w-full items-center justify-center gap-1.5 border-2 border-neutral-900 p-3 text-sm text-neutral-900 ${shapeClass(resolvedCta.call.style)} ${weightClass(resolvedCta.call.fontWeight)}`}
          >
            {resolvedCta.call.text || "Call to Order"}
          </a>
        )}
      </div>

      {/* Trust badges */}
      <div className="mt-2 space-y-1 md:mt-8 md:space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-2.5 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <BanknotesIcon className="h-3 w-3" />
          </div>
          <div>
            <p className="text-xs font-semibold text-green-800">Cash on Delivery</p>
            <p className="text-[11px] text-green-700/80">Pay when you receive your order</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <TruckIcon className="h-3 w-3" />
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-800">Cheap Delivery Rates</p>
            <p className="text-[11px] text-blue-700/80">Parcel Fees - <span className="font-bold">Ksh 190</span> Only Countrywide</p>
          </div>
        </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
            <MapPinIcon className="h-3 w-3" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">Fast Local Shipping</p>
            <p className="text-[11px] text-slate-600">Delivered within Nairobi & across Kenya</p>
          </div>
        </div>
      </div>

            {/* Mobile sticky bar */}
      {(phone || storePhoneClean) && stickyVisible && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-1.5 border-t border-neutral-200 bg-white/95 px-3 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur supports-[padding:max(0px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          {/* Row 1: Call icon + Add to Cart + Buy Now */}
          <div className="flex items-center gap-2">
            {storePhoneClean && resolvedCta.call.enabled && (
              <a
                href={telLink}
                className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-lg"
                aria-label="Call to order"
              >
                <span className="absolute inset-0 rounded-full bg-black animate-ping opacity-20"></span>
                <span className="absolute inset-0 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.6)]"></span>
                <svg className="relative h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            )}
            {resolvedCta.addToCart.enabled && (
              <div className="min-w-0 flex-1">{renderAddToCart("p-3 text-sm", true)}</div>
            )}
            {resolvedCta.buyNow?.enabled && renderBuyNow("p-3 text-sm", true) && (
              <div className="min-w-0 flex-1">{renderBuyNow("p-3 text-sm", true)}</div>
            )}
          </div>
          {/* Row 2: WhatsApp full width */}
          {phone && resolvedCta.whatsapp.enabled && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex w-full items-center justify-center gap-2 py-2.5 text-sm ${shapeClass(resolvedCta.whatsapp.style)} ${weightClass(resolvedCta.whatsapp.fontWeight)}`}
              style={{ backgroundColor: resolvedCta.whatsapp.bgColor || "#16a34a", color: resolvedCta.whatsapp.textColor || "#ffffff" }}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.284A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              {resolvedCta.whatsapp.mobileText || resolvedCta.whatsapp.text || "WhatsApp"}
            </a>
          )}
        </div>
      )}

            {/* Mobile: only Add to Cart if no WhatsApp and no store phone */}
      {!phone && !storePhoneClean && (
        <div className="md:hidden">{renderAddToCart()}</div>
      )}

      {/* Duplicate item modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowDuplicateModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <svg className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6h13M10 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
              </svg>
            </div>
            {/* Text */}
            <h3 className="mb-1 text-center text-base font-bold text-neutral-900">
              Already in Your Cart
            </h3>
            <p className="mb-5 text-center text-sm text-neutral-500">
              This item is already in your cart. Ready to check out, or would you like to keep shopping?
            </p>
            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowDuplicateModal(false); window.dispatchEvent(new Event("cart:item-added")); }}
                className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-neutral-900 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              >
                View Cart
              </button>
              <a
                href="/checkout"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Proceed to Checkout
              </a>
            </div>
            <div className="mt-3 text-center">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600 transition-colors"
              >
                Continue browsing
              </button>
            </div>
                        {/* Close */}
            <button
              onClick={() => setShowDuplicateModal(false)}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
