"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCsvButton({ rows, filename }: { rows: Record<string, string | number | null>[]; filename: string }) {
  function download() {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
  return <Button variant="secondary" onClick={download} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</Button>;
}
