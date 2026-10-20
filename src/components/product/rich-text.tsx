import { Fragment } from "react";

/** Tiny, XSS-safe renderer for product descriptions: paragraphs, "- " lists, **bold**. */
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="prose-sk">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const listStart = lines.findIndex((l) => l.trim().startsWith("- "));
        if (listStart !== -1) {
          const head = lines.slice(0, listStart).join(" ");
          const items = lines.slice(listStart).filter((l) => l.trim().startsWith("- "));
          return (
            <Fragment key={i}>
              {head && <p>{inline(head)}</p>}
              <ul>{items.map((l, j) => <li key={j}>{inline(l.trim().slice(2))}</li>)}</ul>
            </Fragment>
          );
        }
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
