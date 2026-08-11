"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FX_MEDIA, POOL, settle, splitChars, unsplit } from "@/lib/textfx";

// ============================================================================
// The one runner for every [data-tfx] heading on the site. It lives in the
// layout, rescans on each route, splits the marked headings and plays their
// assigned logic when they enter the viewport. See lib/textfx.ts for the
// vocabulary and the plain-layer contract.
//
// data-tfx="rise|flip|decipher|focus|write|cut"   the logic
// data-tfx-delay="0.14"                 stagger between sibling lines
// data-tfx-tail="1"                     write only: this line ends the
//                                       writing, so its caret blinks off
//                                       instead of handing over
//
// NOT for text that React re-renders with new content (the FloatShop centre
// names categories on hover — it runs its own effects over React-owned
// spans). This runner owns static headings only.
// ============================================================================

type Build = (
  chars: HTMLElement[],
  at: number,
  el: HTMLElement,
) => gsap.core.Timeline;

const BUILD: Record<string, Build> = {
  // letters climb out of the line through the .tfx-m mask
  rise: (chars, at) => {
    const tl = gsap.timeline({ paused: true });
    gsap.set(chars, { yPercent: 135 });
    tl.to(
      chars,
      { yPercent: 0, duration: 0.9, ease: "power4.out", stagger: 0.032 },
      at,
    );
    return tl;
  },

  // letters turn over — hinged at their baseline, arriving from behind
  flip: (chars, at) => {
    const tl = gsap.timeline({ paused: true });
    gsap.set(chars, {
      autoAlpha: 0,
      rotationX: -92,
      transformPerspective: 620,
      transformOrigin: "50% 100%",
    });
    tl.to(
      chars,
      {
        autoAlpha: 1,
        rotationX: 0,
        duration: 0.8,
        ease: "back.out(1.6)",
        stagger: 0.04,
      },
      at,
    );
    return tl;
  },

  // letters fade in wearing Armenian glyphs and settle left to right
  decipher: (chars, at) => {
    const tl = gsap.timeline({ paused: true });
    gsap.set(chars, { autoAlpha: 0 });
    tl.to(
      chars,
      { autoAlpha: 1, duration: 0.25, ease: "none", stagger: 0.024 },
      at,
    );
    const run = { p: 0 };
    tl.to(
      run,
      {
        p: 1,
        duration: Math.max(0.7, chars.length * 0.05),
        ease: "power1.inOut",
        onUpdate: () => {
          const settled = Math.floor(run.p * chars.length);
          chars.forEach((c, i) => {
            c.textContent =
              i < settled
                ? (c.dataset.ch ?? "")
                : POOL[(Math.random() * POOL.length) | 0];
          });
        },
        onComplete: () => settle(chars),
      },
      at,
    );
    return tl;
  },

  // letters arrive CUT IN TWO — each glyph is sliced at its waist, the top
  // half descends and the bottom half rises, and the seam closes left to
  // right. The halves are the runner's own spans (a clone overlaid on the
  // original), so once every seam has shut the clones are removed and the
  // heading is ordinary single spans again.
  cut: (chars, at) => {
    const tl = gsap.timeline({ paused: true });
    const tops: HTMLElement[] = [];
    const bots: HTMLElement[] = [];
    chars.forEach((c) => {
      const dup = c.cloneNode(true) as HTMLElement;
      dup.classList.add("tfx-cut");
      dup.setAttribute("aria-hidden", "true");
      c.parentElement?.appendChild(dup);
      tops.push(c);
      bots.push(dup);
    });
    gsap.set(tops, {
      clipPath: "inset(0 0 50% 0)",
      yPercent: -52,
      autoAlpha: 0,
    });
    gsap.set(bots, {
      clipPath: "inset(50% 0 0 0)",
      yPercent: 52,
      autoAlpha: 0,
    });
    tl.to(
      tops,
      { autoAlpha: 1, duration: 0.16, ease: "none", stagger: 0.04 },
      at,
    )
      .to(
        bots,
        { autoAlpha: 1, duration: 0.16, ease: "none", stagger: 0.04 },
        at + 0.05,
      )
      .to(
        tops,
        { yPercent: 0, duration: 0.6, ease: "power3.out", stagger: 0.04 },
        at,
      )
      .to(
        bots,
        { yPercent: 0, duration: 0.6, ease: "power3.out", stagger: 0.04 },
        at + 0.05,
      )
      .call(
        () => {
          chars.forEach((c, i) => {
            gsap.set(c, { clearProps: "clipPath" });
            bots[i].remove();
          });
        },
        [],
        ">",
      );
    return tl;
  },

  // letters are WRITTEN — a caret appears, each glyph is pressed in strict
  // sequence on an unevenly human clock, the caret rides just ahead of the
  // ink and either hands over to the next line or blinks off. The reveal is
  // a visible procedure, not a stagger: no letter exists before its turn.
  write: (chars, at, el) => {
    const tl = gsap.timeline({ paused: true });
    gsap.set(chars, { autoAlpha: 0 });
    const holder = el.querySelector<HTMLElement>(".tfx");
    const caret = document.createElement("span");
    caret.className = "tfx-caret";
    holder?.appendChild(caret);
    gsap.set(caret, { autoAlpha: 0 });
    // caret positions are read at PLAY time, not build time — the display
    // font may swap in between and move every glyph
    const place = (i: number, after: boolean) => {
      const m = chars[i]?.parentElement;
      if (!(m instanceof HTMLElement)) return;
      gsap.set(caret, {
        x: m.offsetLeft + (after ? m.offsetWidth : 0),
        y: m.offsetTop,
      });
    };
    tl.call(() => place(0, false), [], at);
    tl.to(caret, { autoAlpha: 1, duration: 0.12 }, at);
    let t = at + 0.2;
    chars.forEach((c, i) => {
      tl.call(() => place(i, true), [], t);
      tl.fromTo(
        c,
        {
          autoAlpha: 0,
          scale: 1.3,
          filter: "blur(3px)",
          transformOrigin: "50% 80%",
        },
        {
          autoAlpha: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.14,
          ease: "power2.out",
        },
        t,
      );
      t += 0.09 + Math.random() * 0.05; // typing is never metronomic
    });
    if (el.dataset.tfxTail) {
      // the writing is finished: two blinks, then the caret leaves
      tl.set(caret, { autoAlpha: 0 }, t + 0.3)
        .set(caret, { autoAlpha: 1 }, t + 0.62)
        .set(caret, { autoAlpha: 0 }, t + 0.94)
        .set(caret, { autoAlpha: 1 }, t + 1.26)
        .to(caret, { autoAlpha: 0, duration: 0.2 }, t + 1.6);
    } else {
      // hand the pen to the next line
      tl.to(caret, { autoAlpha: 0, duration: 0.18 }, t + 0.12);
    }
    return tl;
  },

  // letters sharpen out of a blur, from the centre of the word outward
  focus: (chars, at) => {
    const tl = gsap.timeline({ paused: true });
    gsap.set(chars, {
      autoAlpha: 0,
      scale: 1.14,
      filter: "blur(9px)",
      transformOrigin: "50% 70%",
    });
    tl.to(
      chars,
      {
        autoAlpha: 1,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.7,
        ease: "power2.out",
        stagger: { each: 0.03, from: "center" },
      },
      at,
    );
    return tl;
  },
};

