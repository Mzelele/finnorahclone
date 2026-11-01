import { baseUrl } from "lib/utils";
import { connectDB } from "@/lib/mongodb";
import { claimCoupon, evaluateCoupon, releaseCoupon } from "@/lib/coupons";
import { initiateStkPush } from "@/lib/mpesa";
import { MpesaTransaction } from "@/models/MpesaTransaction";
import { Order } from "@/models/Order";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

// ===== Spam/abuse protections =====

// 1) Common spam name blacklist (compared case-insensitively after trimming)
const SPAM_NAMES = new Set([
  "john smith",
  "test user",
  "john doe",
  "john smith 002",
  "jane doe",
  "test test",
]);

// 1b) Known disposable/bot email domain blacklist (compared case-insensitively)
const SPAM_EMAIL_DOMAINS = new Set([
  "storebotmail.joonix.net",
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
]);

// 2) Kenyan phone validation: must start with 07, 01, or +254 (then 8 digits)
const KENYAN_PHONE_RE = /^(\+?254|0)([17])\d{8}$/;

// 3) In-memory rate limiter: max 3 orders per hour per IP.
//    NOTE: In-memory state is per-process/isolate. On Cloudflare Workers this
//    is not globally shared across all instances; swap for Redis for a
//    hard guarantee. Provides a reasonable basic protection layer.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3; // max 3 orders per hour per IP
const orderTimestamps = new Map<string, number[]>(); // IP -> timestamps

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  // Prune entries outside the window
  const timestamps = (orderTimestamps.get(ip) || []).filter((t) => t > cutoff);
  orderTimestamps.set(ip, timestamps);
  return timestamps.length >= RATE_LIMIT_MAX;
}

