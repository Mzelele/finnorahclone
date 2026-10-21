"use client";

import { useState, useRef, type DragEvent } from "react";

// ── Types ──────────────────────────────────────────────────────────────

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: { sku: string; message: string }[];
}

// ── Inline SVG icon components (no external library) ──────────────────

const UploadIcon = () => (
  <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const Spinner = () => (
  <svg className="h-5 w-5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const FileIcon = () => (
  <svg className="h-5 w-5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
  </svg>
);

const SkipIcon = () => (
  <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4.503 4.503 0 0 1 1.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 0 0 6.364 6.365l3.129-3.129m5.614-5.615 1.757-1.757a4.5 4.5 0 0 0-6.364-6.365l-4.5 4.5c-.258.26-.437.579-.537.918L7.44 8.06" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

const ChevronDown = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSelect(
  value: string,
  onChange: (v: string) => void,
  placeholder: string,
  options: { label: string; value: string }[],
) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full appearance-none rounded-lg border border-neutral-300 bg-white px-3 py-2 pr-8 text-sm text-neutral-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-neutral-400">
        <ChevronDown />
      </div>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────────

export default function ImportExportPage() {
  // ── Import state ──
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export state ──
  const [exportType, setExportType] = useState("");
  const [exportCategory, setExportCategory] = useState("");
  const [exportInStock, setExportInStock] = useState("");
  const [exportSearch, setExportSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // ── Import handlers ──

  const handleFileChange = (selected: File | null) => {
    setImportResult(null);
    setImportError(null);
    if (selected && selected.name.toLowerCase().endsWith(".csv")) {
      setFile(selected);
    } else {
      setFile(null);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(dropped);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    setExpandedErrors(false);
    cancelRef.current = false;

    try {
      const text = await file.text();
      const { parseWebToffeeCSV } = await import("@/lib/csvParser");
      const allProducts = parseWebToffeeCSV(text);

      if (allProducts.length === 0) {
        setImportError("No valid products found in CSV.");
        return;
      }

      const CHUNK_SIZE = 50;
      const total = allProducts.length;
      let imported = 0, updated = 0, skipped = 0;
      const errors: { sku: string; message: string }[] = [];

      setImportProgress({ current: 0, total });

      for (let i = 0; i < allProducts.length; i += CHUNK_SIZE) {
        if (cancelRef.current) {
          setImportError(`Import cancelled after ${i} of ${total} products.`);
          return;
        }

        const chunk = allProducts.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: chunk }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setImportError(data.error ?? "Import failed");
          return;
        }

        const data = await res.json();
        imported += data.imported ?? 0;
        updated += data.updated ?? 0;
        skipped += data.skipped ?? 0;
        if (data.errors) errors.push(...data.errors);

        setImportProgress({ current: Math.min(i + CHUNK_SIZE, total), total });
      }

      setImportProgress({ current: total, total });
      setTimeout(() => {
        setImportResult({ success: true, imported, updated, skipped, errors, total });
        setImportProgress(null);
      }, 400);

    } catch {
      if (!cancelRef.current) setImportError("Network error — please try again");
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    cancelRef.current = true;
  };


  // ── Export handlers ──

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);

    try {
      const params = new URLSearchParams();
      if (exportType) params.set("type", exportType);
      if (exportCategory.trim()) params.set("category", exportCategory.trim());
      if (exportInStock) params.set("inStock", exportInStock);
      if (exportSearch.trim()) params.set("search", exportSearch.trim());

      const qs = params.toString();
      const url = `/api/products/export${qs ? `?${qs}` : ""}`;

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setExportError(body?.error ?? "Export failed");
        setExporting(false);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] ?? `products-export-${new Date().toISOString().slice(0, 10)}.csv`;

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      setExportError("Network error \u2014 please try again");
    } finally {
      setExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Product Import / Export
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          WebToffee WooCommerce CSV format
        </p>
      </div>

      {/* Two cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Import card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-white">
            Import Products
          </h2>
          <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
            Upload a WebToffee CSV file to bulk import or update products by SKU.
          </p>

          {/* Drop zone / file info */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-blue-400 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 dark:border-neutral-600 dark:bg-neutral-800/50 dark:hover:border-neutral-500"
            }`}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileIcon />
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {file.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatFileSize(file.size)}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setImportResult(null);
                    setImportError(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-1 text-xs text-red-500 underline hover:no-underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <UploadIcon />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Drag &amp; drop a CSV file here, or click to browse
                </p>
                <p className="text-xs text-neutral-400">
                  Only .csv files accepted
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Import button */}
          <button
            type="button"
            disabled={!file || importing}
            onClick={handleImport}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <>
                <Spinner />
                Importing&hellip;
              </>
            ) : (
              "Import Products"
            )}
          </button>

          {/* Error banner */}
          {importError && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-950/30">
              <AlertIcon />
              <p className="text-sm text-red-700 dark:text-red-400">{importError}</p>
            </div>
          )}

          {/* Results summary card */}
          {importing && importProgress && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center text-sm text-neutral-500 dark:text-neutral-400">
                <span>Importing products…</span>
                <div className="flex items-center gap-3">
                  <span>{importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)</span>
                  <button
                    onClick={handleCancelImport}
                    className="text-xs text-red-500 hover:text-red-600 font-medium underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {importResult && (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
                Import Results
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-center gap-2">
                  <CheckIcon />
                  <div>
                    <p className="text-xs text-neutral-500">Imported</p>
                    <p className="text-lg font-bold text-emerald-600">{importResult.imported}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshIcon />
                  <div>
                    <p className="text-xs text-neutral-500">Updated</p>
                    <p className="text-lg font-bold text-blue-600">{importResult.updated}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SkipIcon />
                  <div>
                    <p className="text-xs text-neutral-500">Skipped</p>
                    <p className="text-lg font-bold text-neutral-500">{importResult.skipped}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ErrorIcon />
                  <div>
                    <p className="text-xs text-neutral-500">Errors</p>
                    <p className="text-lg font-bold text-red-500">{importResult.errors.length}</p>
                  </div>
                </div>
              </div>

              {/* Expandable error list */}
              {importResult.errors.length > 0 && (
                <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-700">
                  <button
                    type="button"
                    onClick={() => setExpandedErrors(!expandedErrors)}
                    className="flex items-center gap-1 text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    <ErrorIcon />
                    {expandedErrors ? "Hide" : "View"} error details ({importResult.errors.length})
                  </button>
                  {expandedErrors && (
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-red-100 bg-white p-3 text-xs dark:border-red-800/30 dark:bg-neutral-900">
                      {importResult.errors.map((e, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="shrink-0 font-semibold text-red-600">SKU: {e.sku}</span>
                          <span className="text-red-700 dark:text-red-400">{e.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-white">
            Export Products
          </h2>
          <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
            Download your products as a WebToffee-compatible CSV file. Leave filters empty to export everything.
          </p>

          {/* Filters */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Type</label>
              {renderSelect(exportType, setExportType, "All Types", [
                { label: "Simple", value: "simple" },
                { label: "Variable", value: "variable" },
                { label: "Variation", value: "variation" },
                { label: "Grouped", value: "grouped" },
                { label: "External", value: "external" },
              ])}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Category</label>
              <input
                type="text"
                placeholder="Partial match (e.g. Shoes)"
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">In Stock</label>
              {renderSelect(exportInStock, setExportInStock, "All", [
                { label: "In Stock", value: "true" },
                { label: "Out of Stock", value: "false" },
              ])}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Search</label>
              <input
                type="text"
                placeholder="Name or SKU"
                value={exportSearch}
                onChange={(e) => setExportSearch(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
              />
            </div>
          </div>

          {/* Export button */}
          <button
            type="button"
            disabled={exporting}
            onClick={handleExport}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Spinner />
                Exporting&hellip;
              </>
            ) : (
              <>
                <DownloadIcon />
                Export CSV
              </>
            )}
          </button>

          {/* Error banner */}
          {exportError && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-950/30">
              <AlertIcon />
              <p className="text-sm text-red-700 dark:text-red-400">{exportError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}