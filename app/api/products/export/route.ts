import { generateWebToffeeCSV } from "@/lib/csvParser";
import { getProductsCollection } from "@/lib/productsDb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function yyyyMMDD(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const inStock = searchParams.get("inStock");
    const search = searchParams.get("search");

    const filter: Record<string, unknown> = {};

    if (type) filter.type = type;

    if (category) {
      // categories is stored as an array of strings
      filter.categories = { $elemMatch: { $regex: category, $options: "i" } };
    }

    if (inStock !== null && inStock !== "") {
      // inStock is stored as boolean in DB
      filter.inStock = inStock === "true";
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    console.log("Export filter:", JSON.stringify(filter));

    const collection = await getProductsCollection();
    const products = await collection.find(filter).toArray();

    console.log(`Exporting ${products.length} products`);

    if (products.length === 0) {
      // Still return a valid CSV with just headers
      const csv = generateWebToffeeCSV([]);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="products-export-${yyyyMMDD()}.csv"`,
        },
      });
    }

    const csv = generateWebToffeeCSV(
      products as unknown as Parameters<typeof generateWebToffeeCSV>[0],
    );

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products-export-${yyyyMMDD()}.csv"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 });
  }
}
