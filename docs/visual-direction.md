# Parcel Globe: visual direction

_Research date: 2026-10-07. Every page URL below was fetched or came from search results. Every image URL returned HTTP 200 when I checked it on that date, except where noted._

App concept: a dark 3D globe (globe.gl / three.js) that shows a person's packages as glowing arcs (origin → hubs → home). In-transit arcs carry a moving light dot. Delivered arcs fade over time. There is also a shareable "year in review" card.

---

## 1. References (8)

| # | Reference | Page URL | Image URL | What to borrow |
|---|---|---|---|---|
| 1 | **GitHub homepage globe** ("How we built the GitHub globe", Tobias Ahlin, Dec 2020) | https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/ | https://github.blog/wp-content/uploads/2020/12/102393310-07478b80-3f8d-11eb-84eb-392d555ebd29.png?resize=1200%2C630 (layer breakdown GIF: https://github.blog/wp-content/uploads/2020/12/layers-loop.h264.2020-12-21-11_16_56.gif?resize=640%2C409) | Land is drawn from about 12,000 instanced 5-sided circles with no texture. A halo comes from a backside-sphere shader, tilted toward the top-left. Each arc ends with a landing animation: a solid dot that stays, plus a ring that scales up and fades (6% ease-per-frame). Dots fade out by camera distance, which kills moiré at the globe's limb. |
| 2 | **Stripe globe** ("To design and develop an interactive globe", Sept 2020) | https://stripe.com/blog/globe | https://images.stripeassets.com/fzn2n1nzq965/3ucIBArfJ9br4MYDqULl6h/50c6a09d4e8b642f15ca630d14103462/blog-globe-post-social.jpg?q=80 | Three stacked layers: a semi-transparent ocean sphere, about 60k "sunflower"/Fibonacci-spiral dots (even spacing pole to pole), and arcs that travel between pulsing discs. The arcs are cubic-bezier tubes revealed with `setDrawRange` over 2.5 s. Arc height is distance × 0.5. The look is very thin, restrained lines on deep navy. |
| 3 | **globe.gl "Arc Links" + "US airline routes" examples** (vasturiano) | https://vasturiano.github.io/globe.gl/example/random-arcs/ · https://vasturiano.github.io/globe.gl/example/airline-routes/us-international-outbound.html | https://vasturiano.github.io/globe.gl/example/random-arcs/preview.png (routes: https://vasturiano.github.io/globe.gl/example/airline-routes/preview.png) | The baseline for our exact stack. `arcDashLength`/`arcDashGap`/`arcDashAnimateTime` turn an arc into a travelling dash, and a two-colour gradient array encodes direction. The routes example shows how a single hub fans out arcs. |
| 4 | **globe.gl "Hexed Country Polygons"** | https://vasturiano.github.io/globe.gl/example/hexed-polygons/ | https://vasturiano.github.io/globe.gl/example/hexed-polygons/preview.png | GitHub's dotted-land look in a few lines, with `hexPolygonsData` + `hexPolygonUseDots(true)` + `hexPolygonMargin`. No custom shader needed. |
| 5 | **"Flights" by rsmb**: a personal flight history on react-globe.gl | https://www.rsmb.tv/projects/flights (live: https://www.rsmb.tv/projects/flights/map) | https://www.rsmb.tv/images/flights/flight-globe.webp | The closest analogue to Parcel Globe: one person's history on a night-lights globe. A collapsible stats side panel holds totals (distance, countries, top routes). Filters cover year, airport and airline. Deep links let you share a view. Open source: https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/flights |
| 6 | **NASA Black Marble (Earth at Night)** | https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/ | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg | A near-black planet where light only means people, so your home city and hub cities glow on their own. The globe.gl-ready version ships in three-globe as `//unpkg.com/three-globe/example/img/earth-night.jpg` (200 OK). Public domain (NASA). |
| 7 | **Dribbble "Parcels" logistics globe dashboard** (from the Dribbble "globe dashboard" search) | https://dribbble.com/search/globe-dashboard (search results page; I did not open the individual shot page) | https://cdn.dribbble.com/userupload/45295392/file/c4b6efc5bc375a5165c693e23ac5e6e2.jpg | Shows what UI chrome around a parcel globe can look like: glassy dark cards for "On the way / Delivered / Waiting" with coloured status icons (blue, green, amber). A "Parcels in the way 24/75" floating callout is pinned near the globe, plus ring-progress gauges. Borrow the status colour coding and the floating callout. Skip the dashboard density. |
| 8 | **Spotify Wrapped 2024 summary share card** | https://newsroom.spotify.com/2024-12-04/wrapped-user-experience-2024/ | https://i0.wp.com/musically.com/wp-content/uploads/2024/12/SummaryShareCard-scaled.jpg?fit=2560%2C1440&ssl=1 (third-party host; Spotify's own copy at storage.googleapis.com/pr-newsroom-wp/1/2024/12/SummaryShareCard.jpg returns 403 to hotlinking) | A 9:16 story card: one hero visual on top, then two short ranked lists, then one huge number (minutes) and a URL footer. It comes in several bold colourways the user can swipe through before sharing. Copy that layout for "Year in Parcels". |

