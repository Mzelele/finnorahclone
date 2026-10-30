export type CouponType = "percent" | "fixed" | "free_shipping";

export function normalizeCode(code: unknown) {
  return String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export type CouponResult =
  | { ok: true; coupon: any; discount: number; freeShipping: boolean }
  | { ok: false; error: string };

// Single source of truth: used by the checkout preview AND by order creation.
export async function evaluateCoupon(
  db: any,
  rawCode: unknown,
  subtotal: number,
): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "Enter a discount code" };

  const coupon = await db.collection("coupons").findOne({ code });
  if (!coupon || !coupon.enabled) {
    return { ok: false, error: "This discount code isn't valid" };
  }

  const now = new Date();
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { ok: false, error: "This code isn't active yet" };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { ok: false, error: "This code has expired" };
  }
  if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
    return { ok: false, error: "This code has been fully redeemed" };
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      error: `Spend at least KES ${Number(coupon.minSubtotal).toLocaleString()} to use this code`,
    };
  }

  let discount = 0;
  let freeShipping = false;
  if (coupon.type === "percent") {
    discount = (subtotal * Number(coupon.value)) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
  } else if (coupon.type === "fixed") {
    discount = Number(coupon.value);
  } else if (coupon.type === "free_shipping") {
    freeShipping = true;
  }
  discount = Math.min(Math.round(discount), subtotal);

  return { ok: true, coupon, discount, freeShipping };
}

const num = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

// Dates arrive as YYYY-MM-DD; treat them as Kenya time (UTC+3), expiry = end of that day.
const dateAt = (v: any, end: boolean) => {
  if (!v) return null;
  const s = String(v);
  const d = new Date(
    s.length === 10 ? `${s}T${end ? "23:59:59.999" : "00:00:00.000"}+03:00` : s,
  );
  return isNaN(d.getTime()) ? null : d;
};

export function parseCouponInput(b: any): { error: string } | { data: any } {
  const code = normalizeCode(b.code);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { error: "Code must be 3-32 characters: letters, numbers, - or _" };
  }
  const type = b.type as CouponType;
  if (!["percent", "fixed", "free_shipping"].includes(type)) {
    return { error: "Choose a discount type" };
  }
  const value = Number(b.value) || 0;
  if (type === "percent" && (value <= 0 || value > 100)) {
    return { error: "Percentage must be between 1 and 100" };
  }
  if (type === "fixed" && value <= 0) {
    return { error: "Enter a discount amount" };
  }
  return {
    data: {
      code,
      type,
      value: type === "free_shipping" ? 0 : value,
      description: String(b.description || "").trim(),
      minSubtotal: num(b.minSubtotal) || 0,
      maxDiscount: type === "percent" ? num(b.maxDiscount) : null,
      usageLimit: num(b.usageLimit),
      startsAt: dateAt(b.startsAt, false),
      expiresAt: dateAt(b.expiresAt, true),
      enabled: b.enabled !== false,
    },
  };
}

// Atomically uses up one redemption. Returns false if the limit was reached
// in the meantime (e.g. two customers checking out at the same moment).
export async function claimCoupon(db: any, couponId: any): Promise<boolean> {
  const r = await db.collection("coupons").updateOne(
    {
      _id: couponId,
      enabled: true,
      $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
    },
    { $inc: { usedCount: 1 } },
  );
  return r.modifiedCount === 1;
}

// Gives a redemption back if the order failed after the coupon was claimed.
export async function releaseCoupon(db: any, couponId: any) {
  await db
    .collection("coupons")
    .updateOne({ _id: couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
}
