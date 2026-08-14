"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A BUTTON POSTING, not a link. Signing out changes state, so it must not be
// something a prefetcher, a mail scanner or an <img> on another site can
// trigger by fetching a URL.
export default function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="ap-auth__ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/signout", { method: "POST" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
