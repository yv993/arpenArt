"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import PhotoLightbox from "./PhotoLightbox";
import { stories, type Story } from "@/lib/content";
import shots from "@/lib/stories.json";

type Shot = { id: string; src: string; thumb: string; w: number; h: number; avg: string };
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
// ============================================================================

const STACK = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/** the rail's word for a story: its year, or the first word of its date line */
const railLabel = (s: Story) => s.when.match(/(\d{4})/)?.[1] ?? s.when.split(" ")[0];

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
          const text = p.textContent ?? "";
          const frag = document.createDocumentFragment();
          for (const part of text.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              continue;
            }
            const w = document.createElement("span");
            w.className = "ap-st__w";
            w.textContent = part;
            frag.appendChild(w);
          }
          p.replaceChildren(frag);
          restore.push(() => {
            p.textContent = text;
          });
        });
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
        const next = marks[i + 1];
        ScrollTrigger.create({
          trigger: mark,
          start: "top top",
          ...(next ? { endTrigger: next, end: "top top" } : { end: () => ScrollTrigger.maxScroll(window) }),
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
            <ol className="ap-st__index" aria-label="The stories">
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
                    {story.body.map((p, i) => {
                      const closing = i === story.body.length - 1 && story.body.length > 1 && !story.link && !story.more;
                      return (
                        <p key={p.slice(0, 32)} className={closing ? "ap-st__close" : "ap-st__p"} data-words>
                          {p}
                        </p>
                      );
                    })}
                    {story.more && (
                      <details className="ap-st__more" data-reveal>
                        <summary>{story.more.label}</summary>
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
                          style={{ background: lead.avg }}
                          onClick={(e) => {
                            opener.current = e.currentTarget;
                            setLb({ s: si, i: 0 });
                          }}
                          aria-label={`Open the photographs of “${story.title}”`}
                        >
                          <img src={lead.src} alt="" width={lead.w} height={lead.h} loading={si === 0 ? "eager" : "lazy"} decoding="async" />
                        </button>
                      )
                    )}
                    {pics.length > (story.film ? 0 : 1) && (
                      <ul className="ap-st__thumbs">
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
            {stories.entries.map((s, i) => (
              <li key={s.id}>
                <button type="button" aria-current={active === i ? "true" : undefined} onClick={() => go(i)}>
                  {railLabel(s)}
                </button>
              </li>
            ))}
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
