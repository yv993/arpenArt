"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import PhotoLightbox from "./PhotoLightbox";
import { stories, type Story } from "@/lib/content";
import shots from "@/lib/stories.json";

/** `md`: a 1,080px-wide copy, on the leads whose master is wider than 1,200
 *  (2026-10-05) — see the lead's <picture> */
type Shot = { id: string; src: string; thumb: string; md?: string; w: number; h: number; avg: string };
const S = shots as Shot[];
const byId = (id: string) => S.find((s) => s.id === id);

// ============================================================================
// STUDIO STORIES — /stories (client, change.pdf p12, 2026-09-21), rebuilt as
// a STACK OF SHEETS (Vardan, the same evening: «every section can go to
// another and take the place of the previous part … text revealing, video
// playing, all can procedurally move» — with the Awwwards agency sites as the
// reference). The anatomy those sites share, and what is taken from it:
//
//   · SHEETS THAT STACK. Every story is one screen. It arrives from below
//     and slides up OVER the story before it, which stays put underneath and
//     recedes — scales down, dims — as it is covered. The same curtain the
//     home hero now does, six times over. Done with `position: sticky` (no
//     pins, no spacers): every sheet sticks at the top of the viewport and
//     the next one, in normal flow 40svh later, rides up over it. GSAP only
//     scrubs the recede; the browser does the stacking.
//   · TEXT THAT REVEALS. The heading rises letter by letter (the shared
//     text-FX runner), the paragraphs light up WORD BY WORD as the sheet
//     settles — each word is wrapped in a span after hydration, the way the
//     runner wraps letters, and restored on cleanup.
//   · FILM THAT PLAYS. A sheet with a television feature starts it, muted,
//     the moment the sheet is in place, and pauses it when the next sheet
//     has covered it. The features have sound, so they never start loud —
//     the browser's own controls unmute, and a video the visitor has
//     touched keeps their choice.
//   · A TIMELINE RAIL at the right names the year of every story, marks the
//     one on screen, and jumps to any of them.
//
// THE TRIGGERS ARE NOT THE STICKY SHEETS. ScrollTrigger measures a trigger
// with getBoundingClientRect, and a stuck element reports its STUCK box —
// refresh mid-page and every start is wrong. So each sheet is preceded by
// a zero-height `.ap-st__mark` in normal flow; every trigger reads from the
// mark, which is always where the sheet's flow position is.
//
// live=false (phone, reduced motion): the same markup as the flowing column
// it was — words first, pictures after, nothing autoplays, the films keep
// their controls and a poster. `data-stack` on the section is the only
// switch, and it is set from a matchMedia, never from CSS alone.
//
// ROUND 3 (client, change 3.pdf p9 + p11, 2026-10-01): ELEVEN stories, newest
// first, five of them new. What that changed here:
//   · the cover starts right under the nav («էս ազատ տարածքը մեզ պետք չի») and
//     its index, now eleven rows, takes the sheet's whole height;
//   · the rail says a YEAR ONCE — 2026 heads three stories and 2025 four, and
//     a column reading 2026 2026 2026 2025 2025… told nobody where they were.
//     Each later story of a year is a tick under its year; every button still
//     carries its story's own name for a screen reader and a tooltip;
//   · a story can carry SUB lines under its title, end on a plain paragraph,
//     and loop a film of a few seconds — see the Story type;
//   · an Armenian run inside her English text is marked lang="hy", and the
//     word-splitter keeps that mark (it used to flatten a paragraph to text).
// ============================================================================

const STACK = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/** the rail's word for a story: its year, or the first word of its date line */
const railLabel = (s: Story) => s.when.match(/(\d{4})/)?.[1] ?? s.when.split(" ")[0];

/** Her English text names an Armenian book in Armenian («“Հիշելու հեքիաթներ”»).
 *  Those runs are marked lang="hy" so a screen reader switches voice and the
 *  browser picks an Armenian face. A run is whole WORDS — whatever touches
 *  the Armenian letters without a space (her quotation marks) stays inside
 *  it, so a line can never break between a quote mark and its word. */
