import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import { brand } from "@/lib/content";
import TextFX from "@/components/TextFX";
import { pageMeta } from "@/lib/seo";

// indexable and in the sitemap, so it gets its own snippet, canonical and card
export const metadata: Metadata = pageMeta({
  title: "Terms",
  description: `The terms that apply when you order from ${brand.name}.`,
  path: "/terms",
});

// ONLY FACTS WE HAVE (readiness #10, 2026-10-31). The seller line below is
// built from `brand` (her name, her town, her address) — nothing typed here.
//
// STILL MISSING, AND ARPINE'S TO GIVE — do NOT write these from a template;
// a policy she never agreed to binds her all the same
// (docs/QUESTIONS-FOR-ARPINE.md lists them for her):
//   1. HOW BUYERS PAY — cash, bank transfer, Idram, card? (also one line in
//      `ordering.steps` in lib/content.ts, which today says only "you pay
//      only after her confirmation")
//   2. RETURNS / EXCHANGES — accepted or not, within how many days, who pays
//      the postage back
//   3. CANCELLING — until when a confirmed order can be cancelled (for
//      example before it is made or posted)
//   4. DAMAGED OR LOST IN THE POST — replace, refund, or the carrier's claim
//   5. THE SELLER AS SHE WANTS IT SHOWN — her own name as now, or a
//      registered business name (and any registration number her accountant
//      says must appear)
//   6. DELIVERY — the real rates, times and carriers (lib/content.ts
//      `delivery.options`, marked PLACEHOLDER there) and, for international
//      post, who pays customs
// When she answers, add each as its own short paragraph in this same plain
// voice, and keep every existing sentence as it is.

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
          <p>
            <strong>Who sells:</strong> {brand.artist}, {brand.place} —{" "}
            <a href={"mailto:" + brand.email}>{brand.email}</a>.
          </p>
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
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}