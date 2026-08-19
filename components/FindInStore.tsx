"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ArmeniaMap from "./ArmeniaMap";
import LocationCard from "./LocationCard";
import MapBoundary from "./MapBoundary";
// TYPE-ONLY, and it must stay that way: a value import from TownStreet would
// pull maplibre-gl and its stylesheet out of the dynamic chunk and into the
// bundle every visitor downloads.
import type { StreetApi, StreetState } from "./TownStreet";
import { categories, stockistPage, type Stockist, type Town } from "@/lib/content";

// ============================================================================
// FIND IN STORE — the map is in ArmeniaMap.tsx; this holds the selection and
// the directory, which is the page's real content: a town, the shops that
// carry the work there, their addresses, and the way to each door.
//
// IT IS A DIRECTORY NOW, not a row per town. Arpine's real list (2026-08-18)
// put three shops on one street in Yerevan and three more in Dilijan, so the
// town became a HEADING over its own list and the shop became the leaf. Every
// entry is confirmed — the stand-in addresses, and all the machinery that
// warned people off travelling to them, are gone.
//
// TWO MAPS, at two scales, answering two questions:
//   ArmeniaMap   the country. Which towns, and where they sit.
//   TownStreet   a REAL street map, shown inside a SHOP's LocationCard.
// There was briefly a third — LocationCard drew its own invented street grid
// when it opened — and it is gone. A true map and a made-up one at the same
// scale, told apart only by 10px of caption, is the sort of thing this site
// does not do. LocationCard is now the frame the real map arrives in, so
// there is ONE card and ONE control per shop.
//
// The outbound OSM link is the plain layer's whole answer, and it is not
// gated on the engine.
// ============================================================================

// maplibre-gl and its 70 KB stylesheet exist in this chunk and nowhere else.
// It is only rendered once someone presses "Show the street map", so the
// engine is never fetched — and no packet ever reaches the tile host — for a
// visitor who came to read seven addresses.
const TownStreet = dynamic(() => import("./TownStreet"), { ssr: false });

/** The 3D country map is MOTION: it turns, sways and takes drags, so someone
 *  who asked for less of that should not get it. */
const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
/** The street map is INFORMATION, so it deliberately drops the motion clause —
 *  it mounts with fadeDuration 0 and never animates. Do not "tidy" these two
 *  into one constant; the difference is the point. Width still gates it:
 *  a phone is better served by the OSM link, which opens the map app that
 *  already knows where its owner is standing. */
const WIDE = "(min-width: 861px)";

/** Great-circle kilometres. STRAIGHT LINE, and the page says so out loud: a
 *  road distance would need a routing service, and quoting one without it is
 *  the sort of number that gets somebody lost. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** No false precision: a straight-line distance to a town is not a figure that
 *  deserves decimals once it is in the tens of kilometres. */
