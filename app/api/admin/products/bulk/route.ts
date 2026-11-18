import { connectDB } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const { ids, updates } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No product IDs provided" }, { status: 400 });
    }

        const objectIds = ids
      .filter((id: string) => ObjectId.isValid(id))
      .map((id: string) => new ObjectId(id));

    const updateDoc: any = { $set: { updatedAt: new Date() } };

    if (updates.status !== undefined && updates.status !== "") {
      updateDoc.$set.status = updates.status;
    }
    if (updates.stock !== undefined && updates.stock !== "") {
      updateDoc.$set.stock = Number(updates.stock);
    }
    if (updates.price !== undefined && updates.price !== "") {
      updateDoc.$set.price = Number(updates.price);
    }
        if (updates.category !== undefined && updates.category !== "") {
      const catId = new ObjectId(updates.category);
      // Replace categories with the assigned one (bulk assign replaces all)
      updateDoc.$set.categories = [catId];
      updateDoc.$unset = { category: "" };
    }
    if (updates.comparePrice !== undefined && updates.comparePrice !== "") {
      updateDoc.$set.comparePrice = Number(updates.comparePrice);
    }

    const result = await db.collection("products").updateMany(
      { _id: { $in: objectIds } },
      updateDoc
    );

    if (result.modifiedCount > 0) {
      revalidateTag("products", "default");
      revalidatePath("/");
    }

    return NextResponse.json({
      message: `${result.modifiedCount} product(s) updated`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
