import { connectDB } from "@/lib/mongodb";
import {
  Image,
  Money,
  ProductOption,
  ProductVariant,
  Product as SFCCProduct,
} from "lib/sfcc/types";
import { getCloudinaryUrl } from "lib/utils";
import { ObjectId } from "mongodb";
import { unstable_cache } from "next/cache";

const CURRENCY_CODE = "KES";

function toMoney(amount: number): Money {
  return { amount: (amount ?? 0).toString(), currencyCode: CURRENCY_CODE };
}

function compactText(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.toString().trim())
    .filter(Boolean)
    .join(" ");
}

function buildImageAltText(doc: any): string {
  const brandName =
    typeof doc.brand === "object"
      ? doc.brand?.name
      : doc.brandName || undefined;
  const categoryName =
    typeof doc.category === "object"
      ? doc.category?.name
      : doc.categoryName || undefined;
  const productName = doc.name || "Watch";
  const hasWatch = /watch|watches/i.test(productName);

  return compactText([
    productName,
    brandName && !productName.toLowerCase().includes(brandName.toLowerCase())
      ? brandName
      : undefined,
    categoryName &&
    !productName.toLowerCase().includes(categoryName.toLowerCase())
      ? categoryName
      : undefined,
    hasWatch ? "in Kenya" : "watch in Kenya",
  ]);
}

const PRODUCT_CARD_IMAGE_WIDTH = 800;

function mapImages(images: string[], altText: string): Image[] {
  return images.map((url) => ({
    url: getCloudinaryUrl(url, { width: PRODUCT_CARD_IMAGE_WIDTH }),
    altText,
    height: 600,
    width: PRODUCT_CARD_IMAGE_WIDTH,
  }));
}

function deriveOptions(variants: any[]): ProductOption[] {
  const optionMap = new Map<string, Set<string>>();
  for (const v of variants) {
    for (const [key, value] of Object.entries(v.attributes || {})) {
      if (!optionMap.has(key)) optionMap.set(key, new Set());
      optionMap.get(key)!.add(value as string);
    }
  }
  let idx = 0;
  const options: ProductOption[] = [];
  for (const [name, values] of optionMap) {
    options.push({
      id: `option-${idx++}`,
      name,
      values: Array.from(values).map((v, i) => ({ id: `value-${i}`, name: v })),
    });
  }
  return options;
}

function mapVariants(
  variants: any[],
  basePrice: number,
  altText: string,
): ProductVariant[] {
  return variants.map((v: any, i: number) => ({
    id: v.sku || v._id?.toString() || `variant-${i}`,
    title: v.name,
    availableForSale: v.enabled && v.stock > 0,
    selectedOptions: Object.entries(v.attributes || {}).map(
      ([name, value]) => ({ name, value: value as string }),
    ),
    price: toMoney(v.price || basePrice),
    image: v.images?.[0] ? mapImages([v.images[0]], altText)[0] : undefined,
    sku: v.sku || "",
  }));
}

export function mapProduct(doc: any): SFCCProduct {
  const price = doc.price || 0;
  const imageAltText = buildImageAltText(doc);
  const variantImageUrls: string[] = [];
  for (const v of doc.variants || []) {
    for (const url of v.images || []) {
      if (!variantImageUrls.includes(url)) variantImageUrls.push(url);
    }
  }
  const allImageUrls = [
    ...new Set([...(doc.images || []), ...variantImageUrls]),
  ];
  const images = mapImages(allImageUrls, imageAltText);
  const variants = mapVariants(doc.variants || [], price, imageAltText);
  const options = deriveOptions(doc.variants || []);

  // Use explicit featuredImage if set; otherwise fall back to the first image
  const featuredImageUrl = doc.featuredImage || allImageUrls[0] || "";

  if (doc.type === "simple" || variants.length === 0) {
    variants.push({
      id: doc.sku || doc._id.toString(),
      title: doc.name,
      availableForSale: doc.status === "active" && doc.stock > 0,
      selectedOptions: [],
      price: toMoney(price),
      sku: doc.sku || "",
    });
  }

  const availableForSale =
    doc.type === "simple"
      ? doc.status === "active" && doc.stock > 0
      : variants.some((v) => v.availableForSale);

  return {
    id: doc._id.toString(),
    title: doc.name,
    handle: doc.slug || doc._id.toString(),
    description: doc.description || "",
    descriptionHtml: doc.description || "",
    productHighlights: doc.productHighlights || doc.keyFeatures || "",
    featuredImage: images.find((img) => img.url === featuredImageUrl) ||
      images[0] || { url: "", altText: imageAltText, height: 0, width: 0 },
    currencyCode: CURRENCY_CODE,
    comparePrice: (doc.comparePrice || doc.compareAtPrice) ? toMoney(doc.comparePrice || doc.compareAtPrice) : undefined,
    priceRange: {
      minVariantPrice: toMoney(price),
      maxVariantPrice: toMoney(price),
    },
    seo: { title: doc.name, description: doc.description || "" },
    options,
    tags: [],
    variants,
    images,
    availableForSale,
    updatedAt: doc.updatedAt?.toISOString?.() || new Date().toISOString(),
    variationValues: undefined,
    categoryId:
      doc.category?._id?.toString?.() ||
      doc.category?.toString?.() ||
      (Array.isArray(doc.categories) && doc.categories[0]?._id?.toString?.()) ||
      (Array.isArray(doc.categories) && doc.categories[0]?.toString?.()) ||
      undefined,
    categoryName: doc.category?.name || (Array.isArray(doc.categories) ? doc.categories[0]?.name : undefined) || undefined,
    categorySlug: doc.category?.slug || (Array.isArray(doc.categories) ? doc.categories[0]?.slug : undefined) || undefined,
    brandSlug: doc.brand?.toString?.() || doc.brand || undefined,
    defaultVariant: doc.defaultVariant || undefined,
    sku: doc.sku || undefined,
  };
}

