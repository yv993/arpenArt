# ArpenArt launch checklist

For **Vardan**, in order. Each section says what it switches on and how to check it. Dashboard
labels change from time to time: where a button may be named differently, the text says
*(label may differ)*. Look for the nearest equivalent.

Facts used below (from the 2026-10-31 readiness audit, `imgss/readiness-2026-10-31/READINESS.md`):

- The site runs on Vercel as `arpen-art.vercel.app`, in Vardan's personal scope (`yv993s-projects`).
  Every push to `main` of `github.com/yv993/arpenArt` is a production deploy.
- `arpenart.com` is registered at GoDaddy. It was registered on 2026-10-10 and **expires on 2027-10-10**.
  It still shows the GoDaddy parking page.
  - Nameservers: `ns31` / `ns32.domaincontrol.com`.
  - Records: two parking A records (`3.33.130.190`, `15.197.148.33`) and `www` as a CNAME to the apex.
  - There is **no MX record**.
  - There is **one existing `_dmarc` TXT record**: `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;`.
- Production has none of the mail variables, so every order today returns `delivered:false`.

**Rules for every step**

- Environment variables go in **Vercel → the project → Settings → Environment Variables**.
  - Set them for **Production** only.
  - Mark secrets as *Sensitive* *(label may differ)*.
  - Never paste a value into a chat, an issue, a commit or a screenshot.
- A changed variable does nothing until you **redeploy**:
  1. Open Vercel → Deployments.
  2. On the latest Production deployment, click ⋯.
  3. Click **Redeploy** *(label may differ)*.

  No push is needed. Pages and `NEXT_PUBLIC_*` values are baked in at build time.
- After every redeploy, open `/api/health` (section 1.6). It shows only true/false values, never a
  setting's actual value.

---

## 1. Mail: orders reach Arpine (P0, readiness #1, #2, #5)

### 1.1 Resend account

1. Sign up at resend.com. First decide whose account it is (see section 9). Arpine's own account is
   the simplest owner.
2. Pick the sending region when asked *(label may differ)*.

### 1.2 Verify `arpenart.com` in Resend (DNS at GoDaddy)

1. Resend → **Domains → Add domain** → `arpenart.com`.
2. Resend shows a short list of DNS records (type, name, value). Keep that page open.
3. GoDaddy → **My Products → arpenart.com → DNS** *(label may differ)*. Then **Add** each record
   **exactly** as Resend shows it, with the same type, name and value.
   - GoDaddy adds `.arpenart.com` to names by itself. Type only the part before it: `send`, not
     `send.arpenart.com`.
4. **DMARC: EDIT the existing `_dmarc` record. NEVER add a second one.**
   - Two DMARC records make DMARC invalid, and receivers then treat the mail as if no DMARC record
     existed.
   - The existing record (`p=quarantine`, relaxed alignment) already works with Resend's signing.
     Leave it alone unless Resend asks for a change, and if it does, edit that same record.
5. Back in Resend, click **Verify**. DNS can take minutes to hours. Wait until the domain shows as
   verified.

### 1.3 API key

1. Resend → **API Keys → Create** *(label may differ)*. Give it sending access only.
2. Copy the key once; Resend shows it only at creation.

### 1.4 Vercel variables (Production)

| Name | Value | Secret? |
| --- | --- | --- |
| `RESEND_API_KEY` | the key from 1.3 | **yes** |
| `ORDER_TO_EMAIL` | Arpine's inbox (the address she reads) | no |
| `MAIL_FROM` | a sender on the verified domain, e.g. `ArpenArt <shop@arpenart.com>` | no |
| `AUTH_SECRET` *(optional, turns on sign-in)* | 32+ random characters, e.g. the output of `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | **yes** |

Notes:

- **`MAIL_FROM` needs no inbox.** `arpenart.com` has no MX record, so mail sent *to*
  `shop@arpenart.com` would bounce. That is fine:
  - the buyer's copy sets reply-to to `ORDER_TO_EMAIL`;
  - Arpine's copy sets reply-to to the buyer.
- Keep `ORDER_TO_EMAIL` set even if you also use a webhook: it is what puts each order in
  Arpine's inbox. With a webhook only, the buyer's copy replies to the shop's public address
  (`brand.email` in `lib/content.ts`, `arpenbaroyan@gmail.com`).
- Optional webhook (an order log, for example):
  - `ORDER_WEBHOOK_URL` / `CONTACT_WEBHOOK_URL` (secret; the URL is the credential);
  - `WEBHOOK_SECRET`, so each post is signed (`X-ArpenArt-Signature`).

  When a webhook and Resend are both set, **both** are used.

  If the receiver has not answered after about 12 seconds (or answers with a server error), the
  site tries once more. A slow receiver can therefore get the same order twice. Both posts carry the same `Idempotency-Key`
  header, so the receiver should skip a post whose key it has already seen.
- **Never** set `RESEND_API_BASE` on Vercel. It exists for local tests only.
- **Interim fallback, only if domain verification is stuck:** leave `MAIL_FROM` empty.
  - The site then sends from Resend's onboarding address. Resend delivers that only to the address
    that **owns the Resend account**, so this works only if the account is Arpine's and
    `ORDER_TO_EMAIL` is that same address.
  - The buyer's copy is not attempted, and sign-in stays off.
  - Health then shows `orders:true, buyerCopy:false`.

### 1.5 Redeploy

Follow the redeploy steps under the rules above.

### 1.6 Check `/api/health`

Open `https://arpen-art.vercel.app/api/health`, or `https://www.arpenart.com/api/health` after
section 2. Until section 3 is done, you should see:

