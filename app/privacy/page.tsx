import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import { brand, stockistPage } from "@/lib/content";
import TextFX from "@/components/TextFX";
import { pageMeta } from "@/lib/seo";

// indexable and in the sitemap, so it gets its own snippet, canonical and card
export const metadata: Metadata = pageMeta({
  title: "Privacy",
  description: `What ${brand.name} does with the details you send through its forms.`,
  path: "/privacy",
});

// THIS PAGE DESCRIBES THE SITE AS IT IS BUILT (readiness #11, 2026-10-31).
// The old text said "two forms… name, email, message" while the order form
// also asked for a phone number and an address, and a 30-day cookie existed.
// Every sentence below is traced to code — the three forms (CartView,
// ContactBlock, AuthUI) and their routes under app/api, the session cookie
// (lib/server/auth.ts), the browser storage (lib/cart.ts, ThemeToggle, the
// puzzle note in Cloud.tsx), the location button (FindInStore) and the hosts
// the CSP in next.config.mjs lets the browser reach.
//
// OPTIONAL SERVICES ARE NAMED ONLY WHEN THEY ARE SWITCHED ON. The page is
// prerendered, so these checks run at build — the same moment the routes'
// own configuration is frozen on Vercel — and an env change needs a redeploy
// either way. Only PRESENCE is read; no value is ever rendered.
//
// No retention period and no legal basis is promised here: none has been
// decided, and a privacy page that over-promises is worse than a short one.
// If you add a form field, a cookie, a storage key or a third party, change
// this page in the same commit.
const set = (v: string | undefined) => !!v && v.trim() !== "";

