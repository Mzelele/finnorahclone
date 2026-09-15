import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GridTileImage } from "components/grid/tile";
import { TrackViewContent } from "components/meta-pixel/view-content";
import { Gallery } from "components/product/gallery";
import { ProductActions } from "components/product/product-actions";
import { ProductProvider } from "components/product/product-context";
import { ProductDescription } from "components/product/product-description";
import Prose from "components/prose";
import { HIDDEN_PRODUCT_TAG } from "lib/constants";
import { Image } from "lib/sfcc/types";
import { getProductBySlug, getRelatedProducts } from "lib/storefront/products";
import { getStoreSettings } from "lib/storefront/settings";
import { baseUrl } from "lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

export async function generateMetadata(props: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  try {
    const product = await getProductBySlug(params.handle);
    if (!product) return notFound();

    const { url, width, height, altText: alt } = product.featuredImage || {};
    const indexable = !product.tags.includes(HIDDEN_PRODUCT_TAG);

    const productUrl = `${baseUrl}/product/${params.handle}`;

    return {
      title: product.seo.title || product.title,
      description: product.seo.description || product.description,
      robots: {
        index: indexable,
        follow: indexable,
        googleBot: {
          index: indexable,
          follow: indexable,
        },
      },
      alternates: {
        canonical: productUrl,
      },
      openGraph: {
        type: "website",
        title: product.seo.title || product.title,
        description: product.seo.description || product.description,
        url: productUrl,
        images: url
          ? [
              {
                url,
                width,
                height,
                alt,
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: product.seo.title || product.title,
        description: product.seo.description || product.description,
        images: url ? [url] : undefined,
      },
    };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductPage(props: {
  params: Promise<{ handle: string }>;
}) {
  const params = await props.params;

  try {
    const [product, settings] = await Promise.all([
      getProductBySlug(params.handle),
      getStoreSettings(),
    ]);
    if (!product) return notFound();












        const productUrl = `${baseUrl}/product/${params.handle}`;
    const variantOffers = (product.variants || []).map((v) => ({
      "@type": "Offer",
      name: v.title,
      price: v.price.amount,
      priceCurrency: product.currencyCode,
      availability: v.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: productUrl,
      sku: v.id,
    }));








        const productJsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: product.description,
      image: product.featuredImage?.url || product.images?.[0]?.url,
      url: productUrl,
      sku: (product as any).sku,
      brand: {
        "@type": "Brand",
        name: (product as any).brandName || product.title.split(" ")[0],
      },
      offers: variantOffers.length > 1
        ? {
            "@type": "AggregateOffer",
            availability: product.availableForSale
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",


                                    priceCurrency: product.currencyCode,
            highPrice: product.priceRange?.maxVariantPrice?.amount,
            lowPrice: product.priceRange?.minVariantPrice?.amount,
            offerCount: variantOffers.length,
            offers: variantOffers,
          }
        : variantOffers[0] || undefined,
    };

    const breadcrumbItems = [
      { label: "Home", href: "/" },
      ...(product.categoryName && product.categorySlug
        ? [{ label: product.categoryName, href: `/product-category/${product.categorySlug}` }]
        : product.brandSlug
          ? [{ label: product.brandSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), href: `/brand/${product.brandSlug}` }]
          : []),
      { label: product.title },
    ];

        const safeVariants = product.variants || [];
    const defaultVariant = product.defaultVariant
      ? safeVariants.find((v) => v.title === product.defaultVariant)
      : safeVariants.length === 1 ? safeVariants[0] : undefined;
    const viewContentVariantId = defaultVariant?.id || safeVariants[0]?.id || product.id;
    const viewContentPrice = Number(defaultVariant?.price?.amount || safeVariants[0]?.price?.amount || 0);

    return (
      <div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productJsonLd),
          }}
        />
        <TrackViewContent
          productId={product.id}
          variantId={viewContentVariantId}
          value={viewContentPrice}
          currency={product.currencyCode}
        />





                <div className="mx-auto w-full max-w-none px-0 pb-24 md:px-4 md:pb-6 lg:max-w-(--breakpoint-5xl) md:pt-0">
          {/* Spacer – maintains the margin where breadcrumbs originally lived */}
          <ProductProvider>


                        {/* ── MOBILE: compact stacked layout ── */}
            <div className="lg:hidden">
                            {/* Image - clean white card for mobile contrast */}
              <div className="border-b border-neutral-200 bg-white md:rounded-2xl md:border md:border-neutral-200 md:shadow-sm md:overflow-hidden">
                <Suspense
                  fallback={
                    <div className="relative w-full aspect-[4/3] max-h-[48vw] overflow-hidden bg-neutral-100" />
                  }
                >
                                    <Gallery
                    images={(product.images || []).slice(0, 5).map((image: Image) => ({
                      src: image.url,
                      altText: image.altText,
                    }))}
                  />
                </Suspense>
              </div>

                            {/* Title + Price + Variants + Actions all in one block */}
              {/* Breadcrumbs (Home > Category) appear above the title via ProductDescription */}
              <div className="bg-white px-3 pt-1.5 pb-3 border-t border-neutral-100">
                <Suspense fallback={null}>
                  <ProductDescription
                    product={product}
                    compact
                    breadcrumbs={breadcrumbItems}
                    actions={
                      <ProductActions
                        product={product}
                        whatsappPhone={settings.whatsappPhone || settings.storePhone}
                        storePhone={settings.storePhone}
                        ctaButtons={settings.ctaButtons}
                      />
                    }
                  />
                </Suspense>
              </div>
            </div>

            {/* ── DESKTOP: 3-column grid ── */}








































































































































































































































































                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            {/* ── DESKTOP: 3-column grid ── */}
            <div className="hidden lg:grid gap-4 mt-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)_minmax(260px,0.72fr)] items-start">
















                                                        {/* Image - white card wrapper for visual separation */}
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <Suspense
                  fallback={
                    <div className="relative aspect-square h-full max-h-[400px] w-full overflow-hidden bg-neutral-100" />
                  }
                >
                  <Gallery
                    images={(product.images || []).slice(0, 5).map((image: Image) => ({
                      src: image.url,
                      altText: image.altText,
                    }))}
                  />
                </Suspense>
              </div>

                                                                                                              {/* Second column: breadcrumbs appear above the title via ProductDescription */}

                                                                                                                                                                                                                            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden self-start">
                                                                                                                <div className="border-b border-neutral-200 bg-neutral-50/70 px-4 py-2.5 md:px-5">
                                                                                                                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Product Details</h2>
                                                                                                                </div>
                                                                                                                <div className="p-4 md:p-5 overflow-y-auto">
                                                                                                                  <Suspense fallback={null}>
                                                                                                                    <ProductDescription product={product} breadcrumbs={breadcrumbItems} />
                                                                                                                  </Suspense>
                                                                                                                </div>
                                                                                                              </div>


                                                                                                                                                                                                                            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                                                                                                                <div className="border-b border-neutral-200 bg-neutral-50/70 px-4 py-2.5 md:px-5">
                                                                                                                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Purchase Options</h2>
                                                                                                                </div>
                                                                                                                <div className="p-4 md:p-5">
                                                                                                                  <Suspense fallback={null}>
                                                                                                                    <ProductActions
                                                                                                                      product={product}
                                                                                                                      whatsappPhone={settings.whatsappPhone || settings.storePhone}
                                                                                                                      storePhone={settings.storePhone}
                                                                                                                      ctaButtons={settings.ctaButtons}
                                                                                                                    />
                                                                                                                  </Suspense>
                                                                                                                </div>
                                                                                                              </div>
                                                                                                            </div>


































































































































          </ProductProvider>
                    {product.descriptionHtml ? (
                      <div className="-mt-6 mb-4 overflow-hidden rounded-none border border-neutral-200 bg-white shadow-sm md:mx-0 md:mt-6 md:mb-6 md:rounded-2xl">
              <div className="border-b border-neutral-200 bg-neutral-50/70 px-4 py-3 md:px-8 md:py-4">
                <h2 className="text-lg font-bold text-neutral-900 md:text-2xl">Product Description</h2>
              </div>
              <div className="p-4 md:p-8">
                <Prose
                  className="text-sm leading-relaxed text-neutral-700"
                  html={product.descriptionHtml}
                />
              </div>
            </div>
          ) : null}
          <RelatedProducts
            categoryId={product.categoryId}
            categorySlug={product.categorySlug}
            categoryName={product.categoryName}
            excludeId={product.id}
          />
        </div>
      </div>
    );
  } catch {
    return notFound();
  }
}