**Bonus (light-mode counterpoint):** Cloudflare network globe, https://www.cloudflare.com/network/, image https://www.cloudflare.com/cdn-cgi/image/format=auto,quality=75/static/globe.png. It shows warm orange halftone dots on a cream sphere with faint graticules. It's the basis for Direction C.

**Not included:** Strava Year in Sport (only Instagram/Facebook crawler images were found, no stable first-party image), Vercel's globe, and Flightradar24 (only an old 2D blog image). Add them later if needed.

---

## 2. Visual directions

### A. "Night Mail" ★ recommended
Black Marble meets GitHub's dotted land, with warm parcel light.
- **Palette**
  - Space background `#05070D`
  - Globe body `#0A0F1E`
  - Land dots `#1E2B47` (at 60–80% alpha)
  - City lights: earth-night texture at about 35% brightness
  - **In-transit arc** gradient `#FF8A3D → #FFC86B`
  - **Moving dot** `#FFF3D6` (bloomed)
  - **Delivered arc** `#4FD1C5`, fading toward 0 alpha
  - Delayed/exception `#FF4D6D`
  - Home marker `#FFFFFF` with a `#FFC86B` ring pulse
  - Atmosphere `#3B5BDB`
  - UI text `#E6EAF2` / muted `#7C8799`
