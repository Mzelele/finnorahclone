import type { jsPDF as PDF } from "jspdf";

export type DocKind = "receipt" | "label";

// Logo background behind the logo on printed documents:
//   "auto" = dark band only when the logo has light/white parts on a transparent background
//   "dark" = always use the band, "none" = never use it
const LOGO_BG: "auto" | "dark" | "none" = "none";
// Band colour (RGB). If your logo has BOTH black and white parts, try a
// mid-tone such as [107, 114, 128] or your brand colour.
const BAND_RGB: [number, number, number] = [17, 17, 17];

type Logo = { data: string; w: number; h: number; needsDark: boolean };
type Store = {
  name: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  currency: string;
};

// jsPDF's built-in fonts only support basic Latin, so strip anything else.
const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "")
    .trim();

const money = (n: unknown) =>
  Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const fmtDate = (order: any) => {
  const d = new Date(
    order.createdAt || order.statusHistory?.[0]?.changedAt || Date.now(),
  );
  return clean(
    d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
};

const fitLogo = (logo: Logo, maxW: number, maxH: number) => {
  const ratio = logo.w / logo.h;
  let h = maxH;
  let w = h * ratio;
  if (w > maxW) {
    w = maxW;
    h = w / ratio;
  }
  return { w, h };
};

const paymentInfo = (order: any) => ({
  method: order.paymentMethod === "mpesa" ? "M-Pesa" : "Cash on Delivery",
  paid: order.paymentStatus === "collected",
});

async function loadStore(): Promise<Store> {
  const fallback: Store = {
    name: "Store",
    phone: "",
    email: "",
    address: "",
    logoUrl: "",
    currency: "KES",
  };
  try {
    const res = await fetch("/api/storefront/settings");
    const s = await res.json();
    return {
      name: s.storeName || fallback.name,
      phone: s.storePhone || s.whatsappPhone || "",
      email: s.storeEmail || "",
      address: s.storeAddress || "",
      logoUrl: s.logoUrl || "",
      currency: s.currency || "KES",
    };
  } catch {
    return fallback;
  }
}

// True when the logo is partly transparent AND many visible pixels are light,
// i.e. parts of it would disappear on white paper.
function hasLightOnTransparent(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    let transparent = 0;
    let visible = 0;
    let light = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 40) {
        transparent++;
        continue;
      }
      visible++;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum > 190) light++;
    }
    if (!visible || transparent / (w * h) < 0.1) return false;
    return light / visible > 0.15;
  } catch {
    return false;
  }
}

