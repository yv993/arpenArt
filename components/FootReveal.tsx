"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FX_MEDIA } from "@/lib/textfx";

// ============================================================================
// MOTION FOOTER REVEAL — the curtain. On the moved layer the footer is fixed
// beneath the page: <main> gets an opaque ground, a raised z-index and a
// bottom margin the footer's height, so the last section scrolls UP and
// lifts off the footer like a curtain, while the footer's content
// parallaxes into place underneath.
//
// Lives inside Foot (which the layout renders once, OUTSIDE main — a fixed
// footer inside main could never sit behind main's own background; stacking
// contexts forbid it). Everything keys off html[data-footfx], set only
// here, only under the site's desktop+motion gate — phones, reduced motion
// and no-JS keep the ordinary in-flow footer.
// ============================================================================

export default function FootReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.matchMedia(FX_MEDIA).matches) return;
    const foot = document.querySelector<HTMLElement>(".ap-foot");
    const inner = foot?.querySelector<HTMLElement>(".ap-foot__in");
    const main = document.getElementById("main");
    if (!foot || !inner || !main) return;
    gsap.registerPlugin(ScrollTrigger);

    // The tagline's decipher trigger assumes the footer SCROLLS into view;
    // a fixed element never does, so the trigger would fire at load,
    // unseen. Pre-mark it done — this layout effect runs while the page's
    // Suspense boundary is still hydrating, so it always beats the
    // page-mounted TextFX runner; the runner skips the mark, and the
    // curtain rise is this footer's motion instead.
    const big = foot.querySelector<HTMLElement>("[data-tfx]");
    big?.setAttribute("data-tfx-done", "1");

    const root = document.documentElement;
    const setH = () => root.style.setProperty("--foot-h", foot.offsetHeight + "px");
    setH();
    root.setAttribute("data-footfx", "");
    // Observe MAIN as well as the footer: pinned sections (FloatShop's
    // pin-spacer alone adds ~1.6 viewports) finish mounting AFTER this
    // effect, and a trigger measured against the shorter document parks the
    // whole reveal range ~1400px too high — everything past it reads as
    // "revealed". Any REAL growth re-measures everything.
    //
    // THRESHOLDED, and this is load-bearing: refresh() is GSAP's scroll-to-
    // top-and-restore dance, and firing it on every observer tick turned any
    // page whose absolutely-positioned overlays move (the swaying country
    // map's town chips nudge main's size by a pixel every frame) into a
    // refresh STORM — one dance every debounce interval, forever. Each dance
    // restores the scroll position it read at its own start, so it silently
    // swallowed every programmatic scroll on /find-in-store: scrollIntoView
    // ran, the next dance put the page back, and the click looked like it
    // never scrolled. A pixel of jiggle re-measures nothing; 1400px of
    // pin-spacer still does.
    let lastH = main.scrollHeight + foot.offsetHeight;
    const ro = new ResizeObserver(() => {
      setH();
      const h = main.scrollHeight + foot.offsetHeight;
      if (Math.abs(h - lastH) > 24) {
        lastH = h;
        ScrollTrigger.refresh();
      }
    });
    ro.observe(foot);
    ro.observe(main);
    ScrollTrigger.refresh();

    // Reveal progress = the last footer-height of scroll, computed by hand
    // from the LIVE document on each scroll frame. Not a ScrollTrigger:
    // three formulations (trigger:main bottom-edge, absolute maxScroll()
    // functions, an end-of-main sentinel) all cached positions one
    // FloatShop pin-spacer (~1440px) too high, because refresh measures
    // with pins REVERTED and its compensation never reached this trigger.
    // scrollHeight read at scroll time has the pins applied — it cannot
    // be stale.
    const apply = () => {
      const maxS = document.documentElement.scrollHeight - window.innerHeight;
      const fh = Math.max(1, foot.offsetHeight);
      // A short page (contact, about, the policies, 404) never offers a full
      // footer-height of scroll, so the curtain could not finish and the
      // footer sat permanently half-lit at the bottom of the screen. Below
      // that threshold there is no reveal at all — the footer is simply on.
      const p = maxS < fh + 40 ? 1 : Math.min(1, Math.max(0, (window.scrollY - (maxS - fh)) / fh));
      gsap.set(inner, { yPercent: -24 * (1 - p), autoAlpha: 0.35 + 0.65 * p });
    };
    let raf = 0;
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          apply();
        });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    apply();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      root.removeAttribute("data-footfx");
      root.style.removeProperty("--foot-h");
      big?.removeAttribute("data-tfx-done");
      gsap.set(inner, { clearProps: "all" });
    };
  }, []);

  // route changes swap main's content under the persistent footer trigger —
  // remeasure once the new page has laid out
  useEffect(() => {
    const t = setTimeout(() => ScrollTrigger.refresh(), 80);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
