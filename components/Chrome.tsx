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
      {/* Arpine's own lockup (client files, 2026-08-11) replaces the text
          wordmark — the moon-face mark over the Arpen Art wordmark, ink on
          transparent, served at 2x for retina */}
      <Link className="ap-nav__mark" href="/" aria-label={`${brand.name} — home`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
            brand asset in the chrome; next/image's wrapper adds nothing here */}
        <img src="/brand/arpenart-lockup.png" alt={brand.name} width={244} height={256} />
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
        {/* ICON, NOT A WORD. The bar's link row is already at its width on a
            1024px laptop, and a fifth label pushed the cart badge into the
            wordmark. The accessible name carries the meaning. */}
        <Link className="ap-nav__acct" href="/account" aria-label="Your account" title="Your account">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.6 20a7.4 7.4 0 0 1 14.8 0" strokeLinecap="round" />
          </svg>
        </Link>
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
