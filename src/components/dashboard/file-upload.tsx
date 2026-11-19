"use client";

import { useRef, useState } from "react";
import { FileText, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn, formatBytes } from "@/lib/utils";

/** Supabase free plan caps uploads at 50 MB. Raise with NEXT_PUBLIC_MAX_UPLOAD_MB on Pro. */
const MAX_FILE_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_FILE_LABEL = MAX_FILE_MB >= 1024 ? `${MAX_FILE_MB / 1024} GB` : `${MAX_FILE_MB} MB`;

export interface UploadedFile { path: string; name: string; size: number; mime: string; url?: string }

/**
 * Uploads directly from the browser to Supabase Storage using a short-lived
 * signed upload URL from /api/uploads (so large videos never pass through
 * our server). Shows real progress via XHR.
 */
async function uploadOne(file: File, bucket: "imaket-covers" | "imaket-product-files", onProgress: (p: number) => void): Promise<UploadedFile> {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, fileName: file.name, contentType: file.type, size: file.size }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  if (json.demo) {
    for (let p = 0; p <= 100; p += 20) { onProgress(p); await new Promise((r) => setTimeout(r, 80)); }
    return { path: json.path, name: file.name, size: file.size, mime: file.type, url: bucket === "imaket-covers" ? URL.createObjectURL(file) : undefined };
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", json.signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
  return { path: json.path, name: file.name, size: file.size, mime: file.type, url: json.publicUrl };
}

export function CoverUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  async function pick(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Choose a PNG, JPG or WebP image.");
    if (f.size > 10 * 1024 * 1024) return toast.error("Cover images can be up to 10 MB.");
    try {
      setProgress(0);
      const up = await uploadOne(f, "imaket-covers", setProgress);
      onChange(up.url ?? null);
    } catch (e) { toast.error((e as Error).message); } finally { setProgress(null); }
  }
  return (
    <div>
      <span className="label">Cover image</span>
      <button type="button" onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        className="relative flex aspect-[4/3] w-full max-w-[260px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-surface-2/40 text-sm text-muted hover:border-brand hover:text-brand">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="Cover preview" className="absolute inset-0 h-full w-full object-cover" />
          : progress != null ? <><Loader2 className="h-6 w-6 animate-spin" />{progress}%</> : <><ImagePlus className="h-6 w-6" /> Add a cover<span className="text-xs">1600×1200 works best</span></>}
      </button>
      {value && <button type="button" onClick={() => onChange(null)} className="mt-2 text-sm text-muted hover:text-danger">Remove cover</button>}
      <p className="mt-1.5 text-xs text-muted">No cover? We&apos;ll generate one from your title.</p>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export function FilesUpload({ files, onChange, accept, onUploadingChange }: {
  files: UploadedFile[]; onChange: (f: UploadedFile[]) => void; accept?: string; onUploadingChange?: (uploading: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusyState] = useState<{ name: string; p: number }[]>([]);
  const setBusy = (v: { name: string; p: number }[] | ((b: { name: string; p: number }[]) => { name: string; p: number }[])) => {
    setBusyState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      onUploadingChange?.(next.length > 0);
      return next;
    });
  };
  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const arr = [...list];
    const big = arr.find((f) => f.size > MAX_FILE_BYTES);
    if (big) return toast.error(`${big.name} is over the ${MAX_FILE_LABEL} limit.`);
    setBusy(arr.map((f) => ({ name: f.name, p: 0 })));
    const done: UploadedFile[] = [];
    for (const f of arr) {
      try {
        done.push(await uploadOne(f, "imaket-product-files", (p) => setBusy((b) => b.map((x) => (x.name === f.name ? { ...x, p } : x)))));
      } catch (e) { toast.error(`${f.name}: ${(e as Error).message}`); }
    }
    setBusy([]);
    onChange([...files, ...done]);
  }
  return (
    <div>
      <button type="button" onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center hover:border-brand">
        <UploadCloud className="h-7 w-7 text-brand" />
        <span className="font-medium">Drop files here or browse</span>
        <span className="text-sm text-muted">PDF, ZIP, MP4, MP3, images — up to {MAX_FILE_LABEL} each. Buyers get them after paying.</span>
      </button>
      <input ref={input} type="file" multiple accept={accept} className="hidden" onChange={(e) => pick(e.target.files)} />
      {(files.length > 0 || busy.length > 0) && (
        <ul className="mt-3 divide-y rounded-xl border">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted">{formatBytes(f.size)}</span>
              <button type="button" onClick={() => onChange(files.filter((x) => x.path !== f.path))} className="rounded p-1 text-muted hover:text-danger" aria-label={`Remove ${f.name}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {busy.map((b) => (
            <li key={b.name} className="px-3 py-2.5 text-sm">
              <div className="flex justify-between"><span className="truncate">{b.name}</span><span className="text-xs text-muted">{b.p}%</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full bg-brand transition-[width]")} style={{ width: `${b.p}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
