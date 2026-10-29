import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { POLICIES } from "@/lib/policies";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = POLICIES[(await params).slug];
  return { title: p?.title ?? "Policy" };
}

export default async function PolicyPage({ params }: { params: Params }) {
  const p = POLICIES[(await params).slug];
  if (!p) notFound();
  return (
    <article className="mx-auto max-w-3xl bg-white px-5 pb-24 pt-12">
      <h1 className="text-[2.4rem] sm:text-[3rem]">{p.title}</h1>
      <p className="mt-2 text-sm">Last updated {p.updated}</p>
      <div className="mt-10 space-y-8">
        {p.sections.map(([h, body]) => (
          <section key={h}>
            <h2 className="text-[1.5rem]">{h}</h2>
            <p className="mt-2 text-[17px] leading-[1.55]">{body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
