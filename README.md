# Parcel Globe 包裹地图

> Your own packages as glowing arcs on a dark 3D globe. Self-hosted, bring your own carrier API keys.
> 把你自己的快递画成暗色 3D 地球上的发光弧线。自托管，用你自己的承运商 API key。

**Status: planning (pre-v0.1).** No code yet.

## What it does
- Save tracking numbers in bulk (UPS, FedEx; USPS experimental)
- Calls the carriers' **official** APIs directly — no aggregators
- Draws each route origin → hubs → home on a globe: moving comet dot while in transit, fading arcs after delivery
- Data stays in your browser (IndexedDB); keys stay in your server's environment variables
- Year-in-review card: parcels, total distance, farthest package

## Stack (planned)
Vite + React + TypeScript · globe.gl (three.js) · Tailwind · Dexie · Vercel Functions · zod · Vitest + Playwright

## Docs
- [PLAN.md](PLAN.md) — full development plan (中文)
- [docs/visual-direction.md](docs/visual-direction.md) — visual references and the "Night Mail" direction
- [docs/week1-key-checklist.md](docs/week1-key-checklist.md) — getting UPS / FedEx / USPS keys

## Note on USPS
Since 2026-04-01 USPS restricts Tracking API access for parties who didn't ship the package. Tracking packages sent *to* you may not work; a manual waypoint fallback is planned.

## License
MIT. Not affiliated with UPS, FedEx, or USPS.

## Local development (M3)

```bash
pnpm install
cp .env.example .env.local      # fill in what you have
PG_FIXTURES=1 pnpm dev          # /api/* answers from server/fixtures, no keys needed
pnpm test                       # unit tests (adapters, auth, merge)
pnpm test:live                  # hits the real FedEx API using .env.local (sandbox by default)
```

`pnpm dev` serves `/api/login` and `/api/track` from `server/handlers.ts`, the same
code Vercel runs from `api/`. FedEx sandbox keys need `FEDEX_BASE_URL=https://apis-sandbox.fedex.com`.
The sandbox is virtualized: it returns one canned response, so test with `123456789012`.
UPS support is written against UPS's published OpenAPI docs and not yet verified with live keys.
