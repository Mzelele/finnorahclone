import { connectDB } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidateTag, revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const slugify = (str: string) =>
  str.toLowerCase().trim()
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function POST(req: NextRequest) {
  try {
    const db = await connectDB();
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const original = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!original) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { _id, createdAt, updatedAt, slug, ...rest } = original;
    const now = new Date();
    const newName = `${rest.name} (Copy)`;
    const newSlug = `${slugify(rest.slug || rest.name)}-${Date.now()}`;

        const toInsert: any = {
      ...rest,
      name: newName,
      slug: newSlug,
      sku: rest.sku ? `${rest.sku}-copy` : "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    // Preserve categories array, remove old single field
    if (toInsert.category) delete toInsert.category;
    if (Array.isArray(toInsert.categories)) {
      toInsert.categories = toInsert.categories.map((c: any) => {
        const idStr = c?.toString?.() || c;
        try { return new ObjectId(idStr); } catch { return idStr; }
      });
    }

    const result = await db.collection("products").insertOne(toInsert);
    revalidateTag("products", "default");
    revalidatePath("/");
    return NextResponse.json({ ...toInsert, _id: result.insertedId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
