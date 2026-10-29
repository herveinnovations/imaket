"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return toast.error("Choose a star rating first.");
    setLoading(true);
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, rating, body }) });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return toast.error(json.error ?? "Couldn't post your review.");
    toast.success("Review posted");
    setRating(0); setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <p className="font-medium">Bought this? Leave a review</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="rounded p-0.5">
            <Star className={cn("h-7 w-7", (hover || rating) >= n ? "fill-black text-black" : "text-fg/25")} />
          </button>
        ))}
      </div>
      <Textarea name="body" placeholder="What did you like? What could be better?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
      <Button type="submit" loading={loading}>Post review</Button>
    </form>
  );
}
