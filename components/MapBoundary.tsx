"use client";

import { Component, type ReactNode } from "react";

// ============================================================================
// A boundary around the lazily-imported map, and nothing else.
//
// `next/dynamic` is React.lazy + Suspense with NO error handling: a rejected
// chunk fetch throws straight past it to the nearest boundary, which here is
// app/error.tsx — so a failed 250 KB download would replace the entire
// stockist page (addresses, phone links, the OSM links, the country map) with
// "SOMETHING BROKE". The canonical way to hit that is mundane: leave the page
// open across a deploy, then press the toggle, and the chunk filename it asks
// for no longer exists.
//
// The map's own failure path cannot catch this. `onError` is wired to a
// maplibre event, and maplibre has to have LOADED to raise one.
//
// So: the optional thing fails alone, and degrades into the same sentence a
// dead tile host already produces. This is a class because error boundaries
// have no hook equivalent — getDerivedStateFromError is the only API there is.
// ============================================================================

export default class MapBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { dead: boolean }
> {
  state = { dead: false };

  static getDerivedStateFromError() {
    return { dead: true };
  }

  componentDidCatch() {
    // hands the parent the same flag a maplibre failure sets, so there is one
    // failure state and one sentence rather than two
    this.props.onError();
  }

  render() {
    return this.state.dead ? null : this.props.children;
  }
}
