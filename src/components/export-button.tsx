"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tx } from "@/components/i18n-text";

export interface ExportButtonProps {
  entity: "members" | "leases" | "invoices" | "payments" | "rooms" | "all";
  propertyId?: string;
  status?: string;
  from?: string;
  to?: string;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({
  entity,
  propertyId,
  status,
  from,
  to,
  label,
  className = "",
  variant = "outline",
  size = "sm"
}: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/export/${entity}${queryStr}`);

      if (!res.ok) {
        throw new Error("Download failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Extract filename from header or use default
      const disposition = res.headers.get("Content-Disposition");
      let filename = `${entity}-export.xlsx`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export Excel file. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={downloading}
      onClick={handleDownload}
      className={`inline-flex items-center gap-1.5 font-medium ${className}`}
      title="Export to Excel (.xlsx)"
    >
      {downloading ? (
        <>
          <svg className="h-4 w-4 animate-spin text-muted-foreground" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span><Tx>Exporting...</Tx></span>
        </>
      ) : (
        <>
          <svg
            className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>{label ? <Tx>{label}</Tx> : <Tx>Export Excel</Tx>}</span>
        </>
      )}
    </Button>
  );
}
