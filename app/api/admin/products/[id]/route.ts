import { connectDB } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

async function detectBrand(title: string) {
  try {
    const db = await connectDB();
    const brands = await db.collection("brands").find().toArray();
    if (!brands.length) return null;
    const normalizedTitle = title.toLowerCase();
    for (const brand of brands) {
      const brandName = brand.name?.toLowerCase();
      if (brandName && normalizedTitle.includes(brandName)) {
        return brand.slug;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Detect category by matching title/description against existing category names, slugs or keywords
async function detectCategory(text: string) {
  try {
    const db = await connectDB();
    const categories = await db.collection("categories").find().toArray();
    if (!categories.length) return [];
    const normalized = (text || "").toLowerCase();
    const matched: string[] = [];

    for (const cat of categories) {
      const name = (cat.name || "").toLowerCase();
      const slug = (cat.slug || "").toLowerCase();

      const nameRegex = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\b", "i");
      if (name && nameRegex.test(normalized)) {
        matched.push(cat._id.toString());
        continue;
      }

      if (slug && normalized.includes(slug)) {
        if (!matched.includes(cat._id.toString())) matched.push(cat._id.toString());
        continue;
      }

      const keywords = Array.isArray(cat.keywords) ? cat.keywords : (cat.keywords ? String(cat.keywords).split(",") : []);
      for (const kw of keywords) {
        const k = (kw || "").toLowerCase().trim();
        if (!k) continue;
        const kwRegex = new RegExp("\\b" + k.replace(/[.*+?^${}()|[\\]\\]\\\\]/g, "\\$&") + "\\b", "i");
        if (kwRegex.test(normalized) || normalized.includes(k)) {
          if (!matched.includes(cat._id.toString())) matched.push(cat._id.toString());
        }
      }
    }

    return matched;
  } catch {
    return [];
  }
}

const slugify = (str: string) =>
  str.toLowerCase().trim()
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await connectDB();
    const { id } = await params;
        const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    // Populate categories - support both new array and old single field
    const p2 = { ...product };
    if (Array.isArray(p2.categories) && p2.categories.length > 0) {
      const ids = p2.categories.map((c: any) => {
        const str = c?.toString?.() || c;
        try { return new ObjectId(str); } catch { return str; }
      });
      const cats = await db.collection("categories").find({ _id: { $in: ids } }).toArray();
      const catMap = Object.fromEntries(cats.map((c) => [c._id.toString(), c]));
      p2.categories = p2.categories.map((c: any) => {
        const id = c?.toString?.() || c;
        return catMap[id] || c;
      });
    } else if (p2.category) {
      const cat = await db.collection("categories").findOne({ _id: new ObjectId(p2.category.toString()) });
      if (cat) p2.category = cat;
    }
    return NextResponse.json(p2);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await connectDB();
        const { id } = await params;
    const body = await req.json();
    const existing = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Preserve the original product URL. Only change the slug when the user
    // explicitly edits it; title changes and variant edits must not alter the URL.
    if (body.slug && String(body.slug).trim()) {
      body.slug = slugify(String(body.slug).trim());
    } else {
      body.slug = existing.slug;
    }
    if (body.name) {
      const detectedBrand = await detectBrand(body.name);
      if (detectedBrand) body.brand = detectedBrand;

      // Use only manually selected categories
      const manualCategories = Array.isArray(body.categories) ? body.categories : [];
      if (body.category && !manualCategories.includes(body.category)) {
        manualCategories.push(body.category);
      }
      delete body.category;
      body.categories = manualCategories.map((id: string) => {
        try { return new ObjectId(id); } catch { return id; }
      }); } catch { return id; }
      });
    } else {
      // Handle single category field
      if (body.category) {
        body.categories = [new ObjectId(body.category)];
        delete body.category;
      } else if (Array.isArray(body.categories)) {
        body.categories = body.categories.map((id: string) => {
          try { return new ObjectId(id); } catch { return id; }
        });
      } else {
        body.categories = [];
      }
    }
    body.updatedAt = new Date();
    // Remove old category field if present
    delete body.category;
    const product = await db.collection("products").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: body },
      { returnDocument: "after" }
    );
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Revalidate the storefront so changes reflect immediately without waiting
    // for the cache to expire — both the product detail page and the homepage.
    revalidatePath(`/product/${body.slug || product.slug}`);
    revalidatePath("/");
    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await connectDB();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";
    const existing = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (permanent || existing.status === "archived") {
      await db.collection("products").deleteOne({ _id: new ObjectId(id) });
      return NextResponse.json({ message: "Product permanently deleted" });
    }

    const product = await db.collection("products").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status: "archived", updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return NextResponse.json({ message: "Product archived" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
