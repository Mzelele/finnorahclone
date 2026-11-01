import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/auto";

const SYSTEM_PROMPT = `You are an expert e-commerce copywriter and SEO specialist for a Kenyan online retail store. Your goal is to generate product content that is optimized to appear in Google AI Overviews and answer-based search results.

Your task is to extract product details from raw input text (WhatsApp broadcasts, social media captions, inventory lists) and generate rich, AI-Overview-ready product content.

STRICT RULES:
1. Extract factual product info: name, features, specifications, colors, materials, design details, and price if present.
2. IGNORE and DISCARD: phone numbers, contact details, shop locations/addresses, emojis, WhatsApp links, social media handles, promotional hype (e.g., "RESTOCK ALERT", "HOT DEAL", "LIMITED STOCK", "ORDER NOW").
3. KEEP prices — if a price is mentioned (KSh, KES, USD, etc.), include it in the aiOverview and as the "price" field.
4. If the input contains multiple clearly distinct products, return ALL as a JSON array. If unsure, return a single product in an array.
5. For the "name" field, generate an SEO-optimized product title:
   - Format: [Brand] [Model Number] [Spec 1] [Spec 2] [Material/Type] [Gender] [Category]
   - NO dashes, NO hyphens, NO punctuation separating the title
   - Model number MUST follow brand name immediately if present
   - Examples: "OLEVS 6898 Water Resistant Genuine Leather Mens Watch", "Samsung 65 Inch 4K QLED Smart TV"
   - Max 70 characters, no emojis, no promo words
6. For "description", write 2-4 professional sentences focused on benefits and quality.
7. For "keyFeatures", list 3-7 concise bullet phrases highlighting specs, materials, and functions.
7. For "keyFeatures", return 4-8 items. Each item should start with a relevant emoji followed by a short descriptive phrase. Choose emojis that match the feature (e.g. ⌚ for watch type, 🛡️ for water resistance, ⚙️ for movement type, 🔋 for battery, 🎨 for colors, 📅 for calendar/date, 🌙 for luminous hands, 🔗 for strap material, 🎁 for packaging). Example: "⌚ Chronograph dial with sub-dials", "🛡️ 30m water resistant", "🔗 Genuine leather strap". IMPORTANT: If the input mentions any gift box, gift bag, packaging, or unboxing experience (regardless of price), always replace it with exactly: "🎁 Packaged in a Nice Gift Bag and Gift Box". Never include packaging prices or costs in keyFeatures.

8. For "aiOverview", write a rich HTML-structured description optimized for Google AI Overviews and on-page SEO. Use the following structure:
   - <h2> tag: "Buy [Product Name] in Kenya – Price & Where to Order"
   - Opening paragraph (2-3 sentences): introduce the product, mention price in Kenya, mention Cash on Delivery
   - <h3> tag: "Key Features"
   - <ul> with <li> tags: list 4-6 key features as short phrases (no emojis in this list)
   - <h3> tag: "Why Buy from Us?"
   - <p> tag: 2 sentences about fast nationwide delivery, genuine products, Cash on Delivery, easy WhatsApp ordering
   - <h3> tag: "How to Order"
   - <p> tag: 1-2 sentences with a CTA mentioning WhatsApp or website ordering
   - Total length: 180-250 words
   - Write in natural, knowledgeable English — sound like a helpful human answer
   - Naturally weave in Kenya-specific keywords: "price in Kenya", "buy in Kenya", "Cash on Delivery Kenya", "delivery across Kenya"

OUTPUT FORMAT — ONLY valid JSON, no markdown, no preamble, no explanation. ALWAYS return an array.

[
  {
    "name": "string",
    "price": "string or null",
    "description": "string",
    "keyFeatures": ["string", ...],
    "aiOverview": "string"
  }
]

If no product info found, return: []`;

interface ProductInfo {
  name: string;
  price: string | null;
  description: string;
  keyFeatures: string[];
  aiOverview: string;
}

