import { connectDB } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = await connectDB();
    const settings = await db.collection("settings").findOne({ storeId: "default" });
        const defaults = {
      storeName: "ACME Store",
      currency: "KES",
      country: "Kenya",
      whatsappPhone: "",
      storePhone: "",
      shippingCost: 200,
      freeShippingThreshold: 5000,
      shippingNote: "",
      primaryColor: "#2563eb",
      announcementBar: false,
      announcementText: "",
      logoUrl: "",
      faviconUrl: "",
      metaTitle: "ACME Store",
      metaDescription: "",
      ctaButtons: {
        addToCart: { enabled: true, text: "Add To Cart", mobileText: "", style: "pill", fontWeight: "bold", bgColor: "#2563eb", textColor: "#ffffff" },
        call: { enabled: true, text: "Call to Order", mobileText: "", style: "pill", fontWeight: "semibold", bgColor: "#ffffff", textColor: "#111827" },
        whatsapp: { enabled: true, text: "WhatsApp", mobileText: "", style: "pill", fontWeight: "semibold", bgColor: "#16a34a", textColor: "#ffffff" },
        buyNow: { enabled: true, text: "Buy It Now", mobileText: "", style: "pill", fontWeight: "semibold", bgColor: "#f97316", textColor: "#ffffff" },
      },
      paymentMethods: [
        {
          id: "cash_on_delivery",
          name: "Cash on Delivery",
          description: "Pay when your order arrives.",
          enabled: true,
        },
        {
          id: "mpesa",
          name: "M-Pesa (Receive Prompt)",
          description: "Receive an M-Pesa STK push prompt on your phone.",
          enabled: true,
        },
      ],
    };
    if (!settings) {
      return NextResponse.json(defaults);
    }
    return NextResponse.json({ ...defaults, ...settings });
  } catch (error) {
    console.error("Storefront settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

