"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FX_MEDIA, POOL, settle, splitChars, unsplit } from "@/lib/textfx";

// ============================================================================
// The one runner for every [data-tfx] heading on the site. It is mounted at
// the FOOT OF EVERY PAGE — never the layout — splits the marked headings and
// plays their assigned logic when they enter the viewport. See lib/textfx.ts
// for the vocabulary and the plain-layer contract.
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

/** One colour stop of a resolved CSS gradient: rgb triple + its position. */
type Stop = { c: [number, number, number]; p: number };

/** Read `linear-gradient(100deg, rgb(27,43,76) 0%, …)` — the COMPUTED form,
 *  where every colour is already an rgb()/rgba() triple and every stop
 *  carries an explicit percentage. Anything that does not match that shape
 *  (a conic run, a bare `var()`, an image) returns nothing and the caller
 *  falls back to the clipped path it replaced. */
function readStops(grad: string): Stop[] {
  const out: Stop[] = [];
  const re = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[^)]*\)\s*(-?[\d.]+)%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(grad))) {
    out.push({ c: [+m[1], +m[2], +m[3]], p: +m[4] / 100 });
  }
  // stops may be written past 0..1 on purpose (the ink run ends at 108%, so
  // its terracotta only kisses the tail of a line) — keep them as declared
  return out.length >= 2 ? out : [];
}

/** The colour of `stops` at position `t` (0..1 across the line), linear in
 *  sRGB — the same space the browser interpolates a plain gradient in. */
