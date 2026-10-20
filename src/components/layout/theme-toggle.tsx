"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = !mounted ? Sun : theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  return (
    <button
      onClick={() => setTheme(next)}
      className={cn("grid h-10 w-10 place-items-center rounded-xl text-fg/80 hover:bg-surface-2 hover:text-fg", className)}
      aria-label={`Theme: ${mounted ? theme : "system"}. Switch to ${next}`}
      title={`Theme: ${mounted ? theme : ""}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="inline-flex rounded-xl border bg-surface p-1" role="radiogroup" aria-label="Theme">
      {(["light", "dark", "system"] as const).map((t) => {
        const I = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
        const active = mounted && theme === t;
        return (
          <button key={t} role="radio" aria-checked={active} onClick={() => setTheme(t)}
            className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm capitalize", active ? "bg-brand text-brand-fg" : "text-muted hover:text-fg")}>
            <I className="h-4 w-4" /> {t}
          </button>
        );
      })}
    </div>
  );
}
