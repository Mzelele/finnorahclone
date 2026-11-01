"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
          <svg className="mb-4 h-16 w-16 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">Something went wrong</h1>
          <p className="mb-6 text-sm text-neutral-500">We're sorry — something unexpected happened. Please try again.</p>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
            >
              Try Again
            </button>
            <a
              href="/"
              className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
