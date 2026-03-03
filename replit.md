# Raw Funded — Prop Trading Platform

## Overview
A prop trading platform for traders who've already won elsewhere. Users verify their funded status (via Certificate PDF or Wise/Stripe payout email) to unlock futures trading tiers with no rules, no challenges, and same-day withdrawals.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + wouter (routing) + TanStack Query
- **Backend**: Express.js + Passport.js (session auth) + PostgreSQL + Drizzle ORM
- **Shared**: `shared/schema.ts` — Drizzle schema, Zod validation, types

## Key Files
| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema (users, trades, verifications, withdrawals) |
| `server/db.ts` | Database connection pool |
| `server/auth.ts` | Passport + session auth, password hashing |
| `server/routes.ts` | All API routes (/api/auth/*, /api/trades/*, etc.) |
| `server/storage.ts` | Storage interface + DatabaseStorage implementation |
| `client/src/lib/auth.ts` | useAuth() hook — login, register, logout, session check |
| `client/src/lib/constants.ts` | Tier definitions, leaderboard mock data |
| `client/src/pages/dashboard.tsx` | Main dashboard with tabs (Terminal, Data, etc.) |

## Tier System
- **Unverified**: 1:50 leverage, 1 Micro, 3 tries
- **Verified**: 1:250, 10 Micros / 1 Mini (requires Certificate PDF)
- **Elite**: 1:500, 50 Micros / 5 Minis (requires 1 payout proof)
- **Titan**: 1:2000, Unlimited (requires 2+ payout proofs)
- **Banned**: No trading

## Design System
- Dark theme: bg `#09090B`, card `#0F0F12`, surfaces `#141418`/`#1C1C22`
- Accent: Gold `#E8C547`, Green `#22C55E`, Red `#EF4444`
- Fonts: Barlow Condensed (headings), Barlow (body), JetBrains Mono (data)
- wouter v3: `<Link>` renders `<a>` natively — never nest `<a>` inside `<Link>`

## API Routes
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login (email + password)
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user
- `GET /api/trades` — Trade history
- `GET /api/trades/open` — Open positions
- `GET /api/trades/stats` — P&L, win rate, profit factor
- `POST /api/trades` — Open a trade
- `POST /api/trades/:id/close` — Close a trade
- `POST /api/verifications` — Submit verification proof
- `GET /api/verifications` — List verifications
- `POST /api/withdrawals` — Request withdrawal
- `GET /api/withdrawals` — List withdrawals
- `GET /api/leaderboard` — Public leaderboard

## Trading Terminal
- TradingView widget: loads `https://s3.tradingview.com/tv.js`, 11 instruments with Simple/Pro view modes
- Per-instrument quantity config: Bitcoin/Gold/Silver use 0.01 step with decimal lots; all others use integer contracts (step 1, max 20)
- Switching instrument tabs resets quantity to that instrument's default
- BUY/SELL buttons insert trades to Supabase via `/api/supabase/trades` (server-side proxy, requires auth)
- Supabase credentials stored in env vars: SUPABASE_URL, SUPABASE_ANON_KEY
