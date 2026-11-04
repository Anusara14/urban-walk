<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/wordmark-dark.svg">
    <img src=".github/assets/wordmark-light.svg" alt="URBAN WALK" width="420">
  </picture>
</p>

<p align="center"><em>Don't just walk through the city. Understand the city.</em></p>

<p align="center">
  <strong>v1-beta</strong> · Next.js 16 · MapLibre GL · Supabase (optional) · PWA
</p>

<p align="center">
  Developed by <a href="https://codemypage.com">Codemypage</a> · <a href="https://github.com/Anusara14">Anusara14</a>
</p>

---

URBAN WALK is a mobile-first web app for organised urban walks. It is built for undergraduate planners,
architecture students, researchers, and anyone who wants to understand a city by walking it.
Participants follow a route on an interactive 2D/3D map. They get an alert when they reach a
landmark, read sourced background on it, photograph what they notice, and write down how each place
felt to walk through.

The first event, **Fort to Galle Face** in Colombo, is built from the Young Planners Forum's Google
My Maps export. It is a 3.5 km walk with 10 stops, from the Old Town Hall in Pettah through Colombo
Fort to Galle Face Green and down Galle Road.

## Contents

- [Quick start](#quick-start)
- [What's in the app](#whats-in-the-app)
- [How it works](#how-it-works)
  - [Data: the KML is authoritative](#data-the-kml-is-authoritative)
  - [Hybrid 2D/3D map](#hybrid-2d3d-map)
  - [Location, proximity and privacy](#location-proximity-and-privacy)
  - [Accounts](#accounts)
  - [Organiser dashboard](#organiser-dashboard)
  - [Bandwidth](#bandwidth)
- [Running a walk](#running-a-walk)
- [Deploying with Supabase](#deploying-with-supabase)
- [Project structure](#project-structure)
- [Brand assets](#brand-assets)
- [Status and known limits](#status-and-known-limits)
- [Credits](#credits)

## Quick start

You need Node.js 20 or newer (the tests need Node 23 or newer, which runs TypeScript directly).

```bash
npm install
npm run dev
```

Open <http://localhost:3000> in a phone-width viewport (DevTools device mode works).

With no configuration the app runs in **local mode**. Sign-in, posts, progress and admin edits all
stay in that browser, so you can try every feature without a backend.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server (the service worker runs only in production) |
| `npm test` | Proximity and route-geometry tests (`node --test`) |
| `npm run lint` | ESLint |
| `npm run data:kml` | Regenerate the GeoJSON files and validation report from the KML |
| `npm run data:content` | Re-fetch landmark text and photos from Wikipedia and Wikimedia Commons |

## What's in the app

| Screen | Route | What it does |
|---|---|---|
| Event home | `/` | Hero photo, stops, distance, duration, *Start walking*, a carousel of the stops |
| Walking map | `/walk` | Full-screen 2D/3D map, yellow route, zoom-dependent markers, GPS, floating controls, stop previews |
| Landmark | `/landmark/[id]` | Editorial page: sourced overview, verified organiser notes, photos, observation prompts, participants' posts, related places |
| Discoveries | `/community` | Participants' photos and observations, with appreciation, comments and filters |
| Progress | `/progress` | Stop *N / 10*, distance covered and remaining, time remaining, visited stops |
| Sign in | `/login` | *Continue with Google* (Supabase) or a device profile (local mode); rename, sign out |
| Organiser dashboard | `/admin` | Organisers only, built for desktop and phone. Live overview, moderation, and editors for event details, stops, verified content, the six segments and feature categories |

The yellow camera button on every screen opens photo capture. Observations open from a landmark page
or from Discoveries. Browsing is open to everyone; posting needs an account.

## How it works

### Data: the KML is authoritative

All the geography comes from `data/source/urban-walk.kml`, which is unmodified.
`npm run data:kml` converts it to GeoJSON (EPSG:4326) with a real KML parser (`@tmcw/togeojson`) and
writes a validation report.

```
data/source/urban-walk.kml          the Google My Maps export
data/validation-report.md           counts, bounding box, duplicates, folder differences
public/data/
  urban-walk-route.geojson          the route LineString, all 237 vertices
  urban-walk-landmarks.geojson      points from every folder, with a category for each
  urban-walk-facilities.geojson     public washrooms
  urban-walk-rest-areas.geojson     the two "Possible Rest Area" polygons
  urban-walk-all-features.geojson   everything, with source folder and order
  urban-walk-corridor.geojson       150 m buffer around the route (derived, not from the KML)
  event.json                        event config: stops, names, radii, segments, organiser notes
  landmark-content.json             sourced intros and photos (npm run data:content)
```

- **Validation:** the KML has 35 features. The route has 237 coordinates and is 3.52 km long, and no
  geometry is invalid. The start marker is 0 m from the route's first point and the end marker 1 m
  from its last.
- **Stops:** the 10 points in the `Finalized Layer` folder are the stops. They are numbered by where
  they fall along the route, not by their order in the file.
- **Duplicates:** most stops also appear in the `locations` folder 0–53 m away, sometimes spelled
  differently ("Old Parlimant", "Gall Face Green", "Gaffor Building"). All of them stay in the data.
  The map hides the `locations` copies so markers don't double up, and the original spelling is
  shown on each landmark page.
- **Six segments:** the source map says *"Covers 06 Segments"*, but the export has one LineString and
  no boundaries, so none were invented. Organisers set the boundaries in `/admin → Segments` as
  distances along the original line. Segments always connect and the geometry is never changed.
- **Content:** no history is hand-written. Each overview is the Wikipedia introduction, shown with
  its link and CC BY-SA licence. Photos come from Wikimedia Commons with author and licence credits.
  Organisers add verified sections (history, architecture, urban significance…) in
  `/admin → Content`, and each section needs a source.

### Hybrid 2D/3D map

- **Map engine:** MapLibre GL through [mapcn](https://mapcn.dev). Vector tiles come from
  [OpenFreeMap](https://openfreemap.org), which needs no API key. To use a different OpenMapTiles
  style, set `NEXT_PUBLIC_BASEMAP_STYLE`.
- **3D only near the route:** buildings are flat everywhere. A single `fill-extrusion` layer keeps
  only buildings within `corridor_m` (150 m) of the route, using MapLibre's `distance` expression in
  the tile worker. No 3D geometry is ever built outside the corridor.
- **Zoom-dependent markers:** far out shows numbered dots, medium zoom shows small photos with names,
  and close in shows large photo bubbles with a yellow ring. Markers re-render only when the zoom tier
  changes, and their size animates with `transform`.
- **Route:** a white casing with the remaining route in yellow and the walked part dashed. A pill on
  the line shows the minutes to the next stop.
- **Low-power devices:** on devices with 2 GB of RAM or less, 2 CPU cores or fewer, or Save-Data
  turned on, the map starts in 2D and the frosted-glass blur is off. Every feature still works.

### Location, proximity and privacy

- **Opt-in GPS:** location is requested only on *Start walking* or *My location*. Without it, every
  stop can still be browsed by hand.
- **Arrival alerts** follow tested rules in `src/lib/proximity.ts`:
  - readings less accurate than ±60 m are ignored
  - each stop alerts once
  - at least 45 s between any two alerts
  - a stop alerts again only after you've walked away (2.5× its radius) and 10 minutes have passed
- **Visited stops:** arriving suggests *Mark visited*. Nothing is marked automatically.
- **Photos:**
  - Each photo is re-encoded in the browser (WebP or JPEG, at most 1600 px), which strips its
    metadata, including the camera's own GPS tag.
  - A location is attached only if the participant leaves it switched on. Shared coordinates are
    rounded to about 11 m.
  - The suggested stop link is only a suggestion and can be changed or cleared.
- **Live location** never leaves the device.

### Accounts

Browsing is open. Posting, commenting, appreciating and `/admin` need an account. A signed-out user is
sent to `/login` and returned to the page they were on.

- **Supabase mode:** *Continue with Google*, or *Continue with email* (a passwordless 6-digit code;
  the email's link also works on the same phone). The name labels the participant's posts and can be
  changed on `/login`. Email addresses are never shown to other participants. Email sign-in needs
  custom SMTP in Supabase for anyone outside your organisation; see the setup guide.
- **Organisers:** users whose `app_metadata.role` is `"organiser"`. Only they can open `/admin`, and
  they can delete any post. Row-level security enforces both.
- **Local mode:** a name-only profile on the device. Every local profile counts as an organiser, so
  the console can be tried without a backend.
- **Test access to `/admin`:** on `npm run dev`, or whenever no Supabase project is connected,
  `/admin` opens without an organiser account and shows a *Test mode* banner. The sign-in page also
  links to it. A production deployment with Supabase always requires a real organiser.

### Organiser dashboard

`/admin` has a dark sidebar on desktop, and a sticky top bar with scrollable section tabs on phones.

- **Overview:** live figures that refresh every minute:
  - participants walking and finished, average stops visited
  - photos, observations, comments and appreciations
  - visits by stop and posts by stop
  - the latest posts
- **Moderation:** every post, filterable by type and stop and searchable. It's a table on desktop
  and cards on phones, with delete.
- **Event, Stops, Content, Segments, Features:** the editors. Changes are drafts in the browser until
  you *Export event.json*.

Walking progress is synced to Supabase (`walk_progress`). It records visited stops only, never live
location. Organisers can read it; everyone else can only see their own.

### Bandwidth

- **Photos:** each one is saved twice, at 1600 px and as a 480 px thumbnail. Feeds, map markers and
  the dashboard load only thumbnails; the full photo loads when someone taps it.
- **Map worker:** MapLibre's worker is served from this app, copied by
  `scripts/copy-maplibre-worker.mjs` before `dev` and `build`, so the map has no unpkg dependency.

## Running a walk

1. **Route and stops:** export the walk from Google My Maps as KML, replace
   `data/source/urban-walk.kml`, and run `npm run data:kml`.
2. **Event details:** edit `public/data/event.json`, or use `/admin` and *Export event.json*. This sets
   the title, date, stops, display names, alert radii and segments.
3. **Content:** run `npm run data:content` to fetch Wikipedia intros and Commons photos
   (`scripts/fetch-content.mjs` maps each stop to its articles). Add verified organiser notes in
   `/admin → Content`.
4. **Publish:** deploy. Admin changes made in the browser are drafts until the exported
   `event.json` replaces the file in `public/data/`.

## Deploying with Supabase

Without Supabase, everything stays on each participant's device. The full step-by-step guide is
**[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**. In short:

1. **Create a Supabase project** (Mumbai or Singapore region) and run
   `supabase/migrations/0001_urban_walk.sql` in the SQL editor. It sets up:
   - PostGIS and the tables, with row-level security
   - a `photos` bucket limited to WebP/JPEG files up to 3 MB
   - rate limits on posts and comments
   - the organiser role, and organiser read access to progress
2. **Create a Google OAuth client** (web application). Its redirect URI is
   `https://PROJECT-REF.supabase.co/auth/v1/callback`. Publish the consent screen, then enable
   **Google** under Supabase **Auth → Providers**.
3. **Set the Site URL and Redirect URLs** in Supabase to your Vercel domain.
4. **Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`** to `.env.local` and to
   Vercel's environment variables, then redeploy.
5. **Make organisers:** each person signs in once, then you run one SQL update per person (in the guide).

Admin drafts stay in the browser in both modes until they're exported.

## Project structure

```
src/
  app/                      routes (App Router), manifest, icons
  components/
    map/                    WalkMap, 3D corridor layers, zoom-tiered markers
    walk/ landmark/ home/   screens
    community/ auth/        Discoveries cards, sign-in
    admin/                  dashboard: overview, moderation, editors
    providers/              event model and walk state (GPS, progress, posts)
    uw/                     design system: sheet, composer, nav, brand, badges
    ui/map.tsx              mapcn (vendored by the shadcn CLI, not edited)
  lib/                      geo maths, proximity rules, auth, data backend, types
scripts/                    KML → GeoJSON, content fetcher, MapLibre worker copy
docs/                       Supabase + Google + Vercel setup guide
supabase/migrations/        schema, RLS, storage, functions
tests/                      node:test suites
public/sw.js                offline service worker
```

## Brand assets

| Logo | Used for | File |
|---|---|---|
| Text logo | The only logo inside the app UI (`<Wordmark>`) | `public/brand/urban-walk-wordmark.svg` |
| Header logo (yellow circle) | Browser tab icon only | `src/app/icon.svg` |
| Add-to-home-screen logo (yellow square) | Installed-app icon on iOS and Android, including Android's cropped icon shapes | `public/brand/urban-walk-app-icon.svg` → `public/icon-*.png`, `src/app/apple-icon.png` |

## Status and known limits

This is **v1-beta**.

| Status | Area |
|---|---|
| ✅ Tested | Lint, type checks, the test suite and the production build all pass. Every screen and the core flows were checked in a mobile browser: map, 3D, segments, proximity alerts with simulated GPS, photo posts, comments and likes, device sign-in, the admin gate. |
| ⚠️ Not yet tested | The Supabase path (Google sign-in, shared posts, storage, synced progress) and offline mode on a real phone. Follow the trial-run checklist in the setup guide before an event. |

Known limits:

- **Building heights:** OpenStreetMap has few building heights for Colombo, so most buildings extrude
  to the 5 m default.
- **3D corridor:** changing `corridor_m` in admin moves the 3D cut-off. The pale strip drawn under it
  stays at 150 m until you re-run `npm run data:kml`.
- **Event date:** it isn't in the source data, so the home screen shows *Date to be announced* until
  you set it.
- **No Content Security Policy yet:** MapLibre needs `blob:` workers, so a policy needs testing
  against the deployed site first.
- **Map tiles** come from OpenFreeMap, a free service with no uptime guarantee. That's fine at this
  scale; self-hosting a Colombo tile extract would remove the dependency.

## Credits

- **Developed by** [Codemypage](https://codemypage.com) · [Anusara14](https://github.com/Anusara14).
- **Route and stops:** Young Planners Forum, Urban Walk 01.
- **Map data:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, served by
  [OpenFreeMap](https://openfreemap.org).
- **Landmark text:** [Wikipedia](https://en.wikipedia.org), CC BY-SA 4.0, linked on each page.
- **Photos:** [Wikimedia Commons](https://commons.wikimedia.org) contributors. The author and licence
  are credited under each image.
