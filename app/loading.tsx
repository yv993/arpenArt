// ROUTE LOADING — what a visitor sees while a page's data and chunks arrive.
//
// The site had none. Every navigation was silent: on a slow connection you
// pressed a link and nothing happened until the next page simply appeared.
//
// ANATOMY borrowed from feturesss21/by-function/loaders (animata's split-reveal
// preloader): a paper shutter over the page and a hairline progress track.
// Ported, not copied — that set is Tailwind + a `cn()` helper + a context
// provider across ten files, and this project is plain CSS with a three-package
// budget. What is kept is the shape; what is written is ours.
//
// THE TRACK IS INDETERMINATE, DELIBERATELY. The split-reveal original takes a
// `progress` number and draws it as a width. Next's route loading UI has no
// such number — this renders while a segment suspends and nothing reports how
// far along that is. Drawing a percentage would be inventing one, so the
// hairline sweeps instead: it says "working", which is true, rather than "43%",
// which would not be.
//
// No client hooks, so it stays a server component and costs no JS.
export default function Loading() {
  return (
    <div className="ap-load" role="status" aria-live="polite">
      <span className="ap-load__mark" aria-hidden="true">
        ArpenArt
      </span>
      <span className="ap-load__track" aria-hidden="true">
        <i />
      </span>
      <span className="ap-sr">Loading the page</span>
    </div>
  );
}