```json
{ "ok": true, "orders": true, "buyerCopy": false, "contact": true, "signIn": false, "turnstile": false }
```

`buyerCopy: false` is expected here. (`signIn` shows `true` instead of `false` if you also set the
optional `AUTH_SECRET` in 1.4 and `MAIL_FROM` is on the verified domain; it stays `false` in the
interim fallback. Both are fine.) The buyer's copy is sent only while the bot check is on:
without it, a script could use the copy to mail its own text to any address from
`arpenart.com`. After section 3 the same page shows `"buyerCopy": true` and `"turnstile": true`.

| Field | `true` needs | If it is `false` |
| --- | --- | --- |
| `orders` | `ORDER_WEBHOOK_URL`, or both `RESEND_API_KEY` and `ORDER_TO_EMAIL` | Orders are only logged. Check the names (typos), that they are set for **Production**, and that you redeployed. |
| `buyerCopy` | `RESEND_API_KEY`, a verified sender (`MAIL_FROM`, or `CONTACT_FROM`, not `@resend.dev`) **and** both Turnstile keys (section 3) | Buyers get no copy. Before section 3 that is expected. After it, set `MAIL_FROM` on the verified domain and check both Turnstile keys. |
| `contact` | `CONTACT_WEBHOOK_URL`, or both `RESEND_API_KEY` and `ORDER_TO_EMAIL` | Contact messages are only logged. |
| `signIn` | `AUTH_SECRET` (≥ 16 chars) and `RESEND_API_KEY` and a verified sender, **at build and at run time** (a redeploy does both) | The account icon stays hidden. That is fine for launch. |
| `turnstile` | both Turnstile keys (section 3) | There is no bot check, only the honeypot and the rate limit. |

`true` means *configured*, not *delivered*. Only the test in 1.7 proves delivery.

### 1.7 One agreed test order, with Arpine

Agree a time with Arpine, then:

1. On the live site, add one cheap item, for example one postcard.
2. Choose **Collect in Yerevan**, so no address is needed.
3. Use **your own** email, and write `TEST ORDER — please ignore` in the note. Send it.
4. Check each of these:
   - The page confirms it was sent, with a reference like `AR-XXXXX`.
   - Arpine receives **"Order AR-XXXXX — your name"**. Ask her to check her spam folder too.
   - Her **Reply** goes to your address.
   - Only once `buyerCopy` is true (after section 3): you receive **"Your ArpenArt order
     AR-XXXXX"**, and replying to it goes to Arpine. Before that, no copy comes, and the page
     does not mention one.
5. Send one message through **Contact**, and confirm it reaches her.
6. If `signIn` is true, also request a sign-in link to your own address and open it once.

If an order is shown as "not sent", it was not delivered. The full order is printed in
**Vercel → the project → Logs** *(label may differ)*: search for `NOT DELIVERED`. Vercel keeps
these logs for **1 hour on Hobby** and **1 day on Pro**, so look within that time. Re-read 1.6.

Repeat 1.6 and 1.7 after **every** change to mail variables.

---

## 2. Domain cutover: `www.arpenart.com` (P1, readiness #4, #23)

Do these steps in this order. A build made between steps 1 and 3 points links at a host that does
not answer yet.

**Carts and sign-ins do not move to the new address.** The cart is kept in the buyer's browser,
and the sign-in cookie belongs to one address. After the redeploy in step 5, a buyer who had
items in a cart on `arpen-art.vercel.app` finds an empty cart on `www.arpenart.com`, and anyone
signed in must sign in again. Tell Arpine before you start, in case she is talking to a buyer,
and do step 5 at a quiet hour.

1. **Vercel → the project → Settings → Domains → Add** → `arpenart.com`.
   - Accept the suggestion to add `www.arpenart.com` as well.
   - Make **`www.arpenart.com` primary**, and set `arpenart.com` to **redirect** to it *(label may differ)*.
