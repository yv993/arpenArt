# ArpenArt owner handbook

For **Arpine** (the artist, who owns the shop) and **Vardan** (the developer).

Arpine cannot change the site herself yet: there is no admin page. Every change is a short
message to the developer, then a deploy. This page says what to send and where the developer
makes each change.

---

## 1. What to send, and where it lives

All texts and prices are in **one file**, `lib/content.ts`, unless the table says otherwise.
Prices are in Armenian dram (֏).

| To change | Arpine sends | Developer edits |
| --- | --- | --- |
| **A product line's price** | the line's name and the new price in ֏ | `categories[]` → `from`. `null` = on sale, price not on the site yet: the page and the cart say «Price confirmed by Arpine» and leave it out of every total (posters, since 2026-11-04). |
| **A price for one option** (for example a postcard set, a garment size) | the line, the option, and its price | `categories[]` → `variants.prices`: option → price |
| **An Armenia Eternal price** (a square postcard, an A6 postcard, a scarf, the table runner) | the kind and its price | `categories[]` → `armenia-eternal` → `variants.prices`: put her number in place of that kind's `null`. The page's group, the cart and the order mail follow. |
| **Lines not on sale yet** (brooches, bracelets, notebooks, pendants) | the line and its price, then photos when it goes on sale | `priceList`. When a line opens, it moves into `categories` (bookmarks did, 2026-11-04). |
| **Delivery** (the 4 choices in the cart) | for each choice: its name, price, how long it takes, which carrier | `delivery.options` (`label`, `price`, `eta`, `address`) |
| **"How ordering works"** (choose / confirm / pay) | the new wording, for example how buyers pay | `ordering.steps` |
| **Social links** | the full profile link (for example her Telegram `@handle`) | `socials`. Remove `pending` once it is her own profile. |
| **Shops that sell her work** (Find in store) | shop name; the address as she writes it in Armenian and in Latin letters; a map pin or a photo of the door; phone; opening hours; which lines they carry; a logo if they agree | `stockists` (shop, address, pin, phone, hours, lines). Logos go in `public/stockists/`. |
| **Stories** | the text exactly as it should read, the photos as files, the date and the place | `stories` in `lib/content.ts`. Picture files go in `public/stories/`, listed in `lib/stories.json`. |
| **Her 57 pictures** (gallery, cloud, puzzle) | the image as a full-size file, its title, its short text | `lib/artworks.json` (`text` holds the description; there is no title field yet). Files go in `public/art/`. |
| **Product photos** | the photos as full-size files | `public/products/` + `lib/products.json` |
| **About, home page, footer, email address** | the new wording | `about`, `home`, `brand` |
| **Terms / Privacy** | her decisions (see `docs/QUESTIONS-FOR-ARPINE.md`) | `app/terms/page.tsx`, `app/privacy/page.tsx` |
| **A piece is sold out** (or back) | the line and the piece's number, or the option | `soldOut` — see section 5 |

**How a price works**

- A line's price is `from`. A line whose `from` is **`null`** is on sale without a price on the
  site: like a `null` option below, it shows **"Price confirmed by Arpine"** and is never added
  to a total.
- An option with its own entry in `variants.prices` costs that entry.
- An option whose entry is **`null`** is never added to any total. The cart and the order email
  show it as **"Price confirmed by Arpine"** (`priceTbc` in `lib/content.ts`). The postcard
  **"Full series set"** is like this until she gives its price.
- The server re-prices every order from this file. A price in the visitor's browser is never
  trusted.

**Send pictures as files, not through WhatsApp or Instagram.** Use email attachments or a Drive
folder. Chat apps shrink the image.

**Today's state:**

- Delivery rates (free / 1,500 / 2,500 / 9,000 ֏) are placeholders.
- T-shirts (slug `hoodies` in the code) are "Available Soon", and their price is a placeholder.
  Cups, plates and puzzles were removed on 2026-11-04 (her change 5, p3); their old addresses
  lead to the shop.
- `docs/QUESTIONS-FOR-ARPINE.md` lists every open fact.

---

## 2. How a change goes live

