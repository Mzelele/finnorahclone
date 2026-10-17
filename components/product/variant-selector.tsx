"use client";

import clsx from "clsx";
import { useProduct, useUpdateURL } from "components/product/product-context";
import { Image, ProductOption, ProductVariant } from "lib/sfcc/types";
import { startTransition, useEffect } from "react";

type Combination = {
  id: string;
  availableForSale: boolean;
  [key: string]: string | boolean;
};

export function VariantSelector({
  options,
  variants,
  images,
  defaultVariant,
}: {
  options: ProductOption[];
  variants: ProductVariant[];
  images: Image[];
  defaultVariant?: string;
}) {
    const { state, updateOption, updateImage } = useProduct();
  const updateURL = useUpdateURL();

  // Defensive: tolerate missing/empty options, variants, or images.
  const safeOptions = options || [];
  const safeVariants = variants || [];
  const safeImages = images || [];

  const hasNoOptionsOrJustOneOption =
    !safeOptions.length ||
    (safeOptions.length === 1 && safeOptions[0]?.values?.length === 1);

  useEffect(() => {
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
        const hasUrlOptionParams =
      urlParams &&
      safeOptions.some((option) => urlParams.get(option.name.toLowerCase()));

    if (hasUrlOptionParams) return;

    const hasAnyOptionSelected = safeOptions.some(
      (option) => state[option.name.toLowerCase()]
    );

    if (!hasAnyOptionSelected && safeVariants.length > 0) {
      const targetVariant = (defaultVariant
        ? safeVariants.find((v) => v.title === defaultVariant) || safeVariants[0]
        : safeVariants[0])!;
      startTransition(() => {
        let currentState = { ...state };
        (targetVariant.selectedOptions || []).forEach((opt) => {
          currentState = updateOption(opt.name.toLowerCase(), opt.value);
        });
        if (targetVariant.image) {
          const imageIndex = safeImages.findIndex(
            (img) => (img && img.url) === targetVariant.image!.url
          );
          if (imageIndex >= 0) {
            updateImage(imageIndex.toString());
            currentState = { ...currentState, image: imageIndex.toString() };
          }
        }
        updateURL(currentState);
      });
    }
  }, [safeOptions, safeVariants, state, updateOption, updateImage, updateURL, safeImages, defaultVariant]);

  if (hasNoOptionsOrJustOneOption) {
    return null;
  }

    const combinations: Combination[] = safeVariants.map((variant) => ({
    id: variant.id,
    availableForSale: variant.availableForSale,
    ...(variant.selectedOptions || []).reduce(
      (accumulator, option) => ({
        ...accumulator,
        [option.name.toLowerCase()]: option.value,
      }),
      {},
    ),
  }));

  return safeOptions.map((option) => (
    <form key={option.id}>
      <dl className="mb-2 overflow-visible border-b border-neutral-200 pb-1 md:mb-3 md:pb-2">
        <dt className="mb-1 text-xs font-semibold uppercase leading-none tracking-[0.18em] text-neutral-500 md:mb-2 md:text-sm md:leading-normal">
          {option.name}
        </dt>
                <dd className={clsx(
          "scrollbar-hide -mx-3 flex gap-1.5 px-3 pb-1 pt-px md:mx-0 md:flex-wrap md:gap-2 md:overflow-visible md:px-0 md:pb-0 md:pt-0",
          (option.values || []).length <= 4 ? "flex-nowrap" : "snap-x snap-mandatory overflow-x-auto",
        )}>
          {(option.values || []).map((value) => {
            const optionNameLowerCase = option.name.toLowerCase();
            const optionParams = {
              ...state,
              [optionNameLowerCase]: value.name,
            };

            const filtered = Object.entries(optionParams).filter(
              ([key, value]) =>
                safeOptions.find(
                  (option) =>
                    option.name.toLowerCase() === key &&
                    (option.values || []).some((val) => val.name === value),
                ),
            );
            const isAvailableForSale = combinations.find((combination) =>
              filtered.every(
                ([key, value]) =>
                  combination[key] === value && combination.availableForSale,
              ),
            );

            const isActive = state[optionNameLowerCase] === value.name;

            const handleSelect = () => {
              const optionState = updateOption(optionNameLowerCase, value.name);
              let combinedState = optionState;

                            const matchedVariant = safeVariants.find((variant) =>
                (variant.selectedOptions || []).every(
                  (opt) => optionState[opt.name.toLowerCase()] === opt.value,
                ),
              );

              if (matchedVariant?.image) {
                const imageIndex = safeImages.findIndex(
                  (img) => (img && img.url) === matchedVariant.image!.url,
                );
                if (imageIndex >= 0) {
                  updateImage(imageIndex.toString());
                  combinedState = { ...optionState, image: imageIndex.toString() };
                }
              }

              updateURL(combinedState);
            };

            return (
              <button
                formAction={handleSelect}
                key={value.id}
                aria-disabled={!isAvailableForSale}
                disabled={!isAvailableForSale}
                title={`${option.name} ${value.name}${!isAvailableForSale ? " (Out of Stock)" : ""}`}
                className={clsx(
                  "relative flex items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-in-out md:px-4 md:py-2 md:text-sm",
                  (option.values || []).length <= 4 ? "flex-1" : "min-w-max shrink-0 snap-start",
                  {
                    "border-neutral-900 bg-neutral-900 text-white shadow-lg scale-[1.04]": isActive,
                    "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-700 hover:shadow-sm": !isActive && isAvailableForSale,
                    "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-300 line-through": !isAvailableForSale,
                  },
                )}
              >
                {isActive && (
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {value.name}
              </button>
            );
          })}
        </dd>
      </dl>
    </form>
  ));
}
