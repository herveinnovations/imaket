import { forwardRef } from "react";
import { cn, initials } from "@/lib/utils";

// ─── Badge ───────────────────────────────────────────────────────────
const tones = {
  neutral: "bg-surface-2 text-fg/80",
  brand: "bg-lime text-black",
  success: "bg-[rgb(var(--success)/0.12)] text-success",
  warning: "bg-[rgb(var(--warning)/0.14)] text-warning",
  danger: "bg-[rgb(var(--danger)/0.12)] text-danger",
  accent: "bg-lime text-black",
} as const;

export function Badge({ tone = "neutral", className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, keyof typeof tones> = {
  paid: "success", succeeded: "success", fulfilled: "success", published: "success", active: "success", delivered: "success", completed: "success",
  pending: "warning", pending_review: "warning", requested: "warning", processing: "warning", unfulfilled: "warning", shipped: "brand",
  failed: "danger", rejected: "danger", cancelled: "danger", refunded: "neutral", suspended: "danger", draft: "neutral", archived: "neutral", paused: "neutral",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

// ─── Skeleton ────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-surface-2", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5" />
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────
export function Avatar({ name, src, color, size = 40, className }: { name?: string | null; src?: string | null; color?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-sans font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? "#000" }}
      aria-hidden={!name}
    >
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="h-full w-full object-cover" />
        : initials(name)}
    </span>
  );
}

// ─── Form fields ─────────────────────────────────────────────────────
type FieldProps = { label?: string; hint?: string; error?: string; className?: string };

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function Input({ label, hint, error, className, id, ...props }, ref) {
    const fid = id ?? props.name;
    return (
      <div className={className}>
        {label && <label htmlFor={fid} className="label">{label}</label>}
        <input ref={ref} id={fid} aria-invalid={!!error} className={cn("input", error && "border-danger")} {...props} />
        {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, hint, error, className, id, ...props }, ref) {
    const fid = id ?? props.name;
    return (
      <div className={className}>
        {label && <label htmlFor={fid} className="label">{label}</label>}
        <textarea ref={ref} id={fid} className={cn("input h-auto min-h-[110px] py-2.5 leading-6", error && "border-danger")} {...props} />
        {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  function Select({ label, hint, error, className, id, children, ...props }, ref) {
    const fid = id ?? props.name;
    return (
      <div className={className}>
        {label && <label htmlFor={fid} className="label">{label}</label>}
        <select ref={ref} id={fid} className={cn("input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", error && "border-danger")}
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
          {...props}>
          {children}
        </select>
        {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      </div>
    );
  },
);

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
      <button
        type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-black" : "bg-fg/20")}
      >
        <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border border-fg/20 px-6 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-lime text-black"><Icon className="h-6 w-6" /></span>
      <h3 className="font-display text-xl">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Responsive table ────────────────────────────────────────────────
// Desktop: table. Mobile: each row collapses to a stacked card via data-label.
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card overflow-hidden", className)}>
      <table className="w-full text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3
        max-md:[&_thead]:hidden max-md:[&_tr]:block max-md:[&_tr]:border-b max-md:[&_tr]:py-2 max-md:[&_td]:flex max-md:[&_td]:justify-between max-md:[&_td]:gap-4 max-md:[&_td]:py-1.5
        max-md:[&_td]:before:content-[attr(data-label)] max-md:[&_td]:before:text-muted max-md:[&_td]:before:font-normal">
        {children}
      </table>
    </div>
  );
}
export function THead({ cols }: { cols: (string | { label: string; className?: string })[] }) {
  return (
    <thead className="border-b bg-surface-2/60 text-left text-xs font-medium text-muted">
      <tr>{cols.map((c, i) => typeof c === "string" ? <th key={i} className="font-medium">{c}</th> : <th key={i} className={cn("font-medium", c.className)}>{c.label}</th>)}</tr>
    </thead>
  );
}