export async function getFeaturedProducts(limit = 8) {
  const db = await connectDB();
  const docs = await db
    .collection("products")
    .find({ status: "active" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(mapProduct);
}

export async function getNewArrivals(limit = 8) {
  return getFeaturedProducts(limit);
}

async function getProductsFromDB(params: {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
}) {
  const db = await connectDB();
  const searchTerm = params.search || params.query;
  const sortKey = params.sort || params.sortKey || "best-matches";
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const query: any = { status: "active" };
  const andConditions: any[] = [];

  if (searchTerm) {
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    andConditions.push({
      $or: [
        { name: { $regex: `^${escapedTerm}$`, $options: "i" } },
        { name: { $regex: `^${escapedTerm}`, $options: "i" } },
        { name: { $regex: `\\b${escapedTerm}`, $options: "i" } },
        { name: { $regex: escapedTerm, $options: "i" } },
        { description: { $regex: escapedTerm, $options: "i" } },
      ],
    });
  }

  if (params.category) {
    const categoryDoc = await db
      .collection("categories")
      .findOne({ slug: params.category });
    if (categoryDoc) {
      const catId = categoryDoc._id;
      andConditions.push({
        $or: [
          { categories: catId },
          { categories: catId.toString() },
          { category: catId },
          { category: catId.toString() },
        ],
      });
    }
  }

  if (params.brand) {
    andConditions.push({
      $or: [
        { brand: params.brand },
        { name: { $regex: params.brand.replace(/-/g, " "), $options: "i" } },
      ],
    });
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  if (params.minPrice !== undefined) query.price = { $gte: params.minPrice };
  if (params.maxPrice !== undefined)
    query.price = { ...query.price, $lte: params.maxPrice };

  const sort: any = {};
  
  // When searching, prioritize relevance scoring
  if (searchTerm) {
    // Sort by name ascending so exact/starts-with matches come first alphabetically
    sort.name = 1;
  } else {
    switch (sortKey) {
      case "price_asc":
      case "price-low-to-high":
        sort.price = 1;
        break;
      case "price_desc":
      case "price-high-to-low":
        sort.price = -1;
        break;
      case "newest":
        sort.createdAt = -1;
        break;
      case "oldest":
        sort.createdAt = 1;
        break;
      case "product-name-ascending":
        sort.name = 1;
        break;
      case "product-name-descending":
        sort.name = -1;
        break;
      default:
        sort.createdAt = -1;
    }
  }

  let docs;
  let total;

  if (searchTerm) {
    // Use aggregation pipeline to compute relevance scores for better search results
    // Exact matches and prefix matches are scored higher
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    const pipeline: any[] = [
      { $match: query },
      {
        $addFields: {
          relevanceScore: {
            $add: [
              { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(`^${escapedTerm}$`, "i") } }, 100, 0] },
              { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(`^${escapedTerm}`, "i") } }, 50, 0] },
              { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(`\\b${escapedTerm}`, "i") } }, 20, 0] },
              { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(escapedTerm, "i") } }, 10, 0] },
              { $cond: [{ $regexMatch: { input: "$description", regex: new RegExp(escapedTerm, "i") } }, 5, 0] },
            ],
          },
        },
      },
      { $sort: { relevanceScore: -1, name: 1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const countPipeline: any[] = [
      { $match: query },
      { $count: "total" },
    ];

    const [aggregated, countResult] = await Promise.all([
      db.collection("products").aggregate(pipeline).toArray(),
      db.collection("products").aggregate(countPipeline).toArray(),
    ]);
    
    docs = aggregated;
    total = countResult[0]?.total || 0;
  } else {
    const [found, count] = await Promise.all([
      db.collection("products").find(query).sort(sort).skip(skip).limit(limit).toArray(),
      db.collection("products").countDocuments(query),
    ]);
    docs = found;
    total = count;
  }

      return {
    products: docs.map(mapProduct),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Cached product query. The cache key is derived from the serialized request
 * parameters so the homepage's per-category grids (and any listing page) reuse
 * results instead of hitting MongoDB on every request.
 */
export async function getProducts(
  params: {
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    page?: number;
    limit?: number;
    query?: string;
    sortKey?: string;
    reverse?: boolean;
  } = {},
) {
  return unstable_cache(
    async () => getProductsFromDB(params),
    ["products-query", JSON.stringify(params)],
    { revalidate: 3600, tags: ["products"] },
  )();
}

export async function getAllProductSlugs() {
  const db = await connectDB();
  const docs = await db
    .collection("products")
    .find({ status: "active" }, { projection: { slug: 1 } })
    .toArray();
  return docs.map((d) => d.slug as string);
}

async function getProductBySlugFromDB(slug: string) {
  const db = await connectDB();
  let decodedSlug = slug;
  try { decodedSlug = decodeURIComponent(slug); } catch {}
  const lookupConditions: any[] = [{ slug: { $in: Array.from(new Set([decodedSlug, slug])) } }];
  if (ObjectId.isValid(slug)) {
    lookupConditions.push({ _id: new ObjectId(slug) });
  }
  const doc = await db
    .collection("products")
    .findOne({ $or: lookupConditions });
  if (!doc) return null;
  
  // Populate categories - support both new array and old single field
  if (Array.isArray(doc.categories) && doc.categories.length > 0) {
    const ids = doc.categories.map((c: any) => {
      const str = c?.toString?.() || c;
      try { return new ObjectId(str); } catch { return str; }
    });
    const cats = await db.collection("categories").find({ _id: { $in: ids } }).toArray();
    // Store the first category for backward compatibility
    if (cats.length > 0) {
      doc.category = cats[0];
    }
    } else if (doc.category) {
    const cat = await db
      .collection("categories")
      .findOne({ _id: doc.category });
    if (cat) doc.category = cat;
  }
  return mapProduct(doc);
}

export async function getProductBySlug(slug: string) {
  return unstable_cache(
    () => getProductBySlugFromDB(slug),
    ["product-by-slug", slug],
    { revalidate: 3600, tags: ["products"] },
  )();
}

async function getRelatedProductsFromDB(
  categoryId: string,
  excludeId: string,
  limit = 10,
) {
  const db = await connectDB();
  const docs = await db
    .collection("products")
    .find({
      status: "active",
      $or: [
        { categories: new ObjectId(categoryId) },
        { categories: categoryId },
        { category: new ObjectId(categoryId) },
        { category: categoryId },
      ],
            _id: { $ne: new ObjectId(excludeId) },
    })
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
  return docs.map(mapProduct);
}

export async function getRelatedProducts(
  categoryId: string,
  excludeId: string,
  limit = 10,
) {
  return unstable_cache(
    () => getRelatedProductsFromDB(categoryId, excludeId, limit),
    ["related-products", categoryId, excludeId, String(limit)],
    { revalidate: 3600, tags: ["products"] },
  )();
}

export async function getCollectionProducts({
  collection,
  limit = 100,
  sortKey,
  page = 1,
}: {
  collection: string;
  limit?: number;
  sortKey?: string;
  page?: number;
}) {
  const sortMap: Record<string, string> = {
    "price-low-to-high": "price_asc",
    "price-high-to-low": "price_desc",
    "product-name-ascending": "product-name-ascending",
    "product-name-descending": "product-name-descending",
    "best-matches": "best-matches",
  };
  return getProducts({
    category: collection,
    limit,
    sort: sortMap[sortKey || ""] || "best-matches",
    page,
  });
}

export async function getProduct(id: string) {
  return getProductBySlug(id);
}
