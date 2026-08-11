import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import CartView from "@/components/CartView";
import CartPlate from "@/components/CartPlate";

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
    </>
  );
}
