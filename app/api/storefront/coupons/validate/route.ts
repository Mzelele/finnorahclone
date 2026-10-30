import { connectDB } from "@/lib/mongodb";
import { evaluateCoupon } from "@/lib/coupons";
import { NextRequest, NextResponse } from "next/server";

// Preview only. The order route re-validates the code and recomputes the total.
export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json();
    const db = await connectDB();
    const r = await evaluateCoupon(db, code, Number(subtotal) || 0);
    if (!r.ok) return NextResponse.json({ valid: false, error: r.error });
    return NextResponse.json({
      valid: true,
      code: r.coupon.code,
      type: r.coupon.type,
      value: r.coupon.value,
      description: r.coupon.description || "",
      discount: r.discount,
      freeShipping: r.freeShipping,
    });
  } catch (err) {
    console.error("Coupon validate error:", err);
    return NextResponse.json({ valid: false, error: "Could not check the code" }, { status: 500 });
  }
}