- **Type:** Inter (UI) + JetBrains Mono or IBM Plex Mono for tracking numbers, ETAs and coordinates. The mono numerals give a "manifest" feel.
- **Arcs and dots:** a thin static base arc (in-transit colour at about 25% alpha), plus one short bright dash travelling origin → hub → home. Hub legs fly lower (altitude scale about 0.25) and the long-haul leg flies higher (about 0.45). On arrival, a ring ripple at home (GitHub-style). Delivered arcs turn teal and lose alpha over about 30 days, so last week's deliveries are a soft teal haze and last quarter's are ghosts.
- **Globe texture:** a dark body plus hex dots for land (`hexPolygonUseDots`). Optionally blend earth-night city lights underneath so home and hub cities glow.
- **UI chrome:** minimal frosted-glass panels (`rgba(10,15,30,0.6)` + `backdrop-filter: blur(16px)`, 1px `#ffffff14` border). Left rail lists packages as "manifest rows": carrier glyph, mono tracking number, status pill. Hovering a row highlights its arc and dims the others (globe.gl's highlight-links pattern). A top-right counter reads "3 in transit · 41 delivered".
- **Year-in-review card (1080×1920 + 1200×630 OG):** a black card with a cropped globe rising from the bottom edge showing the whole year's arcs in amber over teal. The headline is a big number, e.g. "**127 parcels · 284,000 km**", which is "7.1× around the Earth". It has three mono-type stat rows (farthest origin, busiest month, top carrier) and a postmark-style circular stamp with the year. Swipeable colourways (amber, teal, magenta), as Wrapped does.

### B. "Octo Neon"
The GitHub/Stripe SaaS-hero aesthetic, pushed further.
- **Palette:** background `#0D0B1F`; globe `#15123A`; dots `#3A3570`; arcs `#FF4FD8 → #7C5CFF`; moving dot `#FFFFFF`; delivered `#38BDF8` fading; atmosphere `#7C5CFF`, altitude 0.25.
- **Type:** Space Grotesk / Mona Sans for headlines, Inter for UI.
- **Arcs:** thicker tube arcs (`arcStroke` 0.6) with strong bloom, plus GitHub-style "spires" (`pointsData` cylinders) at origins of packages still waiting to ship.
- **Texture:** pure hex-dot land, no photo texture, with a tilted halo.
- **Chrome:** gradient-bordered cards and a purple glow.
- **Year card:** neon gradient background with the globe centred and the stats underneath, very "Wrapped".
- **Risk:** reads like every dev-tool landing page, so it's less ownable.

### C. "Air Mail" (light mode)
Cloudflare halftone meets vintage postal ephemera.
- **Palette:** paper `#F7F1E6`; globe `#FBF6EE`; land dots `#E2603A`; graticule `#E8DCCB`; in-transit arcs alternate air-mail red `#C8102E` / blue `#1D3E8A` (envelope-border stripes using `arcDashLength`/`arcDashGap` ≈ 0.02/0.02); moving dot `#1D3E8A`; delivered `#8A8F98` fading; no atmosphere (or `#E8DCCB`, low).
- **Type:** Fraunces or "GT Sectra"-style serif headlines, IBM Plex Mono for data.
- **Chrome:** paper cards, perforated edges, rubber-stamp status badges ("IN TRANSIT", "DELIVERED").
- **Year card:** a postcard/stamp sheet with the globe in a scalloped stamp frame, a cancellation postmark with year and parcel count, and handwritten-style destination list.
- **Risk:** bloom/glow doesn't work on light backgrounds, so the "glowing arcs" brief is weaker. It's best as an alternate theme or as the share card only.

### Recommendation: **A "Night Mail"**, borrowing C's postmark motif for the share card
- **It fits the brief.** "Glowing arcs on a dark globe" needs a dark ground for bloom to read. Night Mail is built around that.
- **The colour carries meaning.** Amber vs teal encodes state (moving vs arrived) at a glance, and warm amber ties to cardboard and porch lights, which is better than the generic SaaS purple of B.
- **Home glows on its own.** Black Marble city lights make the user's home and the big hubs (Memphis, Louisville, Shenzhen…) glow without extra markers, and the globe looks good even with zero packages.
- **It stays distinct.** It sits apart from the GitHub/Stripe look the project will inevitably be compared to, and it's cheap to implement: everything is native globe.gl plus one bloom pass.
- **The share card gets personality.** A postmark stamp from C makes it distinctive and screenshot-friendly.

---

## 3. Technical tips (globe.gl / three.js)

Unless noted, all API names come from the globe.gl README: https://github.com/vasturiano/globe.gl

**Globe and land**
```js
const globe = new Globe(el, { rendererConfig: { antialias: false, alpha: true } }) // GitHub and Stripe both turned AA off for perf
  .backgroundColor('#05070D')
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg') // Black Marble; or omit and style globeMaterial
  .showAtmosphere(true).atmosphereColor('#3B5BDB').atmosphereAltitude(0.18)
  .hexPolygonsData(countries.features)            // ne_110m_admin_0_countries geojson (as in hexed-polygons example)
  .hexPolygonResolution(3).hexPolygonMargin(0.65)
  .hexPolygonUseDots(true).hexPolygonColor(() => 'rgba(30,43,71,0.8)');
const m = globe.globeMaterial(); m.color.set('#0A0F1E'); m.emissive.set('#0A0F1E'); m.emissiveIntensity = 0.1; m.shininess = 0;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
```
- To get GitHub's fade at the limb (anti-moiré), modify the dot material via `onBeforeCompile` so alpha falls with `gl_FragCoord.z`. GitHub's snippet: `gl_FragColor.a = 1.0 + (fadeThreshold - gl_FragCoord.z) * alphaFallOff`.
- Start the camera over the user's home with `globe.pointOfView({ lat, lng, altitude: 2.2 }, 1500)`. GitHub's no-lookup trick was to derive rotation from `getTimezoneOffset()`.

**In-transit arcs with a moving light dot**
- Push each leg as two data items: a **base** arc (`dashLength 1, gap 0`, colour at about 25% alpha) and a **comet** arc (`arcDashLength 0.06`, `arcDashGap 2`, `arcDashInitialGap Math.random()`, `arcDashAnimateTime` ≈ 1500–4000 ms scaled by distance). The gap of more than 1 means only one dash is on the arc at a time, so it reads as a travelling dot.
- `arcColor` takes an array for a gradient. Use `['rgba(255,138,61,0)', '#FFC86B']` so the comet has a tail.
- Use `arcStroke(0.35–0.6)` (tube geometry) on the comet so bloom has area to glow. Keep the base arc at `null` (1px line) for cheapness.
- Altitude: `arcAltitudeAutoScale(0.3–0.45)`, or set `arcAltitude` per leg so hub-to-hub legs sit lower.
- If you need the dot at its **real** progress (e.g. 62% of the way by ETA), skip dashes. Instead compute the position with `d3.geoInterpolate([lng1,lat1],[lng2,lat2])(t)` and render a sprite through `objectsData`/`customLayerData` or `particlesData` (additive-blended radial-gradient texture), updating `t` each frame. Stripe used `geoInterpolate` for its bezier control points too.
- Multi-hop routes (origin → hub → hub → home): either chain arcs and stagger `arcDashInitialGap` so the dot appears to hand off, or use `pathsData` with `pathDashAnimateTime` for one continuous polyline.

**Delivered fade**
- `alpha = Math.max(0.04, Math.exp(-ageDays / 30))`. Return `rgba(79,209,197,alpha)` from `arcColor`, and re-call `arcsData()` once a day or on load, not every frame.
- On delivery, play a home ripple: `ringsData([{lat,lng}])`, `ringColor(() => t => \`rgba(255,200,107,${1-t})\`)`, `ringMaxRadius(3)`, `ringPropagationSpeed(2)`, `ringRepeatPeriod(800)`. Then remove it after a few seconds. This is GitHub's landing ring.

**Glow / bloom**
```js
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
globe.postProcessingComposer().addPass(
  new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.2 /*strength*/, 0.6 /*radius*/, 0.2 /*threshold*/));
```
- Keep the globe body and land dots dark, below the threshold, so only arcs, comets and home bloom. Raise the threshold (0.4–0.6) if city lights bloom too much. For finer control, use selective bloom (a second layer/composer) on arcs only.
- The atmosphere is a built-in shader. Lower `atmosphereAltitude` if bloom makes it too hazy.

**Performance and polish**
- Cap pixel ratio, set `antialias: false` (both GitHub and Stripe did), and add quality tiers: drop hex resolution or bloom when FPS stays under about 55 (GitHub's approach).
- Pause with `globe.pauseAnimation()` when the tab is hidden or the globe scrolls offscreen (Stripe paused animations while scrolling).
- Show a static SVG/PNG placeholder of the globe, then cross-fade to the canvas once ready with `onGlobeReady`. GitHub did this with the Web Animations API.
- Hover highlight: `onArcHover` → recolour that package's arcs and dim the others (see the "Highlight links" example).

**Year-in-review card export**
- Render a dedicated offscreen globe with `rendererConfig: { preserveDrawingBuffer: true }`. Fix `pointOfView`, show all of the year's arcs statically (no dash animation), then `renderer().domElement.toDataURL('image/png')`.
- Composite the globe PNG with text in a 1080×1920 `<canvas>` (or an HTML card → `html-to-image`). Also produce a 1200×630 for the OG image. Load fonts before drawing (`document.fonts.ready`).
- Optional: record a 6–8 s rotating loop with `canvas.captureStream()` + `MediaRecorder` for a video version.

---

## 4. Quick asset list
- Night texture: `//unpkg.com/three-globe/example/img/earth-night.jpg` (verified 200)
- Countries GeoJSON: `ne_110m_admin_0_countries.geojson`. The hexed-polygons example loads it from `../datasets/` (I confirmed this in its source: https://github.com/vasturiano/globe.gl/blob/master/example/hexed-polygons/index.html), so it should be at https://vasturiano.github.io/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson, though I didn't fetch that URL itself. Better to vendor a copy into the repo. The example uses margin 0.3; 0.6–0.7 gives sparser, GitHub-like dots.

---

## 5. Night Mail v2 — chosen direction (2026-10-07)

User picked A "Night Mail". Additional product references and refinements:

| Product | Borrow |
|---|---|
| Shopify BFCM Live Globe (shopify.engineering/how-we-built-shopifys-bfcm-2023-globe) | Arcs dissolve with noise after landing (age 0→1 travel, 1→2 trail dissolves); billboarded gl.POINTS city dots glow better at horizon; camera flies via spherical interpolation and tilts phi down to frame city on horizon (fix camera.up each frame); one small firework on special events; instanced arcs → thousands in one draw call |
| Flighty Passport (developer.apple.com/news/?id=970ncww4) | Airport-board rule: one line per item, 50 years of signage conventions; shareable Passport artwork with lifetime stats; "boringly obvious" status |
| Polarsteps Unpacked (polarsteps.com/news/polarsteps-unpacked-and-2025-travel-report-the-year-in-travel) | Year recap as swipeable story slides, each with one stat |
| rsmb Flights | Personal stats side panel, filters, deep links |
| COBE (cobe.vercel.app) | 5KB dotted WebGL globe; candidate for a lightweight hero/loading globe |
| Arrive (Shopify, defunct) / Parcel / Deliveries | Delivery confetti; day counter; route lines between scan cities |

### Refinements to adopt
1. Departure-board list: each row = carrier · mono tracking tail · origin→dest city codes · status · ETA/days counter (Flighty/airport board).
2. Three arc states: in transit (amber comet), out-for-delivery (arc fully lit + home pulse faster), delivered (lands with small amber firework/ring burst, then teal, noise-dissolve fade over 30 days).
3. Camera: on select, fly with horizon framing (Shopify technique) instead of top-down.
4. City dots: hubs the parcel passed through as billboarded glowing points sized by visit count over the year.
5. Year in Parcels as 5–6 story slides (Polarsteps/Wrapped), last slide = poster card with postmark.
6. Empty state: slowly rotating globe with home glowing + "Paste a tracking number".
