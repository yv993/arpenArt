"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A BUTTON POSTING, not a link. Signing out changes state, so it must not be
// something a prefetcher, a mail scanner or an <img> on another site can
// trigger by fetching a URL.
//
// IT SAYS WHEN IT DID NOT WORK (2026-11-03, peer review #3). Offline, the
// fetch threw out of a try with no catch — an unhandled rejection, the
// button came back and nothing was said. A refused answer (403) refreshed
// the page and left the visitor signed in, again with no word. Now only an
// ok answer refreshes; anything else says so beside the button.
export default function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ap-auth__ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            const res = await fetch("/api/auth/signout", { method: "POST" });
            if (!res.ok) throw new Error(String(res.status));
            router.refresh();
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      <span className="ap-auth__err" role="alert">
        {failed ? "That did not sign you out. Check your connection and try again." : ""}
      </span>
    </>
  );
}
