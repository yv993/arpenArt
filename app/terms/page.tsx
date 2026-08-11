import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import { brand } from "@/lib/content";

export const metadata: Metadata = { title: "Terms" };

export default function Page() {
  return (
    <>
      <Chrome />
      <div className="ap-sec ap-shop">
        <div className="ap-sec__head">
          <h1 className="ap-h2">TERMS</h1>
          <p className="ap-lede">Short, because the arrangement is simple.</p>
        </div>
        <div style={{ display: "grid", gap: 16, maxWidth: "62ch" }}>
          <p>Every illustration on this site is the work of {brand.artist} and remains hers.
          Buying an object does not transfer any right to reproduce the artwork on it.</p>
          <p>Sending an order here is a request, not a purchase. Nothing is charged on this site.
          Arpine replies to confirm what is available, the final price and the postage before
          anything is made or sent.</p>
          <p>Prices shown are before postage and may change; the figure confirmed in her reply is
          the one that applies.</p>
          <p>Painted pieces are finished by hand, so each differs slightly. That is the point of
          them, not a fault.</p>
          <p>Questions: <a href={"mailto:" + brand.email}>{brand.email}</a>.</p>
        </div>
      </div>
    </>
  );
}