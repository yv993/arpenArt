"use client";

import maplibregl from "maplibre-gl";
import type {
  MapOptions,
  MarkerOptions,
  PopupOptions,
  StyleSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";
// ~70 KB of unowned global `.maplibregl-*` rules entering a codebase whose
// entire surface is hand-written `ap-`-prefixed CSS. It is imported anyway,
// and deliberately: marker and popup POSITIONING is intricate (anchor classes,
// transform origins, per-anchor tip geometry) and hand-copying a subset of it
// is how you ship a tooltip that drifts at certain zoom levels. Because this
// module is only ever reached through a dynamic import, Next emits the sheet
// into that chunk — nobody who never opens a map downloads a byte of it.
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// ============================================================================
// STREET MAP — the supplied "mapcn-marker-tooltip" component, ported.
//
// The composable shape is kept verbatim, because it is the good part: one map
// instance can carry any number of markers, each owning its own content and
// tooltip, and each piece portals into DOM that maplibre positions for it.
// What changed is everything Tailwind/shadcn: classes are plain `ap-mlm*`, the
// theme tokens are the palette measured from Arpine's paintings, and the
// loader is this site's own.
//
// Six corrections of substance, all of them real defects rather than taste:
//
//  1. The marker was built in `useMemo(…, [])`. useMemo is a performance hint,
//     not a guarantee — React may discard the cache and re-run it, which would
//     silently orphan a marker that is already on the map. Lazy `useState`
//     initialisers ARE guaranteed to run once.
//  2. The marker was MUTATED DURING RENDER (`marker.setLngLat(...)` in the
//     component body). Under React 19 concurrent rendering a render can be
//     discarded, so the map would move for a render that never commits. Moved
//     into an effect.
//  3. `marker.on("dragstart"|"drag"|"dragend")` and the three DOM listeners
//     were never removed. They are now, on unmount.
//  4. The `viewport` effect depended on OBJECT IDENTITY, so a caller passing
//     an inline `viewport={{...}}` literal re-ran `jumpTo` every render — a
//     map that cannot be panned. It compares VALUES now.
//  5. Markers were undecorated `<div>`s: unreachable by keyboard and invisible
//     to a screen reader, and the tooltip only ever opened on `mouseenter`.
//     MarkerContent renders a real `<button>` when given an onSelect, and the
//     tooltip opens on focus as well as hover.
//  6. `useImperativeHandle` cast a possibly-null map to `Map`. The ref type is
//     honest about the null now.
//
// SSR NOTE — do not "tidy" this away: `MapMarker` calls document.createElement
// during render, which would throw on the server. It never runs there because
// `<Map>` renders `{map && children}` and `map` is null until an effect. That
// guard is load-bearing.
// ============================================================================

type MapStyleOption = string | StyleSpecification;

type MapContextValue = { map: MapLibreMap | null; isLoaded: boolean };
const MapContext = createContext<MapContextValue | null>(null);

export function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap must be used within <Map>");
  return ctx;
}

// The original carried a whole theme system — a light/dark style pair, a
// MutationObserver on <html>, and a prefers-color-scheme listener. It is
// deleted rather than ported. This site HAS no theme: --paper is a measured
// colour taken from Arpine's paintings, there is no .dark class anywhere in
// app/*.css, and a second style sheet nobody can reach is just a second thing
// to keep working. `style` is a single required prop for the same reason: so
// no CDN default can be inherited by accident.

type MapProps = {
  children?: ReactNode;
  className?: string;
  style: MapStyleOption;
  loading?: boolean;
  loadingLabel?: string;
  /** Fired for a failure that arrives BEFORE the style has loaded, i.e. one
   *  there is no map to survive. Errors after load are single missing tiles
   *  and are swallowed — tearing a drawn map down over one 404 would be worse
   *  than the gap. Must be attached where the map is CONSTRUCTED: a child
   *  component cannot subscribe in time, because it does not mount until the
   *  constructor has already started fetching the style. */
  onError?: () => void;
} & Omit<MapOptions, "container" | "style">;

