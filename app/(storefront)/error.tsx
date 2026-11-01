"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-4xl">😔</p>
      <h2 className="mb-2 text-xl font-bold text-neutral-900">Something went wrong</h2>
      <p className="mb-6 text-sm text-neutral-500">An unexpected error occurred. Please try again.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          Try Again
        </button>
        <a href="/" className="rounded-full border border-neutral-200 px-5 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Go Home
        </a>
      </div>
    </div>
  );
}