export default function Page() {
  const env = process.env;
  const resend = set(env.RESEND_API_KEY);
  // the contract's "verified sender": set, and not Resend's onboarding address
  // (which can only ever reach the Resend account's owner, never a buyer)
  const sender = env.MAIL_FROM || env.CONTACT_FROM || "";
  const verified = set(sender) && !sender.includes("@resend.dev");
  const toArpine = resend && set(env.ORDER_TO_EMAIL);
  const orderHook = set(env.ORDER_WEBHOOK_URL);
  const contactHook = set(env.CONTACT_WEBHOOK_URL);
  const signIn = env.NEXT_PUBLIC_SIGNIN === "1";
  const turnstile = set(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  // the server asks Cloudflare only when BOTH keys are set (lib/server/mail.ts
  // turnstileOn); the widget alone loads with the site key
  const turnstileCheck = turnstile && set(env.TURNSTILE_SECRET_KEY);
  // the buyer's copy is sent only under the same three conditions as in
  // lib/server/mail.ts deliver(): Resend, a verified sender AND the bot check
  // (2026-11-01, review SRV-1 — without the check the copy was an open relay)
  const buyerCopy = resend && verified && turnstileCheck;
  const hooked =
    orderHook && contactHook ? "Orders and messages" : orderHook ? "Orders" : contactHook ? "Messages" : "";

  // a group label sits closer to its own paragraphs than to the group above
  const label = { margin: "16px 0 -6px" } as const;

  return (
    <>
      <Chrome />
      <div className="ap-sec ap-shop">
        <div className="ap-sec__head">
          <h1 className="ap-h2">PRIVACY</h1>
          <p className="ap-lede">
            This site collects what you type into its forms, and very little else. Everything it
            receives, where that goes, and what stays in your own browser is listed here.
          </p>
        </div>
        <div style={{ display: "grid", gap: 16, maxWidth: "62ch" }}>
          <h2 className="ap-kicker" style={label}>What the forms send</h2>
          <p>
            <strong>An order</strong> (the cart): your name, email and phone number; how it should
            reach you; for a delivery, the street address, city, postcode and country; your note, if
            you write one; and the items you chose — which line, which picture, which size or
            format, and how many.
          </p>
          <p>
            <strong>A message</strong> (Contact): your name, your email and your message.
          </p>
          <p>
            <strong>Sign-in</strong> (Account): your email, and your name when you create an
            account.{signIn ? "" : " Sign-in is not switched on yet, so this form sends nothing today."}
          </p>
          <p>It is used to reply to you and to prepare your order. It is not sold, and it is not
          passed to advertisers.</p>

          <h2 className="ap-kicker" style={label}>Where it goes</h2>
          <p>
            What you send is for {brand.artist}, who runs this shop. The forms are received by this
            site&rsquo;s own code, which runs on servers of Vercel, the company that hosts the site.
          </p>
          {toArpine || hooked ? (
            <p>
              {toArpine && "Orders and messages are emailed to Arpine’s inbox through Resend, an email-sending service. "}
              {hooked &&
                `${hooked} are ${toArpine ? "also " : ""}passed to a service the shop’s owner set up to collect them.`}
            </p>
          ) : (
            <p>
              Sending them on to Arpine is not switched on yet. Until it is, the page tells you so
              after you press send and shows her address, so you can write to her directly.
            </p>
          )}
          {buyerCopy && (
            <p>Once an order has reached Arpine, a copy of it is emailed to the address you gave,
            also through Resend.</p>
          )}
          {signIn && (
            <p>When you ask to sign in, the link is emailed to the address you gave, through
            Resend.</p>
          )}
          <p>
            If an order or a message is received but cannot be passed on, a copy of it is written
            to the server&rsquo;s log so that it is not lost. Vercel keeps that log only for a short
            time, and the people who run the site can read it there. A form sent before the page
            has finished loading is not read at all: the site only sends you back to the form,
            which then says that nothing was sent, and nothing you typed is kept.
          </p>
          <p>
            To stop a form being sent over and over, the server counts how often it is sent from
            each IP address. That count is kept only in the server&rsquo;s working memory and is
            gone when the server restarts.
          </p>

          <h2 className="ap-kicker" style={label}>Cookies and your browser</h2>
          {signIn ? (
            <p>
              This site sets one cookie, and only once you have signed in, named ap_session.
              It holds your email address — and your name, if you gave one — signed so that it
              cannot be altered. It keeps you signed in for 30 days, or until you sign out, which
              deletes it, and the page&rsquo;s scripts cannot read it. While you are signed in, the
              order and message forms start with that name and email filled in.
            </p>
          ) : (
            <p>Sign-in is not switched on yet, so this site sets no cookies.</p>
          )}
          {/* lib/cart.ts: when the browser refuses to store it, the cart lives
              in the open page only */}
          <p>
            Your cart is stored in your own browser (or, if the browser will not store it, only in
            the open page) and never leaves it until you press send.
          </p>
          {/* CartView's PENDING note (readiness #3): an undelivered order's
              typed details and receipt survive a reload, per tab only */}
          <p>
            If an order could not be sent, the tab keeps what you typed and the written-out order
            in its own storage, so a reload does not lose them. The browser discards that copy when
            the tab closes, and the site removes it as soon as you go back to the cart or the order
            is sent.
          </p>
          <p>
            If you switch between light and dark, that choice is kept in your browser too. And if
            the site is updated just as a picture&rsquo;s puzzle is opening, the tab notes which
            puzzle to reopen after it reloads itself; the browser discards that note when the tab
            closes.
          </p>
          <p>
            On <a href="/find-in-store">Find in store</a>, &ldquo;{stockistPage.near}&rdquo; asks
            your browser for your location. It is used on that page to pick the closest town and
            is never sent anywhere.
          </p>

          <h2 className="ap-kicker" style={label}>Other companies</h2>
          <p>
            Vercel hosts the site. Like any web host, it receives your IP address and the addresses
            of the pages you open. Fonts, pictures and films all come from this site itself.
          </p>
          {/* The street map is the only thing here that talks to anyone else
              (until Turnstile's key is set — see below). Saying so is not optional: the page above promises no tracking,
              and a visitor cannot see a tile request the way they can see a
              form. It is opt-in — the map loads nothing until pressed. */}
          <p>
            One page — <a href="/find-in-store">Find in store</a> — can show a street map. It stays
            off until you press &ldquo;{stockistPage.mapShow}&rdquo;. If you do, the map is drawn
            from tiles fetched from OpenFreeMap, which is outside this site: it receives your IP
            address and which part of the map you looked at. OpenFreeMap sets no cookies and asks
            for no account. Nothing else about you is sent
            {turnstile ? "." : ", and no other page here contacts anyone."}
          </p>
          {/* Turnstile loads from Cloudflare on the pages with a form, so once
              its key is set the sentence above can no longer say "no other
              page" — this paragraph takes over. Wording from Cloudflare's
              Turnstile privacy addendum (signals: IP, TLS fingerprint,
              user agent; also used to improve their bot detection). */}
          {turnstile && (
            <p>
              To keep automated spam out, the forms include a check by Cloudflare Turnstile. It
              loads from Cloudflare when you reach a form and usually stays invisible. Cloudflare
              receives your IP address and technical details of
              your browser to tell a person from a program, and also uses them to improve that
              check (
              <a href="https://www.cloudflare.com/turnstile-privacy-policy/" rel="noopener noreferrer">
                Cloudflare&rsquo;s Turnstile privacy terms
              </a>
              ).
              {turnstileCheck &&
                " When you press send, this site asks Cloudflare whether the check passed, and passes on your IP address with that question."}
            </p>
          )}
          <p>
            Links to Instagram, Telegram, YouTube, OpenStreetMap and akneye.com are ordinary links:
            nothing is sent to those sites unless you follow one, and then that site&rsquo;s own
            rules apply.
          </p>
          <p>No analytics or tracking scripts run on this site.</p>

          <h2 className="ap-kicker" style={label}>Deleting what you sent</h2>
          <p>To have anything you sent deleted, email <a href={"mailto:" + brand.email}>{brand.email}</a>.</p>
        </div>
      </div>
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