1. The developer edits the file and **pushes to `main`** on GitHub (`yv993/arpenArt`).
2. Vercel builds and publishes it automatically, usually in **about a minute**. Every push to
   `main` goes straight to the live site, so nothing half-finished should be pushed. (The GitHub
   check runs at the same time and does not hold the deploy back, unless the Deployment Check in
   `docs/LAUNCH-CHECKLIST.md` §4 has been switched on.)
3. Open the page and check it.

Two things can make a change look missing:

- **Pictures may be cached.** The site lets a browser keep a picture for a day, and for the week
  after that show the copy it has once more while it fetches the new one in the background
  (`Cache-Control: public, max-age=86400, stale-while-revalidate=604800` on the picture folders,
  `next.config.mjs`). So a picture replaced **under the same file name** can show the old version
  for up to a day, and for one more visit to someone returning within the following week.
  - When it must show today, the developer gives the file a new name or a `?v=` version.
- **A tab left open across a deploy** can fail to load parts of the page. **Reload first.**
  - On Vercel Pro, Skew Protection keeps such a tab working, but by default only for one day
    after the deployment it loaded; a tab open longer than that can still fail. See
    `docs/LAUNCH-CHECKLIST.md` §4.

Changing a **setting** (an environment variable on Vercel) needs a **redeploy**. It does not need
a push. See `docs/LAUNCH-CHECKLIST.md`.

---

## 3. How orders arrive

Nothing is charged on the site. An order is a **request**: Arpine replies to confirm what is
available, the final price, postage, and how to pay.

**Arpine receives** an email, if mail is switched on:

- **Subject:** "Order AR-XXXXX — buyer's name".
- **Reply** goes straight to the buyer.
- **Contents:**
  - the buyer's name, email and phone;
  - each item, with its picture number, a link to the picture, and a link to its shop page;
  - the items total, the delivery choice and price, the total;
  - the address, if delivery needs one;
  - the buyer's note.
