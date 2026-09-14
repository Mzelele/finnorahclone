import type { WooProduct } from "@/models/productSchema";
import Papa from "papaparse";

const MAX_ATTRIBUTES = 6;

const FIELD_TO_HEADER: Record<string, string> = {
  id: "ID",
  type: "Type",
  sku: "SKU",
  name: "Name",
  published: "Published",
  isFeatured: "Is featured?",
  visibility: "Visibility in catalog",
  shortDescription: "Short description",
  description: "Description",
  dateOnSaleFrom: "Date sale price starts",
  dateOnSaleTo: "Date sale price ends",
  taxStatus: "Tax status",
  taxClass: "Tax class",
  inStock: "In stock?",
  stock: "Stock",
  lowStockAmount: "Low stock amount",
  backordersAllowed: "Backorders allowed?",
  soldIndividually: "Sold individually?",
  weight: "Weight (kg)",
  "dimensions.length": "Length (cm)",
  "dimensions.width": "Width (cm)",
  "dimensions.height": "Height (cm)",
  allowReviews: "Allow customer reviews?",
  purchaseNote: "Purchase note",
  regularPrice: "Regular price",
  salePrice: "Sale price",
  categories: "Categories",
  tags: "Tags",
  shippingClass: "Shipping class",
  images: "Images",
  downloadLimit: "Download limit",
  downloadExpiryDays: "Download expiry days",
  parent: "Parent",
  groupedProducts: "Grouped products",
  upsells: "Upsells",
  crossSells: "Cross-sells",
  externalUrl: "External URL",
  buttonText: "Button text",
  position: "Position",
};

// WordPress/WooCommerce native export + WebToffee real format
const REAL_WEBTOFFEE_HEADER_TO_FIELD: Record<string, string> = {
  post_title: "name",
  sku: "sku",
  parent_sku: "parent",
  id: "id",
  post_content: "description",
  post_excerpt: "shortDescription",
  post_status: "published",
  regular_price: "regularPrice",
  sale_price: "salePrice",
  stock: "stock",
  stock_status: "inStock",
  weight: "weight",
  length: "dimensions.length",
  width: "dimensions.width",
  height: "dimensions.height",
  tax_status: "taxStatus",
  tax_class: "taxClass",
  backorders: "backordersAllowed",
  sold_individually: "soldIndividually",
  low_stock_amount: "lowStockAmount",
  visibility: "visibility",
  purchase_note: "purchaseNote",
  sale_price_dates_from: "dateOnSaleFrom",
  sale_price_dates_to: "dateOnSaleTo",
  download_limit: "downloadLimit",
  download_expiry: "downloadExpiryDays",
  images: "images",
  product_url: "externalUrl",
  button_text: "buttonText",
  menu_order: "position",
  "tax:product_cat": "categories",
  "tax:product_tag": "tags",
  "tax:product_type": "type",
  "tax:product_shipping_class": "shippingClass",
  upsell_ids: "upsells",
  crosssell_ids: "crossSells",
  children: "groupedProducts",
  post_name: "slug",
  // WooCommerce native export columns
  "Type": "type",
  "SKU": "sku",
  "Name": "name",
  "Published": "published",
  "Is featured?": "isFeatured",
  "Visibility in catalog": "visibility",
  "Short description": "shortDescription",
  "Description": "description",
  "Date sale price starts": "dateOnSaleFrom",
  "Date sale price ends": "dateOnSaleTo",
  "Tax status": "taxStatus",
  "Tax class": "taxClass",
  "In stock?": "inStock",
  "Stock": "stock",
  "Low stock amount": "lowStockAmount",
  "Backorders allowed?": "backordersAllowed",
  "Sold individually?": "soldIndividually",
  "Weight (kg)": "weight",
  "Length (cm)": "dimensions.length",
  "Width (cm)": "dimensions.width",
  "Height (cm)": "dimensions.height",
  "Allow customer reviews?": "allowReviews",
  "Purchase note": "purchaseNote",
  "Regular price": "regularPrice",
  "Sale price": "salePrice",
  "Categories": "categories",
  "Tags": "tags",
  "Shipping class": "shippingClass",
  "Images": "images",
  "Download limit": "downloadLimit",
  "Download expiry days": "downloadExpiryDays",
  "Parent": "parent",
  "Grouped products": "groupedProducts",
  "Upsells": "upsells",
  "Cross-sells": "crossSells",
  "External URL": "externalUrl",
  "Button text": "buttonText",
  "Position": "position",
};