function Loader({ label }: { label: string }) {
  return (
    <div className="ap-mlm__load" role="status">
      <span className="ap-mlm__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="ap-sr">{label}</span>
    </div>
  );
}

export const Map = forwardRef<MapLibreMap | null, MapProps>(function Map(
  { children, className, style, loading = false, loadingLabel = "Loading the map", onError, ...options },
  ref,
) {
  const holder = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // the constructor options are read ONCE; a ref says so out loud, where an
  // empty dep array would merely hide it from the linter
  const initial = useRef({ options, style });
  const fail = useRef(onError);
  fail.current = onError;

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const boot = initial.current;

    const m = new maplibregl.Map({
      container: el,
      style: boot.style,
      renderWorldCopies: false,
      ...boot.options,
    });

    // `load` fires once and means the style is in and the first frame is
    // painted. The original watched `styledata` behind a 100ms timer, but
    // styledata is not one-shot — it fires again for every layer change — so
    // that flag flipped true on the first partial style and could flip back.
    // maplibre puts tabindex="0" on its canvas whatever `keyboard` says, and a
    // caller may host this map in an aria-hidden box — which would leave a tab
    // stop screen readers are explicitly told to ignore. Measured, not assumed:
    // a focusable-descendant probe found exactly this one element. Keyboard
    // users lose nothing, because `keyboard: false` already meant the canvas
    // answered no keys.
    m.getCanvas().setAttribute("tabindex", "-1");

    let up = false;
    const onLoad = () => {
      up = true;
      setIsLoaded(true);
    };
    // Attached on the line after construction, which is still before any
    // network response can land — this is the whole reason the listener lives
    // here and not in a child.
    const onBad = () => {
      if (!up) fail.current?.();
    };
    m.on("error", onBad);
    if (m.loaded()) onLoad();
    else m.on("load", onLoad);

    setMap(m);

    return () => {
      m.off("load", onLoad);
      m.off("error", onBad);
      m.remove();
      setMap(null);
      setIsLoaded(false);
    };
  }, []);

  // Honest about the null: the map does not exist until an effect has run, so
  // a caller holding this ref on first render gets null and has to say what it
  // wants to do about that. The generics are explicit because inference reads
  // `Ref<Map | null>` as `Ref<Map>` — which would quietly restore the very
  // `as Map` cast this replaced.
  useImperativeHandle<MapLibreMap | null, MapLibreMap | null>(ref, () => map, [map]);

  const value = useMemo(() => ({ map, isLoaded }), [map, isLoaded]);

  return (
    <MapContext.Provider value={value}>
      <div ref={holder} className={["ap-mlm", className].filter(Boolean).join(" ")}>
        {(!isLoaded || loading) && <Loader label={loadingLabel} />}
        {/* load-bearing: markers touch `document` during render, so they must
            not exist until the map does — which is never on the server */}
        {map && children}
      </div>
    </MapContext.Provider>
  );
});

type MarkerContextValue = { marker: maplibregl.Marker; map: MapLibreMap | null };
const MarkerContext = createContext<MarkerContextValue | null>(null);

function useMarker() {
  const ctx = useContext(MarkerContext);
  if (!ctx) throw new Error("Marker parts must be used within <MapMarker>");
  return ctx;
}

