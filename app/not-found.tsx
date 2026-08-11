import Link from "next/link";
import Chrome from "@/components/Chrome";

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