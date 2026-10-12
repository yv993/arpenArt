import type { Metadata } from "next";
import Link from "next/link";
import Chrome from "@/components/Chrome";

// A 404 OF ITS OWN NAME (2026-10-05). Every miss carried the home page's
// title, "ArpenArt — Armenia, drawn by hand", so a tab, a history entry or a
// screen reader announcing the page said nothing had gone wrong (WCAG 2.4.2).
// Through the metadata export, not a <title> in the body: the layout's
// template makes it "Not found — ArpenArt", and the page ships ONE title —
// a hoisted <title> element sat in front of the layout's own two copies.
export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <>
      <Chrome />
      <div className="ap-sec ap-shop">
        <div className="ap-sec__head">
          <h1 className="ap-h2">NOT HERE</h1>
          <p className="ap-lede">That page does not exist — but the shop does.</p>
        </div>
        <Link className="ap-btn" href="/shop">Go to the shop</Link>
      </div>
    </>
  );
}