const HY = /[Ա-֏]/;
const GAP = /^\s+$/;
function hy(text: string) {
  if (!HY.test(text)) return text;
  const parts = text.split(/(\s+)/).filter(Boolean);
  const runs: { hy: boolean; text: string }[] = [];
  for (let i = 0; i < parts.length; ) {
    if (HY.test(parts[i])) {
      let run = parts[i++];
      // a space between two Armenian words belongs to the run
      while (i + 1 < parts.length && GAP.test(parts[i]) && HY.test(parts[i + 1])) {
        run += parts[i] + parts[i + 1];
        i += 2;
      }
      runs.push({ hy: true, text: run });
    } else {
      const last = runs[runs.length - 1];
      if (last && !last.hy) last.text += parts[i];
      else runs.push({ hy: false, text: parts[i] });
      i++;
    }
  }
  return runs.map((r, i) =>
    r.hy ? (
      <span lang="hy" key={i}>
        {r.text}
      </span>
    ) : (
      r.text
    ),
  );
}

export default function StoriesView() {
  const root = useRef<HTMLDivElement | null>(null);
  const [stack, setStack] = useState(false);
  /** which story is on screen: −1 is the cover */
  const [active, setActive] = useState(-1);
  /** where each story's sheet is fully in place, in page scroll — read from
   *  its own ScrollTrigger on every refresh, so the rail can jump there */
  const starts = useRef<number[]>([]);
  /** which story's pictures are open in the lightbox, and which picture */
  const [lb, setLb] = useState<{ s: number; i: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const m = window.matchMedia(STACK);
    const read = () => setStack(m.matches);
    read();
    m.addEventListener("change", read);
    return () => m.removeEventListener("change", read);
  }, []);

  // ---- the plain layer's reveals: each block rises as it enters ------------
  useEffect(() => {
    const el = root.current;
    if (!el || stack) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal], [data-words]", el).forEach((n) => {
        gsap.from(n, {
          y: 28,
          autoAlpha: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: n, start: "top 88%", toggleActions: "play none none none" },
        });
      });
    }, el);
    return () => ctx.revert();
  }, [stack]);

  // ---- the stack ------------------------------------------------------------
  useEffect(() => {
    const el = root.current;
    if (!el || !stack) return;
    gsap.registerPlugin(ScrollTrigger);

    const restore: (() => void)[] = [];
    const ctx = gsap.context(() => {
      const cover = el.querySelector<HTMLElement>(".ap-st__cover .ap-st__sheet");
      const items = gsap.utils.toArray<HTMLElement>(".ap-st__item", el);
      const marks = gsap.utils.toArray<HTMLElement>(".ap-st__mark", el);

      // 1. the words. Each paragraph's text becomes one span per word, with
      //    the spaces kept as text nodes between them so lines still break
      //    at word boundaries; cleanup puts the original text back.
      items.forEach((li) => {
        li.querySelectorAll<HTMLElement>("[data-words]").forEach((p) => {
          // the paragraph's own nodes are kept and put back as they were —
          // they are React's, and one of them may be a lang="hy" run, which
          // is split INSIDE a copy of its element so the mark survives
          const own = Array.from(p.childNodes);
          const split = (text: string, into: Node) => {
            for (const part of text.split(/(\s+)/)) {
              if (!part) continue;
              if (GAP.test(part)) {
                into.appendChild(document.createTextNode(part));
                continue;
              }
              const w = document.createElement("span");
              w.className = "ap-st__w";
              w.textContent = part;
              into.appendChild(w);
            }
          };
          const frag = document.createDocumentFragment();
          own.forEach((n) => {
            if (n instanceof HTMLElement) {
              const shell = n.cloneNode(false);
              split(n.textContent ?? "", shell);
              frag.appendChild(shell);
            } else if (n.nodeType === Node.TEXT_NODE) split(n.textContent ?? "", frag);
          });
          p.replaceChildren(frag);
          restore.push(() => {
            p.replaceChildren(...own);
          });
        });
      });

      // 1b. THE FIT. A sheet is one screen, and its type is sized by the
      //    screen's height (stories.css) — which held for her first six
      //    texts and cannot hold for whatever she sends next: the AGBU story
      //    (2026-10-01, six paragraphs) ran 130px past a 1024×768 sheet,
      //    whose overflow is clipped. So a text column taller than its
      //    sheet's inner box steps its type down, half a pixel at a time,
      //    until it fits (12px is the floor). Run again on every refresh —
      //    a resize changes both the box and the type — and once the web
      //    fonts are in, which change the line count. offsetHeight is
      //    layout, so GSAP's transforms on the sheet do not skew it.
      const fit = () => {
        items.forEach((li) => {
          const sheet = li.querySelector<HTMLElement>(".ap-st__sheet");
          const say = li.querySelector<HTMLElement>(".ap-st__say");
          if (!sheet || !say) return;
          say.style.fontSize = "";
          const cs = getComputedStyle(sheet);
          const room = sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          let px = parseFloat(getComputedStyle(say).fontSize);
          while (say.offsetHeight > room && px > 12) {
            px -= 0.5;
            say.style.fontSize = `${px}px`;
          }
        });
      };
      fit();
      ScrollTrigger.addEventListener("refreshInit", fit);
      let gone = false;
      document.fonts?.ready.then(() => {
        if (!gone) fit();
      });
      restore.push(() => {
        gone = true;
        ScrollTrigger.removeEventListener("refreshInit", fit);
        items.forEach((li) => li.querySelector<HTMLElement>(".ap-st__say")?.style.removeProperty("font-size"));
      });

      // 2. the recede: as sheet i+1 rides up (its mark travels from the
      //    bottom of the viewport to the top), sheet i shrinks and dims
      //    beneath it. `ease: "none"` — the motion belongs to the scroll.
      const sheets = [cover, ...items.map((li) => li.querySelector<HTMLElement>(".ap-st__sheet"))];
      sheets.forEach((sheet, i) => {
        const mark = marks[i]; // mark i precedes item i, i.e. the sheet AFTER sheets[i]
        if (!sheet || !mark) return;
        gsap.fromTo(
          sheet,
          { scale: 1, filter: "brightness(1)" },
          {
            scale: 0.94,
            filter: "brightness(0.66)",
            ease: "none",
            scrollTrigger: { trigger: mark, start: "top bottom", end: "top top", scrub: true },
          },
        );
      });

      // 3. every story: the pictures drift up a beat behind the sheet (depth),
      //    the lead settles from a push-in, and once the sheet is half-way
      //    up the words, the small lines and the thumbnails come in — once.
      items.forEach((li, i) => {
        const mark = marks[i];
        if (!mark) return;
        const media = li.querySelector<HTMLElement>(".ap-st__media");
        const lead = li.querySelector<HTMLElement>(".ap-st__lead img, .ap-st__film video");
        if (media) {
          gsap.fromTo(
            media,
            { yPercent: 14 },
            { yPercent: 0, ease: "none", scrollTrigger: { trigger: mark, start: "top bottom", end: "top top", scrub: true } },
          );
        }
        if (lead) {
          gsap.fromTo(
            lead,
            { scale: 1.12 },
            { scale: 1, ease: "none", scrollTrigger: { trigger: mark, start: "top bottom", end: "top 8%", scrub: true } },
          );
        }
        const words = li.querySelectorAll(".ap-st__w");
        const bits = li.querySelectorAll("[data-reveal]");
        const thumbs = li.querySelectorAll(".ap-st__thumbs li");
        const tl = gsap.timeline({ scrollTrigger: { trigger: mark, start: "top 45%", once: true } });
        if (bits.length) tl.from(bits, { y: 26, autoAlpha: 0, duration: 0.7, ease: "power3.out", stagger: 0.07 }, 0);
        if (words.length) tl.from(words, { opacity: 0.1, y: 5, duration: 0.5, ease: "power2.out", stagger: 0.006 }, 0.12);
        if (thumbs.length) tl.from(thumbs, { y: 28, autoAlpha: 0, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 0.3);

        // which story is ON SCREEN: from its sheet being fully in place to
        // the next sheet being fully in place — that is when its film plays
        // and the rail marks it. The last one holds to the end of the page.
        // (the last one's end is the page's own maximum, as a NUMBER — the
        // string "max" next to an endTrigger resolved to an empty range and
        // the last story never came on; measured on the first pass)
        // …PLUS ONE (2026-10-01). A trigger is "active" strictly inside its
        // range, and the page's maximum is a place a visitor can ARRIVE at
        // without passing through — the End key, a reload that restores the
        // scroll at the bottom. There the last story sat at progress 1,
        // never toggled, and its rail mark and its film stayed off (measured:
        // a jump to the end left active at −1). One pixel past the maximum
        // keeps the bottom of the page inside the last story's range.
        const next = marks[i + 1];
        ScrollTrigger.create({
          trigger: mark,
          start: "top top",
          ...(next ? { endTrigger: next, end: "top top" } : { end: () => ScrollTrigger.maxScroll(window) + 1 }),
          onToggle: (self) => {
            if (self.isActive) setActive(i);
          },
          onLeaveBack: () => {
            if (i === 0) setActive(-1);
          },
          onRefresh: (self) => {
            starts.current[i] = self.start;
          },
        });
      });
    }, el);

    // 4. WHICH STORY IS ON SCREEN WHEN THE STACK WAKES (2026-10-02). A
    //    trigger created INSIDE its range takes its progress silently — the
    //    callbacks are held back during a refresh (ScrollTrigger.js, update():
    //    `stateChanged && !_refreshing`) — and the next scroll finds nothing
    //    to toggle. The stack wakes after hydration, at whatever scroll the
    //    browser has by then: a reload that restores the scroll, a hash it
    //    answered in the plain layout, React's own second run of this effect
    //    in development. So the first `active` is READ from the measured
    //    starts, not awaited from a toggle (measured: a load at #agbu-2026
    //    sat at 901, inside the first story, with the rail off and nothing
    //    playing). From there the toggles take over.
    const sync = () => {
      const y = window.scrollY;
      let on = -1;
      starts.current.forEach((top, i) => {
        if (y >= top) on = i;
      });
      setActive(on);
    };
    //    A DEEP LINK — /stories#tsarapatum-2024 from elsewhere, or a hash set
    //    while the stack is up. The browser answers a hash by putting the
    //    anchor's top at the top of the window, and the anchor is the sticky
    //    item whose flow position IS its mark's: the page lands exactly on
    //    the trigger's START, where a trigger is not yet active (`!!clipped
    //    && clipped < 1`) — the rail stayed off and the film never started
    //    until the visitor moved a pixel (measured at 1440×900). A hash in
    //    the address on a FRESH load fared worse: answered in the plain
    //    layout, then the stack replaced that layout and the page was left
    //    at the top (measured: scrollY 0). So the hash is answered here the
    //    way go() answers the rail — one pixel inside the story's range —
    //    once the triggers have measured their starts (a trigger refreshes
    //    as it is created), and again on every change.
    const toHash = () => {
      const i = stories.entries.findIndex((s) => `#${s.id}` === location.hash);
      const top = i < 0 ? undefined : starts.current[i];
      if (top === undefined) return;
      window.scrollTo({ top: top + 1, behavior: "instant" });
    };
    const onHash = () => {
      toHash();
      sync();
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    restore.push(() => window.removeEventListener("hashchange", onHash));

    return () => {
      ctx.revert();
      restore.forEach((fn) => fn());
    };
  }, [stack]);

  // ---- the films follow the active sheet ------------------------------------
  useEffect(() => {
    const el = root.current;
    if (!el || !stack) return;
    el.querySelectorAll<HTMLLIElement>(".ap-st__item").forEach((li, i) => {
      const v = li.querySelector("video");
      if (!v) return;
      if (i === active) {
        // muted until the visitor has touched the sound themselves — these
        // are television features with speech, and no page should start
        // talking on its own
        if (!v.dataset.touched) v.muted = true;
        if (v.paused) v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, [active, stack]);

  /** jump the page to story i's sheet (the rail and the cover's index) */
  const go = useCallback(
    (i: number, e?: React.MouseEvent) => {
      if (!stack) return; // the plain layer follows the anchor natively
      const top = starts.current[i];
      if (top === undefined) return;
      e?.preventDefault();
      window.scrollTo({ top: top + 1, behavior: "smooth" });
    },
    [stack],
  );

  const lbStory: Story | null = lb ? stories.entries[lb.s] : null;
  const lbShots = lbStory ? lbStory.photos.map(byId).filter((s): s is Shot => !!s) : [];
  const total = String(stories.entries.length).padStart(2, "0");

  return (
    <div ref={root}>
      <section className="ap-sec ap-st" aria-labelledby="ap-st-title" data-stack={stack || undefined}>
        {/* ---- the cover: the first sheet, and the index of what follows --- */}
        <header className="ap-st__cover">
          <div className="ap-st__sheet">
            <div className="ap-st__cover-say">
              <p className="ap-kicker">{stories.kicker}</p>
              {/* every letter arrives cut in two and seams shut */}
              <h1 className="ap-h2 ap-st__h1" id="ap-st-title" data-tfx="cut">
                {stories.title}
              </h1>
              <p className="ap-lede">{stories.copy}</p>
            </div>
            <ol className="ap-st__index" id="ap-st-index" aria-label="The stories">
              {stories.entries.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={(e) => go(i, e)}>
                    <span className="ap-st__index-when">{s.when}</span>
                    <span className="ap-st__index-title">{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="ap-st__cue" aria-hidden="true">
              Scroll
            </p>
          </div>
        </header>

        <ol className="ap-st__list">
          {stories.entries.map((story, si) => {
            const pics = story.photos.map(byId).filter((s): s is Shot => !!s);
            const lead = pics[0];
            const night = !!story.film;
            return [
              /* the flow marker every trigger reads from — see the note above */
              <li className="ap-st__mark" role="presentation" key={`m-${story.id}`} />,
              <li
                className={`ap-st__item${night ? " ap-dark" : ""}`}
                key={story.id}
                id={story.id}
                data-side={si % 2 ? "left" : "right"}
                data-film={night || undefined}
              >
                <div className="ap-st__sheet">
                  <div className="ap-st__say">
                    <p className="ap-kicker ap-st__when" data-reveal>
                      <span className="ap-st__n">
                        {String(si + 1).padStart(2, "0")} / {total}
                      </span>
                      {story.when}
                    </p>
                    <h2 className="ap-h2 ap-st__title" data-tfx="rise">
                      {story.title}
                    </h2>
                    {/* the lines she sets under a title — whose book, for what age */}
                    {story.sub && (
                      <p className="ap-st__sub" data-reveal>
                        {story.sub.map((line) => (
                          <span key={line}>{hy(line)}</span>
                        ))}
                      </p>
                    )}
                    {story.body.map((p, i) => {
                      // her closing line stands on its own — unless the text
                      // ends on a paragraph (plainEnd), or on a link / the
                      // interview, where the last line only introduces them
                      const closing =
                        i === story.body.length - 1 && story.body.length > 1 && !story.link && !story.more && !story.plainEnd;
                      return (
                        <p key={p.slice(0, 32)} className={closing ? "ap-st__close" : "ap-st__p"} data-words>
                          {hy(p)}
                        </p>
                      );
                    })}
                    {story.more && (
                      <details className="ap-st__more" data-reveal>
                        {/* the label in its own box: on a phone the summary
                            grows to a 44px target and the underline stays on
                            the words (stories.css, 2026-10-05) */}
                        <summary>
                          <span>{story.more.label}</span>
                        </summary>
                        <div lang={story.more.lang}>
                          {story.more.paragraphs.map((p) => (
                            <p key={p.slice(0, 40)}>{p}</p>
                          ))}
                          <p className="ap-st__credit">{story.more.credit}</p>
                        </div>
                      </details>
                    )}
                    {story.link && (
                      <a className="ap-about__link ap-st__link" href={story.link.href} target="_blank" rel="noopener noreferrer" data-reveal>
                        {story.link.label} <span aria-hidden>↗</span>
                      </a>
                    )}
                  </div>

                  <div className="ap-st__media">
                    {story.film ? (
                      <figure className="ap-st__film">
                        {/* the feature is the sheet's picture. Sound stays off
                            until the visitor turns it on with the browser's
                            own controls; on the plain layer nothing plays
                            until pressed, and nothing is fetched before. */}
                        <video
                          controls
                          muted={stack}
                          preload={stack ? "metadata" : "none"}
                          playsInline
                          loop={story.film.loop}
                          poster={story.film.poster}
                          aria-label={story.film.label}
                          onVolumeChange={(e) => {
                            e.currentTarget.dataset.touched = "1";
                          }}
                        >
                          <source src={story.film.src} type="video/mp4" />
                        </video>
                        <figcaption>{story.film.label}</figcaption>
                      </figure>
                    ) : (
                      lead && (
                        <button
                          type="button"
                          className="ap-st__lead"
                          // THE BOX IS SIZED BEFORE THE PICTURE ARRIVES
                          // (2026-10-05). The lead used to take its size
                          // from the loaded file, so every lead was 0px tall
                          // until it came in (7 of 7 at 360x740) and the page
                          // grew from 12,335 to 14,628px under a phone
                          // reader's thumb — an index jump landed one story
                          // early. Its ratio and natural width ride here, on
                          // the button, so stories.css can give the button
                          // its final width up front (see `.ap-st__lead`).
                          style={
                            {
                              background: lead.avg,
                              "--r": lead.w / lead.h,
                              "--w": `${lead.w}px`,
                            } as React.CSSProperties
                          }
                          onClick={(e) => {
                            opener.current = e.currentTarget;
                            setLb({ s: si, i: 0 });
                          }}
                          aria-label={`Open the photographs of “${story.title}”`}
                        >
                          {/* A PHONE TAKES THE 1,080 COPY (2026-10-05). The
                              lead had one file, the 1,600 master, and every
                              phone downloaded it for a 354px column (708px
                              at DPR 2, 1,062 at DPR 3). Under 860px a lead
                              that has the middle rung offers it; the desktop
                              matches no source and keeps the master it
                              always had, pixel for pixel. */}
                          <picture>
                            {lead.md && (
                              <source media="(max-width: 860px)" srcSet={`${lead.md} 1080w, ${lead.src} ${lead.w}w`} sizes="92vw" />
                            )}
                            <img src={lead.src} alt="" width={lead.w} height={lead.h} loading={si === 0 ? "eager" : "lazy"} decoding="async" />
                          </picture>
                        </button>
                      )
                    )}
                    {pics.length > (story.film ? 0 : 1) && (
                      <ul className="ap-st__thumbs" data-many={pics.length > 8 || undefined}>
                        {(story.film ? pics : pics.slice(1)).map((p, i) => {
                          const at = story.film ? i : i + 1;
                          return (
                            <li key={p.id}>
                              <button
                                type="button"
                                style={{ background: p.avg }}
                                onClick={(e) => {
                                  opener.current = e.currentTarget;
                                  setLb({ s: si, i: at });
                                }}
                                aria-label={`Photograph ${at + 1} of ${pics.length} — “${story.title}”`}
                              >
                                <img src={p.thumb} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
                {/* BACK TO THE INDEX, on a phone (2026-10-05). /stories is
                    18-21 phone screens and its index is only at the top, so
                    each story ends with the way back to it. stories.css
                    shows it at 860px and under only: the stack has its rail,
                    and the desktop's plain layer is left as it was. */}
                <a className="ap-st__back" href="#ap-st-index">
                  <span aria-hidden="true">↑</span>
                  <span>All stories</span>
                </a>
              </li>,
            ];
          })}
        </ol>
      </section>

      {/* the timeline rail — desktop with motion only, where the stack runs;
          hidden while the cover is up, whose index is the navigation there
          (and whose right column the rail sat on top of, measured at 1024) */}
      {stack && (
        <nav className="ap-st__rail" aria-label="Jump to a story" data-on={active >= 0 || undefined}>
          <ol>
            {stories.entries.map((s, i, all) => {
              const year = railLabel(s);
              // the year is SHOWN on the first story of that year; the ones
              // after it are ticks under it, and show theirs when they are
              // the story on screen, hovered or focused. The name each button
              // answers to is its story's, not the year four of them share.
              const heads = i === 0 || railLabel(all[i - 1]) !== year;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={active === i ? "true" : undefined}
                    aria-label={`${s.title} — ${s.when}`}
                    title={s.title}
                    data-heads={heads || undefined}
                    onClick={() => go(i)}
                  >
                    <span className="ap-st__rail-y">{year}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {lb && lbStory && lbShots.length > 0 && (
        <PhotoLightbox
          shots={lbShots}
          i={lb.i}
          onIndex={(next) => setLb({ s: lb.s, i: next })}
          onClose={() => setLb(null)}
          label={`Photographs — ${lbStory.title}`}
          alt={(i) => `${lbStory.title} — photograph ${i + 1} of ${lbShots.length}`}
          opener={opener.current}
        />
      )}
    </div>
  );
}
