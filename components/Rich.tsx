import { Fragment } from "react";

// Renders a translation string, turning [label](href) into a link. Only
// https: and tel: targets are allowed. External links open in a new tab and
// send no referrer, so the target site cannot see that the visitor came from here.
const LINK = /\[([^\]]+)\]\(((?:https:\/\/|tel:)[^)\s]+)\)/g;

export function Rich({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const [whole, label, href] = m;
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(
      href.startsWith("tel:") ? (
        <a key={i} href={href}>{label}</a>
      ) : (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
      ),
    );
    last = i + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