const far = (d: number) => (d < 1 ? "under 1 km" : d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d)} km`);

/** what the two zoom buttons and the recentre button should be doing — derived
 *  from the map's state, and stored coarsely on purpose (see `onState`) */
type Flags = { canIn: boolean; canOut: boolean; moved: boolean };

/** The monogram a shop wears until its logo file lands. Two letters, because
 *  three is a wordmark and one is an ambiguity — and "Dilijan Tourist
 *  Information Center" has to come out as something a person can tell apart
 *  from its neighbours at 52px. */
function initials(name: string) {
  const w = name.split(/\s+/).filter(Boolean);
  // A one-word shop takes its first two LETTERS rather than a lone capital:
  // "Nrani" as a bare "N" reads as a bullet, not a mark.
  const s = w.length > 1 ? (w[0][0] ?? "") + (w[1][0] ?? "") : name.slice(0, 2);
  return s.toUpperCase();
}

export default function FindInStore({ list, logos }: { list: Town[]; logos: string[] }) {
  /** the marks that have actually arrived — see availableLogos() in page.tsx.
   *  A shop whose file is not here wears its monogram, which is a designed
   *  state and not a missing image. */
  const hasLogo = (slug?: string) => !!slug && logos.includes(slug);
  const [live, setLive] = useState(false);
  const [canMap, setCanMap] = useState(false);
  /** the chosen TOWN — this is what the country map's pins select */
  const [sel, setSel] = useState<string | null>(null);
  /** exactly one street map may exist, and it is keyed by SHOP: a town now
   *  holds up to three doors, each with its own map. ArmeniaMap already holds
   *  a WebGL context on this page; seven more is how Safari starts dropping
   *  the oldest, and the oldest is Armenia. */
  const [mapOpen, setMapOpen] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  /** the open map's levers, handed up by TownStreet — see the note there for
   *  why the buttons cannot live inside the map */
  const [api, setApi] = useState<StreetApi | null>(null);
  const [flags, setFlags] = useState<Flags>({ canIn: false, canOut: false, moved: false });
  /** where the visitor is, if they asked to be found. Never sent anywhere: it
   *  is used to sort six numbers in this browser and nothing else — in
   *  particular it is NOT put in the outbound directions URL, which would hand
   *  a stranger's coordinates to a third party. */
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<"idle" | "asking" | "denied" | "none">("idle");
  const [canLocate, setCanLocate] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  /** the TOWN whose copy failed, not a bare flag — a shared boolean printed the
   *  failure sentence under all six */
  const [copyBad, setCopyBad] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  /** Computed, never typed. A hand-written "seven shops" is a number that goes
   *  stale the first time she is stocked somewhere new. */
  const shopCount = list.reduce((n, t) => n + t.shops.length, 0);

  useEffect(() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {}
    // Both of these are secure-context APIs, so they are absent on plain http
    // — feature-detected rather than assumed, and the button simply is not
    // rendered rather than being offered and failing.
    setCanLocate(typeof navigator !== "undefined" && "geolocation" in navigator);
    setCanCopy(typeof navigator !== "undefined" && !!navigator.clipboard?.writeText);
    if (!webgl || !window.matchMedia("(scripting: enabled)").matches) return;
    if (window.matchMedia(DESKTOP).matches) setLive(true);
    if (window.matchMedia(WIDE).matches) setCanMap(true);
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  /** THE MAP REPORTS EVERY FRAME OF A PAN. Storing its raw zoom would re-render
   *  this whole six-town list on every mousemove of a drag; what the buttons
   *  actually need is three booleans, so the state is those — and returning the
   *  SAME object when they have not changed is what makes React bail out. */
  const onState = useCallback((s: StreetState) => {
    setFlags((p) => {
      const next = {
        canIn: s.zoom < s.max - 0.01,
        canOut: s.zoom > s.min + 0.01,
        moved: s.moved,
      };
      return p.canIn === next.canIn && p.canOut === next.canOut && p.moved === next.moved ? p : next;
    });
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setGeo("none");
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(at);
        setGeo("idle");
        // choosing the nearest town IS the answer to "where do I go" — and it
        // also turns the country map, so the two agree
        const near = [...list].sort((a, b) => km(at, a) - km(at, b))[0];
        if (near) {
          setSel(near.id);
          document.getElementById(`town-${near.id}`)?.scrollIntoView({ block: "nearest" });
        }
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "none"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [list]);

  const copy = useCallback((s: Stockist, town: string) => {
    // BOTH SCRIPTS, and the Armenian FIRST. Someone pasting this into a taxi
    // app has left the page behind, and the line she sent is the one a driver
    // in Yerevan can actually read; the transliteration follows for everyone
    // else. The shop's name leads, because "Note Mote, Northern Avenue 6/2"
    // is findable in a way a bare house number is not.
    const text = `${s.shop}, ${s.addressAm}, ${town} (${s.address})`;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyBad(null);
        setCopied(s.id);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(null), 2200);
      })
      .catch(() => {
        setCopied(null);
        setCopyBad(s.id);
      });
  }, []);

  /** nearest first, but only as a LABEL — the list keeps its order, because a
   *  list that re-sorts under the hand is a list you have to re-read */
  const nearestId = me ? [...list].sort((a, b) => km(me, a) - km(me, b))[0]?.id : null;

  const onPick = useCallback((id: string) => setSel((p) => (p === id ? null : id)), []);
  /** Always selects, never un-selects. `onPick` is a TOGGLE, which is right for
   *  the town heading — press the chosen one again to let go. It is wrong for
   *  the street-map button: the usual way to want a town's street is to have
   *  chosen the town first, so routing that press through onPick de-selected
   *  the very town whose map was opening. */
  const select = useCallback((id: string) => setSel(id), []);
  const nameOf = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;

  /** open THIS town's street map, closing whichever was open */
  const openMap = useCallback((id: string) => {
    setMapFailed(false);
    // the levers belong to the map that is going away
    setApi(null);
    setFlags({ canIn: false, canOut: false, moved: false });
    setMapOpen(id);
  }, []);

  /** Keyed on what is SHOWN, not on what was asked for. After a failure the
   *  card is collapsed and the button reads "Show the street map" — but
   *  mapOpen is still this id, so a toggle keyed on that would have closed
   *  something already closed and made the label a lie. Passing the visible
   *  state makes the retry the button offers actually retry. */
  const toggleMap = useCallback(
    (id: string, isShown: boolean) => {
      if (isShown) {
        setMapFailed(false);
        setApi(null);
        setFlags({ canIn: false, canOut: false, moved: false });
        setMapOpen(null);
      } else openMap(id);
    },
    [openMap],
  );

  /** A PIN PRESS IS AN ARRIVAL, NOT A TOGGLE (client 2026-08-13: clicking a
   *  town on the country map must light the same town in the list AND open
   *  its street map there). So it always selects, brings the town's card into
   *  view, and opens its street map — pressing the same pin twice stays
   *  arrived rather than packing everything away again. The heading's toggle
   *  behaviour is untouched; letting go still lives there.
   *  Smooth is safe unguarded: pins only exist on the motion-allowed layer. */
  const pickFromMap = useCallback(
    (id: string) => {
      setSel(id);
      // A town now holds up to three doors, so "open its street map" means the
      // FIRST shop's — the arrival still lands on something specific rather
      // than on a heading, and the other two are one press away underneath.
      const first = list.find((t) => t.id === id)?.shops[0];
      if (canMap && first) openMap(first.id);
      // AFTER the commit, not in the handler: scrolling now measures the list
      // as it still is, and the street map about to expand inside the chosen
      // card grows it past what "nearest" just brought into view. Instant on
      // purpose, same as locate(): a smooth scrollIntoView is cancelled by
      // any competing scroll work and then looks like nothing happened —
      // measured doing exactly that here — while a jump cannot be interrupted.
      window.setTimeout(() => {
        document.getElementById(`town-${id}`)?.scrollIntoView({ block: "nearest" });
      }, 90);
    },
    [canMap, openMap, list],
  );

  const nearest = nearestId ? list.find((t) => t.id === nearestId) : undefined;
  const nearSay =
    geo === "denied"
      ? stockistPage.nearDenied
      : geo === "none"
        ? stockistPage.nearNone
        : me && nearest
          ? // "about under 1 km" is not a sentence: the sub-kilometre case needs
            // its own wording rather than a prefix bolted onto the chip's text
            `Nearest: ${nearest.town}, ${
              km(me, nearest) < 1 ? "less than 1 km" : `about ${far(km(me, nearest))}`
            } away. ${stockistPage.nearNote}`
          : "";

  /* THE MAP'S OWN BUTTONS. Rendered here rather than inside TownStreet because
     the map's host is aria-hidden — see LocationCard — and they are the only
     zoom this map has: the wheel is deliberately not taken. Disabled at the
     limits from the map's real state, so "+" at maximum zoom is visibly spent
     rather than silently dead. */
  const controls = (
    <>
      <button
        type="button"
        className="ap-loc__btn"
        onClick={() => api?.zoomIn()}
        disabled={!api || !flags.canIn}
        aria-label={stockistPage.zoomIn}
        title={stockistPage.zoomIn}
      >
        <span aria-hidden>+</span>
      </button>
      <button
        type="button"
        className="ap-loc__btn"
        onClick={() => api?.zoomOut()}
        disabled={!api || !flags.canOut}
        aria-label={stockistPage.zoomOut}
        title={stockistPage.zoomOut}
      >
        <span aria-hidden>−</span>
      </button>
      <button
        type="button"
        className="ap-loc__btn ap-loc__btn--home"
        onClick={() => api?.recentre()}
        disabled={!api || !flags.moved}
        aria-label={stockistPage.recentre}
        title={stockistPage.recentre}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 1v3M12 20v3M1 12h3M20 12h3" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );

  return (
    <div className="ap-map">
      <p className="ap-map__count">
        <b>{stockistPage.count(shopCount, list.length)}</b>
      </p>

      {/* WHICH ONE IS NEAREST — the question the page is really asked. The
          coordinates never leave this browser: they sort six numbers here and
          are not put in any URL. */}
      {canLocate && (
        <div className="ap-map__near">
          <button type="button" className="ap-map__locate" onClick={locate} disabled={geo === "asking"}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3.4" />
              <circle cx="12" cy="12" r="8.4" />
              <path d="M12 1.2v2.6M12 20.2v2.6M1.2 12h2.6M20.2 12h2.6" strokeLinecap="round" />
            </svg>
            {geo === "asking" ? stockistPage.nearAsking : me ? stockistPage.nearAgain : stockistPage.near}
          </button>
          <p className="ap-map__nearsay" role="status">
            {nearSay}
          </p>
        </div>
      )}

      <div className="ap-map__grid">
        {live && (
          <div className="ap-map__hold">
            <ArmeniaMap towns={list} sel={sel} cue={stockistPage.cue} onPick={pickFromMap} />
            <p className="ap-map__credit">{stockistPage.credit}</p>
          </div>
        )}

        <ul className="ap-map__list">
          {list.map((t) => (
            <li
              key={t.id}
              id={`town-${t.id}`}
              className="ap-map__town"
              data-on={sel === t.id || undefined}
            >
              {/* THE TOWN IS A HEADING NOW, not a leaf. It still toggles the
                  selection the country map drives — press the chosen one again
                  to let go — but what it introduces is a list of shops rather
                  than a single address. */}
              <button type="button" onClick={() => onPick(t.id)} aria-pressed={sel === t.id}>
                <strong>{t.town}</strong>
                <span className="ap-map__region">{t.region}</span>
                {/* only after the visitor asked to be found, and always
                    labelled straight-line — the note under the button says
                    it once for the whole list */}
                {me && (
                  <span className="ap-map__km" data-near={t.id === nearestId || undefined}>
                    {far(km(me, t))}
                    {t.id === nearestId && <i> · {stockistPage.nearestTag}</i>}
                  </span>
                )}
                <span className="ap-map__n">
                  {t.shops.length} {t.shops.length === 1 ? "shop" : "shops"}
                </span>
              </button>

              <ul className="ap-map__shops">
                {t.shops.map((s) => {
                  const open = mapOpen === s.id;
                  /** what is actually ON SCREEN. A failure collapses the card
                   *  rather than leaving a blank 244px plate under a real
                   *  address — and it takes the tile attribution with it,
                   *  since crediting tiles that were never drawn is a licence
                   *  line for nothing. */
                  const shown = open && !mapFailed;
                  return (
                    <li key={s.id} className="ap-stk">
                      <div className="ap-stk__head">
                        {/* THE LOGO, or the shop's initials. A mark that has
                            not arrived yet is a designed monogram rather than
                            a hole — see public/stockists/README.md. */}
                        <span
                          className="ap-stk__logo"
                          data-dark={(hasLogo(s.logo) && s.logoDark) || undefined}
                        >
                          {hasLogo(s.logo) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/stockists/${s.logo}.webp`}
                              alt=""
                              width={52}
                              height={52}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="ap-stk__mono" aria-hidden>
                              {initials(s.shop)}
                            </span>
                          )}
                        </span>
                        <div>
                          <h3 className="ap-stk__name">{s.shop}</h3>
                          {/* HER LINE FIRST. `lang` is not decoration: it tells
                              a screen reader to switch voice, and without it
                              Armenian is read out as mangled Latin. */}
                          <p className="ap-stk__am" lang="hy">
                            {s.addressAm}
                          </p>
                          <p className="ap-stk__lat">
                            {s.address} · {t.town}
                          </p>
                        </div>
                      </div>

                      {(s.phone?.trim() || s.hours?.trim() || s.lines.length > 0) && (
                        <div className="ap-map__addr">
                          <dl>
                            {s.phone?.trim() && (
                              <div>
                                <dt>Phone</dt>
                                <dd>
                                  <a href={`tel:${s.phone.replace(/\s+/g, "")}`}>{s.phone}</a>
                                </dd>
                              </div>
                            )}
                            {s.hours?.trim() && (
                              <div>
                                <dt>Open</dt>
                                <dd>{s.hours}</dd>
                              </div>
                            )}
                            {s.lines.length > 0 && (
                              <div>
                                <dt>Carries</dt>
                                <dd>{s.lines.map(nameOf).join(" · ")}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      )}

                      {/* ONE card, ONE control — the card is the frame the real
                          street map arrives in.

                          MOUNTED ONLY WHEN OPEN, which is a change the new list
                          forced. The closed card is a 92px plate captioned with
                          the shop's name, and that was a fair invitation when
                          there was one per town. Seven of them, each repeating
                          a name printed 20px above it, turned the directory
                          into a column of near-empty boxes — the thing you are
                          scanning became the thing you had to scan past. The
                          invitation is the button below instead. */}
                      {shown && (
                      <LocationCard
                        id={`smap-${s.id}`}
                        town={s.shop}
                        lat={s.addressLat}
                        lng={s.addressLng}
                        confirmed
                        open={shown}
                        // Only ever rendered when open, so it is only ever the
                        // attribution the tile licence requires — and empty
                        // when nothing was drawn, since a credit for tiles that
                        // never arrived is a licence line for nothing.
                        caption={shown ? stockistPage.mapCredit : ""}
                        controls={shown ? controls : undefined}
                      >
                        {shown && (
                          // the chunk itself can fail, and next/dynamic will
                          // not catch that — see MapBoundary
                          <MapBoundary onError={() => setMapFailed(true)}>
                            <TownStreet
                              shop={s}
                              onFail={() => setMapFailed(true)}
                              onReady={setApi}
                              onState={onState}
                            />
                          </MapBoundary>
                        )}
                      </LocationCard>
                      )}

                      {/* THE PIN CAN BE APPROXIMATE WHILE THE ADDRESS IS EXACT.
                          One came from the shop, the other from a geocoder, and
                          the difference belongs beside the map — not in a
                          footnote somebody reads after getting off the bus. */}
                      {shown && s.approx && (
                        <p className="ap-stk__approx">{stockistPage.approx}</p>
                      )}

                      <div className="ap-map__acts">
                        {canMap && (
                          <button
                            type="button"
                            className="ap-smap__toggle"
                            // reports what is on screen, not what was asked
                            // for — after a failure nothing is expanded, and
                            // the label offers the retry that pressing it does
                            aria-expanded={shown}
                            aria-controls={`smap-${s.id}`}
                            onClick={() => {
                              select(t.id);
                              toggleMap(s.id, shown);
                            }}
                          >
                            {shown ? stockistPage.mapHide : stockistPage.mapShow}
                            <span aria-hidden>{shown ? "▾" : "▸"}</span>
                          </button>
                        )}

                        {/* HOW TO GET THERE. Every shop here is confirmed, so
                            these point at the door — the old "directions to
                            the town" fallback went with the stand-in
                            addresses that needed it.

                            `from` is left EMPTY on purpose even when the
                            visitor has just located themselves: filling it
                            would put their coordinates in a URL bound for a
                            third party. OSM asks for the start itself. */}
                        <a
                          className="ap-map__dir"
                          href={`https://www.openstreetmap.org/directions?from=&to=${s.addressLat},${s.addressLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {stockistPage.directions} <span aria-hidden>↗</span>
                        </a>

                        {canCopy && (
                          <button
                            type="button"
                            className="ap-smap__toggle"
                            onClick={() => copy(s, t.town)}
                          >
                            {copied === s.id ? stockistPage.copied : stockistPage.copyAddress}
                            <span aria-hidden>{copied === s.id ? "✓" : "⧉"}</span>
                          </button>
                        )}

                        {/* It is deliberately NOT gated on the engine: a phone,
                            a no-JS visitor and anyone without WebGL never get
                            the toggle above, and this link is the whole of
                            their answer. */}
                        <a
                          className="ap-map__dir"
                          href={`https://www.openstreetmap.org/?mlat=${s.addressLat}&mlon=${s.addressLng}#map=18/${s.addressLat}/${s.addressLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {stockistPage.mapLarger} <span aria-hidden>↗</span>
                        </a>
                      </div>

                      {open && (
                        // outside the aria-hidden map, or no screen reader
                        // would ever hear the failure
                        <p className="ap-smap__state" role="status">
                          {mapFailed ? stockistPage.mapFail : ""}
                        </p>
                      )}
                      {copyBad === s.id && (
                        <p className="ap-smap__state" role="status">
                          {stockistPage.copyFail}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
