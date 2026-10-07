<div align="center">

<img src="docs/logo.svg" width="88" alt="Autolupa logo" />

# Autolupa

**Find a used car at a fair price.**<br/>
A price comparison site for used cars in Czechia and Slovakia that reads every ad and tells you whether the price is good.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-AI_parser-D97757?logo=anthropic&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-16a34a)

🇨🇿 Čeština · 🇸🇰 Slovenčina · Kč · €

<br/>

<img src="docs/screenshots/home.png" alt="Autolupa home page" width="100%" />

</div>

<br/>

## ✨ Highlights

| | |
|---|---|
| 🔎 **All the ads in one place** | Listings from Czech and Slovak marketplaces and dealer feeds, searchable together |
| 🧠 **Smart ad reader** | Works out make, model, year, mileage, engine, fuel and gearbox from free text, in Czech and Slovak |
| 🏷️ **Honest condition labels** | Drivable, damaged, non-running and parts-only cars are labelled clearly and kept apart |
| 📊 **Fair price check** | Every car is compared with similar ones, so you see at a glance how far it is below or above the market |
| 🔁 **Same car, other sites** | Spots the same car advertised on more than one site and shows its price history |
| 🔄 **Always up to date** | New ads every 20 minutes; sold and removed ads disappear on their own |
| ⭐ **For signed-in users** | Bookmarks with price-drop alerts, saved searches and side-by-side comparison |
| 🌍 **Two countries** | Czech and Slovak, with prices in Kč or € at the daily Czech National Bank rate |
| 🔎 **SEO ready** | A landing page for every make and model, structured data, sitemap and clean URLs |
| 🎛️ **Admin panel** | Sources, crawl runs, parser checks, reports, users and an audit log |

<br/>

## 🖼️ A closer look

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/model.png" alt="Model page with prices by year" /><br/><sub><b>Model pages</b>: typical prices for every production year, then the cars on offer</sub></td>
    <td width="50%"><img src="docs/screenshots/listing.png" alt="Listing detail" /><br/><sub><b>Listing</b>: price against the market, parameters read from the ad, one click to the seller</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/conditions.png" alt="Search filtered by condition" /><br/><sub><b>Condition filters</b>: damaged, non-running and parts-only cars only when you ask for them</sub></td>
    <td><img src="docs/screenshots/compare.png" alt="Side-by-side comparison" /><br/><sub><b>Compare</b>: up to four cars side by side, the best value in each row highlighted</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/admin-dashboard.png" alt="Admin dashboard" /><br/><sub><b>Admin dashboard</b>: listings, sources, crawl runs and the audit log</sub></td>
    <td><img src="docs/screenshots/search-sk.png" alt="Slovak version" /><br/><sub><b>Slovak version</b>: every page in Slovak, with prices in euros</sub></td>
  </tr>
</table>

<div align="center">
  <img src="docs/screenshots/mobile-home.png" width="24%" alt="Mobile home" />
  &nbsp;
  <img src="docs/screenshots/mobile-search.png" width="24%" alt="Mobile model page" />
  &nbsp;
  <img src="docs/screenshots/mobile-listing.png" width="24%" alt="Mobile listing" />
  <br/><sub><b>On the phone</b>: the same site, made for thumbs</sub>
</div>

<br/>

## 🚗 For buyers

- **Quick search** from the landing page by make, model, price and year
- **Detailed filters** for mileage, power, fuel, gearbox, body, condition, country, seller type and VAT
- **Market price** for every car, worked out from comparable drivable cars only
- **Best deals** of the day on the landing page
- **Accounts** with bookmarks, saved searches with new-match counts, data export and account deletion
- **Clear legal pages**: terms, privacy policy and cookie policy, plus a cookie banner

## 🧑‍💼 For the site owner

- **Sources** switched on and off from the admin, each with its legal status noted
- **Dealer XML feeds** added in a minute, with a published feed format for car dealers
- **Parser checks**: low-confidence ads, the evidence behind every value, and one-click corrections
- **Reports** from users about wrong or sold ads, with hide and resolve actions
- **Users**: roles and blocking, with every admin action written to an audit log

## 🧱 Built with

| Layer | Technology |
|---|---|
| Website and admin | Next.js 16, React 19, Tailwind CSS 4 |
| Database | PostgreSQL 16, Drizzle ORM, full-text search |
| Listing reader | Rule-based Czech and Slovak parser, with Claude for unclear ads |
| Data collection | Polite crawler that respects robots.txt, plus XML and RSS feeds |
| Background jobs | Scheduled worker for crawling, freshness checks, market prices and exchange rates |
| Security | Same-origin API (CORS), nonce-based CSP, rate limiting, bcrypt, secure cookies, SSRF protection |

<br/>

## 🚀 Getting started

The site runs with Docker in a single step, and an optional demo data set lets you explore it before any real source is connected.

Installation, configuration, data sources and deployment notes are in **[docs/SETUP.md](docs/SETUP.md)**.

<br/>

## 👤 Author

Designed and built by **Nikolas Malík**.<br/>
🌐 [malikweb.eu](https://malikweb.eu) · GitHub [@GeronimoCZE](https://github.com/GeronimoCZE)

## 📄 License

Released under the [MIT License](LICENSE). © 2026 Nikolas Malík
