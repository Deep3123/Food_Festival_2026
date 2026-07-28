# ByteBites

> Invest in Taste. Earn in Happiness.

ByteBites is a futuristic digital food application built for the OPL FinTech Food Fest 2026 (theme: "From Foodpreneurs to Finfluencers"). It blends a food marketplace with fintech-style features: a digital wallet (FoodCoins), UPI payments, live startup metrics, QR-based stall ordering, AI-driven recommendations, gamification, and an investor pitch section.

## Tech stack

- **Frontend**: React 18 + React Router 6 (Vite)
- **Backend**: Node.js + Express
- **Language**: TypeScript (ESM) across the whole monorepo
- **Testing**: Vitest + fast-check (property-based testing) + Supertest
- **Payments**: Paytm UPI gateway behind a swappable interface (with a deterministic mock for dev/test)

## Architecture

The codebase is a three-layer monorepo. Business rules live in framework-agnostic pure modules so they can be exhaustively property-tested without a UI or network.

```
┌─────────────────────────────────────────────┐
│  client/   React SPA (pages, cart, polling)   │
└───────────────────────┬───────────────────────┘
                         │ HTTP / JSON (+ ~3s polling)
┌───────────────────────┴───────────────────────┐
│  server/   Express API (thin HTTP layer)       │
│            in-memory Store, PaymentGateway      │
└───────────────────────┬───────────────────────┘
                         │ calls
┌───────────────────────┴───────────────────────┐
│  domain/   Pure business logic (no framework)  │
│  types/    Shared types + fast-check generators │
└─────────────────────────────────────────────┘
```

Key decisions:
- **Server-authoritative** state: the client only renders what the server returns. Tokens, balances, totals, and rewards are never trusted from the client.
- **Polling (~3s)** instead of websockets satisfies the "within 5 seconds" freshness requirements for order status, metrics, and trending.
- **In-memory store** with deterministic reset (festival demo scope, no external DB).
- **Money math on integer paise** internally to avoid floating-point drift.

## Project structure

```
.
├── domain/                  Pure business logic + property tests
│   ├── pricing.ts           line/order totals, quantity clamping
│   ├── foodcoins.ts         earn (10%, floored) + redemption
│   ├── tokens.ts            unique order-token issuance
│   ├── order-status.ts      status transitions
│   ├── ai-chef.ts           preference-based recommendation scoring
│   ├── trending.ts          rank today's paid orders by units
│   ├── spin.ts              Spin & Win reward selection
│   └── metrics.ts           dashboard metric computation
│
├── types/                   Shared TypeScript types + fast-check generators
│   ├── index.ts             data models (FoodItem, Order, Wallet, ...)
│   └── generators.ts        reusable arbitraries for property tests
│
├── server/                  Express API
│   └── src/
│       ├── app.ts           createApp() factory — all REST routes
│       ├── store.ts         in-memory Store (seeded stalls + items)
│       ├── index.ts         entry point (see "Running" below)
│       └── gateways/
│           ├── mock-gateway.ts    deterministic gateway for dev/test
│           └── paytm-gateway.ts   real Paytm UPI adapter
│
├── client/                  React frontend (Vite)
│   └── src/
│       ├── App.tsx          route table
│       ├── main.tsx         entry point
│       ├── routes.ts        central route path definitions
│       ├── api/client.ts    typed fetch client for the API
│       ├── hooks/usePolling.ts   ~3s polling hook
│       ├── cart/            pure cart module + React context
│       └── pages/           HomePage, Marketplace, Cart, Checkout,
│                            OrderTracker, Wallet, Metrics, AIChef,
│                            Trending, Referral, Investor, SpinWheel
│
└── .kiro/specs/bytebites/   Requirements, design, and task plan
```

## Features

| Area | What it does |
| --- | --- |
| Home | Hero + navigation to ordering, trending, and the investor dashboard |
| Marketplace | Browse a stall's menu (via QR/stall route) with image, rating, stock, INR price |
| Cart | Line items, totals, quantity controls, removal, over-quantity clamping |
| Checkout | UPI payment; issues an order token on success, retains cart on failure |
| Order tracking | Live status: Order Received → Preparing → Ready for Pickup |
| Wallet | FoodCoins balance; redeem for toppings, discounts, lucky-draw entries |
| Referral | Unique per-customer link; 10 FoodCoins per referred first order (idempotent) |
| Metrics dashboard | Orders today, revenue, digital-payment %, best seller, satisfaction |
| AI Chef | Recommends dishes from hunger/spice/taste preferences with a confidence score |
| Trending | Most-ordered items ranked by units for the day |
| Spin & Win | One spin per paid order, awarding a reward applied to the account |
| Investor pitch | Vision, revenue model, growth strategy, market traction |
| Customer profile | Mobile-number identity — orders, wallet, and rewards all key off the number |
| WhatsApp confirmation | Order confirmation sent to the customer's mobile on successful checkout |
| Admin / seller | Order-management dashboard to view and advance orders (unauthenticated demo) |

