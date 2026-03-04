# Raw Funded — Prop Trading Platform

## Overview
A private prop trading platform where admin assigns funded accounts. Users get assigned balance, leverage, tier, and settings by admin. Platform features futures trading with no rules, no challenges, and same-day withdrawals. Public registration is disabled — accounts are created by admin only.

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
| `server/routes.ts` | All API routes (/api/auth/*, /api/trades/*, /api/admin/*) |
| `server/storage.ts` | Storage interface + DatabaseStorage implementation |
| `client/src/lib/auth.ts` | useAuth() hook — login, register, logout, session check |
| `client/src/lib/constants.ts` | Tier definitions, leaderboard mock data |
| `client/src/pages/dashboard.tsx` | Main dashboard with tabs (Terminal, Data, etc.) |
| `client/src/pages/admin.tsx` | Admin panel — create/edit accounts, manage users |

## Admin System
- `isAdmin` boolean on users table — only admin users can access `/admin` and `/api/admin/*` routes
- `leverage`, `maxContracts`, `isActive` fields on users — admin-assigned per-account
- Admin can: create accounts, edit tier/balance/leverage/maxContracts, toggle active/disabled, reset passwords
- Public registration (`POST /api/auth/register`) is disabled — returns 403
- Admin link appears in dashboard sidebar (gold lock icon) only for admin users

## Tier System
- **Unverified**: Default tier for new accounts
- **Verified**: Standard funded tier
- **Elite**: Advanced tier
- **Titan**: Top tier, unlimited
- **Banned**: No trading

## Design System
- Dark theme: bg `#09090B`, card `#0F0F12`, surfaces `#141418`/`#1C1C22`
- Accent: Gold `#E8C547`, Green `#22C55E`, Red `#EF4444`
- Fonts: Barlow Condensed (headings), Barlow (body), JetBrains Mono (data)
- wouter v3: `<Link>` renders `<a>` natively — never nest `<a>` inside `<Link>`

## API Routes
- `POST /api/auth/register` — **DISABLED** (returns 403)
- `POST /api/auth/login` — Login (email + password)
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user
- `GET /api/admin/users` — List all users (admin only)
- `POST /api/admin/users` — Create user account (admin only)
- `PATCH /api/admin/users/:id` — Update user settings (admin only)
- `POST /api/admin/users/:id/reset-password` — Reset user password (admin only)
- `GET /api/trades` — Trade history
- `GET /api/trades/open` — Open positions
- `GET /api/trades/stats` — P&L, win rate, profit factor
- `GET /api/trades/analytics` — Detailed analytics
- `POST /api/trades` — Open a trade
- `POST /api/trades/:id/close` — Close a trade
- `POST /api/verifications` — Submit verification proof
- `GET /api/verifications` — List verifications
- `POST /api/withdrawals` — Request withdrawal
- `GET /api/withdrawals` — List withdrawals
- `GET /api/leaderboard` — Public leaderboard

## Trading Terminal
- TradingView widget: loads `https://s3.tradingview.com/tv.js`, 11 instruments with Simple/Pro view modes
- Per-instrument quantity config with lotSize system (MGC/MNQ/MES/SIL/MCL = 0.10 lotSize)
- Spreads: Gold/GC/MGC = $0.03, Silver/SIL = $0.008 (applied at entry only)
- All trades persist in PostgreSQL; live P&L via price polling
- Contract sizes: BTC=1, Gold(GC)=100oz, MGC=10oz, Silver/SIL=5000, Oil/MCL=1000, S&P/MES=50/5, Nasdaq/MNQ=20/2
- Price sources: Coinbase (BTC), Yahoo Finance (all others)

## File Uploads
- multer handles file uploads to `/uploads/` directory
- Served at `/uploads/` static route
- Used for verification proof documents (PDF/screenshots)
