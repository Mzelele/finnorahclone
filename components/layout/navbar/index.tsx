"use client";
import clsx from "clsx";
import { CategoryIcon } from "components/category-icon";
import LogoSquare from "components/logo-square";
import { Collection, Menu } from "lib/sfcc/types";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import MenuDrawer from "./menu-drawer";
import MobileSearch from "./mobile-search";
import ProfileDropdown from "./profile-dropdown";
import Search, { SearchSkeleton } from "./search";
import WishlistNav from "./wishlist-nav";

const CartModal = dynamic(() => import("components/cart/modal"), { ssr: false });

function CategoryBar({ categories, dark }: { categories: Collection[]; dark: boolean }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [categories.length]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
    setTimeout(checkScroll, 320);
  };

  if (!categories.length) return null;

  return (
    <div className={clsx(
      "relative border-t",
      dark ? "border-neutral-800 bg-neutral-900" : "border-neutral-100 bg-neutral-50"
    )}>
      <div className="relative mx-auto max-w-7xl">
        {/* Left fade + button */}
        {showLeft && (
          <div className={clsx("absolute left-0 top-0 z-10 flex h-full items-center",
            dark ? "bg-gradient-to-r from-neutral-900 via-neutral-900/80 to-transparent" : "bg-gradient-to-r from-neutral-50 via-neutral-50/80 to-transparent"
          )}>
            <button
              onClick={() => scroll("left")}
              className={clsx("ml-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition",
                dark ? "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
              )}
            >
              ‹
            </button>
          </div>
        )}

        {/* Scrollable category list */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="scrollbar-hide flex items-center gap-0 overflow-x-auto px-3 lg:px-6"
          style={{ scrollBehavior: "smooth" }}
        >
          {/* All Products first */}
          <Link
            href="/shop"
            className={clsx(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors",
              pathname === "/shop"
                ? "border-red-600 text-red-600"
                : dark
                  ? "border-transparent text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                  : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
            )}
          >
            All Products
          </Link>

          {categories.map((cat) => {
            const isActive = pathname === cat.path || pathname?.startsWith(cat.path + "/");
            return (
              <Link
                key={cat.handle}
                href={cat.path}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors",
                  isActive
                    ? "border-red-600 text-red-600"
                    : dark
                      ? "border-transparent text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                      : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
                )}
              >
                {(cat.emoji || cat.image) && (
                  <span className="shrink-0 text-sm">
                    <CategoryIcon
                      value={cat.emoji}
                      iconClassName="text-current"
                    />
                  </span>
                )}
                {cat.title}
              </Link>
            );
          })}
        </div>

        {/* Right fade + button */}
        {showRight && (
          <div className={clsx("absolute right-0 top-0 z-10 flex h-full items-center",
            dark ? "bg-gradient-to-l from-neutral-900 via-neutral-900/80 to-transparent" : "bg-gradient-to-l from-neutral-50 via-neutral-50/80 to-transparent"
          )}>
            <button
              onClick={() => scroll("right")}
              className={clsx("mr-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition",
                dark ? "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
              )}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Navbar({
  menu,
  categories,
  pages = [],
  settings,
}: {
  menu: any[];
  categories: Collection[];
  pages?: Menu[];
  settings: Record<string, any>;
}) {
  const iconUrl = settings.faviconUrl && settings.faviconUrl !== "/favicon.ico" ? settings.faviconUrl : undefined;
  const pathname = usePathname();
  const isCheckout = pathname?.startsWith("/checkout") ?? false;
  const dark = Boolean(settings?.navbarDark);

  return (
    <nav className={clsx("sticky top-0 z-50 shadow-md", dark ? "bg-black" : "bg-white")}>
      {/* Main navbar row */}
      <div className={clsx("px-3 pb-2 pt-2 lg:px-6 lg:pb-3 lg:pt-3", dark ? "border-neutral-700" : "border-neutral-200")}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 md:gap-4">
          {/* Left */}
          <div className="flex flex-1 items-center gap-1.5 md:flex-none md:gap-4">
            <MenuDrawer categories={categories} pages={pages} navbarDark={dark} />
            <MobileSearch navbarDark={dark} />
            <Link
              href="/"
              prefetch={true}
              className="flex flex-1 flex-shrink-0 items-center justify-center gap-1.5 md:flex-none md:justify-start md:gap-2"
            >
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  className="h-8 w-auto max-w-[130px] object-contain md:h-10 md:max-w-[150px]"
                />
              ) : (
                <>
                  {settings.showLogoIcon && (
                    <LogoSquare iconUrl={iconUrl} logoIconUrl={settings.logoIconUrl || undefined} />
                  )}
                  <div className={clsx("text-sm font-bold md:text-base", dark ? "text-white" : "text-black")}>
                    {settings.storeName}
                  </div>
                </>
              )}
            </Link>
          </div>

          {/* Center: Search - desktop only */}
          {!isCheckout && (
            <div className="hidden flex-1 max-w-md md:block">
              <Suspense fallback={<SearchSkeleton navbarDark={dark} />}>
                <Search navbarDark={dark} />
              </Suspense>
            </div>
          )}

          {/* Right */}
          <div className="flex items-center gap-1.5 md:gap-4">
            <WishlistNav navbarDark={dark} />
            <ProfileDropdown navbarDark={dark} />
            <CartModal navbarDark={dark} />
          </div>
        </div>
      </div>

      {/* Category bar - desktop only, hidden on checkout */}
      {!isCheckout && (
        <div className="hidden md:block">
          <CategoryBar categories={categories} dark={dark} />
        </div>
      )}
    </nav>
  );
}