import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import Chrome from "@/components/Chrome";
import AuthUI from "@/components/AuthUI";
import SignOut from "@/components/SignOut";
import { authReady, readSession, SESSION_COOKIE } from "@/lib/server/auth";
import { brand } from "@/lib/content";

// NOINDEX, and not because the page is secret: it is a sign-in screen, and a
// search result leading to one is a result leading nowhere. The sitemap does
// not list it either.
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NOTE: Record<string, string> = {
  bad: "That link has expired or was already used. Ask for a fresh one.",
  off: "Sign-in is not switched on for this site yet.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const ready = authReady();
  const jar = await cookies();
  const who = ready ? readSession(jar.get(SESSION_COOKIE)?.value) : null;

  if (who) {
    return (
      <>
        <Chrome />
        <div className="ap-acct">
          <div className="ap-acct__who">
            <p className="ap-kicker">(Your account)</p>
            <strong>{who.name || "Signed in"}</strong>
            <span>{who.email}</span>
          </div>

          {/* WHAT THIS ACCOUNT ACTUALLY DOES, stated plainly. There is no
              order history here because there is no database to keep one
              in — saying so is better than a page that looks like it lost
              the visitor's orders. */}
          <div className="ap-acct__facts">
            <p>
              Your name and email are remembered on this device so the order form starts filled in.
            </p>
            <p>
              Orders are confirmed by Arpine over email, exactly as they are without an account —
              there is no order history kept on this site.
            </p>
          </div>

          <div className="ap-acct__acts">
            <Link className="ap-btn" href="/shop">
              Back to the shop
            </Link>
            <SignOut />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Chrome />
      <AuthUI ready={ready} notice={s && NOTE[s] ? NOTE[s] : !ready ? NOTE.off : undefined} />
      {/* the expired-link case has no form of its own to live in, so it is
          handed to the panel above as its notice */}
      <span className="ap-sr" role="status">
        {s === "bad" ? NOTE.bad : ""}
      </span>
      <span hidden>{brand.name}</span>
    </>
  );
}
