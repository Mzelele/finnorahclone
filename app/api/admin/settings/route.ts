import { connectDB } from "@/lib/mongodb";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const defaultSettings = {
  storeId: "default",
  storeName: "ACME Store",
  storeEmail: "",
  storePhone: "",
  whatsappPhone: "",
  storeAddress: "",
  currency: "KES",
  country: "Kenya",
  metaTitle: "ACME Store",
  metaDescription: "",
  shopMetaTitle: "",
  shopMetaDescription: "",
  shippingCost: 200,
  freeShippingThreshold: 5000,
  shippingNote: "",
  deliveryRegions: [],
  deliveryMethods: [
    { id: "standard", name: "Standard Delivery", description: "2-3 business days", price: 200, enabled: true },
    { id: "express", name: "Express Delivery", description: "Same day / next day", price: 500, enabled: true },
    { id: "pickup", name: "Pick Up", description: "Collect from our location", price: 0, enabled: true },
  ],
  logoUrl: "",
  logoIconUrl: "",
  faviconUrl: "",
  showLogoIcon: true,
  primaryColor: "#2563eb",
  announcementBar: false,
  announcementText: "",
  announcementLink: "",
  heroEnabled: false,
  heroMode: "text",
  heroTitle: "",
  heroSubtitle: "",
  heroImageUrl: "",
  heroImageUrls: [],
  heroAutoplayInterval: 3000,
  heroButtonText: "Shop Now",
  heroButtonLink: "",
  heroBgColor: "#f5f5dc",
  facebookPixelId: "",
  scripts: [],
  // Navbar theme: false = light, true = dark
  navbarDark: false,
  ctaButtons: {
    addToCart: { enabled: true, text: "Add To Cart", style: "pill" },
    call: { enabled: true, text: "Call to Order", style: "pill" },
    whatsapp: { enabled: true, text: "WhatsApp", style: "pill" },
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

export async function GET() {
  try {
    const db = await connectDB();
    const settings = await db
      .collection("settings")
      .findOne({ storeId: "default" });
    if (!settings) {
      await db.collection("settings").insertOne({
        ...defaultSettings,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return NextResponse.json(defaultSettings);
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const { storeId, _id, createdAt, updatedAt, __v, ...data } = body;

    const settings = await db
      .collection("settings")
      .findOneAndUpdate(
        { storeId: "default" },
        { $set: { ...data, updatedAt: new Date() } },
        { upsert: true, returnDocument: "after" },
      );

    // Banner/homepage content (announcement bar, hero banner, etc.) has
    // changed — clear the homepage cache immediately so the storefront
    // reflects the latest settings.
    revalidatePath("/");
    revalidateTag("store-settings", "default");

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}

