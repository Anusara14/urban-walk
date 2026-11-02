// Pulls sourced intro text and Commons photos for each landmark.
// Run: npm run data:content   (writes public/data/landmark-content.json)
// Nothing here is written by hand: every paragraph and image carries its source URL
// and licence so organisers can verify or replace it in /admin.
import { writeFileSync } from "node:fs";

const UA = { "User-Agent": "UrbanWalk/0.1 (Young Planners Forum demo)" };
const WIKI = "https://en.wikipedia.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";

// feature id -> { article: exact Wikipedia article about the place, area: broader article
// used only when no article exists, commons: search term for photos }
const MAP = {
  "finalized-layer--09--old-town-hall-building-and-museum": { area: "Pettah, Sri Lanka", commons: "Old Town Hall Pettah Colombo", drop: /Marikkar/ },
  "finalized-layer--03--jami-ul-alfar-mosque": { article: "Jami Ul-Alfar Mosque", commons: "Jami Ul-Alfar Mosque" },
  "finalized-layer--07--gaffor-building": { article: "Gaffoor Building", commons: "Gaffoor Building", drop: /Abdul_Gaffoor/ },
  "finalized-layer--08--cargills-building": { area: "Fort (Colombo)", commons: "Cargills building Colombo Fort" },
  "finalized-layer--05--de-mel-building": { area: "Fort (Colombo)", commons: "De Mel building Colombo", drop: /Steel Blues|SB_flagship/ },
  "finalized-layer--02--historic-central-point-building": { area: "Fort (Colombo)", commons: "Central Point building Colombo", drop: /Kollupitiya/ },
  "finalized-layer--06--colombo-old-clock-tower": { article: "Old Colombo Lighthouse", commons: "Old Colombo Lighthouse clock tower" },
  "finalized-layer--00--old-parlimant": { article: "Old Parliament Building, Colombo", commons: "Old Parliament Building Colombo" },
  "finalized-layer--01--gall-face-green": { article: "Galle Face Green", commons: "Galle Face Green Colombo", drop: /World Trade|Roundabout/ },
  "finalized-layer--04--sltda": { area: "Kollupitiya", commons: "Galle Road Kollupitiya Colombo" },
  "locations--07--grand-oriental-hotel": { article: "Grand Oriental Hotel", commons: "Grand Oriental Hotel Colombo" },
  "locations--08--old-general-post-office-gpo": { article: "Former General Post Office, Colombo", commons: "General Post Office Colombo Fort", drop: /Ceylon_-_btv|Amerique/ },
  "locations--15--dutch-museum": { article: "Colombo Dutch Museum", commons: "Dutch Period Museum Colombo" },
  "locations--04--colombo-railway-station": { article: "Fort railway station", commons: "Colombo Fort railway station" },
  "locations--02--the-old-hospital": { article: "Old Colombo Dutch Hospital", commons: "Old Dutch Hospital Colombo" },
  "locations--13--one-galle-face-mall": { article: "One Galle Face", commons: "One Galle Face Colombo" },
  "locations--12--colombo-port-city-foot-bridge": { article: "Port City Colombo", commons: "Port City Colombo" },
};

const cache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (base, params) => {
  const url = `${base}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  if (cache.has(url)) return cache.get(url);
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(800);
    const res = await fetch(url, { headers: UA });
    if (res.status === 429) { await sleep(4000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const json = await res.json();
    // Commons sometimes answers 200 with an error body when throttling
    if (json.error) { await sleep(4000 * (attempt + 1)); continue; }
    cache.set(url, json);
    return json;
  }
  throw new Error(`rate limited: ${url}`);
};

async function intro(title) {
  const d = await get(WIKI, { action: "query", prop: "extracts|info", exintro: "1", explaintext: "1", inprop: "url", redirects: "1", titles: title });
  const page = Object.values(d.query.pages)[0];
  if (!page.extract) return null;
  return {
    title: page.title,
    url: page.fullurl,
    paragraphs: page.extract.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 40),
    license: "CC BY-SA 4.0",
  };
}

const strip = (html = "") => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function photos(term, limit = 4) {
  const d = await get(COMMONS, {
    action: "query", generator: "search", gsrsearch: `${term} filetype:bitmap`, gsrnamespace: "6", gsrlimit: String(limit),
    prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "960",
  });
  if (!d.query) return [];
  return Object.values(d.query.pages)
    .sort((a, b) => a.index - b.index)
    .map((p) => {
      const ii = p.imageinfo[0];
      const m = ii.extmetadata ?? {};
      return {
        // thumburl has the width in its path; the app rewrites it for smaller sizes
        src: ii.thumburl,
        width: ii.thumbwidth,
        height: ii.thumbheight,
        page: ii.descriptionurl,
        caption: strip(m.ImageDescription?.value).slice(0, 160),
        author: strip(m.Artist?.value).slice(0, 80),
        license: m.LicenseShortName?.value ?? "see source",
      };
    });
}

const out = {};
for (const [id, cfg] of Object.entries(MAP)) {
  const article = cfg.article ? await intro(cfg.article) : null;
  const area = !article && cfg.area ? await intro(cfg.area) : null;
  out[id] = { article, area, photos: (await photos(cfg.commons, 5)).filter((ph) => !cfg.drop?.test(ph.page + ph.caption)).slice(0, 4) };
  console.log(id, article ? "article" : area ? "area" : "-", out[id].photos.length, "photos");
}
writeFileSync("public/data/landmark-content.json", JSON.stringify({ fetched_at: new Date().toISOString(), landmarks: out }, null, 1) + "\n");