export default function TextFX() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.matchMedia(FX_MEDIA).matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const cleanups: (() => void)[] = [];

    // WAIT FOR HYDRATION BEFORE TOUCHING THE DOM.
    //
    // This runner is mounted in the LAYOUT, and a layout's effect can fire
    // before the page's own subtree has hydrated — React hydrates
    // incrementally. Splitting a heading in that gap rewrites HTML React has
    // not yet claimed, and hydration then fails on exactly what we changed:
    //   "server rendered text didn't match" on <span data-tfx="rise"
    //    data-tfx-done="1" aria-label="ARMENIA,"> — attributes and an
    //   aria-label the server never sent, because we had just added them.
    // React recovers by regenerating the tree, which throws our split away and
    // costs a full client re-render of the page.
    //
    // TWO FRAMES WAS NOT ENOUGH — it was a guess at how long hydration takes,
    // and on the home page (a hero, a 57-card cloud, two WebGL rooms) it takes
    // longer than 32ms. The wait has to be an EVENT, not a duration.
    //
    // `load` is the one that is guaranteed to be after hydration: React
    // hydrates during the document's loading, and `load` fires once every
    // subresource is in. Late is harmless here — every effect is ScrollTrigger
    // -gated at "top 88%" and plays when its heading is reached, not on mount.
    // rAF after it, so the scan lands on a fresh frame rather than in the
    // middle of the load handler.
    let a = 0;
    let b = 0;
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-tfx]").forEach((el) => {
        // StrictMode mounts twice: the cleanup below fully unsplits, so a
        // marked element here means another live runner owns it — skip.
        if (el.dataset.tfxDone) return;
        el.dataset.tfxDone = "1";
        const original = el.textContent ?? "";
        const chars = splitChars(el);
        if (!chars.length) {
          delete el.dataset.tfxDone;
          return;
        }
        const build = BUILD[el.dataset.tfx ?? ""] ?? BUILD.rise;
        const tl = build(
          chars,
          parseFloat(el.dataset.tfxDelay ?? "0") || 0,
          el,
        );
        const st = ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: () => tl.play(),
        });
        cleanups.push(() => {
          st.kill();
          tl.kill();
          settle(chars);
          unsplit(el, original);
          delete el.dataset.tfxDone;
        });
      });
    };

    const arm = () => {
      a = requestAnimationFrame(() => {
        b = requestAnimationFrame(scan);
      });
    };
    // On a client-side route change the document is long since `complete`, so
    // `load` will never fire again — arm straight away. Only the FIRST load has
    // hydration to wait for.
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });

    return () => {
      window.removeEventListener("load", arm);
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
      cleanups.forEach((fn) => fn());
    };
  }, [pathname]);

  return null;
}