type MapMarkerProps = {
  longitude: number;
  latitude: number;
  children: ReactNode;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, "element">;

export function MapMarker({
  longitude,
  latitude,
  children,
  onDragEnd,
  draggable = false,
  ...markerOptions
}: MapMarkerProps) {
  const { map } = useMap();
  const cb = useRef({ onDragEnd });
  cb.current = { onDragEnd };

  // a lazy useState initialiser is guaranteed to run exactly once; useMemo is
  // not, and an orphaned marker is a marker stuck on the map forever
  const [marker] = useState(() =>
    new maplibregl.Marker({
      ...markerOptions,
      element: document.createElement("div"),
      draggable,
    }).setLngLat([longitude, latitude]),
  );

  useEffect(() => {
    if (!map) return;
    const onEnd = () => {
      const l = marker.getLngLat();
      cb.current.onDragEnd?.({ lng: l.lng, lat: l.lat });
    };
    marker.on("dragend", onEnd);
    marker.addTo(map);
    return () => {
      marker.off("dragend", onEnd);
      marker.remove();
    };
  }, [map, marker]);

  // position and draggability are SIDE EFFECTS — doing them in the render body
  // moves the map for renders React may still throw away
  useEffect(() => {
    const at = marker.getLngLat();
    if (at.lng !== longitude || at.lat !== latitude) marker.setLngLat([longitude, latitude]);
  }, [marker, longitude, latitude]);

  useEffect(() => {
    if (marker.isDraggable() !== draggable) marker.setDraggable(draggable);
  }, [marker, draggable]);

  const value = useMemo(() => ({ marker, map }), [marker, map]);
  return <MarkerContext.Provider value={value}>{children}</MarkerContext.Provider>;
}

type MarkerContentProps = {
  children?: ReactNode;
  className?: string;
  /** given, the marker becomes a real button — reachable by keyboard, which
   *  the original's bare <div> never was */
  onSelect?: () => void;
  label?: string;
  selected?: boolean;
};

export function MarkerContent({ children, className, onSelect, label, selected }: MarkerContentProps) {
  const { marker } = useMarker();
  const cls = ["ap-mlm__pin", className].filter(Boolean).join(" ");

  return createPortal(
    onSelect ? (
      <button type="button" className={cls} onClick={onSelect} aria-label={label} aria-pressed={selected}>
        {children}
      </button>
    ) : (
      <div className={cls}>{children}</div>
    ),
    marker.getElement(),
  );
}

type MarkerTooltipProps = {
  children: ReactNode;
  className?: string;
  /** keep it open regardless of pointer — used for the town currently chosen */
  open?: boolean;
} & Omit<PopupOptions, "className" | "closeButton" | "closeOnClick">;

export function MarkerTooltip({ children, className, open, ...popupOptions }: MarkerTooltipProps) {
  const { marker, map } = useMarker();
  const container = useMemo(() => document.createElement("div"), []);
  const [tooltip] = useState(
    () =>
      new maplibregl.Popup({
        offset: 18,
        ...popupOptions,
        closeOnClick: false,
        closeButton: false,
      }).setMaxWidth("none"),
  );
  const pinned = useRef(false);
  pinned.current = !!open;

  useEffect(() => {
    if (!map) return;
    tooltip.setDOMContent(container);
    const el = marker.getElement();
    const show = () => tooltip.setLngLat(marker.getLngLat()).addTo(map);
    const hide = () => {
      if (!pinned.current) tooltip.remove();
    };
    // focus/blur as well as hover: a tooltip only a mouse can summon is a
    // tooltip half this site's visitors never see
    el.addEventListener("mouseenter", show);
    el.addEventListener("mouseleave", hide);
    el.addEventListener("focusin", show);
    el.addEventListener("focusout", hide);
    return () => {
      el.removeEventListener("mouseenter", show);
      el.removeEventListener("mouseleave", hide);
      el.removeEventListener("focusin", show);
      el.removeEventListener("focusout", hide);
      tooltip.remove();
    };
  }, [container, map, marker, tooltip]);

  // the chosen town keeps its label up without a pointer on it
  useEffect(() => {
    if (!map) return;
    if (open) tooltip.setLngLat(marker.getLngLat()).addTo(map);
    else tooltip.remove();
  }, [open, map, marker, tooltip]);

  return createPortal(
    <div className={["ap-mlm__tip", className].filter(Boolean).join(" ")}>{children}</div>,
    container,
  );
}

export type { MapLibreMap };
