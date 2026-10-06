import { baseUrl } from "lib/utils";
import { connectDB } from "@/lib/mongodb";
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
  try {
    const db = await connectDB();
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

    const customerEmail = email || (phone ? `${phone}@placeholder.local` : `guest-${Date.now()}@placeholder.local`);

    let customer = await db.collection("customers").findOne({ $or: [{ email: customerEmail }, { phone }] });
    if (customer && email && customer.email !== email) {
      await db.collection("customers").updateOne({ _id: customer._id }, { $set: { email: email } });
      customer.email = email;
    }
    if (!customer) {
      const now = new Date();
      const result = await db.collection("customers").insertOne({
        email: customerEmail, name: fullName, phone: phone || "", createdAt: now, updatedAt: now,
      });
      customer = { _id: result.insertedId, email: customerEmail, name: fullName, phone: phone || "" };
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
      subtotal: body.subtotal,
      shippingCost: body.shippingCost || 0,
            total: body.total,
      shippingAddress: { fullName, phone: phone || "", address, city, region, country, notes: notes || "" },
      adminNotes: "",
      statusHistory: [{ status: "pending", note: "Order placed", changedAt: now }],
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("orders").insertOne(orderData);

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

    if (paymentMethod === "mpesa") {
      try {
        // Reuse the shared Daraja helper (token/password/timestamp/payload all
        // live in lib/mpesa.ts) so we don't duplicate any of that logic here.
        const daraja = await initiateStkPush({
          phoneNumber: phone || "", // the customer's phone, e.g. "0712345678"
          amount: body.total, // amount in KES
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
              amount: Number(body.total),
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
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}



