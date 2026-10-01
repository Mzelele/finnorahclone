import { connectDB } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
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

export async function GET(req: NextRequest) {
  try {
    const db = await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const filter: any = {};
    if (status) filter.status = status;
        if (category) {
      try {
        const catId = new ObjectId(category);
        filter.$or = [
          { categories: catId },
          { categories: category },
          { category: catId },
          { category: category },
        ];
      } catch {
        filter.$or = [
          { categories: category },
          { category: category },
        ];
      }
    }
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const col = db.collection("products");

    const countFilter = { ...filter };
    delete countFilter.status;

    const [products, total, statusCounts] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
      col
        .aggregate([
          { $match: countFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

        // Populate category names - support both old `category` (single) and new `categories` (array)
    const allCatRefs = products.flatMap((p) => {
      const refs: string[] = [];
      if (Array.isArray(p.categories)) {
        for (const c of p.categories) {
          if (c) refs.push(c.toString());
        }
      } else if (p.category) {
        refs.push(p.category.toString());
      }
      return refs;
    });
    const uniqueCatIds = [...new Set(allCatRefs.filter(Boolean))];
        const catDocs = uniqueCatIds.length
      ? await db.collection("categories").find({ _id: { $in: uniqueCatIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } }).toArray()
      : [];
    const catMap = Object.fromEntries(catDocs.map((c) => [c._id.toString(), { _id: c._id, name: c.name }]));

    const populated = products.map((p) => {
      const p2 = { ...p };
      // Map new categories array
      if (Array.isArray(p2.categories)) {
        p2.categories = p2.categories.map((c: any) => {
          const id = c?.toString?.() || c;
          return catMap[id] || c;
        });
      }
      // Map old single category
      if (p2.category) {
        p2.category = catMap[p2.category.toString()] || p2.category;
      }
      return p2;
    });

    const counts = statusCounts.reduce(
      (acc, item) => ({ ...acc, [item._id || "draft"]: item.count }),
      { active: 0, draft: 0, archived: 0 },
    );

    return NextResponse.json({ products: populated, total, counts, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await connectDB();
    const body = await req.json();
    body.slug = slugify(body.slug || body.name || `draft-product-${Date.now()}`);
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
      });
    } else {
      // Handle existing single category field
      if (body.category) {
        body.categories = [new ObjectId(body.category)];
        delete body.category;
      } else if (Array.isArray(body.categories)) {
        body.categories = body.categories.map((id: string) => new ObjectId(id));
      } else {
        body.categories = [];
      }
    }
    const now = new Date();
    const toInsert = { ...body, createdAt: now, updatedAt: now };
    const result = await db.collection("products").insertOne(toInsert);
    return NextResponse.json({ ...toInsert, _id: result.insertedId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


