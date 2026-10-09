"use client";

import { useEffect, useState } from "react";

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return Math.abs(h) / 2147483647;
}

export function ProductRatingSummary({ productHandle }: { productHandle: string }) {
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  // Stable random defaults based on product handle
  const rand = seededRandom(productHandle);
  const defaultRating = parseFloat((4.5 + rand * 0.5).toFixed(1));
  const defaultCount = Math.floor(15 + rand * 85);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`reviews:${productHandle}`);
      if (stored) {
        const reviews = JSON.parse(stored);
        if (reviews.length) {
          setCount(reviews.length);
          setAvg(reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length);
        }
      }
    } catch {}
  }, [productHandle]);

  const displayRating = avg ?? defaultRating;
  const displayCount = count > 0 ? count : defaultCount;

  return (
    <div className="mb-2 flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-5 w-5 ${star <= Math.round(displayRating) ? "text-yellow-400" : "text-neutral-300"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-xs text-neutral-500">
        {typeof displayRating === "number" ? displayRating.toFixed(1) : "5.0"} · {displayCount} reviews
      </span>
    </div>
  );
}
