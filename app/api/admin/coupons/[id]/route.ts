import { connectDB } from "@/lib/mongodb";
import { parseCouponInput } from "@/lib/coupons";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const parsed = parseCouponInput(await req.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await connectDB();
  const col = db.collection("coupons");
  const clash = await col.findOne({ code: parsed.data.code, _id: { $ne: new ObjectId(id) } });
  if (clash) return NextResponse.json({ error: "That code already exists" }, { status: 409 });

  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed.data, updatedAt: new Date() } },
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const db = await connectDB();
  await db.collection("coupons").deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok: true });
}
