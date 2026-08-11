// The heaviest route on the site: a category page mounts GSAP scroll rigs, a
// drift gallery of ten photographs and — on /shop/postcards — a WebGL deck.
// The root app/loading.tsx would cover this too, but a segment-level file lets
// Next show it the moment THIS segment suspends rather than waiting for the
// whole tree, which is the difference between feedback and a frozen link.
import Loading from "../../loading";

export default Loading;
