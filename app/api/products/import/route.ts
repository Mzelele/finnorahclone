import { parseWebToffeeCSV } from "@/lib/csvParser";
import { getProductsCollection } from "@/lib/productsDb";
import { connectDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function stripHtml(html: string): string {
  if (!html) return "";
  let text = html.replace(/<tr[^>]*>/gi, "\n").replace(/<\/tr>/gi, "");
  text = text.replace(/<th[^>]*>/gi, "• ").replace(/<\/th>/gi, ": ");
  text = text.replace(/<td[^>]*>/gi, "").replace(/<\/td>/gi, " ");
  text = text.replace(/<br\s*[\/]?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "• ");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  return text
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}


function parseImageUrls(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(",");
  return items
    .map((item) => {
      // WebToffee format: "https://url.jpg ! alt : X ! title : Y ! desc : ! caption :"
      const match = item.trim().match(/^(https?:\/\/[^\s!]+)/);
      return match ? match[1].trim() : "";
    })
    .filter(Boolean);
}

async function resolveCategoryIds(
  categoryString: string | string[] | undefined,
  db: import("mongodb").Db
): Promise<string[]> {
  if (!categoryString) return [];
  const names: string[] = [];
  const raw = Array.isArray(categoryString) ? categoryString.join("|") : String(categoryString);
  // "Smartphones|Smartphones > Vilaon phones" — split by pipe, take leaf name after ">"
  for (const part of raw.split("|")) {
    const leaf = part.includes(">") ? part.split(">").pop()!.trim() : part.trim();
    if (leaf) names.push(leaf);
  }
  if (!names.length) return [];
  const ids: string[] = [];
  const col = db.collection("categories");
  for (const name of names) {
    const cat = await col.findOne({
      $or: [
        { name: { $regex: `^${name}$`, $options: "i" } },
        { title: { $regex: `^${name}$`, $options: "i" } },
        { slug: name.toLowerCase().replace(/\s+/g, "-") },
      ],
    });
    if (cat) {
      const id = cat._id.toString();
      if (!ids.includes(id)) ids.push(id);
    } else {
      // Create the category so it's available immediately
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const result = await col.insertOne({ name, slug, title: name, createdAt: new Date() });
      ids.push(result.insertedId.toString());
    }
  }
  return ids;
}


function sanitizeContent(text: string): string {
  if (!text) return text;
  let result = text;

  // Replace 254mobiles brand variations with Kings Tech
  result = result.replace(/254[\s-]?mobiles/gi, "Kings Tech");
  result = result.replace(/254MOBILES/g, "Kings Tech");

  // Replace old phone number with new one
  result = result.replace(/\+?254[\s]?111[\s]?503[\s]?604/g, "254 142 652 388");

  // Replace 3rd Floor with 6th Floor in address context
  result = result.replace(/3rd Floor/gi, "6th Floor");

  // Remove stray anchor tags pointing to 254mobiles site
  result = result.replace(/<a[^>]*254[^>]*>.*?<\/a>/gi, "");

  // Remove stray Google/unrelated anchor tags
  result = result.replace(/<a[^>]*https?:\/\/www\.google\.com[^>]*>.*?<\/a>/gi, "");

  return result;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
  }

  let fileContent: string;
  try {
    fileContent = await file.text();
  } catch {
    return NextResponse.json({ success: false, error: "Failed to read uploaded file" }, { status: 400 });
  }

  if (!fileContent.trim()) {
    return NextResponse.json({ success: false, error: "Uploaded file is empty" }, { status: 400 });
  }

  let products;
  try {
    products = parseWebToffeeCSV(fileContent);
  } catch (err) {
    console.error("CSV parse error:", err);
    return NextResponse.json({ success: false, error: "Failed to parse CSV file" }, { status: 400 });
  }

  console.log(`Parsed ${products.length} products from CSV`);

  if (products.length === 0) {
    return NextResponse.json(
      { success: false, error: "No valid products found in CSV. Make sure the file has a SKU/ID column and at least one data row." },
      { status: 400 },
    );
  }

  let collection;
  try {
    collection = await getProductsCollection();
  } catch {
    return NextResponse.json({ success: false, error: "Database connection failed" }, { status: 500 });
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { sku: string; message: string }[] = [];

  for (const product of products) {
    const { sku } = product;

    if (!sku || sku.trim() === "") {
      skipped++;
      continue;
    }

    if (!product.name || product.name.trim() === "") {
      product.name = sku;
    }

    // Native WooCommerce mappings
    const rawShortDesc = product.shortDescription || (product as Record<string, unknown>).post_excerpt as string || "";
    const keyFeatures = sanitizeContent(rawShortDesc); // keep rich HTML for the Key Features editor field

    const regularPrice = Number(product.regularPrice) || 0;
    const salePrice = Number(product.salePrice) || 0;

    // regular_price is always the "was" price (compare-at); sale_price is the selling price
    const price = salePrice > 0 ? salePrice : regularPrice;
    const compareAtPrice = regularPrice > 0 ? regularPrice : 0;

    // Parse image URLs from WebToffee "url ! alt : x ! title : y" format
    const parsedImages = parseImageUrls(product.images as string | string[] | undefined);

    // Resolve category names to MongoDB ObjectIds
    let resolvedCategories: string[] = [];
    try {
      const db = await connectDB();
      const rawCats = (product as Record<string, unknown>)["tax:product_cat"] as string | undefined
        || (Array.isArray(product.categories) ? product.categories.join("|") : product.categories as string | undefined);
      resolvedCategories = await resolveCategoryIds(rawCats, db);
    } catch { /* skip category resolution on error */ }

    const enrichedProduct = {
      ...product,
      shortDescription: rawShortDesc,
      description: sanitizeContent(product.description || (product as Record<string, unknown>).post_content as string || ""),
      keyFeatures,
      features: keyFeatures,
      regularPrice,
      salePrice,
      price,
      compareAtPrice,
      images: parsedImages.length > 0 ? parsedImages : (product.images || []),
      ...(resolvedCategories.length > 0 ? { categories: resolvedCategories } : {}),
      status: (product as any).published === 1 || (product as any).published === "1" ? "active" : "draft",
      stock: (product.stock != null && product.stock !== "" ? Number(product.stock) : 1000),
      updatedAt: new Date(),
    };

    try {
      const result = await collection.updateOne(
        { sku },
        {
          $set: enrichedProduct,$setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) imported++;
      else updated++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error during upsert";
      console.error(`Error upserting SKU ${sku}:`, message);
      errors.push({ sku, message });
    }
  }

  return NextResponse.json({ success: true, imported, updated, skipped, errors });
}
