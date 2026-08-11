import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import { brand } from "@/lib/content";
import TextFX from "@/components/TextFX";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return (
    <>
      <Chrome />
      <div className="ap-sec ap-shop">
        <div className="ap-sec__head">
          <h1 className="ap-h2">PRIVACY</h1>
          <p className="ap-lede">
            This site collects only what you type into its two forms: your name, your email, your
            message, and — for an order — which items you chose.
          </p>
        </div>
        <div style={{ display: "grid", gap: 16, maxWidth: "62ch" }}>
          <p>It is used to reply to you and to prepare your order. It is not sold, and it is not
          passed to advertisers.</p>
          <p>Your cart is stored in your own browser and never leaves it until you press send.</p>
          <p>No analytics or tracking scripts run on this site.</p>
          {/* The street map is the only thing here that talks to anyone else.
              Saying so is not optional: the page above promises no tracking,
              and a visitor cannot see a tile request the way they can see a
              form. It is opt-in — the map loads nothing until pressed. */}
          <p>
            One page — <a href="/find-in-store">Find in store</a> — can show a street map. It stays
            off until you press &ldquo;Show the street map&rdquo;. If you do, the map is drawn from
            tiles fetched from OpenFreeMap, which is outside this site: it receives your IP address
            and which part of the map you looked at. OpenFreeMap sets no cookies and asks for no
            account. Nothing else about you is sent, and no other page here contacts anyone.
          </p>
          <p>To have anything you sent deleted, email <a href={"mailto:" + brand.email}>{brand.email}</a>.</p>
        </div>
      </div>
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}