// Record a successfully created order for rate-limiting purposes
function recordOrder(ip: string): void {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (orderTimestamps.get(ip) || []).filter((t) => t > cutoff);
  timestamps.push(now);
  orderTimestamps.set(ip, timestamps);
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // "x-forwarded-for" may contain a comma-separated list of IPs (proxies chain
    // the real client IP first). With noUncheckedIndexedAccess, indexing the array
    // can type as `string | undefined`, so guard it explicitly rather than using a
    // non-null assertion. If the first entry is missing/empty we fall through to
    // the next header instead of crashing at runtime.
    const firstForwardedIp = forwarded.split(",")[0]?.trim();
    if (firstForwardedIp) return firstForwardedIp;
  }
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // Tracked outside the try so the catch can give a coupon use back if the order fails.
  let claimedCouponId: any = null;
  let orderSaved = false;
  let dbRef: any = null;
  try {
    const db = await connectDB();
    dbRef = db;
    const body = await req.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 });
    }
    if (!body.shippingAddress?.fullName || !body.shippingAddress?.phone) {
      return NextResponse.json({ error: "Full name and phone number are required" }, { status: 400 });
    }
    if (body.total === undefined || body.subtotal === undefined) {
      return NextResponse.json({ error: "Total and subtotal are required" }, { status: 400 });
    }

    // Validate selected payment method against enabled methods in settings
    const settings = await db.collection("settings").findOne({ storeId: "default" });
    const paymentMethods = Array.isArray(settings?.paymentMethods)
      ? settings.paymentMethods
      : [
          { id: "cash_on_delivery", name: "Cash on Delivery", enabled: true },
          { id: "mpesa", name: "M-Pesa (Receive Prompt)", enabled: true },
        ];
    const selectedMethod = body.paymentMethod;
    const enabledMethodIds = paymentMethods
      .filter((m: any) => m.enabled)
      .map((m: any) => m.id);
    if (!selectedMethod || !enabledMethodIds.includes(selectedMethod)) {
      return NextResponse.json(
        { error: "Selected payment method is not available" },
        { status: 400 }
      );
    }

    const { fullName, phone, email, address, city, region, country, notes } = body.shippingAddress;

    // ---- 1) Spam name blacklist ----
    if (SPAM_NAMES.has(String(fullName).trim().toLowerCase())) {
      return NextResponse.json(
        { error: "The provided name is not accepted. Please use a valid name." },
        { status: 400 }
      );
    }

        // ---- 2) Kenyan phone validation ----
        const normalizedPhone = String(phone || "").replace(/[\s\-()]/g, "");
        if (!KENYAN_PHONE_RE.test(normalizedPhone)) {
          return NextResponse.json(
            {
              error:
                "Invalid phone number. Please enter a valid Kenyan number (e.g. 07XXXXXXXX, 01XXXXXXXX, or +2547XXXXXXXX).",
            },
            { status: 400 }
          );
        }

        // ---- 2b) Bot email domain blacklist ----
        if (email) {
          const emailDomain = String(email).split("@").pop()?.trim().toLowerCase() || "";
          if (SPAM_EMAIL_DOMAINS.has(emailDomain)) {
            return NextResponse.json(
              { error: "The provided email address is not accepted." },
              { status: 400 }
            );
          }
        }

        // ---- 2c) Non-Kenyan address block ----
        if (country) {
          const normalizedCountry = String(country).trim();
          if (normalizedCountry !== "Kenya" && normalizedCountry !== "KE") {
            return NextResponse.json(
              { error: "Orders are only accepted within Kenya." },
              { status: 400 }
            );
          }
        }

        // ---- 3) Rate limit by IP ----
    // Check the limit before creating the order, but only record the order
    // after it is successfully persisted (see below).
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Too many orders. Please try again later." },
        { status: 429 }
      );
    }

    // ---- 4) Pricing + discount code, computed on the server (browser totals are not trusted) ----
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const itemsSubtotal = body.items.reduce(
      (sum: number, it: any) => sum + Number(it.price) * Number(it.quantity),
      0,
    );
    const orderSubtotal =
      Number.isFinite(itemsSubtotal) && itemsSubtotal > 0
        ? round2(itemsSubtotal)
        : Number(body.subtotal) || 0;
    let orderShipping = Math.max(0, Number(body.shippingCost) || 0);
    let orderDiscount = 0;
    let appliedCoupon: { code: string; type: string; value: number } | null = null;

    const couponSettings = await db.collection("settings").findOne({ storeId: "default" });
    const couponCode = couponSettings?.couponsEnabled === false ? "" : String(body.couponCode || "").trim();
    if (couponCode) {
      const result = await evaluateCoupon(db, couponCode, orderSubtotal);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      if (!(await claimCoupon(db, result.coupon._id))) {
        return NextResponse.json({ error: "This code has been fully redeemed" }, { status: 400 });
      }
      claimedCouponId = result.coupon._id;
      orderDiscount = result.discount;
      if (result.freeShipping) orderShipping = 0;
      appliedCoupon = {
        code: result.coupon.code,
        type: result.coupon.type,
        value: Number(result.coupon.value) || 0,
      };
    }
    const orderTotal = round2(Math.max(0, orderSubtotal - orderDiscount) + orderShipping);

    const customerEmail = email || (phone ? `${phone}@placeholder.local` : `guest-${Date.now()}@placeholder.local`);

    // Find or create the customer: email first, then phone. Never hand a customer an
    // email that another customer already owns (that caused the E11000 error).
    const customers = db.collection("customers");
    let customer: any = await customers.findOne({ email: customerEmail });
    if (!customer && phone) {
      customer = await customers.findOne({ phone });
      if (customer && email && customer.email !== email) {
        try {
          await customers.updateOne(
            { _id: customer._id },
            { $set: { email, updatedAt: new Date() } },
          );
          customer.email = email;
        } catch (err: any) {
          if (err?.code !== 11000) throw err; // email taken by someone else: keep this record
        }
      }
    }
    if (!customer) {
      const now = new Date();
      try {
        const inserted = await customers.insertOne({
          email: customerEmail,
          name: fullName,
          phone: phone || "",
          createdAt: now,
          updatedAt: now,
        });
        customer = { _id: inserted.insertedId, email: customerEmail, name: fullName, phone: phone || "" };
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
        customer = await customers.findOne({ email: customerEmail }); // created by a parallel request
        if (!customer) throw err;
      }
    }

    for (const item of body.items) {
      if (!item.productId || !item.quantity) continue;
      if (!ObjectId.isValid(item.productId)) continue;
      if (item.variantId && ObjectId.isValid(item.variantId)) {
        await db.collection("products").updateOne(
          { _id: new ObjectId(item.productId), "variants._id": new ObjectId(item.variantId) },
          { $inc: { "variants.$.stock": -item.quantity } }
        );
      } else {
        await db.collection("products").updateOne(
          { _id: new ObjectId(item.productId) },
          { $inc: { stock: -item.quantity } }
        );
      }
    }

        const now = new Date();
    const orderNumber = "ORD-" + Date.now();

    // Payment method is sent by the checkout form. Only "mpesa" triggers the
    // M-Pesa flow; anything else (or missing) reverts to Cash on Delivery.
    const paymentMethod = body.paymentMethod === "mpesa" ? "mpesa" : "cash_on_delivery";
    // M-Pesa orders start as "pending" (waiting for the STK callback). COD
    // orders have no upfront payment, so "unpaid" is more truthful there.
    const paymentStatus = paymentMethod === "mpesa" ? "pending" : "unpaid";

    const orderData = {
      orderNumber,
      customer: customer._id,
      status: "pending",
      paymentMethod,
      paymentStatus,
      mpesaCheckoutRequestId: null, // filled in below once Daraja returns a CheckoutRequestID
      items: body.items.map((item: any) => ({
        product: ObjectId.isValid(item.productId) ? new ObjectId(item.productId) : item.productId,
        variantId: item.variantId && ObjectId.isValid(item.variantId) ? new ObjectId(item.variantId) : item.variantId || null,
        name: item.name,
        sku: item.sku || "",
        image: item.image || "",
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal: orderSubtotal,
      discount: orderDiscount,
      coupon: appliedCoupon,
      shippingCost: orderShipping,
      total: orderTotal,
      shippingAddress: { fullName, phone: phone || "", address, city, region, country, notes: notes || "" },
      adminNotes: "",
      statusHistory: [{ status: "pending", note: "Order placed", changedAt: now }],
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("orders").insertOne(orderData);
    orderSaved = true;

    // Record the successful order for rate limiting
    recordOrder(clientIp);

    try {
      const emailRes = await fetch(new URL("/api/send-order-email", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail,
          customerName: fullName,
          orderId: orderNumber,
          items: orderData.items,
          total: orderData.total,
          phone: phone || "",
          address: `${address}, ${city}, ${country}`, notes: notes || "",
          productUrl: body.items?.[0]?.productId ? `${baseUrl}/product/${body.items[0].handle || ""}` : "",
        }),
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) console.error("Email route error:", emailData);
    } catch (emailError: any) {
      console.error("Order email error:", emailError?.message || emailError);
    }

        // ---- M-Pesa payment (only when the customer chose M-Pesa) ----
    // The Order is already saved. Now, right after creation, we send the STK
    // push to the customer's phone, persist an MpesaTransaction linked to this
    // order, and store the returned CheckoutRequestID back on the Order so the
    // frontend can poll for the live payment result.
    const orderId = result.insertedId.toString();
    let checkoutRequestId: string | null = null;

    if (paymentMethod === "mpesa" && orderTotal > 0) {
      try {
        // Reuse the shared Daraja helper (token/password/timestamp/payload all
        // live in lib/mpesa.ts) so we don't duplicate any of that logic here.
        const daraja = await initiateStkPush({
          phoneNumber: phone || "", // the customer's phone, e.g. "0712345678"
          amount: orderTotal, // amount in KES
          accountReference: orderNumber, // shown on the STK prompt
          description: "Order payment",
        });

        const responseCode = daraja.ResponseCode;
        const checkoutId = daraja.CheckoutRequestID as string | undefined;
        const merchantRequestId = daraja.MerchantRequestID as string | undefined;

        // Only treat it as accepted if Daraja actually returned a "0" response
        // code and a CheckoutRequestID (meaning the prompt was sent).
        if (responseCode === "0" && checkoutId) {
          checkoutRequestId = checkoutId;

          // Persist a "pending" MpesaTransaction linked to this order via orderId.
          try {
            await MpesaTransaction.create({
              checkoutRequestId: checkoutId,
              merchantRequestId,
              orderId, // <- link the transaction to its Order
              phoneNumber: phone || "",
              amount: orderTotal,
              accountReference: orderNumber,
            });
          } catch (txError) {
            // Persisting the transaction must not fail the order — Daraja already
            // sent the prompt. Log it and continue.
            console.error("Failed to persist MpesaTransaction for order:", txError);
          }

          // Save the CheckoutRequestID onto the Order so the success page can
          // poll GET /api/mpesa/status/[checkoutRequestId].
          await Order.findByIdAndUpdate(orderId, {
            $set: { mpesaCheckoutRequestId: checkoutId },
          });
        } else {
          // Daraja did not accept the STK push (e.g. invalid params). Leave the
          // order as-is; the frontend can still show the order but no live
          // M-Pesa status will be available.
          console.warn("M-Pesa STK push not acknowledged for order:", orderNumber, daraja);
        }
      } catch (mpesaError) {
        // The push failed entirely (network, missing env, etc.). We must NOT
        // fail the whole order placement — the customer already has an Order.
        // Log it so it can be investigated; payment can be retried later.
        console.error("M-Pesa initiation failed for order", orderNumber, mpesaError);
      }
    }

    return NextResponse.json({
      orderId,
      orderNumber,
      paymentMethod,
      // The CheckoutRequestID lets the success page start live polling. Null
      // for COD or if the M-Pesa push/daraja acknowledgement failed.
      checkoutRequestId,
    });
  } catch (error) {
    console.error("Orders API error:", error);
    if (claimedCouponId && !orderSaved && dbRef) {
      await releaseCoupon(dbRef, claimedCouponId).catch(() => {});
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}



