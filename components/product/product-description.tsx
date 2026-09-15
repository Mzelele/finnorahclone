import React from "react";
import { Breadcrumbs } from "components/breadcrumbs";
import Prose from "components/prose";
import { WishlistButton } from "components/wishlist/wishlist-button";
import { Product } from "lib/sfcc/types";
import { ProductPrice } from "./product-price";
import { VariantSelector } from "./variant-selector";

export function ProductDescription({
  product,
  compact = false,
  breadcrumbs,
  actions,
}: {
  product: Product;
  compact?: boolean;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <>
      <div className={compact ? "mb-2.5 border-b border-neutral-200 pb-2.5" : "mb-3 border-b border-neutral-200 pb-3"}>
        {breadcrumbs ? (
          <div className="mb-2">
            <Breadcrumbs items={breadcrumbs} hideLastOnMobile />
          </div>
        ) : null}

                <h1 className={compact ? "mb-1.5 text-lg font-semibold leading-snug text-neutral-950" : "mb-2 text-2xl font-semibold leading-tight text-neutral-950 md:text-3xl"}>
          {product.title}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ProductPrice product={product} />
          </div>
          <WishlistButton handle={product.handle} size={compact ? "sm" : "md"} />
        </div>
      </div>
      <VariantSelector
        options={product.options}
        variants={product.variants}
        images={product.images}
        defaultVariant={product.defaultVariant}
      />
            {actions ? <div className="mt-2.5">{actions}</div> : null}
      {product.productHighlights ? (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
            Key Features
          </h3>
          <Prose
            className="text-sm leading-relaxed text-neutral-700"
            html={product.productHighlights}
          />
        </div>
      ) : null}
    </>
  );
}