## Getting started

Requires Node.js 20+ and npm 10+ (uses npm workspaces).

```bash
# install all workspace dependencies
npm install
```

## Running

Run the API and the frontend in two terminals:

```bash
# 1) API server — http://localhost:3001
npm run dev --workspace @bytebites/server

# 2) frontend dev server (Vite) — http://localhost:5173
npm run dev --workspace @bytebites/client
```

The client calls same-origin `/api/...` paths, which the Vite dev server proxies to the API (see `client/vite.config.ts`). Start the API first so the proxy has something to reach; otherwise API calls return the SPA's `index.html` and you'll see a JSON parse error in the UI.

Configuration:
- `PORT` — API port (default `3001`).
- `VITE_API_TARGET` — API origin the Vite proxy targets (default `http://localhost:3001`).
- `PAYMENT_GATEWAY=paytm` — use the real Paytm UPI adapter instead of the mock (requires the `PAYTM_*` env vars); defaults to the deterministic mock gateway so checkout succeeds without live credentials.
- `NOTIFICATION_GATEWAY=whatsapp` — send order confirmations via the Meta WhatsApp Cloud API (requires `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and optionally `WHATSAPP_API_VERSION`, default `v21.0`); defaults to a mock that logs the message. A notification failure never fails the order.
- `BYTEBITES_DATA_FILE` — path to the JSON persistence file (default `server/data/bytebites-db.json`). Orders, wallets, referrals, and customers are written through on every change so data survives a restart.

## Customer identity, persistence, and admin

- **Mobile-number identity**: customers register with a mobile number (+ name, optional email) via `POST /api/customers`. The normalized mobile number is the `customerId` that orders, wallet balance, and referrals all key off, so a returning number maps to the same account. The client captures this on a `/profile` page (and gates checkout on it), persisting it to `localStorage`.
- **JSON-file persistence**: the server writes orders, wallets, referrals, and customers to a JSON file (write-through on every mutation) so a restart doesn't wipe data. Tests use an isolated in-memory store, so they never touch the real file.
- **WhatsApp confirmation**: on a successful checkout the server sends an order confirmation to the customer's mobile through a pluggable notification gateway (Meta WhatsApp Cloud API adapter, mock by default).
- **Admin / seller page**: `/admin` lists all orders (most-recent first, optional stall filter) and lets a seller advance an order's status. These `/api/admin/*` endpoints are intentionally unauthenticated for the demo and must be placed behind seller authentication in production.

## Testing

Property-based tests (fast-check, 100+ iterations each) validate the 29 correctness properties defined in the design; example and integration tests cover UI content, error views, and end-to-end flows.

```bash
# server + domain suite (Node env)
npm test

# client suite (jsdom env)
npm test --workspace @bytebites/client

# type-check the whole monorepo
npm run typecheck
```

Current status: 102 tests across 28 files (70 server/domain, 32 client), all passing, with clean type-checks.

Each property test is tagged for traceability, e.g.:

```
// Feature: bytebites, Property 21: FoodCoins earned equal 10% of the total, floored
```

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/stalls/:stallId/menu` | Menu for a stall (404 if unknown) |
| POST | `/api/checkout` | Pay, create order, issue token, credit coins |
| GET | `/api/orders/:token` | Current order status |
| POST | `/api/orders/:token/advance` | Advance order status one step |
| POST | `/api/orders/:token/spin` | Perform the single spin for a paid order |
| GET | `/api/metrics` | Current-day metrics |
| GET | `/api/trending` | Items ranked by units ordered today |
| POST | `/api/ai-chef/recommend` | Recommendations from preferences |
| GET | `/api/wallet/:customerId` | FoodCoins balance |
| POST | `/api/wallet/:customerId/redeem` | Redeem FoodCoins |
| GET | `/api/referral/:customerId` | Referral link |
| POST | `/api/referral/claim` | Credit referrer on a referred first order |
| POST | `/api/customers` | Register/upsert a customer by mobile number |
| GET | `/api/customers/:mobile` | Fetch a customer by mobile number |
| GET | `/api/admin/orders` | List all orders (optional `?stallId=`), most-recent first |
| GET | `/api/admin/orders/:token` | Fetch a single order (admin) |

All error responses use a consistent shape: `{ "error": string, "code": string }`.

## Spec

The full requirements, design, and implementation plan live in `.kiro/specs/bytebites/`:
- `requirements.md` — user stories and acceptance criteria
- `design.md` — architecture, data models, and the 29 correctness properties
- `tasks.md` — the implementation task list