const HEADER_TO_FIELD: Record<string, string> = {};
for (const [field, header] of Object.entries(FIELD_TO_HEADER)) {
  HEADER_TO_FIELD[header] = field;
}

const BOOLEAN_FIELDS = new Set<string>([
  "isFeatured", "inStock", "backordersAllowed", "soldIndividually", "allowReviews",
]);

const PIPE_SEPARATED_FIELDS = new Set<string>([
  "categories", "tags", "images", "groupedProducts", "upsells", "crossSells",
]);

const NUMBER_FIELDS = new Set<string>([
  "published", "stock", "lowStockAmount", "weight",
  "regularPrice", "salePrice", "downloadLimit", "downloadExpiryDays", "position",
]);

function splitPipe(value: string): string[] {
  if (!value || !value.trim()) return [];
  return value.split("|").map((s) => s.trim()).filter(Boolean);
}

function joinPipe(arr: string[]): string {
  return (arr ?? []).join("|");
}

function toBool(val: string): boolean {
  return val === "1";
}

function fromBool(val: boolean): string {
  return val ? "1" : "0";
}

function toNumber(val: string | undefined): number {
  if (!val || val.trim() === "") return 0;
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

function collectAllMetaKeys(products: WooProduct[]): string[] {
  const keySet = new Set<string>();
  for (const p of products) {
    for (const m of p.metaData ?? []) {
      if (m.key) keySet.add(m.key);
    }
  }
  return Array.from(keySet).sort();
}

/**
 * Detect CSV format by inspecting headers.
 * Returns 'native' for WordPress/WooCommerce native export,
 * 'webtoffee' for real WebToffee snake_case format,
 * 'standard' for the standard WebToffee-style format.
 */
function detectFormat(fields: string[]): "native" | "webtoffee" | "standard" {
  const normalized = fields.map((f) => f.replace(/^\uFEFF/, "").trim());
  // WooCommerce native export: has both "Name" and "SKU" as headers
  if (normalized.includes("Name") && normalized.includes("SKU")) return "native";
  // Real WebToffee snake_case: has post_title
  if (normalized.includes("post_title")) return "webtoffee";
  return "standard";
}

function realToBool(val: string, field: string): boolean {
  const lower = val.toLowerCase().trim();
  if (field === "inStock") return lower === "instock" || lower === "1";
  if (field === "backordersAllowed") return lower === "yes" || lower === "notify" || lower === "1";
  if (field === "soldIndividually") return lower === "yes" || lower === "1";
  if (field === "isFeatured" || field === "allowReviews") return lower === "1" || lower === "yes";
  return lower === "1";
}

export function parseWebToffeeCSV(fileContent: string): WooProduct[] {
  const cleanContent = fileContent.replace(/^\uFEFF/, "");

  const result = Papa.parse<Record<string, string>>(cleanContent, {
    header: true,
    skipEmptyLines: true,
    transform: (val) => val.trim(),
  });

  if (result.errors.length > 0) {
    console.warn("CSV parse warnings:", result.errors);
  }

  const fields = (result.meta.fields ?? []).map((f) => f.replace(/^\uFEFF/, "").trim());
  const format = detectFormat(fields);

  console.log("Detected CSV format:", format, "| Headers:", fields.slice(0, 8));

  // Choose the right header→field mapping
  const activeHeaderMap: Record<string, string> =
    format === "standard" ? HEADER_TO_FIELD : REAL_WEBTOFFEE_HEADER_TO_FIELD;

  const isRealWebToffee = format === "webtoffee";
  const isNative = format === "native";

  const rows = result.data;
  const products: WooProduct[] = [];

  for (const row of rows) {
    // Find SKU — works for all three formats
    const skuVal = (
      row["SKU"] ?? row["sku"] ?? row["post_name"] ?? ""
    ).trim();
    if (!skuVal) continue;

    const product: Record<string, unknown> = {};

    for (const [rawHeader, val] of Object.entries(row)) {
      const header = rawHeader.replace(/^\uFEFF/, "").trim();
      const fieldPath = activeHeaderMap[header];
      if (!fieldPath) continue;

      const trimmedVal = val.trim();
      if (trimmedVal === "") continue;

      if (isRealWebToffee && BOOLEAN_FIELDS.has(fieldPath)) {
        product[fieldPath] = realToBool(trimmedVal, fieldPath);
      } else if (isNative && BOOLEAN_FIELDS.has(fieldPath)) {
        // WooCommerce native uses "1"/"0"
        product[fieldPath] = toBool(trimmedVal);
      } else if (BOOLEAN_FIELDS.has(fieldPath)) {
        product[fieldPath] = toBool(trimmedVal);
      } else if (fieldPath === "published") {
        if (isRealWebToffee) {
          product[fieldPath] =
            trimmedVal.toLowerCase() === "publish" || trimmedVal.toLowerCase() === "published" ? 1 : 0;
        } else {
          product[fieldPath] = parseInt(trimmedVal, 10) || 1;
        }
      } else if (NUMBER_FIELDS.has(fieldPath)) {
        product[fieldPath] = toNumber(trimmedVal);
      } else if (fieldPath.startsWith("dimensions.")) {
        product[fieldPath] = toNumber(trimmedVal);
      } else if (PIPE_SEPARATED_FIELDS.has(fieldPath)) {
        // WooCommerce native uses comma-separated categories; WebToffee uses pipe
        if ((isNative) && (fieldPath === "categories" || fieldPath === "tags")) {
          product[fieldPath] = trimmedVal.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
          product[fieldPath] = splitPipe(trimmedVal);
        }
      } else {
        product[fieldPath] = trimmedVal;
      }
    }

    // Ensure SKU is set
    if (!product.sku) product.sku = skuVal;

    // Build nested dimensions object
    const dLength = product["dimensions.length"] as number | undefined;
    const dWidth = product["dimensions.width"] as number | undefined;
    const dHeight = product["dimensions.height"] as number | undefined;
    if (dLength !== undefined || dWidth !== undefined || dHeight !== undefined) {
      product["dimensions"] = {
        length: dLength ?? 0,
        width: dWidth ?? 0,
        height: dHeight ?? 0,
      };
    }
    delete product["dimensions.length"];
    delete product["dimensions.width"];
    delete product["dimensions.height"];

    // Attributes
    const attrs: WooProduct["attributes"] = [];
    if (isRealWebToffee) {
      for (const col of Object.keys(row)) {
        const match = col.match(/^attribute:(pa_.+)$/);
        if (match) {
          const value = (row[col] ?? "").trim();
          if (!value) continue;
          attrs.push({ name: match[1]!, value, visible: true, global: true });
        }
      }
    } else {
      // Standard + native WooCommerce both use "Attribute N name" columns
      for (let i = 1; i <= MAX_ATTRIBUTES; i++) {
        const name = (row[`Attribute ${i} name`] ?? "").trim();
        const value = (row[`Attribute ${i} value(s)`] ?? "").trim();
        if (!name && !value) continue;
        const visibleRaw = (row[`Attribute ${i} visible`] ?? "").trim();
        const globalRaw = (row[`Attribute ${i} global`] ?? "").trim();
        attrs.push({
          name,
          value,
          visible: visibleRaw === "" ? true : toBool(visibleRaw),
          global: globalRaw === "" ? true : toBool(globalRaw),
        });
      }
    }
    product["attributes"] = attrs;

    // Meta data
    const metaData: WooProduct["metaData"] = [];
    for (const [col, val] of Object.entries(row)) {
      if (col.startsWith("meta:") && val.trim() !== "") {
        metaData.push({ key: col.slice(5), value: val.trim() });
      } else if (col.startsWith("Meta: ") && val.trim() !== "") {
        metaData.push({ key: col.slice(6).trim(), value: val.trim() });
      }
    }
    product["metaData"] = metaData;

    // Ensure array fields exist
    for (const field of PIPE_SEPARATED_FIELDS) {
      if (!Array.isArray(product[field])) product[field] = [];
    }
    if (!Array.isArray(product["attributes"])) product["attributes"] = [];

    products.push(product as unknown as WooProduct);
  }

  return products;
}

export function generateWebToffeeCSV(products: WooProduct[]): string {
  const metaKeys = collectAllMetaKeys(products);

  const orderedHeaders: string[] = [];

  const standardFields = [
    "id", "type", "sku", "name", "published", "isFeatured", "visibility",
    "shortDescription", "description", "dateOnSaleFrom", "dateOnSaleTo",
    "taxStatus", "taxClass", "inStock", "stock", "lowStockAmount",
    "backordersAllowed", "soldIndividually", "weight",
    "dimensions.length", "dimensions.width", "dimensions.height",
    "allowReviews", "purchaseNote", "regularPrice", "salePrice",
    "categories", "tags", "shippingClass", "images",
    "downloadLimit", "downloadExpiryDays", "parent",
    "groupedProducts", "upsells", "crossSells",
    "externalUrl", "buttonText", "position",
  ];
  orderedHeaders.push(...standardFields.map((f) => FIELD_TO_HEADER[f] ?? f));

  for (let i = 1; i <= MAX_ATTRIBUTES; i++) {
    orderedHeaders.push(`Attribute ${i} name`);
    orderedHeaders.push(`Attribute ${i} value(s)`);
    orderedHeaders.push(`Attribute ${i} visible`);
    orderedHeaders.push(`Attribute ${i} global`);
  }

  for (const key of metaKeys) {
    orderedHeaders.push(`Meta: ${key}`);
  }

  const dataRows: Record<string, string>[] = products.map((p) => {
    const row: Record<string, string> = {};

    for (const field of standardFields) {
      const header = FIELD_TO_HEADER[field];
      if (!header) continue;

      let val: unknown;
      if (field === "dimensions.length") val = p.dimensions?.length ?? 0;
      else if (field === "dimensions.width") val = p.dimensions?.width ?? 0;
      else if (field === "dimensions.height") val = p.dimensions?.height ?? 0;
      else val = (p as unknown as Record<string, unknown>)[field];

      row[header] = formatCellValue(field, val);
    }

    for (let i = 0; i < MAX_ATTRIBUTES; i++) {
      const attr = (p.attributes ?? [])[i];
      const idx = i + 1;
      row[`Attribute ${idx} name`] = attr?.name ?? "";
      row[`Attribute ${idx} value(s)`] = attr?.value ?? "";
      row[`Attribute ${idx} visible`] = attr !== undefined ? fromBool(attr.visible) : "";
      row[`Attribute ${idx} global`] = attr !== undefined ? fromBool(attr.global) : "";
    }

    for (const key of metaKeys) {
      const entry = (p.metaData ?? []).find((m) => m.key === key);
      row[`Meta: ${key}`] = entry?.value ?? "";
    }

    return row;
  });

  return Papa.unparse(
    { fields: orderedHeaders, data: dataRows },
    { quotes: true, quoteChar: '"', delimiter: ",", newline: "\n" },
  );
}

function formatCellValue(field: string, val: unknown): string {
  if (val === undefined || val === null) return "";
  if (BOOLEAN_FIELDS.has(field)) return fromBool(val as boolean);
  if (NUMBER_FIELDS.has(field)) return String(val);
  if (PIPE_SEPARATED_FIELDS.has(field)) return joinPipe(val as string[]);
  return String(val);
}
