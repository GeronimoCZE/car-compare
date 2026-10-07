# Development notes

A Heureka-style aggregator for used cars. It collects listings from CZ/SK marketplaces and dealer feeds, reads the free-text ads to extract make, model, year, mileage, engine, fuel, gearbox and **condition** (drivable / damaged / non-running / for parts / spare parts), compares every car with similar ones, and sends buyers to the source listing.

"Autolupa" is a working name; change it with `NEXT_PUBLIC_SITE_NAME`.

## What's inside

| Area | Where |
| --- | --- |
| Next.js 16 app (App Router), Czech `/cs` and Slovak `/sk` | `src/app/[locale]` |
| PostgreSQL schema (Drizzle ORM) and migrations | `src/db/schema.ts`, `drizzle/` |
| Listing text parser (rules, negation-aware, Czech/Slovak inflection) | `src/parser/extract.ts`, `src/parser/catalog.ts` |
| Optional Claude fallback for ambiguous ads (cached, budgeted) | `src/parser/llm.ts` |
| Source adapters: Bazoš, generic sitemap + schema.org JSON-LD, partner XML/RSS feeds, demo data | `src/ingest/sources/` |
| Polite crawler (robots.txt, per-host rate limit, retries) | `src/ingest/http.ts` |
| Ingest pipeline, liveness checks, market medians and deal scores | `src/ingest/pipeline.ts`, `src/ingest/market.ts` |
| Worker schedule | `scripts/worker.ts` |
| Admin (sources, runs, listing corrections, reports, users, parser playground) | `src/app/[locale]/admin` |

### Features
- Landing page with search, popular makes, best deals of the day, newest listings.
- Search with filters (make, model, price, year, mileage, power, fuel, gearbox, body, condition, country, seller, VAT, source), sorting, pagination.
- SEO landing pages per make and model (`/cs/auta/skoda/octavia`) with a price-by-year chart and table, canonical URLs, hreflang cs/sk, JSON-LD (`WebSite`, `Car` + `Offer`), dynamic `sitemap.xml`, `robots.txt`, `noindex` on filter permutations.
- Listing page: parsed parameters, condition labels and notes, market median and % below/above market, price history, the same car on other sites, similar cars, report button, outbound redirect `/go/:id`.
- Accounts: register, login, password reset (email via `SMTP_URL`), profile, language, change password, bookmarks with "price dropped since you saved it", saved searches with new-match counters, GDPR data export, account deletion.
- Side-by-side comparison of up to 4 cars (no account needed).
- Terms, privacy policy, cookie policy, cookie banner, about/partner page with the XML feed spec.
- Prices are stored in the original currency and normalised to CZK (CNB daily rate); Czech visitors see Kč, Slovak visitors see €.

### Keeping listings fresh
- Crawl every 20 min; each adapter stops paging once it reaches known listings.
- Liveness check every 10 min re-verifies the least recently checked listings and marks removed ones (404, "inzerát byl smazán", redirect to category, `SoldOut` in JSON-LD).
- Snapshot feeds: anything missing from a partner's feed is removed immediately.
- Listings from a disabled source that haven't been seen for 72 h are hidden rather than shown stale.

## Running locally

```bash
cp .env.example .env            # adjust DATABASE_URL etc.
npm install
npm run db:migrate
ADMIN_EMAIL=you@example.cz ADMIN_PASSWORD='change-me' npm run seed -- --demo   # --demo adds synthetic listings
npm run ingest -- crawl demo_cz && npm run ingest -- crawl demo_sk && npm run ingest -- market
npm run dev                      # http://localhost:3000
npm run worker                   # background jobs, in a second terminal
npm test                         # parser, adapter and market tests
```

Or `docker compose up --build` (Postgres, migrations + seed, web, worker).

## Security and caching

- **CORS:** the API is same-origin only. `src/proxy.ts` refuses cross-origin requests and preflights with 403 and never sends `Access-Control-Allow-*` headers. Mutating routes also check `Origin`/`Sec-Fetch-Site` (CSRF), on top of `SameSite=Lax` cookies and Next's own server-action origin check.
- **CSP:** every page gets a per-request nonce; only scripts carrying it run (`'strict-dynamic'`), no inline handlers, no framing (`frame-ancestors 'none'`), forms post only to this site. Non-page responses get `default-src 'none'`. Plus HSTS (preload), COOP, nosniff, Referrer-Policy, Permissions-Policy.
- **Sessions:** random 256-bit token, only its SHA-256 is stored; cookie is `__Host-sid`, httpOnly, Secure, SameSite=Lax. Password change or reset signs out all other devices; resets burn every outstanding link. Expired sessions are purged nightly.
- **Passwords:** bcrypt cost 12, 8–128 chars; login timing doesn't reveal which emails exist.
- **Rate limits:** login (per account and per IP), registration, password reset, reports, bookmarks, saved searches. Set `TRUST_PROXY_HOPS` to the number of proxies in front of the app so client IPs can't be spoofed via `X-Forwarded-For`. The limiter is in-memory per process; with several web instances, put it behind a shared store (Redis) or a proxy-level limit.
- **Input:** JSON bodies capped at 8 KB and validated; admin form values checked against DB enums; JSON-LD escaped.
- **Crawler SSRF guard:** every fetch and redirect hop is resolved and refused if it points to private, loopback or cloud-metadata addresses; bodies capped at 50 MB. Admin-entered feed URLs are checked when saved.
- **Admin:** every admin action re-checks the session and is written to `admin_audit` (shown on the dashboard).
- **Disclosure:** `/.well-known/security.txt`.

Caching: public listing data (search results, facets, landing sections, listing detail, price history) is held in Next's data cache for 1–5 minutes and shared by all visitors; per-user data (bookmarks, account) is never cached. Admin edits invalidate the cache immediately. `/api/models` and `/api/listings` are publicly cacheable for a few minutes; every other API response is `private, no-store`. Static assets are immutable-cached by Next.

## Sources and legal status

Every real source is **disabled by default**. Enable a source in Admin → Zdroje only once its terms allow it or the operator has agreed. The crawler always obeys robots.txt.

| Source | Status |
| --- | --- |
| Bazoš.cz / Bazoš.sk | Terms forbid automated use and unofficial apps without consent; robots.txt blocks known price-comparison bots. Adapter is built; needs written consent. |
| Sbazar.cz, Sauto.cz (Seznam) | robots.txt disallows generic crawlers, so the crawler refuses. Needs a data agreement with Seznam. |
| TipCars | robots.txt allows listing pages and publishes a sitemap; verify terms and the URL pattern before enabling. |
| Autobazar.eu (SK) | Not verified yet; ask for a partner feed. |
| Dealer XML feeds | The clean route: dealers send a feed URL (format in `docs/feed-spec.md`), added in Admin. |

The Claude fallback is off unless `ANTHROPIC_API_KEY` is set. Only listing text is sent, results are cached by content hash, and `LLM_MAX_CALLS_PER_RUN` caps spend per run.

Legal texts in `src/content/legal.tsx` are a starting template. Fill in `OPERATOR_NAME`, `OPERATOR_ID`, `OPERATOR_ADDRESS` and have a lawyer review them.
