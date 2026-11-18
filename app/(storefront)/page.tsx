import { BrandCarousel } from "components/layout/brand-carousel";
import { CategoryCircles } from "components/layout/category-circles";
import CategorySections from "components/layout/category-sections";
import { HeroSection } from "components/layout/hero-section";
import { getBrands } from "lib/storefront/brands";
import { getAllCategories } from "lib/storefront/categories";
import { getProducts } from "lib/storefront/products";
import { getStoreSettings } from "lib/storefront/settings";
import { baseUrl } from "lib/utils";
export const revalidate = 3600;

export async function generateMetadata() {
  try {
    const settings = await getStoreSettings();
    const title = settings.metaTitle || settings.storeName || "Watches in Kenya";
    const description = settings.metaDescription || "Discover a curated collection of luxury and everyday watches in Kenya. Shop top brands with fast delivery across Nairobi and nationwide. Best prices guaranteed.";

    return {
      title,
      description,
      alternates: {
        canonical: `${baseUrl}/`,
      },
      openGraph: {
        type: "website",
        title,
        description,
        url: baseUrl,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "Shop Premium Watches in Kenya | Authentic Brands, Fast Delivery",
      description:
        "Discover a curated collection of luxury and everyday watches in Kenya. Shop top brands with fast delivery across Nairobi and nationwide. Best prices guaranteed.",
      alternates: {
        canonical: `${baseUrl}/`,
      },
      openGraph: {
        type: "website",
        title: "Shop Premium Watches in Kenya | Authentic Brands, Fast Delivery",
        description:
          "Discover a curated collection of luxury and everyday watches in Kenya. Shop top brands with fast delivery across Nairobi and nationwide. Best prices guaranteed.",
        url: baseUrl,
      },
      twitter: {
        card: "summary_large_image",
        title: "Shop Premium Watches in Kenya | Authentic Brands, Fast Delivery",
        description:
          "Discover a curated collection of luxury and everyday watches in Kenya. Shop top brands with fast delivery across Nairobi and nationwide.",
      },
    };
  }
}

export default async function HomePage() {
  const [categories, rawBrands] = await Promise.all([getAllCategories(), getBrands()]);

  const brands = rawBrands.map((b: any) => ({
    _id: b._id?.toString?.() || String(b._id),
    name: b.name,
    slug: b.slug,
    imageUrl: b.imageUrl,
    createdAt: b.createdAt?.toISOString?.() || b.createdAt,
    updatedAt: b.updatedAt?.toISOString?.() || b.updatedAt,
  }));

  const initialData: Record<string, any> = {};
  await Promise.all(
    categories.map(async (cat) => {
      const result = await getProducts({ category: cat.handle, limit: 6, page: 1, includeTotal: false });
      initialData[cat.handle] = result;
    })
  );

  const categoriesWithProducts = categories.filter((cat) => {
    const result = initialData[cat.handle];
    return result && result.products.length > 0;
  });

  const categorySummaries = categories.map((c) => ({
    slug: c.handle,
    title: c.title,
    emoji: c.emoji,
    image: c.image,
    children: (c.children || []).map((ch) => ({
      slug: ch.handle,
      title: ch.title,
      path: ch.path,
    })),
  }));

  return (
    <>
      <HeroSection categories={categorySummaries} />
      <CategoryCircles categories={categorySummaries} />
      <CategorySections
        categories={categoriesWithProducts.map((c) => ({ slug: c.handle, name: c.title, description: c.description }))}
        initialData={initialData}
      />
      {brands.length > 0 && <BrandCarousel brands={brands} />}
    </>
  );
}

