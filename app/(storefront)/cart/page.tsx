"use client";

import Price from "components/price";
import { DEFAULT_OPTION } from "lib/constants";
import { trackInitiateCheckout } from "lib/meta-pixel";
import { createUrl } from "lib/utils";
import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCart } from "components/cart/cart-context";
import { DeleteItemButton } from "components/cart/delete-item-button";
import { EditItemQuantityButton } from "components/cart/edit-item-quantity-button";

type MerchandiseSearchParams = { [key: string]: string };

export default function CartPage() {
  const { cart, updateCartItem } = useCart();
  const router = useRouter();
  const getCachedCta = () => {
    try {
      const cached = localStorage.getItem("cta_style");
      if (cached) return JSON.parse(cached);
    } catch {}
    return { shape: "rounded-full", weight: "font-semibold", bgColor: "#2563eb", textColor: "#ffffff" };
  };
  const [ctaStyle, setCtaStyle] = useState<{ shape: string; weight: string; bgColor: string; textColor: string }>(getCachedCta);

  useEffect(() => {
    fetch("/api/storefront/settings")
      .then((r) => r.json())
      .then((data) => {
        const btn = data?.ctaButtons?.addToCart;
        if (btn) {
          const style = {
            shape: btn.style === "rectangle" ? "rounded-[4px]" : "rounded-full",
            weight: btn.fontWeight === "bold" ? "font-bold" : btn.fontWeight === "normal" ? "font-normal" : "font-semibold",
            bgColor: btn.bgColor || "#2563eb",
            textColor: btn.textColor || "#ffffff",
          };
          setCtaStyle(style);
          try { localStorage.setItem("cta_style", JSON.stringify(style)); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handleCheckout = useCallback(() => {
    if (cart?.lines.length) {
      trackInitiateCheckout({
        content_ids: cart.lines
          .map((item) => item.merchandise.id || item.merchandise.product.id)
          .filter(Boolean),
        content_type: "product",
        value: Number(cart.cost.totalAmount.amount),
        currency: cart.cost.totalAmount.currencyCode,
        num_items: cart.totalQuantity,
      });
    }
    router.push("/checkout");
  }, [cart, router]);

  const colorMap: Record<string, string> = {
    black: "#000000", white: "#ffffff", silver: "#c0c0c0", gold: "#ffd700",
    "rose gold": "#e0bfb8", blue: "#0000ff", red: "#ff0000", green: "#008000",
    brown: "#8b4513", gray: "#808080", grey: "#808080", navy: "#000080",
    beige: "#f5f5dc", cream: "#fffdd0", tan: "#d2b48c", bronze: "#cd7f32",
    titanium: "#878681", cognac: "#9a4a3a",
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#EEF4F8" }}>
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-4 py-4 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <p className="text-base font-bold text-neutral-900">
            My Cart
            {cart && cart.lines.length > 0 && (
              <span className="ml-1.5 font-normal text-neutral-500">
                · {cart.totalQuantity}{" "}
                {cart.totalQuantity === 1 ? "item" : "items"}
              </span>
            )}
          </p>
          <Link href="/shop" style={{ color: ctaStyle.bgColor }} className="text-sm hover:underline">
            Continue Shopping
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
        {!cart || cart.lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <svg className="h-16 w-16 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="mt-6 text-center text-2xl font-bold text-neutral-900">
              Your cart is empty.
            </p>
            <Link
              href="/shop"
              className={`mt-6 bg-blue-600 px-6 py-3 text-sm text-white transition hover:bg-blue-700 ${ctaStyle.shape} ${ctaStyle.weight}`}
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* Items */}
            <ul className="flex flex-col gap-3">
              {cart.lines
                .sort((a, b) =>
                  a.merchandise.product.title.localeCompare(
                    b.merchandise.product.title
                  )
                )
                .map((item, i) => {
                  const merchandiseSearchParams = {} as MerchandiseSearchParams;
                  item.merchandise.selectedOptions.forEach(({ name, value }) => {
                    if (value !== DEFAULT_OPTION)
                      merchandiseSearchParams[name.toLowerCase()] = value;
                  });
                  const merchandiseUrl = createUrl(
                    `/product/${item.merchandise.product.handle}`,
                    new URLSearchParams(merchandiseSearchParams)
                  );
                  const colorOption = item.merchandise.selectedOptions.find(
                    (o) => o.name.toLowerCase() === "color" || o.name.toLowerCase() === "colour"
                  );
                  const colorValue = colorOption?.value;
                  const swatchColor = colorValue
                    ? colorMap[colorValue.toLowerCase()] || colorValue
                    : undefined;

                  return (
                    <li key={i} className="flex w-full flex-col rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-100 md:p-4">
                      <div className="relative flex w-full flex-row justify-between">
                        <div className="flex min-w-0 flex-1 flex-row gap-3">
                          <div className="relative h-20 w-20 flex-none overflow-hidden rounded-lg border border-neutral-200 bg-white md:h-24 md:w-24">
                            <Image
                              className="h-full w-full object-contain p-1"
                              width={96}
                              height={96}
                              alt={item.merchandise.product.image?.altText || item.merchandise.product.title}
                              src={item.merchandise.product.image?.url || item.merchandise.product.featuredImage?.url || ""}
                            />
                          </div>
                          <Link href={merchandiseUrl} className="z-30 flex min-w-0 flex-1 flex-col">
                            <span className="line-clamp-2 text-sm font-semibold leading-tight text-neutral-900">
                              {item.merchandise.product.title}
                            </span>
                            {swatchColor && (
                              <div className="mt-1.5 flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 self-start">
                                <span className="inline-block h-3 w-3 rounded-full ring-1 ring-inset ring-neutral-300" style={{ backgroundColor: swatchColor }} />
                                <span className="text-[11px] font-medium text-neutral-600">{colorValue}</span>
                              </div>
                            )}
                            {item.merchandise.title !== DEFAULT_OPTION && !swatchColor && (
                              <p className="mt-1 text-xs text-neutral-500">{item.merchandise.title}</p>
                            )}
                          </Link>
                        </div>
                        <div className="flex h-20 flex-col items-end justify-between md:h-24">
                          <Price
                            className="flex justify-end text-right text-sm font-semibold text-neutral-900"
                            amount={item.cost.totalAmount.amount}
                            currencyCode={item.cost.totalAmount.currencyCode}
                          />
                          <div className="ml-auto flex h-8 flex-row items-center rounded-full border border-neutral-200 bg-white">
                            <EditItemQuantityButton item={item} type="minus" optimisticUpdate={updateCartItem} />
                            <p className="min-w-[24px] text-center">
                              <span className="text-sm font-semibold text-neutral-900">{item.quantity}</span>
                            </p>
                            <EditItemQuantityButton item={item} type="plus" optimisticUpdate={updateCartItem} />
                          </div>
                          <DeleteItemButton item={item} optimisticUpdate={updateCartItem} />
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>

            {/* Footer */}
            <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-700">Total</p>
                <Price
                  className="text-right text-lg font-bold text-neutral-900"
                  amount={cart.cost.totalAmount.amount}
                  currencyCode={cart.cost.totalAmount.currencyCode}
                />
              </div>
              <div className="my-4 border-t border-neutral-200" />
              <button
                onClick={handleCheckout}
                style={{ backgroundColor: ctaStyle.bgColor, color: ctaStyle.textColor }} className={`flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm transition hover:opacity-90 ${ctaStyle.shape} ${ctaStyle.weight}`}
              >
                <Lock className="h-4 w-4" />
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
