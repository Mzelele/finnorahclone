import { parseWebToffeeCSV } from "@/lib/csvParser";
import { getProductsCollection } from "@/lib/productsDb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

  // Parse CSV — supports WooCommerce native, WebToffee real, and standard formats
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
      { success: false, error: "No valid products found in CSV. Make sure the file has a SKU column and at least one data row." },
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

    // Ensure name is not empty (fall back to SKU)
    if (!product.name || product.name.trim() === "") {
      product.name = sku;
    }

    try {
      const result = await collection.updateOne(
        { sku },
        {
          $set: { ...product, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
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
