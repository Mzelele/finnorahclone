"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { clsx } from "clsx";
import { useProduct, useUpdateURL } from "components/product/product-context";
import Image from "next/image";

export function Gallery({
  images,
}: {
  images: { src: string; altText: string }[];
}) {
  const { state, updateImage } = useProduct();
  const updateURL = useUpdateURL();
  const imageIndex = state.image ? parseInt(state.image) : 0;
    // Defensive: tolerate missing/empty image arrays (e.g. products with no media).
  const safeImages = images || [];
  const safeImageIndex =
    !Number.isNaN(imageIndex) && imageIndex >= 0 && imageIndex < safeImages.length
      ? imageIndex
      : 0;

  const nextImageIndex =
    safeImageIndex + 1 < safeImages.length ? safeImageIndex + 1 : 0;
  const previousImageIndex =
    safeImageIndex === 0 ? safeImages.length - 1 : safeImageIndex - 1;

  const buttonClassName =
    "flex h-full items-center justify-center px-5 text-neutral-700 transition-all ease-in-out hover:scale-110 hover:text-black md:px-6";

            return (
            <form className="grid grid-cols-1 gap-0 bg-white lg:rounded-2xl lg:p-3 lg:grid-cols-[72px_1fr] lg:gap-3">
              {/* Desktop: Thumbnails column on the left */}
              {safeImages.length > 1 && (
                <div className="hidden lg:flex lg:flex-col lg:gap-2 lg:overflow-y-auto lg:max-h-[520px]">
                  {safeImages.map((image, index) => (
                    <button
                      key={index}
                      type="submit"
                      formAction={() => {
                        const newState = updateImage(index.toString());
                        updateURL(newState);
                      }}
                      className={clsx(
                        "relative aspect-square w-full shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                        index === safeImageIndex
                          ? "border-blue-600 opacity-100"
                          : "border-neutral-200 opacity-60 hover:border-neutral-300 hover:opacity-80"
                      )}
                      aria-label={`View image ${index + 1}`}
                    >
                      <Image
                        src={image.src}
                        alt={image.altText}
                        fill
                        sizes="72px"
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Main Image Column */}
              <div className="relative aspect-square w-full overflow-hidden bg-neutral-50 lg:rounded-xl">
        {safeImages[safeImageIndex] && (
          <Image
            className="h-full w-full object-cover"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            alt={safeImages[safeImageIndex]?.altText as string}
            src={safeImages[safeImageIndex]?.src as string}
            priority={true}
            unoptimized
          />
        )}

        {safeImages.length > 1 ? (
          <div className="absolute bottom-3 flex w-full justify-center md:bottom-[15%]">
            <div className="mx-auto flex h-10 items-center rounded-full border border-neutral-200 bg-white/90 text-neutral-900 shadow-lg backdrop-blur-sm md:h-11">
              <button
                formAction={() => {
                  const newState = updateImage(previousImageIndex.toString());
                  updateURL(newState);
                }}
                aria-label="Previous product image"
                className={buttonClassName}
              >
                <ArrowLeftIcon className="h-5" />
              </button>
              <div className="mx-1 h-6 w-px bg-neutral-300"></div>
              <button
                formAction={() => {
                  const newState = updateImage(nextImageIndex.toString());
                  updateURL(newState);
                }}
                aria-label="Next product image"
                className={buttonClassName}
              >
                <ArrowRightIcon className="h-5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}

