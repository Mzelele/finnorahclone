"use client";

import { useEffect } from "react";

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Product page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-4 text-5xl">😔</p>
      <h2 className="mb-2 text-xl font-bold text-neutral-900">This product could not be loaded</h2>
      <p className="mb-6 text-sm text-neutral-500">Something went wrong while loading this page. Please try again or browse other products.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          Try Again
        </button>
        <a href="/shop" className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Browse Products
        </a>
      </div>
    </div>
  );
}
