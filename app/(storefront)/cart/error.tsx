"use client";

import { useEffect } from "react";

export default function CartError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Cart page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-4 text-5xl">🛒</p>
      <h2 className="mb-2 text-xl font-bold text-neutral-900">Your cart could not be loaded</h2>
      <p className="mb-6 text-sm text-neutral-500">Something went wrong. Your items are safe — please try refreshing the page.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          Refresh Cart
        </button>
        <a href="/" className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Go Home
        </a>
      </div>
    </div>
  );
}
