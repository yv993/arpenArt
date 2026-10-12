import gsap from "gsap";

// ============================================================================
// FLY TO CART — the piece you just added is thrown into the nav's cart.
//
// A clone of the product photograph is lifted onto a fixed layer, arced to
// the cart link and dropped into it; the count then takes the hit. Nothing
// in the real layout moves, so the page cannot reflow mid-flight.
//
// Reduced motion gets no flight at all: the caller's "Added" line is the
// whole confirmation there.
// ============================================================================

// The arc comes from the two axes using DIFFERENT easings — y eases out
// (rises early), x eases in (crosses late) — which bows the path without
// ever leaving the straight line's bounding box. An explicit apex was tried
// first and measured flying ~400px ABOVE the viewport: the cart lives in the
// top bar, so an upward overshoot has nowhere to go.

export function flyToCart(from: HTMLElement | null | undefined) {
  if (typeof window === "undefined") return;
  // NO PICTURE TO THROW IS STILL AN ADD (2026-10-05 repair). A missing or
  // unrendered source used to end here in silence: /shop/postcards once a
  // card was picked (the ref sat on the other <img>, so null — at 390 AND at
  // 1440) and /shop/stickers on a phone (its stage picture is display:none
  // on the plain layer, a 0x0 box) measured 0 flight frames and no count
  // bump. The count still takes the hit, so every add is acknowledged.
  if (!from || !from.getBoundingClientRect().width) {
    bumpCart();
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    bumpCart();
    return;
  }
  // THE CART THAT IS ON SCREEN (2026-10-05, mobile pass). There are two now:
  // the drawer's `.ap-nav__cart` (the desktop bar's own) and the phone bar's
  // `.ap-nav__cartbar` (Chrome.tsx). Whichever has a box is the one in view —
  // on a phone the drawer's measured 0x0, which used to end the flight here
  // before it began, so a phone never saw an add land.
  const cart = Array.from(document.querySelectorAll<HTMLElement>(".ap-nav__cart, .ap-nav__cartbar")).find(
    (e) => e.getBoundingClientRect().width > 0,
  );
  if (!cart) {
    bumpCart();
    return;
  }

  const a = from.getBoundingClientRect();
  const b = cart.getBoundingClientRect();
  if (!a.width || !b.width) {
    bumpCart();
    return;
  }

  const clone = from.cloneNode(true) as HTMLElement;
  clone.className = "ap-fly";
  clone.removeAttribute("id");
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    left: a.left + "px",
    top: a.top + "px",
    width: a.width + "px",
    height: a.height + "px",
  });
  document.body.appendChild(clone);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);

  gsap
    .timeline({
      onComplete: () => {
        clone.remove();
        bumpCart();
      },
    })
    .to(clone, { duration: 0.26, scale: 0.84, ease: "power2.out" }, 0)
    .to(clone, { duration: 0.86, y: dy, ease: "power2.out" }, 0)
    .to(clone, { duration: 0.86, x: dx, ease: "power1.in" }, 0)
    .to(clone, { duration: 0.56, scale: 0.05, rotate: 22, ease: "power2.in" }, 0.32)
    .to(clone, { duration: 0.2, autoAlpha: 0, ease: "none" }, 0.68);
}

/** The count catches it — a short squash, kept separate so reduced motion
 *  still gets the acknowledgement without the flight. */
export function bumpCart() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // EVERY RENDERED COUNT, not the first in the document (2026-10-05): the
  // phone bar's copy comes first in the DOM and is display:none on the
  // desktop bar — taking only the first would have bumped an invisible box
  // there and left the count you can see standing still.
  document.querySelectorAll<HTMLElement>(".ap-nav__n").forEach((n) => {
    if (!n.getClientRects().length) return;
    gsap.fromTo(
      n,
      { scale: 1 },
      { scale: 1.55, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1, clearProps: "scale" },
    );
  });
}
