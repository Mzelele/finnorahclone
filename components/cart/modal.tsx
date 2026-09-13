"use client";

import { Dialog, Transition } from "@headlessui/react";
import Price from "components/price";
import { DEFAULT_OPTION } from "lib/constants";
import { trackInitiateCheckout } from "lib/meta-pixel";
import { createUrl } from "lib/utils";
import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useCart } from "./cart-context";
import { DeleteItemButton } from "./delete-item-button";
import { EditItemQuantityButton } from "./edit-item-quantity-button";
import OpenCart from "./open-cart";

type MerchandiseSearchParams = {
  [key: string]: string;
};

export default function CartModal({ navbarDark }: { navbarDark?: boolean }) {
  const { cart, updateCartItem } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const [ctaStyle, setCtaStyle] = useState<{ shape: string; weight: string }>({ shape: "rounded-full", weight: "font-semibold" });

  useEffect(() => {
    fetch("/api/storefront/settings")
      .then((r) => r.json())
      .then((data) => {
        const btn = data?.ctaButtons?.addToCart;
        if (btn) {
          setCtaStyle({
            shape: btn.style === "rectangle" ? "rounded-[4px]" : "rounded-full",
            weight: btn.fontWeight === "bold" ? "font-bold" : btn.fontWeight === "normal" ? "font-normal" : "font-semibold",
          });
        }
      })
      .catch(() => {});
  }, []);
  const pathname = usePathname();
  const router = useRouter();

    const handleCheckout = useCallback(() => {
    // Fire pixel
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
    // Navigate immediately — the pathname change will close the drawer
    if (pathname !== "/checkout") {
      router.push("/checkout");
    } else {
      closeCart();
    }
  }, [cart, pathname, router]);

  useEffect(() => {
    const onItemAdded = () => openCart();
    window.addEventListener("cart:item-added", onItemAdded);
    return () => window.removeEventListener("cart:item-added", onItemAdded);
  }, []);

  useEffect(() => {
    closeCart();
  }, [pathname]);

  useEffect(() => {
    const onUpdate = () => {
      // force re-read from localStorage by dispatching a no-op
      // the cart-context already updates its own state
    };
    window.addEventListener("cart-updated", onUpdate);
    return () => window.removeEventListener("cart-updated", onUpdate);
  }, []);

  return (
    <>
      <button aria-label="Open cart" onClick={openCart}>
        <OpenCart quantity={cart?.totalQuantity} navbarDark={navbarDark} />
      </button>
      <Transition show={isOpen}>
        <Dialog onClose={closeCart} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="opacity-0 backdrop-blur-none"
            enterTo="opacity-100 backdrop-blur-[.5px]"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="opacity-100 backdrop-blur-[.5px]"
            leaveTo="opacity-0 backdrop-blur-none"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel className="fixed bottom-0 right-0 top-0 flex h-full w-full flex-col border-l border-neutral-200 text-neutral-900 md:w-[420px]" style={{ backgroundColor: "#EEF4F8" }}>
              {/* Header — matches main navbar height, shadow and dark/light styling */}
              <div className={`border-b px-3 py-2 shadow-md md:px-6 md:py-3 ${navbarDark ? "border-neutral-700 bg-black" : "border-neutral-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-bold md:text-base ${navbarDark ? "text-white" : "text-neutral-900"}`}>
                    My Cart
                    {cart && cart.lines.length > 0 ? (
                      <span className="ml-1.5 font-normal text-neutral-500">· {cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "items"}</span>
                    ) : null}
                  </p>
                  <button aria-label="Close cart" onClick={closeCart}>
                    <CloseCart navbarDark={navbarDark} />
                  </button>
                </div>
              </div>

              {!cart || cart.lines.length === 0 ? (
                <div className="mt-20 flex w-full flex-col items-center justify-center overflow-hidden px-5">
                  <svg className="h-16 w-16 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="mt-6 text-center text-2xl font-bold text-neutral-900">
                    Your cart is empty.
                  </p>
                  <Link
                    href="/shop"
                    onClick={closeCart}
                    className={`mt-6 bg-blue-600 px-6 py-3 text-sm text-white transition hover:bg-blue-700 ${ctaStyle.shape} ${ctaStyle.weight}`}
                  >
                    Continue Shopping
                  </Link>
                </div>
              ) : (
                <div className="flex h-full flex-col justify-between overflow-hidden">
                  {/* Product list */}
                  <div className="grow overflow-auto px-5 pt-4 md:px-7 md:pt-5">
                    <ul className="flex flex-col gap-3">
                    {cart.lines
                      .sort((a, b) =>
                        a.merchandise.product.title.localeCompare(
                          b.merchandise.product.title,
                        ),
                      )
                      .map((item, i) => {
                        const merchandiseSearchParams =
                          {} as MerchandiseSearchParams;

                        item.merchandise.selectedOptions.forEach(
                          ({ name, value }) => {
                            if (value !== DEFAULT_OPTION) {
                              merchandiseSearchParams[name.toLowerCase()] =
                                value;
                            }
                          },
                        );

                        const merchandiseUrl = createUrl(
                          `/product/${item.merchandise.product.handle}`,
                          new URLSearchParams(merchandiseSearchParams),
                        );

                        // Determine the color value for a swatch — look for a "Color" option
                        const colorOption = item.merchandise.selectedOptions.find(
                          (o) => o.name.toLowerCase() === "color" || o.name.toLowerCase() === "colour",
                        );
                        const colorValue = colorOption?.value;
                        // Map common color names to hex for swatch display
                        const colorMap: Record<string, string> = {
                          black: "#000000",
                          white: "#ffffff",
                          silver: "#c0c0c0",
                          gold: "#ffd700",
                          "rose gold": "#e0bfb8",
                          blue: "#0000ff",
                          red: "#ff0000",
                          green: "#008000",
                          brown: "#8b4513",
                          gray: "#808080",
                          grey: "#808080",
                          navy: "#000080",
                          beige: "#f5f5dc",
                          cream: "#fffdd0",
                          tan: "#d2b48c",
                          bronze: "#cd7f32",
                          titanium: "#878681",
                          cognac: "#9a4a3a",
                        };
                        const swatchColor = colorValue ? colorMap[colorValue.toLowerCase()] || colorValue : undefined;

                        return (
                          <li
                            key={i}
                            className="flex w-full flex-col rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-100 md:p-4"
                          >
                            <div className="relative flex w-full flex-row justify-between">
  
                              <div className="flex min-w-0 flex-1 flex-row gap-3">
                                <div className="relative h-20 w-20 flex-none overflow-hidden rounded-lg border border-neutral-200 bg-white md:h-24 md:w-24">
                                  <Image
                                    className="h-full w-full object-contain p-1"
                                    width={96}
                                    height={96}
                                    alt={
                                      item.merchandise.product.image?.altText ||
                                      item.merchandise.product.featuredImage
                                        ?.altText ||
                                      item.merchandise.product.title
                                    }
                                    src={
                                      item.merchandise.product.image?.url ||
                                      item.merchandise.product.featuredImage
                                        ?.url ||
                                      ""
                                    }
                                  />
                                </div>
                                <Link
                                  href={merchandiseUrl}
                                  onClick={closeCart}
                                  className="z-30 flex min-w-0 flex-1 flex-col"
                                >
                                  <span className="line-clamp-2 text-sm font-semibold leading-tight text-neutral-900">
                                    {item.merchandise.product.title}
                                  </span>
                                  {/* Color swatch pill */}
                                  {swatchColor && (
                                    <div className="mt-1.5 flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 self-start">
                                      <span
                                        className="inline-block h-3 w-3 rounded-full ring-1 ring-inset ring-neutral-300"
                                        style={{ backgroundColor: swatchColor }}
                                      />
                                      <span className="text-[11px] font-medium text-neutral-600">{colorValue}</span>
                                    </div>
                                  )}
                                  {item.merchandise.title !== DEFAULT_OPTION && !swatchColor ? (
                                    <p className="mt-1 text-xs text-neutral-500">
                                      {item.merchandise.title}
                                    </p>
                                  ) : null}
                                </Link>
                              </div>
                              <div className="flex h-20 flex-col items-end justify-between md:h-24">
                                <Price
                                  className="flex justify-end text-right text-sm font-semibold text-neutral-900"
                                  amount={item.cost.totalAmount.amount}
                                  currencyCode={
                                    item.cost.totalAmount.currencyCode
                                  }
                                />
                                <div className="ml-auto flex h-8 flex-row items-center rounded-full border border-neutral-200 bg-white">
                                  <EditItemQuantityButton
                                    item={item}
                                    type="minus"
                                    optimisticUpdate={updateCartItem}
                                  />
                                  <p className="min-w-[24px] text-center">
                                    <span className="text-sm font-semibold text-neutral-900">
                                      {item.quantity}
                                    </span>
                                  </p>
                                  <EditItemQuantityButton
                                    item={item}
                                    type="plus"
                                    optimisticUpdate={updateCartItem}
                                  />
                                </div>
                                <DeleteItemButton
                                  item={item}
                                  optimisticUpdate={updateCartItem}
                                />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {/* Checkout footer */}
                  <div className="border-t border-neutral-200/80 bg-white px-5 pb-5 pt-4 md:px-7 md:pb-6 md:pt-5">
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
                                          className={`flex w-full items-center justify-center gap-2 bg-blue-600 px-5 py-3.5 text-sm text-white transition hover:bg-blue-700 ${ctaStyle.shape} ${ctaStyle.weight}`}
                                        >
                                          <Lock className="h-4 w-4" />
                                          Proceed to Checkout
                                        </button>
                  </div>
                </div>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  );
}

function CloseCart({ navbarDark, className }: { navbarDark?: boolean; className?: string }) {
  return (
    <div className={"relative flex h-11 w-11 items-center justify-center rounded-md transition-colors " + (navbarDark ? "border-neutral-700 text-white" : "border-neutral-200 text-neutral-900") }>
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
      </svg>
    </div>
  );
}
