# Stockist logos

Each shop on `/find-in-store` can show its own logo. Until a file lands here the
card falls back to a **monogram chip** (the shop's initials in the measured
palette) — which is a deliberate design, not a broken image, so the page is
never waiting on these.

## Drop the files here

Save each logo at this exact name (PNG, JPG or WEBP all work — the encoder picks
whatever it finds):

| file                     | shop                                            |
| ------------------------ | ----------------------------------------------- |
| `note-mote.*`            | Note Mote (both Northern Avenue shops share it)  |
| `made-by-armenia.*`      | Made by Armenia — Arami St, Yerevan              |
| `anyutis.*`              | Anyut Is / Anyutis — Dilijan                     |
| `tic-dilijan.*`          | TIC — Dilijan Tourist Information Center         |
| `nrani.*`                | Nrani — Dilijan                                  |
| `crafts-of-armenia.*`    | Crafts of Armenia — Garni                        |

Then run:

```bash
node scripts/stockist-logos.mjs
```

It writes optimised `*.webp` next to the sources and reports what it found. The
site reads the `.webp`. Re-run it any time a logo is replaced.

## A note on the dark ones

Two of these marks (Crafts of Armenia, Anyutis) are drawn for a **dark**
background. They are not recoloured — a retailer's mark is theirs — so the card
gives them a dark chip to sit on instead, set by `logoDark: true` on the shop in
`lib/content.ts`. Everything else sits on paper.

Logos are used here to identify shops that carry the work. If any shop asks not
to be shown, delete its file and remove `logo` from its entry: the monogram
takes over on its own.
