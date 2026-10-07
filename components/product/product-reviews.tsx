"use client";

import { useEffect, useState } from "react";

type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${filled ? "text-yellow-400" : "text-neutral-300"}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHovered(star)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <StarIcon filled={star <= (hovered || rating)} />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productHandle }: { productHandle: string }) {
  const storageKey = `reviews:${productHandle}`;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setReviews(JSON.parse(stored));
    } catch {}
  }, [storageKey]);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const handleSubmit = () => {
    if (!name.trim()) return setError("Please enter your name.");
    if (rating === 0) return setError("Please select a star rating.");
    if (!comment.trim()) return setError("Please write a comment.");

    const newReview: Review = {
      id: Date.now().toString(),
      name: name.trim(),
      rating,
      comment: comment.trim(),
      date: new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }),
    };

    const updated = [newReview, ...reviews];
    setReviews(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    setName(""); setComment(""); setRating(0); setError(""); setShowForm(false);
  };

  return (
    <div className="mx-3 mb-4 mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm md:mx-0 md:mt-6 md:mb-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-4 py-3 md:px-8 md:py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-neutral-900 md:text-2xl">Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-sm text-neutral-500">
                {avgRating.toFixed(1)} · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-full border border-blue-600 px-4 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
        >
          {showForm ? "Cancel" : "Write a Review"}
        </button>
      </div>

      <div className="p-4 md:p-8">
        {/* Form */}
        {showForm && (
          <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 md:p-5">
            <h3 className="mb-4 text-sm font-bold text-neutral-900">Your Review</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Rating</label>
                <StarRating rating={rating} onChange={setRating} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Comment</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience with this product..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleSubmit}
                className="w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Submit Review
              </button>
            </div>
          </div>
        )}

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <svg className="h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="mt-3 text-sm font-semibold text-neutral-500">No reviews yet</p>
            <p className="mt-1 text-xs text-neutral-400">Be the first to review this product</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {reviews.map((r) => (
              <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{r.name}</p>
                      <StarRating rating={r.rating} />
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400">{r.date}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