2. **GoDaddy → arpenart.com → DNS**. Copy exactly what the Vercel domain card shows:
   - **A** record `@`: replace **both** parking values with the **single** value on the Vercel card;
   - **CNAME** `www`: set it to the project-specific target on the Vercel card;
   - add no AAAA record;
   - turn off GoDaddy **Forwarding** if it is on;
   - do not touch the `_dmarc` record or the Resend records.
3. Wait until Vercel shows both domains as **Valid Configuration**, with a certificate. Then check:
   - `https://www.arpenart.com` loads the shop;
   - `https://arpenart.com` redirects to it.
4. Vercel variable (Production): `NEXT_PUBLIC_SITE_URL` = `https://www.arpenart.com`.
   Use lowercase and `https://`, with nothing after `.com`. A wrong form fails silently and keeps
   search closed.
5. **Redeploy.** This build:
   - opens `robots.txt` and the sitemap, so the shop can now be indexed;
   - points canonicals, social cards and sign-in links at the domain;
   - switches on the code redirect in `next.config.mjs`, which sends the production `*.vercel.app`
     host's **pages** to `www.arpenart.com`. Three kinds of address are **not** redirected:
     `/api/*`, `/_next/*` and the picture folders (`/art/`, `/products/`, `/stories/…` files and
     the rest of `public/`). A tab opened on the old address before the redeploy can then still
     send its order and load its pictures. If its puzzle needs a part that the new deploy no longer
     has, it reloads by itself — onto the new address, where it does not reopen the puzzle (the note
     that reopens it belongs to the old address).
6. Check:
   - `https://www.arpenart.com/robots.txt` must **not** say `Disallow: /`;
   - `https://www.arpenart.com/sitemap.xml` lists `www` addresses;
   - `https://arpen-art.vercel.app/` lands on `https://www.arpenart.com/`;
   - `https://arpen-art.vercel.app/brand/arpenart-lockup.png` shows the logo **without** moving to
     `www` (a picture is not redirected);
   - `/api/health` still shows the same values as in 1.6.
7. Update old links:
   - the GitHub repo's *Website* field;
   - Arpine's Instagram bio;
   - Vardan's portfolio case study (`my-portfolio/lib/caseStudies.ts`, `liveUrl`).

To run on the domain while staying hidden from search, stop after step 3. You can add step 4
later.

---

## 3. Bot check: Cloudflare Turnstile (P1, readiness #6)

The buyer's copy of an order stays off until this section is done. Without a bot check, a script
could use the copy to send its own text to any address from `arpenart.com`. Turnstile stops
scripts, and once both keys are set the copy switches on.

1. Log in to the Cloudflare dashboard (a free account is enough) → **Turnstile** →
   **Add widget / Add site** *(label may differ)*.
2. Name it `ArpenArt`. Add the hostnames `www.arpenart.com`, `arpenart.com` and
   `arpen-art.vercel.app`. Choose the **Managed** mode *(label may differ)*.
3. Copy the **Site Key** and the **Secret Key**. Add both in Vercel (Production):
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the site key (not secret);
   - `TURNSTILE_SECRET_KEY` = the secret key (**secret**).

   Set **both or neither**:
   - with only the site key, the widget shows but nothing checks it;
   - with only the secret key, nothing is checked either (the server needs both keys), and
     `/api/health` shows `turnstile: false`.

   In both half-set cases the buyer's copy stays off too.
4. **Redeploy.** Check:
   - `/api/health` → `turnstile: true` and `buyerCopy: true`;
   - one test message and one test order (as in 1.7) still go through, and this time you receive
     the buyer's copy, **"Your ArpenArt order AR-XXXXX"**.

   The widget is set to appear only when Cloudflare needs a tick (`components/Turnstile.tsx`), so
   usually you will not see it. To confirm it loads, open the browser's developer tools →
   Network first, then open (or reload) `/contact` and look for a request to
   `challenges.cloudflare.com`. It starts by itself as soon as a form is near the screen, so
   clicking into a field adds nothing once it has loaded.
5. `/privacy` names Cloudflare by itself once the site key is set, after that redeploy.

---

## 4. Vercel plan (P1, readiness #12, #30)

1. Vercel → your account or team → **Settings → Billing** *(label may differ)*. Read the plan
   name.
2. **Hobby is for personal, non-commercial use only**, and this site sells Arpine's work. If the
   project is on Hobby, either:
   - upgrade the scope to **Pro**; or
   - move the project to a Pro team that Arpine owns: Project → Settings → General →
     **Transfer** *(label may differ)*.

   Vercel copies the environment variables with the project (only variables written in a
   `vercel.json` stay behind, and this project has none). After a transfer, check that every
   variable is listed under Settings → Environment Variables, then re-run 1.6 and 1.7. Old logs
   and integrations do not move.