- An item with no set price says **"price confirmed by Arpine"** (the cart's own words), and the total says what
  it leaves out.
- Contact messages arrive as **"Enquiry from name"**, also with Reply going to the sender.
- If a webhook is configured too (an order log, for example), the same order goes there as well.

**What the buyer sees** (exact wording on the page may differ):

| What happened | The buyer sees |
| --- | --- |
| Delivered, and the buyer's copy was sent | the order is confirmed with its reference **AR-XXXXX**, and the page mentions the copy in their inbox. The copy's Reply goes to Arpine. Only the ordered items leave the cart; anything the buyer added meanwhile stays there, and the page says so. |
| Delivered, no copy (the sender is not verified yet, or the bot check is not on yet) | the same confirmation, without mentioning a copy |
| **Not delivered** (mail is off, or every channel failed) | an honest "not sent" message with Arpine's address and a way to copy the order text, so they can send it to her themselves. Their cart is kept until they say they sent it. A copy of the order is printed in the Vercel log, which Vercel keeps for **1 hour on Hobby** and **1 day on Pro**. |
| The cart holds a piece that is now sold out | the line is flagged, and the order is not sent until they remove it (section 5) |
| A field is wrong or missing | a message next to that field; nothing is sent |
| Too many tries, the bot check failed, or the check is waiting for the buyer's tick | a message next to the send button; nothing is sent |
| They pressed Send before the page had finished loading (contact and sign-in forms) | the page comes back with an empty form and says that nothing was sent, so they type it again; nothing they typed is kept anywhere |
| The cart changed in another tab while the order was being sent | nothing is sent; the form keeps what they typed and says the cart changed |

---

## 4. When something is wrong

**First, open `/api/health`** (for example `https://www.arpenart.com/api/health`). It shows only
true/false values:

| Shows `false` | Meaning | What to do (Vardan) |
| --- | --- | --- |
| `orders` | Orders are **not delivered**, only logged | Vercel → Settings → Environment Variables (Production): `RESEND_API_KEY` and `ORDER_TO_EMAIL` (or `ORDER_WEBHOOK_URL`) must be there, spelled exactly. Then **redeploy**. |
| `contact` | Contact messages are only logged | the same variables, or `CONTACT_WEBHOOK_URL`, then redeploy |
| `buyerCopy` | Buyers get no copy | Expected until both Turnstile keys are set: the copy is sent only while the bot check is on (`docs/LAUNCH-CHECKLIST.md` §3). After that, `MAIL_FROM` must be an address on the domain verified in Resend (not `@resend.dev`), and Resend → Domains must still say *Verified*. Then redeploy. |
| `signIn` | The account icon is hidden | fine for launch. It needs `AUTH_SECRET` (16+ characters), Resend and a verified sender, then a redeploy. |
| `turnstile` | No bot check | both Turnstile keys, then redeploy (`docs/LAUNCH-CHECKLIST.md` §3) |

**Everything is `true` but an order did not arrive:**

1. Arpine checks her spam folder.
2. Resend → **Emails / Logs** *(label may differ)*: was it sent, did it bounce, was it rejected?
   An API key that was deleted or revoked shows up here.
3. Vercel → the project → **Logs** *(label may differ)*: search for `NOT DELIVERED`.
   - Undelivered orders are printed there in full. Vercel keeps them for 1 hour on Hobby and
     1 day on Pro, so until the plan is Pro, look within the hour.
4. Send one test order (`docs/LAUNCH-CHECKLIST.md` §1.7) after any fix.

**The whole site is down:** check Vercel → Deployments (did the last build fail?) and the
domain's DNS at GoDaddy. If the last deploy broke the site, Vercel can put the previous deployment
back: Deployments → ⋯ → **Promote / Instant Rollback** *(label may differ)*.

---

## 5. Marking a piece sold out

For a piece that is gone: a print, the last scarf of a design, a keychain that is no longer made.
(A whole line that stops selling is different: its `status` in `categories` changes.)

**Arpine sends** the line and the piece's number as the shop shows it (for example "keychain
no. 03"), or the option (for example "Sheet 03" of the stickers).

**The developer edits** `soldOut` in `lib/content.ts`, then pushes (section 2):

```ts
export const soldOut: Record<string, readonly string[]> = {
  keychains: ["03"],
};
```

- The key is the line's slug, as in `categories`: `keychains`, `magnets`, `3d-stickers`,
  `scarves`, `totes`, `stickers`, `postcards`, …
- Each entry is one of two things:
  - **the piece's number**, as text with two digits: `"03"`, not `"3"`. For keychains, magnets,
    3D stickers, scarves (the design), tote bags (the bag), bookmarks and posters that is the
    item's own number (a bookmark's number is ours, 01–25 in her file order: no. 01 is her file
    -02, and her -15 and -24 are left out as re-exports of -02 and -08 — `scripts/bookmarks.mjs`
    prints the whole table, products.json keeps hers as `her`, and the order mail shows both,
    «bookmark no. 14 · file 16»;
    a poster's is her flat file's, 01–04, `Untitled-3-01` … `-04`). An Armenia Eternal piece
    (key `"armenia-eternal"`) is named by its id, which says its kind: `"sq01"`–`"sq07"` square
    postcards, `"a601"`–`"a604"` A6 postcards, `"sc01"`–`"sc04"` scarves, `"ru01"` (navy) and
    `"ru02"` (white) table runners — `scripts/eternal.mjs` prints which of her files each one is.
    For
    the lines printed with her pictures (postcards, for example) it is the picture's number;
  - **an option label**, exactly as the picker shows it: `"Sheet 03"`, `"Bandana"`, `"M"`.
- An option label counts for every piece of that line: `scarves: ["Bandana"]` marks every
  bandana sold out. One entry cannot mark only one combination, such as design 02 as a bandana.
- Today the list is empty. Nothing is marked sold out until Arpine says so.

**What buyers then see:**

- the piece's add button reads **"Sold out"** and adds nothing;
- a cart that already holds it (carts are kept in the buyer's browser) flags the line
  **"Sold out"**, leaves it out of the total, and asks them to remove it before sending:
  "Sold out: Keychain no. 03. Please remove it from your cart, then send again.";
- the server refuses an order that still holds it, with the same sentence word for word, so even
  a page opened before the change cannot send it.
- a picture number on the postcards also blocks a "Full series set" line whose chosen picture
  is that number (the set line carries the picture picked when it was added).

**To undo it,** delete the entry (or the whole line's key) and push. The piece can be added
again straight away, and carts that still hold it count it again.
