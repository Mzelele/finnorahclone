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

const REAL_WEBTOFFEE_HEADER_TO_FIELD: Record<string, string> = {
  post_title: "name",
  sku: "sku",
  parent_sku: "parent",
  ID: "id",
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
  Type: "type",
  SKU: "sku",
  Name: "name",
  Published: "published",
  "Is featured?": "isFeatured",
  "Visibility in catalog": "visibility",
  "Short description": "shortDescription",
  Description: "description",
  "Date sale price starts": "dateOnSaleFrom",
  "Date sale price ends": "dateOnSaleTo",
  "Tax status": "taxStatus",
  "Tax class": "taxClass",
  "In stock?": "inStock",
  Stock: "stock",
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
  Categories: "categories",
  Tags: "tags",
  "Shipping class": "shippingClass",
  Images: "images",
  "Download limit": "downloadLimit",
  "Download expiry days": "downloadExpiryDays",
  Parent: "parent",
  "Grouped products": "groupedProducts",
  Upsells: "upsells",
  "Cross-sells": "crossSells",
  "External URL": "externalUrl",
  "Button text": "buttonText",
  Position: "position",
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
  const lower = val.toLowerCase().trim();
  return lower === "1" || lower === "yes" || lower === "true" || lower === "instock";
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

function detectFormat(fields: string[]): "native" | "webtoffee" | "standard" {
  const normalized = fields.map((f) => f.replace(/^\uFEFF/, "").trim());
  if (normalized.includes("post_title") || normalized.includes("stock_status") || normalized.some((f) => f.startsWith("attribute:"))) return "webtoffee";
  if (normalized.includes("Name") && normalized.includes("SKU")) return "native";
  return "standard";
}

function realToBool(val: string, field: string): boolean {
  const lower = val.toLowerCase().trim();
  if (field === "inStock") return lower === "instock" || lower === "1" || lower === "yes" || lower === "true";
  if (field === "backordersAllowed") return lower === "yes" || lower === "notify" || lower === "1" || lower === "true";
  if (field === "soldIndividually") return lower === "yes" || lower === "1" || lower === "true";
  return lower === "1" || lower === "yes" || lower === "true";
}

export function parseWebToffeeCSV(fileContent: string): WooProduct[] {
  const cleanContent = fileContent.replace(/^\uFEFF/, "");

  const result = Papa.parse<Record<string, string>>(cleanContent, {
    header: true,
    skipEmptyLines: true,
    transform: (val) => val.trim(),
  });

  const fields = (result.meta.fields ?? []).map((f) => f.replace(/^\uFEFF/, "").trim());
  const format = detectFormat(fields);

  console.log("Detected CSV format:", format, "| Headers count:", fields.length);

  const activeHeaderMap: Record<string, string> = {
    ...HEADER_TO_FIELD,
    ...REAL_WEBTOFFEE_HEADER_TO_FIELD,
  };

  const rows = result.data;
  const products: WooProduct[] = [];

  for (const row of rows) {
    // Primary: SKU -> ID -> post_name (slug) -> post_title
    const rawSku = (row["SKU"] ?? row["sku"] ?? "").trim();
    const rawId = (row["ID"] ?? row["id"] ?? "").trim();
    const rawSlug = (row["post_name"] ?? "").trim();
    const rawTitle = (row["post_title"] ?? row["Name"] ?? row["name"] ?? "").trim();

    const skuVal = rawSku || (rawId ? `ID-${rawId}` : rawSlug || rawTitle);
    if (!skuVal) continue;

    const product: Record<string, unknown> = {};

    for (const [rawHeader, val] of Object.entries(row)) {
      const header = rawHeader.replace(/^\uFEFF/, "").trim();
      const fieldPath = activeHeaderMap[header];
      if (!fieldPath) continue;

      const trimmedVal = val.trim();
      if (trimmedVal === "") continue;

      if (BOOLEAN_FIELDS.has(fieldPath)) {
        product[fieldPath] = realToBool(trimmedVal, fieldPath);
      } else if (fieldPath === "published") {
        product[fieldPath] =
          trimmedVal.toLowerCase() === "publish" || trimmedVal.toLowerCase() === "published" || trimmedVal === "1" ? 1 : 0;
      } else if (NUMBER_FIELDS.has(fieldPath) || fieldPath.startsWith("dimensions.")) {
        product[fieldPath] = toNumber(trimmedVal);
      } else if (PIPE_SEPARATED_FIELDS.has(fieldPath)) {
        if (fieldPath === "categories" || fieldPath === "tags") {
          if (trimmedVal.includes("|")) {
            product[fieldPath] = splitPipe(trimmedVal);
          } else {
            product[fieldPath] = trimmedVal.split(",").map((s) => s.trim()).filter(Boolean);
          }
        } else {
          product[fieldPath] = splitPipe(trimmedVal);
        }
      } else {
        product[fieldPath] = trimmedVal;
      }
    }

    product.sku = skuVal;
    product.name = rawTitle || rawSlug || skuVal;

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

    const attrs: WooProduct["attributes"] = [];
    for (const col of Object.keys(row)) {
      const attrMatch = col.match(/^attribute:(.+)$/);
      if (attrMatch) {
        const attrName = attrMatch[1]!;
        const attrVal = (row[col] ?? "").trim();
        if (!attrVal) continue;

        const dataCol = `attribute_data:${attrName}`;
        const dataVal = (row[dataCol] ?? "").trim();
        let visible = true;
        if (dataVal) {
          const parts = dataVal.split("|");
          if (parts.length >= 2) {
            visible = parts[1].trim() === "1";
          }
        }

        attrs.push({
          name: attrName,
          value: attrVal,
          visible,
          global: attrName.startsWith("pa_"),
        });
      }
    }

    if (attrs.length === 0) {
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

    const metaData: WooProduct["metaData"] = [];
    for (const [col, val] of Object.entries(row)) {
      if ((col.startsWith("meta:") || col.startsWith("Meta: ")) && val.trim() !== "") {
        const key = col.replace(/^(meta:|Meta:\s*)/i, "").trim();
        metaData.push({ key, value: val.trim() });
      }
    }
    product["metaData"] = metaData;

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
  const orderedHeaders: string[] = [
    "ID", "Type", "SKU", "Name", "Published", "Is featured?", "Visibility in catalog",
    "Short description", "Description", "Date sale price starts", "Date sale price ends",
    "Tax status", "Tax class", "In stock?", "Stock", "Low stock amount",
    "Backorders allowed?", "Sold individually?", "Weight (kg)",
    "Length (cm)", "Width (cm)", "Height (cm)",
    "Allow customer reviews?", "Purchase note", "Regular price", "Sale price",
    "Categories", "Tags", "Shipping class", "Images",
    "Download limit", "Download expiry days", "Parent",
    "Grouped products", "Upsells", "Cross-sells",
    "External URL", "Button text", "Position",
  ];

  for (let i = 1; i <= MAX_ATTRIBUTES; i++) {
    orderedHeaders.push(`Attribute ${i} name`);
    orderedHeaders.push(`Attribute ${i} value(s)`);
    orderedHeaders.push(`Attribute ${i} visible`);
    orderedHeaders.push(`Attribute ${i} global`);
  }

  for (const key of metaKeys) {
    orderedHeaders.push(`Meta: ${key}`);
  }

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