3. On Pro, check **Skew Protection**: Project → Settings → Advanced → Skew Protection
   *(label may differ)*. It may already be on: Vercel turns it on by itself for projects created
   after 19 November 2024. If you change it, **Redeploy**. Vercel's own steps end with a
   redeploy, so the change counts from the next deployment.
   - What it does: a tab left open across a deploy keeps loading the parts of the version it
     started with. Without it, such a tab can fail to load lazy parts (the puzzle already recovers
     by itself, but other parts may not).
   - Its limit: by default it covers a tab for **one day** after the deployment that tab loaded
     was made (**Maximum Age**, on the same settings page). A tab open longer than that can still
     fail. A reload fixes it.
4. *(Optional)* **Make the GitHub check a real gate.** Today Vercel publishes every push to `main`
   without waiting for the GitHub workflow (`.github/workflows/ci.yml`). That workflow only
   reports, after the deploy. Vercel's **Deployment Checks** can hold a new production deployment
   off the domains until chosen GitHub checks pass:
   1. Project → Settings → Environments → **Production**: make sure automatic aliasing for
      production is on *(label may differ)*.
   2. Project → Settings → Build and Deployment → **Deployment Checks** → **Add Checks**. Choose
      **GitHub** as the provider, then search for and select the job **`check`** (GitHub may show
      it as `CI / check`).
   3. From the next push, each production deployment is built but reaches the domains only once
      `check` has passed. So publishing now also waits for the check to finish. If `check`
      fails, the live site keeps the previous deployment. To publish anyway, open that
      deployment and use **Force Promote**.

   If the job in `ci.yml` is ever renamed, update the check here too: Vercel matches it by name.

---

## 5. Uptime monitor (P2, readiness #16)

Use any free external uptime service, with alerts to Vardan's email (and Arpine's, if she wants
them):

| Monitor | URL | Alert when |
| --- | --- | --- |
| Home page | `https://www.arpenart.com/` | the status is not 200 |
| Health | `https://www.arpenart.com/api/health` | the status is not 200, or (if the service can check page text) the body does not contain `"orders":true` |

Until section 2 is done, use `arpen-art.vercel.app` in both URLs.

---

## 6. Search engines (P2, readiness #23); after section 2

1. **Google Search Console**:
   1. **Add property → URL prefix** `https://www.arpenart.com/`.
   2. Choose the **HTML tag** method, and copy only the `content="…"` value.
   3. Set it as `GOOGLE_SITE_VERIFICATION` in Vercel, then **Redeploy**.
   4. Press **Verify**.
   5. Go to **Sitemaps** and submit `sitemap.xml`.
2. **Bing Webmaster Tools**:
   1. Add the site. Importing from Google Search Console is the shortest way.
   2. Or use the meta-tag method: copy the `msvalidate.01` content value into
      `BING_SITE_VERIFICATION`, then redeploy and verify.
3. **Yandex Webmaster**:
   1. Add the site and choose the meta-tag method.
   2. Copy the content value into `YANDEX_VERIFICATION`, then redeploy and verify.

The site emits each tag only while its variable is set (`lib/seo.ts`). Keep the variables after
verifying, because the engines re-check them.

---

## 7. Keep the domain (P2, readiness #22)

1. GoDaddy → **My Products → Domains → arpenart.com** → turn **Auto-renew ON**
   *(label may differ)*.
2. Make sure the card on file will still be valid on **2027-10-10**.
3. Check that the registrant email is an inbox Arpine reads; renewal and transfer notices go there.

---

## 8. Public or private repository (P2, readiness #22)

`github.com/yv993/arpenArt` is **public** today. No secrets are in git (`.env*` is ignored,
`imgss/` is ignored). Decide together:

- **Public:** the code doubles as Vardan's portfolio piece. Anyone can read how the shop works,
  but not its settings.
- **Private:** only invited people can see the code. Vercel keeps deploying either way.

To change it: GitHub → the repo → Settings → General → *Danger Zone* → **Change visibility**
*(label may differ)*.

---

## 9. Who owns which account (fill in and keep it with the passwords)

Keep the logins and every secret variable in one shared password manager that both Vardan and
Arpine can open.

| Account | Login owner | Who else has access | Who pays | Recovery email / 2FA |
| --- | --- | --- | --- | --- |
| GitHub repo `yv993/arpenArt` | Vardan (`yv993`) | | free | |
| Vercel project | Vardan (personal scope `yv993s-projects`) today | | | |
| GoDaddy (`arpenart.com`) | Arpine (registrant) | | | |
| Resend | *to decide* | | | |
| Arpine's inbox (`ORDER_TO_EMAIL`) | Arpine | | free | |
| Cloudflare (Turnstile) | *to decide* | | free | |
| Google Search Console / Bing / Yandex | *to decide* | | free | |
| Uptime monitor | *to decide* | | | |
| Password manager | *to decide* | | | |
