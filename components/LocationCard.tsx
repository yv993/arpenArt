"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

// ============================================================================
// LOCATION CARD — the supplied LocationMap component, ported, and now a frame
// for the REAL map rather than a drawing of one.
//
// It began as a faithful port: motion springs → gsap.quickTo, Tailwind →
// .ap-loc*, and an invented street grid that drew itself when the card opened.
// That grid is GONE (client 2026-08-06: pressing "Show the street map" must
// give the real thing "instead of" the schematic). Once a page carries actual
// OpenStreetMap tiles for an address, a hand-drawn approximation of the same
// address is not a second feature, it is a contradiction — and the caption
// that used to excuse it ("Schematic — the pin marks the town centre") was
// only ever load-bearing while no real map existed.
//
// What survives is what the component was actually for: the plate, its measured
// palette, the status chip, the hover tilt, the name and coordinates, and the
// height transition. The card is now PRESENTATIONAL — FindInStore owns the
// open state and the button, so there is exactly one control per town instead
// of a card that expanded one way and a link that expanded another.
//
// Not a <button> any more, and that is structural, not stylistic: an
// interactive, draggable map cannot live inside a button element.
// ============================================================================

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/** decimal degrees → the form people actually read on a map */
function dms(lat: number, lng: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

export default function LocationCard({
  id,
  town,
  lat,
  lng,
  confirmed,
  open,
  caption,
  controls,
  children,
}: {
  id: string;
  town: string;
  /** the DOOR's coordinates when there is an address — this is what the map
   *  inside is centred on, so printing the town centre here would caption the
   *  picture with the wrong place */
  lat: number;
  lng: number;
  confirmed: boolean;
  open: boolean;
  /** when open this carries the tile service's attribution, which is a licence
   *  condition and not decoration */
  caption: string;
  /** The map's own buttons — zoom and recentre — laid OVER the map but
   *  deliberately OUTSIDE `.ap-loc__canvas`, which is aria-hidden. A control
   *  in there would be a tab stop screen readers are told to ignore, which is
   *  the same reason maplibre's NavigationControl is off. Rendered only while
   *  open: buttons for a map that is not on screen are three more tab stops
   *  that do nothing. */
  controls?: ReactNode;
  /** the live map. Rendered by the parent so this file never reaches maplibre */
  children?: ReactNode;
}) {
  const plate = useRef<HTMLDivElement>(null);
  const tilt = useRef<{ x: (v: number) => void; y: (v: number) => void } | null>(null);

  // The tilt is a pointer affordance for the CLOSED card: desktop only, never
  // for someone who asked for less motion, and never while the map is open —
  // tilting a live canvas would fight the drag and skew the tiles.
  useEffect(() => {
    if (open) {
      tilt.current = null;
      if (plate.current) gsap.set(plate.current, { clearProps: "transform" });
      return;
    }
    if (!window.matchMedia(DESKTOP).matches) return;
    const el = plate.current;
    if (!el) return;
    tilt.current = {
      x: gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3" }),
      y: gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3" }),
    };
    return () => {
      tilt.current = null;
      gsap.set(el, { clearProps: "transform" });
    };
  }, [open]);

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const t = tilt.current;
    if (!t) return;
    const r = e.currentTarget.getBoundingClientRect();
    // ±8° at 50px from centre, exactly the original's useTransform range
    t.x(gsap.utils.clamp(-8, 8, -((e.clientY - (r.top + r.height / 2)) / 50) * 8));
    t.y(gsap.utils.clamp(-8, 8, ((e.clientX - (r.left + r.width / 2)) / 50) * 8));
  }, []);

  const level = useCallback(() => {
    tilt.current?.x(0);
    tilt.current?.y(0);
  }, []);

  return (
    <div
      id={id}
      className="ap-loc"
      data-open={open || undefined}
      onPointerMove={onMove}
      onPointerLeave={level}
    >
      <div className="ap-loc__plate" ref={plate}>
        {/* the real map, when the parent has opened it. aria-hidden with
            nothing focusable inside — see the note in TownStreet.tsx */}
        <div className="ap-loc__canvas" aria-hidden="true">
          {children}
        </div>

        {open && controls && <div className="ap-loc__ctl">{controls}</div>}

        {/* abstract graph paper for the closed state. Deliberately NOT streets:
            it is texture, and texture cannot be mistaken for a claim. */}
        <span className="ap-loc__grid" aria-hidden="true" />

        <div className="ap-loc__body">
          <div className="ap-loc__top">
            <svg
              className="ap-loc__icon"
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" x2="9" y1="3" y2="18" />
              <line x1="15" x2="15" y1="6" y2="21" />
            </svg>
            {/* the original's "LIVE" would be a claim; this is the real state */}
            <span className="ap-loc__chip" data-on={confirmed || undefined}>
              <i />
              {confirmed ? "Confirmed" : "Arranging"}
            </span>
          </div>

          <div className="ap-loc__foot">
            <span className="ap-loc__name">{town}</span>
            {/* CONDITIONAL, not merely clipped. These used to be present
                always and hidden with max-height:0 + opacity:0 — invisible,
                but still read out, so a closed card recited coordinates and a
                tile credit for a map that had never loaded, and the toggle's
                aria-expanded promised a reveal that changed nothing a screen
                reader could perceive. Opening the card now genuinely adds
                content. */}
            {open && (
              <>
                <span className="ap-loc__co">{dms(lat, lng)}</span>
                {caption && <span className="ap-loc__cap">{caption}</span>}
              </>
            )}
            <span className="ap-loc__rule" />
          </div>
        </div>
      </div>
    </div>
  );
}
