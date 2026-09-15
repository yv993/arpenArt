"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brand, categories, delivery, home, ownItemWord } from "@/lib/content";
import { clear, dram, read, remove, setQty, subscribe, total, unit, type Line } from "@/lib/cart";
import { OrderingSteps } from "@/components/CategoryView";
import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";

type Art = { id: string; thumb: string; w: number; h: number; avg: string };
type Shot = { id: string; thumb: string; w: number; h: number; avg: string };
const ART = artworks as Art[];
const P = products as Record<string, Shot[]>;

type State = "idle" | "sending" | "sent" | "logged" | "error";

/** what was ordered, frozen at the moment of sending */
type Receipt = {
  lines: { label: string; qty: number; sum: number }[];
  goods: number;
  shipLabel: string;
  shipPrice: number;
  /** only for the fallback email the buyer sends themselves */
  who: string[];
};

export default function CartView() {
  const [lines, setLines] = useState<Line[]>([]);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [ref, setRef] = useState("");
  // the API's 422 shape: { errors: { field: message } } — same as /api/contact
  const [errors, setErrors] = useState<Record<string, string>>({});
  // true only when the server says the buyer's copy actually went out; the
  // done screen never claims an email that was not sent
  const [copied, setCopied] = useState(false);
  // THE ENDING HAD FORGOTTEN THE ORDER (UX laws M4 + M7, 2026-09-15). A
  // successful send calls clear(), so by the time "Order received" rendered
  // the cart was empty and the screen named nothing that had been bought.
  // Worst in the honest fallback — no email transport configured — which
  // told the buyer to "also send it directly" to Arpine, from a page that
  // had just wiped what they would need to write. The receipt is taken
  // BEFORE clear(), so the ending shows what was chosen and the fallback
  // email arrives already written.
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  // which delivery service — decides the charge AND whether an address is
  // asked for. Defaults to the Yerevan courier: she works there, and an
  // address is what most orders need anyway.
  const [shipId, setShipId] = useState("yerevan");
  const ship = delivery.options.find((o) => o.id === shipId) ?? delivery.options[0];

  useEffect(() => {
    const sync = () => setLines(read());
    sync();
    setMounted(true);
    return subscribe(sync);
  }, []);

  /** the goods alone; delivery is added on top of this, never hidden in it */
  const goods = total(lines);
  const nameOf = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  /** One line, in words. The receipt, the fallback email and the buttons'
   *  accessible names all say it the same way — the Remove buttons used to be
   *  named by CATEGORY alone, so two keychains in a cart read to a screen
   *  reader as two identical "Remove Keychains". */
  const lineLabel = (l: Line) => {
    const own = ownItemWord[l.cat];
    // a fixed-item line names itself ("Keychain no. 04" — the category would
    // only repeat the noun); a choose-an-illustration line needs the category,
    // because "Illustration no. 05" alone does not say it is a tote bag
    const what = l.art ? (own ? `${own} no. ${l.art}` : `${nameOf(l.cat)} — Illustration no. ${l.art}`) : nameOf(l.cat);
    return `${what}${l.variant ? ` (${l.variant})` : ""}`;
  };

  // the ending is a new screen, so put the reader on its heading — otherwise a
  // screen reader stays on a Send button that no longer exists
  useEffect(() => {
    if (state === "sent" || state === "logged") doneHeading.current?.focus();
  }, [state]);
  // `art` is TWO different id spaces — see ownItemWord in content.ts. For a
  // fixed-item line (magnet, keychain, 3D sticker) it names the category's own
  // product photo; only for the choose-an-illustration lines does it name one
  // of the 57 artworks. Resolving artworks first showed a buyer illustration
  // no. 05 — a different picture — for magnet no. 05.
  const thumbOf = (l: Line) => {
    const media = categories.find((c) => c.slug === l.cat)?.media ?? "";
    if (ownItemWord[l.cat]) return (l.art && P[media]?.find((s) => s.id === l.art)?.thumb) || P[media]?.[0]?.thumb;
    return (l.art ? ART.find((a) => a.id === l.art)?.thumb : undefined) ?? P[media]?.[0]?.thumb;
  };

  // put the keyboard where the fix is — the first field the server rejected,
  // in the order they appear in the form
  const focusFirst = (form: HTMLFormElement, errs: Record<string, string>) => {
    const first = ["name", "email", "phone", "address", "city", "country", "consent"].find((k) => errs[k]);
    if (!first) return;
    (form.querySelector(`[name="${first}"]`) as HTMLElement | null)?.focus();
  };

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending" || !lines.length) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setErrors({});
    // the form is noValidate (so the server's messages are the one voice), which
    // means `required` on the checkbox does nothing — enforce consent here
    if (!f.get("consent")) {
      const errs = { consent: "Please tick the box so Arpine may reply to you." };
      setErrors(errs);
      focusFirst(form, errs);
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: get("name"),
          email: get("email"),
          phone: get("phone"),
          note: get("note"),
          company: get("company"), // honeypot
          // the delivery half: only the CHOICE travels, never its price —
          // the server looks that up, exactly as it does for the products.
          // An address is sent only when one was asked for, so a collection
          // order carries no stale fields.
          ship: shipId,
          ...(ship.address
            ? {
                address: get("address"),
                city: get("city"),
                postcode: get("postcode"),
                country: get("country"),
              }
            : {}),
          // the server re-prices from its own copy of the catalogue; this is
          // only what the buyer chose, never what it should cost
          lines: lines.map((l) => ({ cat: l.cat, art: l.art, variant: l.variant, qty: l.qty })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        copied?: boolean;
        ref?: string;
        errors?: Record<string, string>;
      };
      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setState("idle");
        focusFirst(form, data.errors);
        return;
      }
      if (!res.ok || !data.ok) {
        setState("error");
        return;
      }
      setRef(data.ref ?? "");
      setCopied(!!data.copied);
      // frozen before clear() — see `receipt` above
      setReceipt({
        lines: lines.map((l) => ({ label: lineLabel(l), qty: l.qty, sum: unit(l.cat) * l.qty })),
        goods,
        shipLabel: ship.label,
        shipPrice: ship.price,
        who: [
          get("name"),
          get("phone") ? `Phone: ${get("phone")}` : "",
          ship.address
            ? [get("address"), [get("postcode"), get("city")].filter(Boolean).join(" "), get("country")].filter(Boolean).join(", ")
            : "",
          get("note") ? `Note: ${get("note")}` : "",
        ].filter(Boolean),
      });
      setState(data.delivered ? "sent" : "logged");
      clear();
      form.reset();
    } catch {
      setState("error");
    }
  };

  // The head is static — no cart data in it — so it renders in every state,
  // including the pre-mount shell. The TextFX runner scans the page before
  // the localStorage read resolves; if the heading waited for `mounted`, the
  // runner would find nothing and the cart title would never get its flip.
  const head = (
    <div className="ap-sec__head">
      <p className="ap-kicker">(Cart)</p>
      {/* rise, not flip — same reason as the gallery title in HomeView.tsx
          (2026-09-15): the per-letter 3D turn tears the first glyph and
          overlaps the rest mid-entrance; this was the only other flip */}
      <h1 className="ap-h2" data-tfx="rise">
        YOUR SELECTION
      </h1>
    </div>
  );

  if (!mounted)
    return (
      <div className="ap-sec ap-cart" aria-busy="true">
        {head}
      </div>
    );

  if (state === "sent" || state === "logged") {
    // the fallback email, written out: the buyer should only have to press Send
    const mailBody = receipt
      ? [
          ...(ref ? [`Order reference: ${ref}`, ""] : []),
          ...receipt.lines.map((l) => `${l.qty} × ${l.label} — ${dram(l.sum)}`),
          `Delivery — ${receipt.shipLabel}: ${receipt.shipPrice ? dram(receipt.shipPrice) : "Free"}`,
          `Total: ${dram(receipt.goods + receipt.shipPrice)}`,
          "",
          ...receipt.who,
        ].join("\n")
      : "";
    const mailto = `mailto:${brand.email}?subject=${encodeURIComponent(`ArpenArt order${ref ? ` ${ref}` : ""}`)}&body=${encodeURIComponent(mailBody)}`;

    return (
      <div className="ap-sec ap-cart">
        <div className="ap-cart__done">
          <h1 className="ap-h2" ref={doneHeading} tabIndex={-1}>
            Order received
          </h1>
          {ref && (
            <p className="ap-cart__ref">
              Reference <strong>{ref}</strong>
            </p>
          )}
          {state === "sent" ? (
            <p>
              Arpine has your request and will reply to confirm the total and postage.
              {copied && " A copy was sent to your email."}
            </p>
          ) : (
            <p>
              Your request was recorded, but email delivery is not configured on this site yet —
              so please send it to Arpine as well. The button below opens the email already
              written; you only need to press send.
            </p>
          )}

          {receipt && (
            <div className="ap-cart__receipt">
              <ul>
                {receipt.lines.map((l) => (
                  <li key={l.label}>
                    <span>
                      {l.qty} × {l.label}
                    </span>
                    <span>{dram(l.sum)}</span>
                  </li>
                ))}
              </ul>
              <dl className="ap-cart__sums">
                <div>
                  <dt>Delivery — {receipt.shipLabel}</dt>
                  <dd>{receipt.shipPrice ? dram(receipt.shipPrice) : "Free"}</dd>
                </div>
                <div className="ap-cart__sums-total">
                  <dt>Total</dt>
                  <dd>{dram(receipt.goods + receipt.shipPrice)}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* exactly one primary: in the fallback the email IS the order */}
          {state === "logged" ? (
            <div className="ap-cart__doneActs">
              <a className="ap-btn" href={mailto}>
                Email this order to Arpine
              </a>
              <Link className="ap-btn is-ghost" href="/shop">
                Back to the shop
              </Link>
            </div>
          ) : (
            <Link className="ap-btn" href="/shop">
              Back to the shop
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ap-sec ap-cart">
      {head}

      {!lines.length ? (
        <div className="ap-cart__empty">
          <p>Nothing chosen yet.</p>
          <Link className="ap-btn" href="/shop">
            Go to the shop
          </Link>
        </div>
      ) : (
        <div className="ap-cart__grid">
          <ul className="ap-cart__list">
            {lines.map((l) => {
              const t = thumbOf(l);
              return (
                <li className="ap-cart__row" key={l.cat + (l.art ?? "") + (l.variant ?? "")}>
                  <figure className="ap-cart__fig">
                    {t && <img src={t} alt="" width={120} height={160} loading="lazy" />}
                  </figure>
                  <div className="ap-cart__what">
                    <h2>{nameOf(l.cat)}</h2>
                    {l.art && <p>{ownItemWord[l.cat] ?? "Illustration"} no. {l.art}</p>}
                    {l.variant && <p>{l.variant}</p>}
                    <p className="ap-cart__unit">{dram(unit(l.cat))} each</p>
                  </div>
                  <div className="ap-cart__qty">
                    <button
                      type="button"
                      aria-label={`One fewer: ${lineLabel(l)}`}
                      onClick={() => setQty(l.cat, l.art, l.qty - 1, l.variant)}
                    >
                      −
                    </button>
                    <span aria-live="polite">{l.qty}</span>
                    <button
                      type="button"
                      aria-label={`One more: ${lineLabel(l)}`}
                      onClick={() => setQty(l.cat, l.art, l.qty + 1, l.variant)}
                    >
                      +
                    </button>
                  </div>
                  <p className="ap-cart__sum">{dram(unit(l.cat) * l.qty)}</p>
                  <button
                    type="button"
                    className="ap-cart__rm"
                    onClick={() => remove(l.cat, l.art, l.variant)}
                    aria-label={`Remove ${lineLabel(l)}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>

          {/* the strip and the form share one column so they stick together */}
          <div className="ap-cart__side">
            <OrderingSteps />

            <form className="ap-cart__form" onSubmit={send} noValidate>
              {/* the sum, itemised, so the delivery charge is never a
                  surprise sitting inside one number */}
              <dl className="ap-cart__sums">
                <div>
                  <dt>Items</dt>
                  <dd>{dram(goods)}</dd>
                </div>
                <div>
                  <dt>Delivery — {ship.label}</dt>
                  <dd>{ship.price ? dram(ship.price) : "Free"}</dd>
                </div>
                <div className="ap-cart__sums-total">
                  <dt>Total</dt>
                  <dd>{dram(goods + ship.price)}</dd>
                </div>
              </dl>
              <p className="ap-cart__note">{delivery.note}</p>

              <div className="ap-pot" aria-hidden="true">
                <label htmlFor="ap-company">Company</label>
                <input id="ap-company" name="company" tabIndex={-1} autoComplete="off" />
              </div>

              <label className="ap-field">
                <span>Name</span>
                <input name="name" required autoComplete="name" aria-invalid={!!errors.name} />
                {errors.name && <em className="ap-contact__warn">{errors.name}</em>}
              </label>
              <label className="ap-field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <em className="ap-contact__warn">{errors.email}</em>}
              </label>
              <label className="ap-field">
                <span>Phone</span>
                <input
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+374 …"
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <em className="ap-contact__warn">{errors.phone}</em>}
              </label>

              {/* how it reaches them — the address block only exists for the
                  branch that needs one, so a Yerevan pickup is two clicks */}
              <fieldset className="ap-field ap-ship">
                <legend>{delivery.label}</legend>
                {delivery.options.map((o) => (
                  <label key={o.id} className="ap-ship__opt">
                    <input
                      type="radio"
                      name="ship"
                      value={o.id}
                      checked={shipId === o.id}
                      onChange={() => setShipId(o.id)}
                    />
                    <span>
                      <strong>{o.label}</strong>
                      <em>{o.eta}</em>
                    </span>
                    <b className="ap-ship__price">{o.price ? dram(o.price) : "Free"}</b>
                  </label>
                ))}
              </fieldset>

              {ship.address && (
                <>
                  <label className="ap-field">
                    <span>Address</span>
                    <input
                      name="address"
                      required
                      autoComplete="street-address"
                      aria-invalid={!!errors.address}
                    />
                    {errors.address && <em className="ap-contact__warn">{errors.address}</em>}
                  </label>
                  <div className="ap-cart__pair">
                    <label className="ap-field">
                      <span>City</span>
                      <input name="city" required autoComplete="address-level2" aria-invalid={!!errors.city} />
                      {errors.city && <em className="ap-contact__warn">{errors.city}</em>}
                    </label>
                    <label className="ap-field">
                      <span>Postal code</span>
                      <input name="postcode" autoComplete="postal-code" />
                    </label>
                  </div>
                  <label className="ap-field">
                    <span>Country</span>
                    <input
                      name="country"
                      required
                      defaultValue="Armenia"
                      autoComplete="country-name"
                      aria-invalid={!!errors.country}
                    />
                    {errors.country && <em className="ap-contact__warn">{errors.country}</em>}
                  </label>
                </>
              )}

              <label className="ap-field">
                <span>Anything to add?</span>
                <textarea name="note" rows={3} />
              </label>

              <label className="ap-field ap-consent">
                <input type="checkbox" name="consent" required aria-invalid={!!errors.consent} />
                <span>
                  {home.contact.consent} — <Link href="/privacy">privacy</Link>
                </span>
              </label>
              {errors.consent && <em className="ap-contact__warn">{errors.consent}</em>}

              {/* the server's "cart is empty" case — possible when another tab
                  cleared the cart between render and submit */}
              {errors.lines && (
                <p className="ap-cart__err" role="alert">
                  {errors.lines}
                </p>
              )}
              {state === "error" && (
                <p className="ap-cart__err" role="alert">
                  That did not send. Please try again, or email{" "}
                  <a href={`mailto:${brand.email}`}>{brand.email}</a>.
                </p>
              )}

              <button className="ap-btn" type="submit" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Send this order"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
