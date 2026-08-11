"use client";

import { useEffect, useRef } from "react";
import { Map, MapMarker, MarkerContent, MarkerTooltip, useMap } from "./StreetMap";
import { stockistPage, type Stockist } from "@/lib/content";

// ============================================================================
// TOWN STREET MAP — the ArpenArt side of the ported mapcn component.
//
// This module is the ONLY thing that names maplibre-gl, and FindInStore
// imports it with next/dynamic behind a button. Deliberate on two counts: the
// engine is ~1 MB, and the moment it runs it fetches tiles from CARTO — the
// single third-party request this site makes. Nobody pays either cost for a
// page they came to read six addresses on.
//
// ONE TOWN PER MAP, and FindInStore permits exactly one open at a time. Six
// live WebGL contexts on a page that already spends one on the country map is
// how Safari starts silently dropping the oldest — and the one it drops is
// Armenia.
//
// ACCESSIBILITY SHAPE, and it constrains the markup more than it looks:
// the canvas host is aria-hidden, so it must contain NOTHING focusable, or the
// page ships a tab stop screen readers are told to ignore. That rules out
// maplibre's keyboard handler, its navigation control, and — the one that
// caught me — the ported MarkerContent's <button> mode. The marker here is
// inert decoration. Everything the map MEANS (shop, street, town, coordinates)
// is real text above it, and the way out is a real link below it.
// ============================================================================

/** OpenFreeMap's Positron fork — see the note in next.config.mjs for why not
 *  CARTO (commercial licence) and not OSM raster (usage policy). Positron is
 *  the palest of the three styles, which matters when it has to sit on cream
 *  paper beside her paintings.
 *
 *  ATTRIBUTION IS A LICENCE CONDITION, not decoration. maplibre's own control
 *  would render it from the TileJSON, but that control is focusable and this
 *  map's host is aria-hidden — so the control is off and the exact required
 *  wording is printed as real text in the panel instead. If you ever remove
 *  that line, put this control back. */
const STYLE = "https://tiles.openfreemap.org/styles/positron";

// Failure detection used to live here, in a child that called useMap(). It was
// moved into <Map> itself, because a child cannot subscribe in time: maplibre
// begins fetching the style inside its constructor, and this component does not
// mount until React has re-rendered with the map in context. A tile host that
// fails immediately — the exact case the failure text exists for — would raise
// its error into a listener that did not exist yet, and the card would sit on
// the loading dots forever saying nothing.

/** What the map can be asked to do from outside it. FindInStore imports these
 *  two with `import type` — and it must stay that way, or a value import from
 *  this module would drag maplibre-gl and its 70 KB stylesheet out of the
 *  dynamic chunk and into the page everyone downloads. */
export type StreetApi = { zoomIn: () => void; zoomOut: () => void; recentre: () => void };
export type StreetState = { zoom: number; min: number; max: number; moved: boolean };

/** THE CONTROLS ARE NOT RENDERED HERE. Everything inside this component sits
 *  in an aria-hidden host, and a <button> in there is a tab stop screen
 *  readers are told to ignore — the same rule that already keeps maplibre's own
 *  NavigationControl off this map. So the map hands its levers upward and
 *  FindInStore renders real buttons in the light. It reports its own zoom too,
 *  so a "+" at maximum zoom can be properly disabled rather than dead.
 *
 *  <Map> renders `{map && children}`, so this only ever mounts with a map. */
function Levers({
  home,
  onReady,
  onState,
}: {
  home: [number, number];
  onReady: (api: StreetApi | null) => void;
  onState: (s: StreetState) => void;
}) {
  const { map } = useMap();
  // the callbacks are held in a ref so a caller passing inline arrows cannot
  // re-subscribe the map's listeners on every render
  const cb = useRef({ onReady, onState });
  cb.current = { onReady, onState };
  const [hx, hy] = home;

  useEffect(() => {
    if (!map) return;
    const report = () => {
      const c = map.getCenter();
      cb.current.onState({
        zoom: map.getZoom(),
        min: map.getMinZoom(),
        max: map.getMaxZoom(),
        // "moved" is about the DOOR leaving the middle, not about any pan at
        // all: eased recentring lands within a rounding error of home, and a
        // recentre button that stays enabled for ever is a broken one
        moved: Math.abs(c.lng - hx) > 1e-5 || Math.abs(c.lat - hy) > 1e-5,
      });
    };
    map.on("move", report);
    map.on("zoom", report);
    report();
    cb.current.onReady({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      recentre: () => map.easeTo({ center: [hx, hy], zoom: 16, duration: 460 }),
    });
    return () => {
      map.off("move", report);
      map.off("zoom", report);
      cb.current.onReady(null);
    };
  }, [map, hx, hy]);

  return null;
}

export default function TownStreet({
  town,
  onFail,
  onReady,
  onState,
}: {
  town: Stockist;
  /** reported UP rather than rendered here: this component lives inside an
   *  aria-hidden host, so a failure sentence printed in place is one no screen
   *  reader would ever read out. FindInStore prints it outside. */
  onFail: () => void;
  onReady: (api: StreetApi | null) => void;
  onState: (s: StreetState) => void;
}) {
  const confirmed = town.shop.trim().length > 0;
  // the DOOR, not the town centre — the country map marks the centre, and this
  // map exists precisely to answer the question the centre cannot
  const lng = town.addressLng ?? town.lng;
  const lat = town.addressLat ?? town.lat;

  return (
    <Map
      style={STYLE}
      center={[lng, lat]}
      zoom={16}
      minZoom={11}
      maxZoom={18}
      // a map that eats the wheel traps the reader inside a six-item list
      scrollZoom={false}
      dragRotate={false}
      pitchWithRotate={false}
      touchZoomRotate={false}
      // no focusable descendants under an aria-hidden host
      keyboard={false}
      // credited as real text in the panel instead, where it is legible
      attributionControl={false}
      // honest under reduced motion by construction, not by branch
      fadeDuration={0}
      loadingLabel={stockistPage.mapLoading}
      onError={onFail}
    >
      <Levers home={[lng, lat]} onReady={onReady} onState={onState} />
      <MapMarker longitude={lng} latitude={lat}>
        <MarkerContent>
          <span className="ap-mlm__dot" data-soon={!confirmed || undefined} />
        </MarkerContent>
        {/* Pinned open: there is one pin and it is the point of the card.
            It does NOT repeat the town — the card names that 60px below, and
            in a 244px frame the tooltip was the loudest thing on screen. What
            it carries is what the card cannot: which shop is at the pin, or
            that nothing is confirmed there yet. */}
        <MarkerTooltip open>
          {confirmed ? (
            <b>{town.shop}</b>
          ) : (
            <span>{town.placeholder ? stockistPage.pinPlaceholder : stockistPage.empty}</span>
          )}
        </MarkerTooltip>
      </MapMarker>
    </Map>
  );
}
