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
  if (!from || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    bumpCart();
    return;
  }
  const cart = document.querySelector<HTMLElement>(".ap-nav__cart");
  if (!cart) return;

  const a = from.getBoundingClientRect();
  const b = cart.getBoundingClientRect();
  if (!a.width || !b.width) return;

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
  const n = document.querySelector<HTMLElement>(".ap-nav__n");
  if (!n) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.fromTo(
    n,
    { scale: 1 },
    { scale: 1.55, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1, clearProps: "scale" },
  );
}
