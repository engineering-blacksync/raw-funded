# Raw Funded — Prop Trading Platform

## Overview
A private prop trading platform where admin assigns funded accounts. Users get assigned balance, leverage, tier, and settings by admin. Platform features futures trading with no rules, no challenges, and same-day withdrawals.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + wouter (routing) + TanStack Query
- **Backend**: Express.js + Passport.js (session auth) + PostgreSQL + Drizzle ORM
- **Shared**: `shared/schema.ts` — Drizzle schema, Zod validation, types

## Key Files
| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema (users, trades, verifications, withdrawals) |
| `server/db.ts` | Database connection pool |
| `server/auth.ts` | Passport + session auth, password hashing, requireAuth/requireApproved middleware |
| `server/routes.ts` | All API routes (/api/auth/*, /api/trades/*, /api/admin/*) |
| `server/storage.ts` | Storage interface + DatabaseStorage implementation |
| `client/src/lib/auth.ts` | useAuth() hook — login, register, logout, session check |
| `client/src/lib/constants.ts` | Tier definitions, leaderboard mock data |
| `client/src/pages/dashboard.tsx` | Main dashboard with tabs (Terminal, Data, etc.) |
| `client/src/pages/admin.tsx` | Admin panel — verification queue, all traders, create accounts |
| `client/src/pages/pending.tsx` | Pending/rejected status page for non-approved users |

## Access Control System
- **User statuses**: `pending` (default), `approved`, `rejected`, `banned`
- `isAdmin` boolean on users table — only admin users can access `/admin` and `/api/admin/*` routes
- `requireAuth` — allows any authenticated user (for session/verification endpoints)
- `requireApproved` — requires `status === 'approved'` AND `isActive === true` (for trading/withdrawal endpoints)
- New users register with `status: 'pending'` and are redirected to `/pending` page
- Admin approves/rejects verifications, which sets user status and tier
- Login allows all non-banned users; routing handled client-side based on status/isAdmin
- Admin-created accounts are auto-approved with `status: 'approved'`

## Admin System
- `isAdmin` boolean on users table — only admin users can access `/admin` and `/api/admin/*` routes
- Admin panel tabs: Verification Queue, All Traders, Create Account
- Stats bar shows: total users, pending verifications, tier counts, open positions
- Admin can: approve/reject verifications (assign tier/balance), create accounts, edit tier/balance/leverage/maxContracts, toggle active/disabled, suspend accounts, reset passwords, view trader's open/closed trades
- `leverage`, `maxContracts`, `isActive` fields on users — admin-assigned per-account
- `approvedBy`, `adminNotes`, `verifiedAt` fields track admin actions

## Tier System
- **Unverified**: Default tier for new accounts
- **Verified**: Standard funded tier (leverage 1:250, 10 contracts)
- **Elite**: Advanced tier (leverage 1:500, 50 contracts)
- **Titan**: Top tier (leverage 1:2000, 999 contracts)

## Design System
- Dark theme: bg `#09090B`, card `#0F0F12`, surfaces `#141418`/`#1C1C22`
- Accent: Gold `#E8C547`, Green `#22C55E`, Red `#EF4444`
- Fonts: Barlow Condensed (headings), Barlow (body), JetBrains Mono (data)
- wouter v3: `<Link>` renders `<a>` natively — never nest `<a>` inside `<Link>`

## API Routes
- `POST /api/auth/register` — Register (status defaults to pending)
- `POST /api/auth/login` — Login (email + password)
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user
- `GET /api/admin/users` — List all users (admin only)
- `POST /api/admin/users` — Create user account (admin only, auto-approved)
- `PATCH /api/admin/users/:id` — Update user settings (admin only)
- `POST /api/admin/users/:id/reset-password` — Reset user password (admin only)
- `GET /api/admin/verifications` — List all verifications (admin only)
- `POST /api/admin/verifications/:id/approve` — Approve verification (admin only)
- `POST /api/admin/verifications/:id/reject` — Reject verification (admin only)
- `GET /api/admin/stats` — Platform stats (admin only)
- `GET /api/admin/users/:id/trades` — View user's trades (admin only)
- `GET /api/trades` — Trade history (approved users only)
- `GET /api/trades/open` — Open positions (approved users only)
- `GET /api/trades/stats` — P&L, win rate, profit factor (approved users only)
- `GET /api/trades/analytics` — Detailed analytics (approved users only)
- `POST /api/trades` — Open a trade (approved users only)
- `POST /api/trades/:id/close` — Close a trade (approved users only)
- `POST /api/verifications` — Submit verification proof
- `GET /api/verifications` — List verifications
- `POST /api/withdrawals` — Request withdrawal (approved users only)
- `GET /api/withdrawals` — List withdrawals (approved users only)
- `GET /api/leaderboard` — Public leaderboard

## Trading Terminal
- TradingView widget: loads `https://s3.tradingview.com/tv.js`, 11 instruments with Simple/Pro view modes
- Per-instrument quantity config with lotSize system (MGC/MNQ/MES/SIL/MCL = 0.10 lotSize)
- Spreads: Gold/GC/MGC = $0.03, Silver/SIL = $0.008 (applied at entry only)
- All trades persist in PostgreSQL; live P&L via price polling
- Contract sizes: BTC=1, Gold(GC)=100oz, MGC=10oz, Silver/SIL=5000, Oil/MCL=1000, S&P/MES=50/5, Nasdaq/MNQ=20/2
- Price sources: Coinbase (BTC), Yahoo Finance (all others)

## Supabase Integration
- POST `/api/supabase/trades` — Sync trade open to Supabase
- POST `/api/supabase/trades/close` — Sync trade close to Supabase
- POST `/api/supabase/trades/update` — Push live PnL updates (every 800ms)

## File Uploads
- multer handles file uploads to `/uploads/` directory
- Served at `/uploads/` static route
- Used for verification proof documents (PDF/screenshots)
