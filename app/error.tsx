"use client";

import { useEffect } from "react";
import Chrome from "@/components/Chrome";
import { brand } from "@/lib/content";

// Route-level error boundary: a page render threw, the layout survived. Same
// chrome and voice as not-found.tsx — the failure page should still feel like
// the site, not like the framework.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error service is wired up; the console is the honest place for it.
    console.error(error);
  }, [error]);

  return (
    <>
      <Chrome />
      <div className="ap-sec ap-shop">
        <div className="ap-sec__head">
          <h1 className="ap-h2">SOMETHING BROKE</h1>
          <p className="ap-lede">This page hit an error. Trying again usually clears it.</p>
        </div>
        <button type="button" className="ap-btn" onClick={reset}>
          Try again
        </button>
        <p className="ap-lede">
          Still broken? Write to <a href={`mailto:${brand.email}`}>{brand.email}</a> and Arpine
          will sort it out.
        </p>
      </div>
    </>
  );
}