async function RelatedProducts({
  categoryId,
  categorySlug,
  categoryName,
  excludeId,
}: {
  categoryId?: string;
  categorySlug?: string;
  categoryName?: string;
  excludeId: string;
}) {
  if (!categoryId) return null;
  const relatedProducts = await getRelatedProducts(categoryId, excludeId);

  if (!relatedProducts.length) return null;

  const items = relatedProducts.slice(0, 4);

  return (
        <div className="mx-3 mt-4 mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:mx-0 md:mt-6 md:mb-6 md:p-8">
      <div className="-mx-5 -mt-5 mb-4 border-b border-neutral-200 bg-neutral-50/70 px-5 py-3 md:-mx-8 md:-mt-8 md:mb-6 md:px-8 md:py-4">
        <h2 className="text-lg font-bold text-neutral-900 md:text-2xl">Related Products</h2>
      </div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((product: any) => (
          <li key={product.handle}>
            <Link
              href={`/product/${product.handle}`}
              prefetch={true}
              className="block"
            >
              <GridTileImage
                alt={product.title}
                label={{
                  title: product.title,
                  amountMin: product.priceRange.minVariantPrice.amount,
                  amountMax: product.priceRange.maxVariantPrice.amount,
                  currencyCode: product.currencyCode,
                }}
                comparePrice={product.comparePrice?.amount}
                src={product.featuredImage?.url}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
              />
            </Link>
          </li>
        ))}
      </ul>
      {categorySlug && (
        <div className="mt-4 md:mt-6">
          <Link
            href={`/category/${categorySlug}`}
            prefetch={true}
            className="flex w-full items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 md:py-4 md:text-base"
          >
            View All {categoryName || "Products"}
          </Link>
        </div>
      )}
    </div>
  );
}
