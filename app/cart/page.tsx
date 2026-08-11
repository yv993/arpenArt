import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import CartView from "@/components/CartView";
import CartPlate from "@/components/CartPlate";
import TextFX from "@/components/TextFX";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <>
      <Chrome />
      {/* FIRST, so every layer of the cart paints over it. The plate only
          appears on desktop with motion allowed — it sets `data-plate` on
          .ap-cart itself, and the stylesheet hangs off that. */}
      <CartPlate />
      <CartView />
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
