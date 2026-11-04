// A FORM SENT BEFORE THE PAGE'S SCRIPT HAD STARTED (2026-11-02).
//
// The order, contact and sign-in forms send with fetch once the page is
// running. A press on Send before that does the browser's own submit. With no
// method that was a GET, and the buyer's name, email and phone went into the
// address bar, the history and the server logs. A POST to the page itself is
// no better on Vercel: the pages are prerendered, and Vercel answers a POST to
// one with 405 (a multipart one gets Next's 404 "action not found" — probed on
// the live /terms, 2026-11-02).
//
// So the forms post HERE (`action="/api/early?to=/contact"`), and this sends
// the visitor straight back to that page by GET, with nothing in the address.
// The body is never read: nothing is sent, stored or logged.
//
// …WITH `#not-sent` (2026-11-03, NF-E1/CR4-F1): the page came back as an
// empty form, which looks just like a form cleared after a message went. The
// contact and sign-in forms read the fragment once they run, say that nothing
// was sent, and take it off the address. A fragment never reaches a server
// or a log.
export const dynamic = "force-dynamic";

/** a path on this site only — never `//host` or `/\host`, which a browser
 *  would follow to another site (an open redirect) */
const SAFE = /^\/(?![/\\])[\w\-./#]*$/;

export function POST(req: Request) {
  const to = new URL(req.url).searchParams.get("to") ?? "/";
  const back = SAFE.test(to) ? to : "/";
  // the home page has no form, and a path with its own fragment keeps it
  const say = back !== "/" && !back.includes("#") ? `${back}#not-sent` : back;
  return new Response(null, {
    status: 303,
    headers: { Location: say, "Cache-Control": "no-store" },
  });
}
