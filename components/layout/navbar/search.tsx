"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type SearchProduct = {
  handle: string;
  title: string;
  featuredImage?: {
    url?: string;
    altText?: string;
  };
  priceRange?: {
    minVariantPrice?: {
      amount?: string;
      currencyCode?: string;
    };
  };
};

export default function Search({ navbarDark }: { navbarDark?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/storefront/products?search=${encodeURIComponent(trimmedQuery)}&limit=5`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(Array.isArray(data.products) ? data.products : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <Form
      action="/search"
      prefetch={false}
      className="relative w-full"
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 150)}
    >
      <div className="relative flex items-center">
        <input
          type="text"
          name="q"
          placeholder="Search products..."
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className={`w-full rounded-lg border px-3 py-2 pr-9 text-sm transition-all focus:outline-none focus:ring-1 ${navbarDark ? "border-neutral-700 bg-neutral-800 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500" : "border-neutral-300 bg-neutral-100 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-neutral-400"}`}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md bg-red-600 p-1 hover:bg-red-500 transition-colors">
          <MagnifyingGlassIcon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* Dropdown results */}
      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
          {loading ? (
            <div className="px-4 py-3 text-sm text-neutral-500">Searching...</div>
          ) : results.length ? (
            <>
              <div className="max-h-72 overflow-y-auto">
                {results.map((product) => (
                  <Link
                    key={product.handle}
                    href={`/product/${product.handle}`}
                    className="flex items-center gap-3 border-b border-neutral-800 px-3 py-2.5 last:border-b-0 hover:bg-neutral-800 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      router.push(`/product/${product.handle}`);
                    }}
                    onClick={() => setOpen(false)}
                  >
                    <div className="h-10 w-10 flex-none overflow-hidden rounded-lg bg-neutral-800 ring-1 ring-neutral-700">
                      {product.featuredImage?.url ? (
                        <img
                          src={product.featuredImage.url}
                          alt={product.featuredImage.altText || product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-neutral-100">
                        {product.title}
                      </p>
                      {product.priceRange?.minVariantPrice?.amount ? (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {product.priceRange.minVariantPrice.currencyCode || "KES"}{" "}
                          {Number(product.priceRange.minVariantPrice.amount).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                className="block border-t border-neutral-800 px-4 py-2.5 text-center text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                onClick={() => setOpen(false)}
              >
                View all results →
              </Link>
            </>
          ) : (
            <div className="px-4 py-3 text-sm text-neutral-500">No products found</div>
          )}
        </div>
      ) : null}
    </Form>
  );
}

export function SearchSkeleton() {
  return (
    <form className="relative w-full">
      <div className="relative flex items-center">
        <input
          placeholder="Search products..."
          className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md bg-red-600 p-1">
          <MagnifyingGlassIcon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
    </form>
  );
}
