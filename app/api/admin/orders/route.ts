import { connectDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const db = await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const hideDeleted = searchParams.get("hideDeleted") === "true";

    const filter: any = {};
    if (status && status !== "all") filter.status = status;
    if (paymentStatus && paymentStatus !== "all") filter.paymentStatus = paymentStatus;
    if (hideDeleted) filter.deletedAt = { $exists: false };
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const col = db.collection("orders");

    const [orders, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    // Manually populate customer
    const customerIds = orders.map((o) => o.customer).filter(Boolean);
    const customers = customerIds.length
      ? await db.collection("customers").find({ _id: { $in: customerIds } }).toArray()
      : [];
    const customerMap = Object.fromEntries(customers.map((c) => [c._id.toString(), c]));

    const populated = orders.map((o) => ({
      ...o,
      customer: o.customer ? customerMap[o.customer.toString()] || o.customer : null,
    }));

    return NextResponse.json({ orders: populated, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const { ObjectId } = await import("mongodb");
    const orderNumber = "ORD-" + Date.now();
    const order = {
      orderNumber,
      shippingAddress: body.shippingAddress,
      items: body.items,
      total: body.total,
      status: body.status || "pending",
      paymentStatus: body.paymentStatus || "unpaid",
      note: body.note || "",
      source: body.source || "admin",
      createdAt: new Date(),
      statusHistory: [{ status: body.status || "pending", note: "Order created manually", changedAt: new Date() }],
    };
    const result = await db.collection("orders").insertOne(order);
    return NextResponse.json({ _id: result.insertedId, orderNumber });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
