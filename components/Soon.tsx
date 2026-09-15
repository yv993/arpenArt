"use client";

import { useEffect, useRef, useState } from "react";
import { soon } from "@/lib/content";

// ============================================================================
// AVAILABLE SOON — the small window a not-yet-open line opens instead of a
// page (client, change.pdf p8, 2026-09-15: «these sections should not lead to
// another window yet — let a small window open on top and say Available
// Soon»). Five lines wear `status: "soon"` in content.ts: T-Shirts, cups,
// plates, puzzles and — while her separate designs are pending — totes.
//
// ONE window, mounted once in Chrome so it exists on every page; any tile,
// card, ring pick or menu item asks for it with `openSoon(name)`. The tiles
// stay real <a href="/shop"> elements underneath (SoonLink), so with no JS a
// tap still lands somewhere honest — the shop index — instead of nowhere.
//
// Escape and a click on the veil close it; focus goes to the Close button on
// open and back to whatever opened it on close.
// ============================================================================

const EVENT = "ap:soon";

export function openSoon(name?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { name: name ?? "" } }));
}

/** A link that opens the window rather than a page. `name` is the line it
 *  stands for, printed as the window's kicker. */
export function SoonLink({
  name,
  children,
  onClick,
  ...rest
}: { name: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href="/shop"
      aria-haspopup="dialog"
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
        openSoon(name);
      }}
    >
      {children}
    </a>
  );
}

export default function SoonModal() {
  const [name, setName] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      opener.current = document.activeElement as HTMLElement | null;
      setName((e as CustomEvent<{ name: string }>).detail?.name ?? "");
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    if (name === null) return;
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setName(null);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      opener.current?.focus?.();
    };
  }, [name]);

  if (name === null) return null;
  return (
    <div className="ap-soon" role="dialog" aria-modal="true" aria-labelledby="ap-soon-t" onClick={() => setName(null)}>
      <div className="ap-soon__box" onClick={(e) => e.stopPropagation()}>
        {name && <p className="ap-kicker">({name})</p>}
        <h2 className="ap-soon__t" id="ap-soon-t">
          {soon.title}
        </h2>
        <p className="ap-soon__p">{soon.copy}</p>
        <button ref={closeBtn} type="button" className="ap-btn" onClick={() => setName(null)}>
          {soon.close}
        </button>
      </div>
    </div>
  );
}
