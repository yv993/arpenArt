"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand, categories, nav, soon } from "@/lib/content";
import { count, read, subscribe } from "@/lib/cart";
import ThemeToggle from "./ThemeToggle";
import SoonModal, { SoonLink } from "./Soon";

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
  // YOU ARE HERE (2026-10-05): the drawer listed every page and never said
  // which one was open (UX laws M4) — `aria-current="page"` on the link whose
  // href IS this path; quality.css marks it in the phone drawer only.
  const here = (href: string) => (path === href ? ("page" as const) : undefined);

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

  // THE OPEN PHONE DRAWER HOLDS THE PAGE STILL, AND LETS GO THE USUAL WAYS
  // (2026-10-05, leftovers pass, real phone emulation). Measured before:
  // with the menu open, a finger dragged on it at 430x932 and 768x1024
  // scrolled the page underneath by 762px and 465px (the drawer fits there,
  // so it has nothing to scroll and the gesture fell through), and Escape
  // did nothing at all. Now, while it is open on the phone layout:
  //   · the page is locked — body overflow, the same lock the lightboxes use;
  //   · Escape closes it and gives focus back to Menu (unless the Available
  //     Soon window opened from it is up — Escape is that window's first);
  //   · a press outside the bar and the drawer closes it, as a light-dismiss
  //     popover does — the press itself still lands, so a link under it
  //     still works (UX laws D3: the platform's own rule, not a new one);
  //   · focus tabbing out of the bar closes it, so a keyboard never walks
  //     into a page the drawer is covering.
  // Widening past the phone layout closes it too: the burger is gone there
  // and nothing could close it — or release the lock.
  const head = useRef<HTMLElement | null>(null);
  const burger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 860px)");
    if (!open || !phone.matches) return;
    const bar = head.current;
    const inModal = (n: EventTarget | null) => n instanceof Element && !!n.closest('[aria-modal="true"]');
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      setOpen(false);
      burger.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node) || bar?.contains(t) || inModal(t)) return;
      setOpen(false);
    };
    const onFocusOut = (e: FocusEvent) => {
      const to = e.relatedTarget;
      // null = focus left the document (another app, the address bar): stay open
      if (!(to instanceof Node) || bar?.contains(to) || inModal(to)) return;
      setOpen(false);
    };
    const onWiden = () => {
      if (!phone.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    bar?.addEventListener("focusout", onFocusOut);
    phone.addEventListener("change", onWiden);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      bar?.removeEventListener("focusout", onFocusOut);
      phone.removeEventListener("change", onWiden);
    };
  }, [open]);

  return (
    <>
    {/* the one Available Soon window every page shares — see Soon.tsx */}
    <SoonModal />
    <header className="ap-nav" data-lift={lift || undefined} ref={head}>
      {/* Arpine's own lockup (client files, 2026-08-11) replaces the text
          wordmark — the moon-face mark over the Arpen Art wordmark, ink on
          transparent, served at 2x for retina */}
      <Link className="ap-nav__mark" href="/" aria-label={`${brand.name} — home`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
            brand asset in the chrome; next/image's wrapper adds nothing here */}
        <img src="/brand/arpenart-lockup.png" alt={brand.name} width={244} height={256} />
      </Link>

      {/* THE CART IN THE PHONE BAR (2026-10-05, mobile pass). Below 861px the
          cart and its count lived only inside the CLOSED drawer: measured at
          390x844 with five lines in the cart, `.ap-nav__cart` was a 0x0 box,
          the count could not be seen, and the bar read logo + MENU — so
          lib/fly.ts found a 0-wide target and the flight and the count's
          bump never ran on a phone (UX laws D3: every shop shows the cart in
          its bar; M4: what is in it is recognised, not remembered). This is a
          second link OUTSIDE the drawer, shown only on the phone layout
          (shop.css); the drawer keeps its own Cart, and the desktop bar is
          untouched — this one is display:none there. «Cart» is the drawer's
          own word, so no new copy; the name carries the count for a reader. */}
      <Link
        className="ap-nav__cartbar"
        href="/cart"
        aria-label={`Cart, ${n} ${n === 1 ? "item" : "items"}`}
        aria-current={here("/cart")}
      >
        Cart
        <span className="ap-nav__n" data-has={n > 0 || undefined}>
          {n}
        </span>
      </Link>

      <button
        ref={burger}
        type="button"
        className="ap-nav__burger"
        aria-expanded={open}
        aria-controls="ap-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Menu"}
      </button>

      <nav className="ap-nav__links" id="ap-menu" data-open={open || undefined} aria-label="Sections">
        {nav.map((l) =>
          l.href === "/shop" ? (
            // THE SHOP LINK CARRIES A CARET (client, change.pdf p1, 2026-09-15:
            // «add a small triangle that opens the list of shop products on
            // hover»). The word is still the link to /shop; the list under it
            // shows on hover and on keyboard focus (CSS :focus-within), and in
            // the phone drawer it simply sits open under the word. A closed
            // line lists itself too, but opens the Available Soon window.
            // NO aria-haspopup (2026-10-05): the word NAVIGATES to /shop — a
            // press never opens the list, which shows on hover/focus — so the
            // attribute promised a menu button the link is not (WCAG 4.1.2).
            // `here` marks the page you are on, in the drawer and the bar.
            <div className="ap-nav__shop" key={l.href}>
              <Link href={l.href} aria-current={here(l.href)}>
                {l.label}
                <svg className="ap-nav__caret" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M1 3l4 4 4-4z" />
                </svg>
              </Link>
              <ul className="ap-nav__menu" aria-label="Shop lines">
                {categories.map((c) => (
                  <li key={c.slug}>
                    {c.status === "open" ? (
                      <Link href={`/shop/${c.slug}`} aria-current={here(`/shop/${c.slug}`)}>
                        {c.name}
                      </Link>
                    ) : (
                      <SoonLink name={c.name}>
                        {c.name}
                        <small>{soon.tile}</small>
                      </SoonLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Link key={l.href} href={l.href} aria-current={here(l.href)}>
              {l.label}
            </Link>
          ),
        )}
        {/* THE THREE UTILITIES SHARE ONE BOX (2026-10-05) — for the phone
            drawer only, where they become one row that stays on the screen's
            bottom edge while the list scrolls (quality.css). On the desktop
            bar the box is `display: contents`, so the three are still the
            row's own items, laid out exactly as before. */}
        <div className="ap-nav__util">
          {/* ICON, NOT A WORD. The bar's link row is already at its width on
              a 1024px laptop, and a fifth label pushed the cart badge into
              the wordmark. The accessible name carries the meaning. */}
          <ThemeToggle />
          <Link className="ap-nav__acct" href="/account" aria-label="Your account" title="Your account" aria-current={here("/account")}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.6 20a7.4 7.4 0 0 1 14.8 0" strokeLinecap="round" />
            </svg>
          </Link>
          <Link className="ap-nav__cart" href="/cart" aria-current={here("/cart")}>
            Cart
            <span className="ap-nav__n" data-has={n > 0 || undefined}>
              {n}
            </span>
          </Link>
        </div>
      </nav>
    </header>
    {/* WHERE "SKIP TO CONTENT" LANDS (2026-10-05). The skip link pointed at
        #main, but this bar mounts INSIDE <main>, so it landed before the
        bar's own controls: measured at 390 and 1440, Tab → skip → Enter →
        Tab focused the logo, i.e. it skipped nothing. The target is here
        now, right after the bar; tabIndex -1 so it can take focus without
        joining the Tab order. */}
    <span id="content" className="ap-nav__skipto" tabIndex={-1} />
    </>
  );
}
