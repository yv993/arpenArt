"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Gallery from "./Gallery";
import CatFig from "./CatFig";
import Cloud from "./Cloud";
import FloatShop, { type FloatCat } from "./FloatShop";
import Selector from "./Selector";
import Sun from "./Sun";
import { brand, categories, home } from "@/lib/content";
import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";

type Art = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  avg: string;
  lg?: string;
  lgW?: number;
  lgH?: number;
  back?: string;
  mock?: string;
  mockW?: number;
  mockH?: number;
  text?: string;
};
type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
const ART = artworks as Art[];
const P = products as Record<string, Shot[]>;

// ============================================================================
// The home story:
//   HERO       the illustration fills the screen and pushes in as you scroll
//   CLOUD      the 57 pictures lying freely in space — the frame pins and the
//              whole plane drifts across, or you drag it (see Cloud.tsx)
//   GALLERY    the whole collection orbiting as a sphere
//   SHOP       what the pictures become
//   ABOUT      Arpine, in her own words
// The cloud is desktop-only and reduced-motion-gated; everywhere else the same
// markup is an ordinary horizontally-scrollable rail you can swipe.
// ============================================================================

export default function HomeView() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(min-width: 861px) and (prefers-reduced-motion: no-preference)", () => {
      // ---- HERO: the illustration takes the frame ----------------------
      // A portrait reel of the Yerevan coffee film used to stand in the
      // middle here and swallow the frame as you scrolled. It is GONE
      // (client 2026-08-06) and the scrub is now the painting's alone: it
      // pushes in and dims while the title rises away, and the sentence and
      // CTA return over it at the end. The end-state contrast was already
      // measured against the DIMMED PAINTING rather than the video — 5.42:1
      // — so losing the reel does not weaken it.
      // All of it only under [data-x], which this callback owns; phones and
      // reduced motion keep the static contained hero.
      const hero = el.querySelector<HTMLElement>(".ap-hero");
      if (hero) {
        hero.setAttribute("data-x", "");
        // the card is the END overlay — hidden until the painting has taken
        // the frame (a set, not a fromTo: a mid-timeline fromTo would not
        // apply its "from" until the playhead reaches it)
        gsap.set(".ap-hero__card", { autoAlpha: 0, y: 26 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        // THE PAINTING OPENS WHOLE AND THEN PUSHES IN. It used to open
        // already cropped — full-bleed cover — so the first thing the site
        // showed of Arpine's work was a piece of it. It is `contain` now
        // (see the [data-x] block in globals.css) and the scrub still ends
        // at the same 1.12 push, only from her real frame rather than from
        // a crop of it.
        //
        // PARALLAX, built the way the client's reference builds it: read the
        // planes off `[data-parallax-layer]`, give each its own yPercent,
        // start them together with `"<"`, ease "none" throughout so the
        // motion belongs to the scroll and not to a curve.
        //
        // THE ORDER OF THE SPEEDS IS THE WHOLE TRICK, and it is the
        // reference's: the FURTHEST plane travels MOST (its layer 1 goes to
        // 70, its nearest to 10). Distant things sliding further than near
        // ones is what a moving camera does, and reversing it makes a scene
        // that feels like a sticker sliding on glass. Scaled down here
        // because this frame is one screen rather than the reference's tall
        // scroll, and because a painting is the subject: 26/14/8/4, so the
        // room moves around her work instead of the work moving in a room.
        const LAYERS: Array<[string, number]> = [
          ["1", 26], // the ground — furthest, travels most
          ["2", 14], // her painting
          ["3", 8], // the type
          ["4", 4], // the haze in front of it — nearest, travels least
        ];
        const stage = hero.querySelector("[data-parallax-layers]");
        LAYERS.forEach(([layer, yPercent], i) => {
          const nodes = stage?.querySelectorAll(`[data-parallax-layer="${layer}"]`);
          if (!nodes?.length) return;
          tl.to(nodes, { yPercent, ease: "none", duration: 0.72 }, i === 0 ? 0 : "<");
        });

        // …and on top of the drift, the beats this hero already had: the
        // painting pushes in and dims, the title leaves, the sentence and
        // CTA return over it. `scale` and `yPercent` are separate transform
        // components, so this tween and the layer drift above compose on the
        // same element instead of fighting for one property.
        tl.fromTo(
          ".ap-hero__img",
          { scale: 1 },
          { scale: 1.12, filter: "brightness(0.55) saturate(0.92)", ease: "none", duration: 0.72 },
          0,
        )
          .to(".ap-hero__title", { yPercent: -46, autoAlpha: 0, ease: "none", duration: 0.6 }, 0)
          .to(".ap-hero__hint", { autoAlpha: 0, duration: 0.12, ease: "none" }, 0)
          .to(".ap-hero__card", { autoAlpha: 1, y: 0, ease: "none", duration: 0.22 }, 0.78);
      }

      // ---- everything else rises in ---------------------------------------
      el.querySelectorAll<HTMLElement>("[data-rise]").forEach((n) => {
        gsap.from(n, {
          y: 28,
          autoAlpha: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: n, start: "top 88%", toggleActions: "play none none none" },
        });
      });

      // leaving the desktop context must also strip the expansion attribute,
      // or a resize down to phone width keeps the cover/reel CSS with no
      // timeline driving it
      return () => hero?.removeAttribute("data-x");
    });

    // gentle reveals at every width
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      el.querySelectorAll<HTMLElement>(".ap-cat").forEach((n, i) => {
        gsap.from(n, {
          y: 30,
          autoAlpha: 0,
          duration: 0.7,
          delay: (i % 3) * 0.06,
          ease: "power3.out",
          scrollTrigger: { trigger: n, start: "top 92%", toggleActions: "play none none none" },
        });
      });
    });

    return () => mm.revert();
  }, []);

  // The hero's ground is the SERIES ITSELF as light: every artwork's
  // measured average colour (all 57), sorted by hue into one ribbon. The
  // stage blurs it into an aurora behind the painting. Pure arithmetic on
  // module data — identical on server and client, so hydration-safe.
  const heroField = useMemo(() => {
    const hueOf = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 255) / 255;
      const g = ((n >> 8) & 255) / 255;
      const b = (n & 255) / 255;
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      if (!d) return 0;
      const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return h * 60;
    };
    const stops = [...ART]
      .sort((a, b) => hueOf(a.avg) - hueOf(b.avg) || a.id.localeCompare(b.id))
      .map((a, i, arr) => `${a.avg} ${((i / (arr.length - 1)) * 100).toFixed(1)}%`)
      .join(", ");
    return `linear-gradient(115deg, ${stops})`;
  }, []);

  // The floating shop's card textures: a category's first photograph, or —
  // for an unphotographed line — the first artwork of its swatch, the same
  // substitution CatFig makes. Every category therefore floats, skirts too.
  const floatCats: FloatCat[] = categories.map((c) => {
    const shot = P[c.media]?.[0];
    const swatch = c.swatch?.length ? ART.find((a) => a.id === c.swatch![0]) : undefined;
    const src = shot ?? swatch;
    return {
      slug: c.slug,
      name: c.name,
      from: c.from,
      status: c.status,
      tex: src?.thumb ?? "/hero/hero.webp",
      w: src?.w ?? 298,
      h: src?.h ?? 421,
    };
  });

  return (
    <div className="ap" ref={root}>
      {/* FIRST in the source, so every section that follows paints over it —
          the sun travels BEHIND the page, not across the top of it. */}
      <Sun />

      {/* ═══ HERO ══════════════════════════════════════════════════════════ */}
      <section
        className="ap-hero ap-dark"
        aria-label={brand.name}
        style={{ "--hero-field": heroField } as React.CSSProperties}
      >
        {/* THE LAYER STACK, in the client's reference's own contract:
            `data-parallax-layers` on the trigger, `data-parallax-layer="n"`
            on each plane, one scrubbed timeline moving them at n speeds.
            1 = the ground (furthest, travels most), 2 = her painting,
            3 = the type, 4 = the haze in front of it. The type sitting
            BETWEEN two moving planes is the whole reason the reference
            reads as depth rather than as a zoom. */}
        <div className="ap-hero__stage" data-parallax-layers>
          <div className="ap-hero__field" data-parallax-layer="1" aria-hidden="true" />
          {/* TWO PLATES, and the browser picks ONE. `hero-nosun` has the sun
              inpainted out because components/Sun.tsx flies a cutout of it
              down the page; every other visitor needs the sun that was
              painted in. Doing this in JS meant desktop fetched both — 280 KB
              spent to throw one away, plus a swap you could see. The gate is
              pure CSS, so <picture> resolves it before a byte is requested.
              `scripting: enabled` is load-bearing: without it a no-JS desktop
              would get the sunless plate and nothing to fly it. */}
          {/* THE PAINTING NOW MOVES. Arpine sent an animated cut of this exact
              illustration — she blinks, her hair drifts, the clouds cross —
              and it replaces the still wherever motion is welcome.

              A <video> with the STILL as its poster, not a <picture>: the
              poster is what a phone, a reduced-motion reader and anyone whose
              autoplay is refused actually see, and it is the same file the
              plain layer used before, so nothing regressed for them. `preload
              ="none"` on the phone breakpoint would be ideal but a poster
              alone already costs them nothing — the source elements are
              media-gated, so a narrow screen matches NEITHER and downloads no
              video at all.

              muted + playsInline + loop is the combination every current
              autoplay policy accepts; `disablePictureInPicture` and no
              controls because this is scenery, not a film someone should be
              offered a scrubber for. */}
          <video
            className="ap-hero__img"
            data-parallax-layer="2"
            poster="/hero/intro.webp"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-label={home.hero.alt}
            width={1280}
            height={720}
          >
            <source
              src="/hero/intro.mp4"
              type="video/mp4"
              media="(min-width: 861px) and (prefers-reduced-motion: no-preference)"
            />
            <source
              src="/hero/intro-sm.mp4"
              type="video/mp4"
              media="(min-width: 561px) and (prefers-reduced-motion: no-preference)"
            />
          </video>
          {/* The expanding reel of the Yerevan coffee film stood here and is
              removed (client 2026-08-06). /hero/coffee.mp4 and its poster are
              left in public/ — nothing references them now, so they cost
              nothing to serve, and putting the reel back is a markup change
              rather than a re-encode. */}
          <div className="ap-hero__type" data-parallax-layer="3">
            {/* the top-right sky is the only calm zone on this illustration —
                measured 3.15–3.73:1, so display size only, never body copy */}
            <h1 className="ap-hero__title">
              <span data-tfx="rise">{home.hero.line1}</span>
              <span data-tfx="rise" data-tfx-delay="0.16">
                {home.hero.line2}
              </span>
            </h1>
            {/* the sub and CTA sit on paper, where they clear 13.3:1 */}
            <div className="ap-hero__card">
              <p>{home.hero.sub}</p>
              <Link className="ap-btn" href="/shop">
                {home.hero.cta} <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
          <span className="ap-hero__hint" aria-hidden="true">
            {home.hero.hint}
          </span>
          {/* LAST IN THE SOURCE so it paints over the type — this is the
              plane the title passes behind, which is the reference's whole
              depth cue. Light, not artwork: see the note in globals.css. */}
          <div className="ap-hero__haze" data-parallax-layer="4" aria-hidden="true" />
        </div>
      </section>

      {/* ═══ CLOUD — the series lying freely in space ══════════════════════ */}
      <Cloud
        items={ART}
        kicker={home.strip.kicker}
        title={home.strip.title}
        copy={home.strip.copy}
        pick={{ line: home.strip.pickLine, body: home.strip.pickBody, cta: home.strip.pickCta }}
      />

      {/* ═══ RIBBON — the awning between the series and the gallery ════════
          Every word on it is a fact the page already states: her tagline,
          the real count of illustrations, the lines that are actually open.
          aria-hidden because it repeats, never informs. ══════════════════ */}
      <div className="ap-ribbon" aria-hidden="true">
        <div className="ap-ribbon__track">
          {[0, 1].map((run) => (
            <span className="ap-ribbon__run" key={run}>
              <span>{brand.tagline}</span>
              <span>{ART.length} illustrations</span>
              {categories
                .filter((c) => c.status === "open")
                .map((c) => (
                  <span key={c.slug}>{c.name}</span>
                ))}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ GALLERY ═══════════════════════════════════════════════════════ */}
      <section className="ap-sec ap-sec--gal ap-dark" id="gallery">
        <div className="ap-sec__head">
          <p className="ap-kicker" data-rise>
            {home.gallery.kicker}
          </p>
          <h2 className="ap-h2" data-tfx="flip">
            {home.gallery.title}
          </h2>
          <p className="ap-lede" data-rise>
            {home.gallery.copy}
          </p>
        </div>
        <Gallery />
      </section>

      {/* ═══ SHOP — the categories as a floating gallery ═══════════════════ */}
      <section className="ap-sec" id="shop">
        <FloatShop cats={floatCats} kicker={home.shopIntro.kicker} name="Shop" copy={home.shopIntro.copy} />

        {/* the grid stays: the plain layer everywhere, the accessible layer
            under the canvas (sr-only + focus bottom sheet) when it runs */}
        <ul className="ap-cats">
          {categories.map((c) => {
            return (
              <li className="ap-cat" key={c.slug} data-soon={c.status === "soon" || undefined}>
                <Link href={c.status === "open" ? `/shop/${c.slug}` : "/shop"} aria-label={c.name}>
                  <CatFig cat={c} />
                  <div className="ap-cat__row">
                    <h3>{c.name}</h3>
                    {c.status === "open" ? (
                      <span className="ap-cat__from">from {c.from.toLocaleString()} ֏</span>
                    ) : (
                      <span className="ap-cat__from is-soon">Soon</span>
                    )}
                  </div>
                  <p className="ap-cat__blurb">{c.blurb}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ═══ FROM THE STUDIO — the last thing before the footer ════════════ */}
      <section className="ap-sec" id="studio">
        <div className="ap-sec__head">
          <p className="ap-kicker" data-rise>
            {home.studio.kicker}
          </p>
          <h2 className="ap-h2" data-tfx="rise">
            {home.studio.title}
          </h2>
          <p className="ap-lede" data-rise>
            {home.studio.copy}
          </p>
          {/* the panels are photographs standing in for films that do not
              exist yet — said here rather than discovered later */}
          {home.studio.panels.every((p) => !p.video) && (
            <p className="ap-isel__pending">{home.studio.pending}</p>
          )}
        </div>
        <Selector />
      </section>

      {/* ABOUT used to sit here; it is its own page now (/about), which the
          nav links to directly. */}
    </div>
  );
}