function sampleRun(stops: Stop[], t: number): string {
  const x = Math.min(1, Math.max(0, t));
  if (x <= stops[0].p) return `rgb(${stops[0].c.join(",")})`;
  const last = stops[stops.length - 1];
  if (x >= last.p) return `rgb(${last.c.join(",")})`;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (x > b.p) continue;
    const span = b.p - a.p;
    const f = span > 0 ? (x - a.p) / span : 0;
    const mix = a.c.map((v, k) => Math.round(v + (b.c[k] - v) * f));
    return `rgb(${mix.join(",")})`;
  }
  return `rgb(${last.c.join(",")})`;
}

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
  useEffect(() => {
    if (!window.matchMedia(FX_MEDIA).matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const cleanups: (() => void)[] = [];

    // WHY THIS RUNNER LIVES IN THE PAGE AND NOT THE LAYOUT (2026-08-11).
    //
    // app/loading.tsx wraps every route in a Suspense boundary, so React
    // hydrates SELECTIVELY: the layout's tree first, the page's boundary
    // later. A layout-mounted runner's effect therefore fires while the
    // page's headings are still unhydrated HTML — splitting one in that gap
    // rewrites markup React has not yet claimed, and hydration then fails on
    // exactly what we changed ("server rendered text didn't match" on
    // attributes the server never sent). Two rAFs did not fix it — a guess at
    // hydration's duration. Waiting for `load` did not fix it either — with
    // cached assets `load` fires while the big home tree is still hydrating.
    // No browser event can see a Suspense boundary.
    //
    // React itself is the only reliable clock: an effect of a component
    // INSIDE the page's boundary cannot run before that boundary has
    // hydrated. So every page mounts <TextFX /> as its LAST child, and this
    // effect starts strictly after the headings it will split are React's.
    // Remounting per route also replaces the old pathname rescan.
    /** THE RUN TRAVELS AS FLAT COLOUR PER CHARACTER.
     *
     *  A heading whose fill is a clipped gradient goes INVISIBLE the moment
     *  this runner splits it: GSAP leaves a transform on every character
     *  span, a transformed element escapes its ancestor's background-clip,
     *  and a glyph with a transparent fill and no background behind it is
     *  nothing at all. The first fix gave every character its own COPY of
     *  the gradient, sized to the heading and offset to that character's
     *  place in it.
     *
     *  THAT FIX HAD A TAIL, and this is the second attempt at it. Chromium
     *  rasterizes `background-clip: text` unreliably on a span that is
     *  composited — and these spans are: GSAP leaves at minimum a
     *  `perspective()` on them and the stylesheet asks for
     *  `will-change: transform`. The symptom was the FIRST character of a
     *  title painting as its unclipped slice — a torn cream slab where the
     *  letter should be — with styles byte-identical to its healthy
     *  neighbours. Measured across many loads it was intermittent, survived
     *  clearing the transform after the entrance, and did NOT move when the
     *  offset was nudged off zero. Chasing the race is the wrong shape of
     *  fix: the failure lives in the clip itself.
     *
     *  So there is no clip any more. Each character is given the run's
     *  colour AT ITS OWN POSITION as a plain `color`, sampled from the
     *  heading's declared gradient. The line still walks from one end of
     *  the run to the other; what it loses is the variation WITHIN a single
     *  glyph, which at these sizes is a few per cent of one letter and
     *  which nobody can see — against a torn letter, which everybody can.
     *  Re-measured when the display font lands: Fraunces reflows the line,
     *  and colours sampled against fallback metrics would sit a half-glyph
     *  off. */
    const paintSlices = (el: HTMLElement, chars: HTMLElement[]) => {
      // Resolved, not the raw token: a custom property comes back as the
      // literal `var(--grad-ink)` it was written as, while backgroundImage
      // has already been computed down to rgb() stops we can read.
      const cs = getComputedStyle(el);
      const grad = cs.backgroundImage && cs.backgroundImage !== "none"
        ? cs.backgroundImage
        : cs.getPropertyValue("--tfx-grad").trim();
      if (!grad || grad === "none") return;
      const er = el.getBoundingClientRect();
      if (!er.width) return;

      const stops = readStops(grad);
      for (const c of chars) {
        const cr = c.getBoundingClientRect();
        if (stops.length >= 2) {
          // FLAT COLOUR, SAMPLED — see the note above on why this is not a
          // clipped gradient. The sample point is the glyph's own centre
          // along the line, so consecutive letters step through the same
          // run the heading declares.
          const t = er.width > 0 ? (cr.left + cr.width / 2 - er.left) / er.width : 0;
          c.style.color = sampleRun(stops, t);
          // EXPLICIT, not cleared. `-webkit-text-fill-color` INHERITS, and
          // the heading itself is still `transparent` (it declares the run
          // for the plain, unsplit layer). Clearing these to "" let that
          // transparent cascade in: every glyph vanished and the heading's
          // own unclipped background showed through as a row of filled
          // blocks — measured, on the first pass of this change.
          c.style.backgroundImage = "none";
          c.style.webkitBackgroundClip = "border-box";
          c.style.backgroundClip = "border-box";
          c.style.webkitTextFillColor = "currentColor";
        } else {
          // an unreadable run keeps the old behaviour rather than losing the
          // heading's colour entirely
          c.style.backgroundImage = grad;
          c.style.backgroundSize = `${er.width}px ${er.height}px`;
          c.style.backgroundPosition = `${er.left - cr.left}px ${er.top - cr.top}px`;
          c.style.webkitBackgroundClip = "text";
          c.style.backgroundClip = "text";
          c.style.webkitTextFillColor = "transparent";
        }
      }
    };

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
        // BEFORE build(): the builders set transforms on these spans in the
        // same tick, and the slices must be cut from the untransformed line
        paintSlices(el, chars);
        const build = BUILD[el.dataset.tfx ?? ""] ?? BUILD.rise;
        const tl = build(
          chars,
          parseFloat(el.dataset.tfxDelay ?? "0") || 0,
          el,
        );
        /** THE LANDING. Once the entrance ends, the chars stop being
         *  composited: GSAP's leftover identity transform and the
         *  stylesheet's will-change each kept every span on its own GPU
         *  layer, and Chromium's clipped-text rasterization is flaky on
         *  composited spans — on two pages the FIRST character of a
         *  gradient title painted as its unclipped slice, a torn cream slab
         *  where the letter should be, with styles byte-identical to its
         *  healthy neighbours. Plain spans clip flawlessly (isolated and
         *  verified), so at rest that is what these become. It is also
         *  simply the rule: will-change only while animating. Re-cutting
         *  the slices here doubles as the webfont fix — by the time an
         *  entrance has finished, Fraunces has long landed. */
        let landed = false;
        let land = 0;
        const finish = () => {
          if (landed) return;
          landed = true;
          // KILL FIRST. `onComplete` is not a guarantee: measured on the
          // shop and gallery headings, characters were still being written
          // every frame long after the entrance should have ended — the
          // first letter left foreshortened by its rotation, 42x46 where
          // its neighbours were 38x63, with the second letter sitting on
          // top of it. That is the "letters running into each other", and
          // it is also why the clipped fill kept tearing: a span that never
          // stops animating never stops being composited. Killing the
          // tweens makes the resting state final rather than hoped for.
          // EVERY SPAN THE EFFECT MADE, not just `chars`. `cut` clones each
          // character into a second, absolutely-positioned half and animates
          // both; `write` adds a caret. Those clones are not in `chars`, so
          // settling only `chars` left the bottom halves stranded mid-slide
          // — the ghost "OURN" lying across A JOURNEY THROUGH ARMENIA.
          const spans = [
            ...chars,
            ...Array.from(el.querySelectorAll<HTMLElement>(".tfx-cut, .tfx-caret")),
          ];
          gsap.killTweensOf(spans);
          gsap.set(spans, { clearProps: "transform,opacity,visibility,clipPath" });
          // the caret is scaffolding: once the writing has landed it goes
          el.querySelectorAll(".tfx-caret").forEach((n) => n.remove());
          for (const c of spans) c.style.willChange = "auto";
          paintSlices(el, chars);
        };
        tl.eventCallback("onComplete", finish);
        const st = ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: () => {
            tl.play();
            // BELT AND BRACES, on the timeline's own clock: its full length
            // plus a beat. If onComplete fires first this is a no-op; if it
            // never fires, the heading still lands.
            land = window.setTimeout(finish, (tl.duration() + 0.45) * 1000);
          },
        });
        cleanups.push(() => {
          if (land) window.clearTimeout(land);
          st.kill();
          tl.kill();
          settle(chars);
          unsplit(el, original);
          delete el.dataset.tfxDone;
        });
        // The webfont usually lands after this scan, and slices cut against
        // fallback metrics sit a half-glyph off. In flight, finish() will
        // re-cut at the end anyway; already finished, re-cut now; not yet
        // played, the chars sit translated at their set() offsets, so cut
        // against their MASKS — the mask box is the char's resting box.
        // ONE PAINTER, NOT TWO. This used to re-cut the slices by hand here,
        // with its own copy of the offset maths — and when paintSlices moved
        // off clipped gradients that copy stayed behind, quietly writing the
        // old background back over every character the moment the font
        // landed. The result was a heading of filled blocks: colour from the
        // new path, background from the dead one. It calls paintSlices now,
        // like everything else, so there is exactly one place that decides
        // how a character is painted.
        document.fonts?.ready.then(() => {
          if (!el.isConnected || !el.dataset.tfxDone) return;
          if (tl.progress() >= 1) finish();
          else paintSlices(el, chars);
        });
      });
    };

    // one fresh frame so the scan never lands inside the hydration commit
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(scan);
    });

    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
