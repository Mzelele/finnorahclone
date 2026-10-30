import { connectDB } from "@/lib/mongodb";
import { parseCouponInput } from "@/lib/coupons";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const db = await connectDB();
  const coupons = await db.collection("coupons").find({}).sort({ createdAt: -1 }).toArray();
  return NextResponse.json(coupons);
}

export async function POST(req: NextRequest) {
  const db = await connectDB();
  const parsed = parseCouponInput(await req.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const col = db.collection("coupons");
  await col.createIndex({ code: 1 }, { unique: true });
  if (await col.findOne({ code: parsed.data.code })) {
    return NextResponse.json({ error: "That code already exists" }, { status: 409 });
  }
  const doc = { ...parsed.data, usedCount: 0, createdAt: new Date(), updatedAt: new Date() };
  const res = await col.insertOne(doc);
  return NextResponse.json({ ...doc, _id: res.insertedId }, { status: 201 });
}