function loadLogo(url: string): Promise<Logo | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, 600 / img.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          data: canvas.toDataURL("image/png"),
          w: canvas.width,
          h: canvas.height,
          needsDark: hasLightOnTransparent(ctx, canvas.width, canvas.height),
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// RECEIPT (A5 portrait)
// ---------------------------------------------------------------------------
function buildReceipt(
  doc: PDF,
  order: any,
  store: Store,
  logo: Logo | null,
  pw?: number,
  ph?: number,
) {
  const W = pw ?? 148;
  const H = ph ?? 210;
  const M = 10;
  const R = W - M;
  const items: any[] = order.items || [];
  const ship = order.shippingAddress || {};
  const { method, paid } = paymentInfo(order);
  const cur = store.currency;
  let y = M;

  // Header: logo left, store details right. Logos with light/white parts sit
  // on a dark band so they stay visible on white paper.
  const dark = !!logo?.needsDark;
  const contact = [store.address, store.phone, store.email]
    .map(clean)
    .filter(Boolean);
  const logoBox = logo ? fitLogo(logo, 46, 16) : { w: 0, h: 0 };
  const headH = Math.max(logoBox.h, 9 + contact.length * 4);
  if (dark) {
    doc.setFillColor(BAND_RGB[0], BAND_RGB[1], BAND_RGB[2]);
    doc.rect(0, 0, W, y + headH + 4, "F");
  }
  if (logo) doc.addImage(logo.data, "PNG", M, y, logoBox.w, logoBox.h);
  doc.setTextColor(dark ? 255 : 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(clean(store.name), R, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(dark ? 215 : 90);
  contact.forEach((line, i) =>
    doc.text(line, R, y + 9 + i * 4, { align: "right" }),
  );
  if (dark) {
    y += headH + 4 + 8;
  } else {
    y += headH + 3;
    doc.setDrawColor(210);
    doc.setLineWidth(0.3);
    doc.line(M, y, R, y);
    y += 8;
  }

  // Title + order meta
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RECEIPT", M, y);
  doc.setFontSize(9);
  doc.text(clean(order.orderNumber), R, y - 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  doc.text(fmtDate(order), R, y, { align: "right" });
  y += 9;

  // Billed to / Deliver to. The Deliver-to column shares its left edge with
  // the QTY column below, so the two line up vertically.
  const colX = 86;
  const colW = R - colX;
  const left = [
    clean(order.customer?.name || ship.fullName || "Guest"),
    clean(order.customer?.phone),
    clean(order.customer?.email),
  ].filter(Boolean);
  const right = [
    clean(ship.fullName),
    clean(ship.phone),
    ...(doc.splitTextToSize(clean(ship.address), colW) as string[]),
    clean([ship.city, ship.region].filter(Boolean).join(", ")),
    clean(ship.country),
  ].filter(Boolean);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("BILLED TO", M, y);
  doc.text("DELIVER TO", colX, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);
  left.forEach((l, i) => doc.text(l, M, y + i * 4.2));
  right.forEach((l, i) => doc.text(l, colX, y + i * 4.2));
  y += Math.max(left.length, right.length) * 4.2 + 5;

  // Items table
  const THUMB = 12;
  const nameX = M + 2 + THUMB + 3;
  const nameW = colX - 3 - nameX;
  const drawHead = (top: number) => {
    doc.setFillColor(243, 244, 246);
    doc.rect(M, top, R - M, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text("ITEM", M + 2, top + 4.8);
    doc.text("QTY", colX, top + 4.8);
    doc.text("PRICE", 112, top + 4.8, { align: "right" });
    doc.text("TOTAL", R - 2, top + 4.8, { align: "right" });
    return top + 7;
  };
  y = drawHead(y);

  items.forEach((item) => {
    const nameLines = (
      doc.splitTextToSize(clean(item.name), nameW) as string[]
    ).slice(0, 4);
    const details = [
      item.variantId && item.variantId !== item.sku
        ? `Variant: ${clean(item.variantId)}`
        : "",
      item.sku ? `SKU: ${clean(item.sku)}` : "",
    ]
      .filter(Boolean)
      .join("   ");
    const textH = nameLines.length * 4 + (details ? 3.6 : 0) + 3;
    const rowH = Math.max(textH, THUMB + 4);

    if (y + rowH > H - 50) {
      doc.addPage();
      y = drawHead(M);
    }

    drawThumb(doc, item._thumb, M + 2, y + 2, THUMB);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);
    nameLines.forEach((l, i) => doc.text(l, nameX, y + 4 + i * 4));
    if (details) {
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(details, nameX, y + 4 + nameLines.length * 4 - 0.4);
    }
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(String(item.quantity), colX, y + 4);
    doc.text(money(item.price), 112, y + 4, { align: "right" });
    doc.text(money(item.quantity * item.price), R - 2, y + 4, {
      align: "right",
    });
    y += rowH;
    doc.setDrawColor(235);
    doc.setLineWidth(0.3);
    doc.line(M, y, R, y);
  });

  // Totals
  if (y > H - 55) {
    doc.addPage();
    y = M;
  }
  y += 6;
  const labelX = 90;
  const totalRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(label, labelX, y);
    doc.setTextColor(0);
    doc.text(value, R - 2, y, { align: "right" });
    y += 5.5;
  };
  totalRow("Subtotal", `${cur} ${money(order.subtotal)}`);
  if (Number(order.discount) > 0) {
    const code = clean(order.coupon?.code).slice(0, 14);
    totalRow(
      code ? `Discount (${code})` : "Discount",
      `-${cur} ${money(order.discount)}`,
    );
  }
  const deliveryLabel = order.deliveryMethodName
    ? `Delivery (${clean(order.deliveryMethodName)})`
    : "Delivery";
  totalRow(
    deliveryLabel.length > 24 ? "Delivery" : deliveryLabel,
    Number(order.shippingCost) === 0
      ? "Free"
      : `${cur} ${money(order.shippingCost)}`,
  );
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(labelX, y - 2, R - 2, y - 2);
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("TOTAL", labelX, y);
  doc.text(`${cur} ${money(order.total)}`, R - 2, y, { align: "right" });
  y += 10;

  // Payment
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Payment method: ${method}`, M, y);
  doc.setFont("helvetica", "bold");
  if (paid) doc.setTextColor(22, 128, 61);
  else doc.setTextColor(180, 83, 9);
  doc.text(
    paid ? "PAID" : method === "M-Pesa" ? "PENDING" : "PAY ON DELIVERY",
    R - 2,
    y,
    { align: "right" },
  );

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(
    clean(`Thank you for shopping with ${store.name}!`),
    W / 2,
    H - 10,
    { align: "center" },
  );
}

// ---------------------------------------------------------------------------
// PACKAGE LABEL (A6 portrait, 105 x 148 mm)
// ---------------------------------------------------------------------------
const LABEL_SIZE: [number, number] = [105, 148];

function buildLabel(
  doc: PDF,
  order: any,
  store: Store,
  logo: Logo | null,
  pw?: number,
  ph?: number,
) {
  const W = pw ?? LABEL_SIZE[0];
  const H = ph ?? LABEL_SIZE[1];
  const M = 7;
  const R = W - M;
  const items: any[] = order.items || [];
  const ship = order.shippingAddress || {};
  const { method, paid } = paymentInfo(order);
  const cur = store.currency;

  doc.setDrawColor(0);
  doc.setLineWidth(0.7);
  doc.rect(3, 3, W - 6, H - 6);

  let y = 8;
  let headH = 8;
  if (logo) {
    const { w, h } = fitLogo(logo, 32, 10);
    if (logo.needsDark) {
      doc.setFillColor(BAND_RGB[0], BAND_RGB[1], BAND_RGB[2]);
      doc.rect(M - 1.5, y - 1.5, w + 3, h + 3, "F");
    }
    doc.addImage(logo.data, "PNG", M, y, w, h);
    headH = h;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(clean(store.name), M, y + 5);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(clean(order.orderNumber), R, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(fmtDate(order), R, y + 8, { align: "right" });
  y += Math.max(headH, 9) + 3;
  doc.setLineWidth(0.3);
  doc.line(M, y, R, y);
  y += 5;

  // Recipient
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text("SHIP TO", M, y);
  y += 2;

  const name = clean(ship.fullName || order.customer?.name || "Customer");
  const nameSize = name.length > 28 ? 14 : name.length > 18 ? 17 : 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize);
  doc.setTextColor(0);
  const nameLines = (doc.splitTextToSize(name, R - M) as string[]).slice(0, 2);
  const nameLH = nameSize * 0.4233;
  nameLines.forEach((l, i) => doc.text(l, M, y + nameSize * 0.3528 + i * nameLH));
  y += nameLines.length * nameLH + 2;

  doc.setFontSize(15);
  doc.text(clean(ship.phone || order.customer?.phone), M, y + 15 * 0.3528);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const addrLines = (
    doc.splitTextToSize(clean(ship.address), R - M) as string[]
  ).slice(0, 3);
  addrLines.forEach((l, i) => doc.text(l, M, y + 3.5 + i * 5));
  y += addrLines.length * 5 + 1;

  const cityRegion = clean(
    [ship.city, ship.region].filter(Boolean).join(", "),
  ).toUpperCase();
  if (cityRegion) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(cityRegion, M, y + 4);
    y += 6;
  }
  if (ship.country) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(clean(ship.country), M, y + 3);
    y += 5;
  }
  if (ship.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(90);
    (doc.splitTextToSize(`Note: ${clean(ship.notes)}`, R - M) as string[])
      .slice(0, 2)
      .forEach((l, i) => doc.text(l, M, y + 3 + i * 3.6));
    y += Math.min(2, Math.ceil(clean(ship.notes).length / 60) || 1) * 3.6 + 1;
  }

  // Items summary
  const payTop = H - 7 - 24;
  const itemsLimit = payTop - 10;
  y += 2;
  doc.setLineWidth(0.3);
  doc.setDrawColor(150);
  doc.line(M, y, R, y);
  y += 4;
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(`ITEMS (${totalQty})`, M, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0);
  const TH = 9;
  const rowH = TH + 1.5;
  const thumbRows = Math.floor((itemsLimit - y) / rowH);
  const useThumbs =
    thumbRows >= 2 || (thumbRows >= 1 && items.length <= thumbRows);

  if (useThumbs) {
    const fit = items.length > thumbRows ? thumbRows - 1 : items.length;
    for (let i = 0; i < fit; i++) {
      const it = items[i];
      drawThumb(doc, it._thumb, M, y, TH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0);
      (
        doc.splitTextToSize(
          `${it.quantity} x ${clean(it.name)}`,
          R - M - TH - 3,
        ) as string[]
      )
        .slice(0, 3)
        .forEach((l, k) => doc.text(l, M + TH + 3, y + 3 + k * 3.4));
      y += rowH;
    }
    if (items.length > fit) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(`+ ${items.length - fit} more item(s)`, M, y + 3);
    }
  } else {
    const lineH = 3.6;
    const maxLines = Math.max(0, Math.floor((itemsLimit - y) / lineH));
    const rows = items.map((it) => `${it.quantity} x ${clean(it.name)}`);
    const shown =
      rows.length > maxLines ? rows.slice(0, Math.max(maxLines - 1, 0)) : rows;
    shown.forEach((r) => {
      doc.text((doc.splitTextToSize(r, R - M) as string[])[0] || "", M, y);
      y += lineH;
    });
    if (rows.length > shown.length) {
      doc.setTextColor(110);
      doc.text(`+ ${rows.length - shown.length} more item(s)`, M, y);
    }
  }

  // Sender
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110);
  const from = clean(
    `From: ${store.name}${store.phone ? "  |  " + store.phone : ""}`,
  );
  doc.text((doc.splitTextToSize(from, R - M) as string[])[0], M, payTop - 3);

  // Payment box
  const boxW = R - M;
  if (paid) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.rect(M, payTop, boxW, 24);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PAID", W / 2, payTop + 12, { align: "center" });
    doc.setFontSize(8);
    doc.text("DO NOT COLLECT PAYMENT", W / 2, payTop + 19, { align: "center" });
  } else {
    doc.setFillColor(0, 0, 0);
    doc.rect(M, payTop, boxW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      method === "M-Pesa" ? "M-PESA NOT CONFIRMED - COLLECT" : "COLLECT ON DELIVERY",
      W / 2,
      payTop + 7,
      { align: "center" },
    );
    doc.setFontSize(22);
    doc.text(`${cur} ${money(order.total)}`, W / 2, payTop + 17.5, {
      align: "center",
    });
  }
  doc.setTextColor(0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export type Paper = "a4" | "a5" | "a6";

const PAPER_MM: Record<Paper, [number, number]> = {
  a4: [210, 297],
  a5: [148, 210],
  a6: [105, 148],
};
// The layouts above are drawn on these base sizes; other paper sizes are scaled.
const BASE_MM: Record<DocKind, [number, number]> = {
  receipt: [148, 210],
  label: [105, 148],
};
const DEFAULT_PAPER: Record<DocKind, Paper> = { receipt: "a4", label: "a4" };

// Wraps the jsPDF doc so every coordinate, font size and line width is
// multiplied by s. This lets the same layout fill any paper size.
function scaleDoc(doc: PDF, s: number): PDF {
  if (s === 1) return doc;
  const map: Record<string, (a: any[]) => any[]> = {
    text: (a) => [a[0], a[1] * s, a[2] * s, a[3]],
    line: (a) => a.map((v) => v * s),
    rect: (a) => [a[0] * s, a[1] * s, a[2] * s, a[3] * s, a[4]],
    addImage: (a) => [a[0], a[1], a[2] * s, a[3] * s, a[4] * s, a[5] * s],
    setFontSize: (a) => [a[0] * s],
    setLineWidth: (a) => [a[0] * s],
    splitTextToSize: (a) => [a[0], a[1] * s, ...a.slice(2)],
  };
  return new Proxy(doc, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, target);
      if (typeof val !== "function") return val;
      const mapper = map[prop as string];
      return (...args: any[]) => {
        const res = val.apply(target, mapper ? mapper(args) : args);
        return res === target ? receiver : res;
      };
    },
  }) as PDF;
}

type Thumb = { data: string; ratio: number };

// Loads a product image, flattens it onto white and returns a small JPEG.
// Returns null if the image can't be loaded (e.g. blocked by CORS).
function thumbFromSrc(src: string, cors: boolean): Promise<Thumb | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(
          1,
          240 / Math.max(img.naturalWidth, img.naturalHeight),
        );
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ data: canvas.toDataURL("image/jpeg", 0.8), ratio: w / h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

// Tries a direct load first (fast for Cloudinary); if the host blocks CORS,
// fetches the image through our own server instead.
async function loadThumb(url?: string): Promise<Thumb | null> {
  if (!url) return null;
  const direct = await thumbFromSrc(url, true);
  if (direct) return direct;
  try {
    const res = await fetch(`/api/admin/image-proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const objUrl = URL.createObjectURL(await res.blob());
    const thumb = await thumbFromSrc(objUrl, false);
    URL.revokeObjectURL(objUrl);
    return thumb;
  } catch {
    return null;
  }
}

// Draws a thumbnail "contained" inside a size x size box with a light border.
function drawThumb(
  doc: PDF,
  t: Thumb | null | undefined,
  x: number,
  y: number,
  size: number,
) {
  if (!t) return;
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.rect(x, y, size, size);
  const pad = 0.4;
  const box = size - pad * 2;
  let w = box;
  let h = box;
  if (t.ratio > 1) h = box / t.ratio;
  else w = box * t.ratio;
  doc.addImage(t.data, "JPEG", x + (size - w) / 2, y + (size - h) / 2, w, h);
}

async function build(kind: DocKind, order: any, paper?: Paper): Promise<PDF> {
  const [{ jsPDF }, store] = await Promise.all([import("jspdf"), loadStore()]);
  const logo = await loadLogo(store.logoUrl);
  const thumbs = await Promise.all(
    (order.items || []).map((it: any) => loadThumb(it.image)),
  );
  order = {
    ...order,
    items: (order.items || []).map((it: any, i: number) => ({
      ...it,
      _thumb: thumbs[i],
    })),
  };
  if (logo && LOGO_BG !== "auto") logo.needsDark = LOGO_BG === "dark";
  const size = PAPER_MM[paper || DEFAULT_PAPER[kind]];
  const s = size[0] / BASE_MM[kind][0];
  const doc = new jsPDF({ unit: "mm", format: size, orientation: "portrait" });
  const d = scaleDoc(doc, s);
  const pw = doc.internal.pageSize.getWidth() / s;
  const ph = doc.internal.pageSize.getHeight() / s;
  if (kind === "receipt") buildReceipt(d, order, store, logo, pw, ph);
  else buildLabel(d, order, store, logo, pw, ph);
  return doc;
}

export async function imageDocument(kind: DocKind, order: any, paper?: Paper): Promise<Blob> {
  const doc = await build(kind, order, paper);
  return doc.output("blob") as unknown as Blob;
}

export async function downloadDocument(
  kind: DocKind,
  order: any,
  paper?: Paper,
) {
  const doc = await build(kind, order, paper);
  const num = clean(order.orderNumber).replace(/[^A-Za-z0-9-]/g, "") || "order";
  doc.save(`${kind}-${num}.pdf`);
}

export async function printDocument(kind: DocKind, order: any, paper?: Paper) {
  // Open the tab synchronously so popup blockers allow it, then fill it in.
  const w = window.open("", "_blank");
  try {
    const doc = await build(kind, order, paper);
    doc.autoPrint();
    const url = URL.createObjectURL(doc.output("blob"));
    if (w) w.location.href = url;
    else window.open(url, "_blank");
  } catch (err) {
    w?.close();
    throw err;
  }
}
