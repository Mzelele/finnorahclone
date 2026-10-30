import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;

// Blocks obvious local/private targets. The route sits under /api/admin, so it
// is only reachable by a logged-in admin.
function isBlockedHost(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("[")) return true;
  if (/^127\\./.test(h) || /^10\\./.test(h) || /^192\\.168\\./.test(h)) return true;
  if (/^169\\.254\\./.test(h) || /^0\\./.test(h)) return true;
  if (/^172\\.(1[6-9]|2\\d|3[01])\\./.test(h)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(target.protocol) || isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(target.toString(), {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OrderDocs/1.0)" },
    });
    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });

    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    return new NextResponse(buf, {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
