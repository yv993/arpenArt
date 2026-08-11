"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand, nav } from "@/lib/content";
import { count, read, subscribe } from "@/lib/cart";

// Fixed chrome: wordmark left, sections right, cart count. The count is read
// only after mount so the server HTML and the hydrated tree agree.
//
// `data-lift` turns on once the page has moved. At rest the bar is flush and
// square; lifted, it floats free of the edges as a pane of liquid glass. The
// flag starts false on the server AND on the first client render, so the two
// trees match — the real scroll position is read in the effect below.
export default function Chrome() {
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(false);
  const [lift, setLift] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const sync = () => setN(count(read()));
    sync();
    return subscribe(sync);
  }, []);

  useEffect(() => {
    let frame = 0;
    // 6px of hysteresis so a trackpad hovering on the threshold cannot
    // flicker the bar between its two states.
    const read = () => {
      frame = 0;
      setLift((was) => (window.scrollY > (was ? 6 : 12) ? true : false));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => setOpen(false), [path]);

  return (
    <header className="ap-nav" data-lift={lift || undefined}>
      <Link className="ap-nav__mark" href="/">
        <strong>{brand.name}</strong>
        <span>{brand.artist}</span>
      </Link>

      <button
        type="button"
        className="ap-nav__burger"
        aria-expanded={open}
        aria-controls="ap-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Menu"}
      </button>

      <nav className="ap-nav__links" id="ap-menu" data-open={open || undefined} aria-label="Sections">
        {nav.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
        <Link className="ap-nav__cart" href="/cart">
          Cart
          <span className="ap-nav__n" data-has={n > 0 || undefined}>
            {n}
          </span>
        </Link>
      </nav>
    </header>
  );
}