function validateSingleProduct(data: unknown): ProductInfo {
  if (!data || typeof data !== "object") {
    throw new Error("Product entry is not a valid JSON object");
  }

  const obj = data as Record<string, unknown>;

  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const price = typeof obj.price === "string" ? obj.price.trim() : null;
  const description = typeof obj.description === "string" ? obj.description.trim() : "";
  const keyFeatures = Array.isArray(obj.keyFeatures)
    ? obj.keyFeatures.filter((f): f is string => typeof f === "string").map((f) => f.trim())
    : [];
  const aiOverview = typeof obj.aiOverview === "string" ? obj.aiOverview.trim() : "";

  return { name, price, description, keyFeatures, aiOverview };
}

function validateProducts(data: unknown): ProductInfo[] {
  if (Array.isArray(data)) {
    return data.map(validateSingleProduct);
  }
  // Single object response — wrap in array
  return [validateSingleProduct(data)];
}

function extractJsonFromText(text: string): string {
  const trimmed = text.trim();

  // Remove markdown code fences if present
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  // Try array first: find the first '[' and last ']'
  const firstSquare = withoutFences.indexOf("[");
  const lastSquare = withoutFences.lastIndexOf("]");

  if (firstSquare !== -1 && lastSquare !== -1 && firstSquare < lastSquare) {
    return withoutFences.slice(firstSquare, lastSquare + 1);
  }

  // Fall back to object: find first '{' and last '}'
  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object or array found in model response");
  }

  return withoutFences.slice(firstBrace, lastBrace + 1);
}

export async function POST(req: NextRequest) {
  // 1. Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[generate-product-info] OPENROUTER_API_KEY is not set in environment");
    return NextResponse.json(
      { error: "Server configuration error: API key not set" },
      { status: 500 }
    );
  }

  // 2. Parse the request body
  let body: { rawText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const rawText = body?.rawText?.trim();
  if (!rawText) {
    return NextResponse.json(
      { error: 'Field "rawText" is required and must be a non-empty string' },
      { status: 400 }
    );
  }

  // 3. Call OpenRouter
  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Kenyan Retail Store - Product Info Generator",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: rawText },
        ],
        temperature: 0.4,
        max_tokens: 1800,
      }),
    });
  } catch (error) {
    console.error("[generate-product-info] Network error:", error);
    return NextResponse.json(
      { error: "Failed to connect to AI service. Please try again later." },
      { status: 502 }
    );
  }

  // 4. Handle non-200 responses from OpenRouter
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(
      `[generate-product-info] OpenRouter error ${response.status}:`,
      errorText
    );
    return NextResponse.json(
      { error: `AI service returned an error (${response.status}). Please try again.` },
      { status: 502 }
    );
  }

  // 5. Parse the OpenRouter response
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    console.error("[generate-product-info] Failed to parse OpenRouter response as JSON");
    return NextResponse.json(
      { error: "Received an invalid response from AI service." },
      { status: 502 }
    );
  }

  // 6. Extract the message content
  const resultObj = result as Record<string, unknown>;
  const choices = resultObj?.choices as Array<Record<string, unknown>> | undefined;
  const messageContent = choices?.[0]?.message;

  if (!messageContent || typeof (messageContent as Record<string, unknown>).content !== "string") {
    console.error(
      "[generate-product-info] Unexpected response structure:",
      JSON.stringify(result).slice(0, 500)
    );
    return NextResponse.json(
      { error: "AI service returned an unexpected response structure." },
      { status: 502 }
    );
  }

  const rawContent = (messageContent as Record<string, string>).content;
  if (!rawContent) return;

  // 7. Extract JSON from the model's response
  let parsed: unknown;
  try {
    const jsonString = extractJsonFromText(rawContent);
    parsed = JSON.parse(jsonString);
  } catch (error) {
    console.error(
      "[generate-product-info] Failed to parse JSON from model:",
      error,
      "Raw content:",
      rawContent.slice(0, 500)
    );
    return NextResponse.json(
      { error: "AI service returned malformed data. Please try again." },
      { status: 502 }
    );
  }

  // 8. Validate and sanitize — always return { products: ProductInfo[] }
  try {
    const products = validateProducts(parsed);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[generate-product-info] Validation error:", error);
    return NextResponse.json(
      { error: "AI service returned data in an unexpected format." },
      { status: 502 }
    );
  }
}