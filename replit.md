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
| `client/src/pages/pricing.tsx` | Pricing page with 3 card tiers + Stripe checkout |
| `client/src/pages/onboarding.tsx` | Post-payment registration page |
| `server/stripeClient.ts` | Replit connector-based Stripe client |
| `server/seed-products.ts` | Seeds 3 products in Stripe (run once) |

## Access Control System
- **User statuses**: `pending` (default), `approved`, `rejected`, `banned`
- `isAdmin` boolean on users table — only admin users can access `/admin` and `/api/admin/*` routes
- `requireAuth` — allows any authenticated user (for session/verification endpoints)
- `requireApproved` — requires `status === 'approved'` AND `isActive === true` (for trading/withdrawal endpoints)
- New users register with `status: 'pending'` and are redirected to `/pending` page
- Admin approves/rejects verifications, which sets user status and tier
- Login allows all non-banned users; routing handled client-side based on status/isAdmin
- Admin-created accounts are auto-approved with `status: 'approved'`

## Payout System
- Stage flow: `requested` → `payout_accepted` → `risk_approved` → `funds_sent`
- Rejection allowed from any non-terminal stage; refunds balance
- Balance deducted immediately on request; refunded on rejection
- Trading paused while payout is pending (POST /api/trades blocked)
- Open positions must be closed before requesting payout
- Only one active payout per user at a time
- Server enforces strict state machine — no stage skipping or terminal state mutation
- Dashboard shows progress tracker with 4 stages; admin panel has Payouts tab
- **Payout Methods**: User selects method before entering amount
  - Crypto (same day): USDT, Bitcoin, Ethereum — user provides wallet address
  - Bank (1–3 business days): Wise, Rise — user provides email
  - Schema fields: `payoutMethod` (text), `payoutAddress` (text) on withdrawals table
  - Admin sees method + address in Payouts tab

## Admin System
- `isAdmin` boolean on users table — only admin users can access `/admin` and `/api/admin/*` routes
- Admin panel tabs: Verification Queue, All Traders, Payouts, Create Account
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

## Stripe Payment Flow
- Three account sizes: $50, $200, $1,000 (purchased via Stripe)
- Products seeded in Stripe via `server/seed-products.ts`
- Flow: User visits `/pricing` → clicks "Get Started" → Stripe Checkout → redirected to `/onboarding?session_id=X&amount=Y` → creates account via `POST /api/auth/register-paid`
- Payment verified server-side before account creation (amount derived from Stripe, not client)
- Session reuse prevention: stripeSessionId checked for uniqueness
- Admin sees Stripe-paid pending users in queue tab with "Assign Card" action
- `stripeClient.ts`: Replit connector-based Stripe client (no raw API key needed)
- Schema fields: `stripePaid`, `amountPaid`, `card`, `stripeSessionId` on users table

## Card System
- Card levels: bronze, silver, gold, black
- Max micros depend on BOTH account size AND card level:
  - $50:   bronze=1, silver=2, gold=3
  - $200:  bronze=4, silver=5, gold=6
  - $1000: bronze=7, silver=8, gold=9
- Black card: interview only, must verify $20,000+ in payouts, max micros=999
- Admin assigns card via "Assign Card" in queue or PATCH /api/admin/users/:id
- `allowedInstruments` text[] column on users — admin toggles which instruments each trader can access
- null/empty = all instruments allowed; specific array = only those instruments visible in Terminal

## Trade Execution Flow (MT5 Bridge)
- Trade placed → inserted into Supabase → MT5 bridge picks up → sets `mt5_status` and `open_price`
- Supabase `mt5_status` column: `pending` → `filled` (with `open_price`) or `rejected` (with `reject_reason`)
- Dashboard polls `GET /api/supabase/trades/:id` which returns `id,open_price,status,ticket,mt5_status,reject_reason`
- Trade shows as live (P&L ticking) only when `mt5_status = 'filled'` and `open_price` is set
- If `mt5_status = 'rejected'`: trade kept visible but grayed out (opacity-40), reject_reason shown as error banner + inline red text, Dismiss button to remove
- UI badges per trade: pending=yellow "Pending", filled=green "Live", rejected=red "Rejected"
- Rejected trades excluded from P&L totals; close button disabled for non-filled trades (tooltip: "This trade was not executed on MT5")
- Close All only processes filled (or legacy executed) trades, skips pending/rejected
- `LocalTrade` extends `Trade` with optional `mt5Status`/`rejectReason` — used only in Terminal component state
- Legacy fallback: if `mt5_status` is null, falls back to checking `open_price` + `status` fields
- Entry price displayed is always from Supabase `open_price` (MT5 source of truth), never from chart
- P&L: BUY = (current - open_price) × lot_size; SELL = (open_price - current) × lot_size
- P&L tick rounding: MBT/Bitcoin/BTCUSD=$0.50, Gold(GC)=$10, MGC=$1 (uses Math.trunc)
- $2 per-contract platform spread applied at trade entry (BUY adds, SELL subtracts)
- lot_size = contracts × instrument.lotSize (MBT/MGC lotSize=0.10 so 1 contract = 0.1 lot; others lotSize=1)
- No CONTRACT_SIZES multiplier — lot size conversion handled by instrument config lotSize field

## API Routes
- `GET /api/stripe/publishable-key` — Get Stripe publishable key
- `POST /api/stripe/create-checkout` — Create Stripe checkout session (amount: 50/200/1000)
- `GET /api/stripe/verify-session/:id` — Verify Stripe payment status
- `POST /api/auth/register-paid` — Register after Stripe payment (verifies session)
- `POST /api/admin/users/:id/assign-card` — Assign card tier to Stripe-paid user (admin only)
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
- `POST /api/payouts` — Request payout (approved, no open trades, no pending payout)
- `GET /api/payouts` — List user's payouts
- `GET /api/payouts/pending` — Check if user has a pending payout
- `GET /api/admin/payouts` — List all payouts (admin only)
- `POST /api/admin/payouts/:id/advance` — Advance payout stage (admin only, enforces state machine)
- `GET /api/leaderboard` — Public leaderboard

## Trading Terminal
- TradingView widget: loads `https://s3.tradingview.com/tv.js`, 11 instruments with Simple/Pro view modes
- Per-instrument quantity config with lotSize system (MGC/MNQ/MES/SIL/MCL = 0.10 lotSize)
- Spreads: Gold/GC/MGC = $0.03, Silver/SIL = $0.008 (applied at entry only)
- All trades persist in PostgreSQL; live P&L via price polling
- Contract sizes: BTC=1, Gold(GC)=100oz, MGC=10oz, Silver/SIL=5000, Oil/MCL=1000, S&P/MES=50/5, Nasdaq/MNQ=20/2
- Price sources: Finnhub WebSocket → SSE relay (all instruments — real-time tick-level, no polling/timers)
  - Server holds single Finnhub WS connection (`wss://ws.finnhub.io`), feeds `priceCache` and broadcasts to SSE clients
  - Client connects to `GET /api/prices/stream` (SSE) — receives tick-level updates pushed on every Finnhub message
  - Auto-reconnect with exponential backoff (server WS: 3s→30s max; client SSE: 3s→15s max)
  - Markets closed = last known price held; no separate client WS (avoids Finnhub free-tier 1-connection limit)
- Finnhub symbol map: BINANCE:BTCUSDT→MBT/BTCUSD, OANDA:XAU_USD→Gold(GC)/MGC/XAUUSD, OANDA:XAG_USD→Silver/SIL/XAGUSD, OANDA:BCO_USD→Oil(WTI)/MCL/WTIUSD, FXCM:USA500.IDX/USD→S&P500/MES/SPX, FXCM:USATEC.IDX/USD→Nasdaq/MNQ/NDX
- Spread map: BTCUSD/MBT=20, XAUUSD/Gold(GC)=0.30, XAGUSD/Silver/SIL=0.03, WTIUSD/Oil(WTI)/MCL=0.05, SPX/S&P500=0.50, NDX/Nasdaq/MNQ=1.50, MES=0.25, MGC=0.20
- Chart symbols: COINBASE:BTCUSD, OANDA:XAUUSD, OANDA:XAGUSD, TVC:USOIL, TVC:SPX, NASDAQ:NDX (free TradingView widget compatible)
- FINNHUB_API_KEY stored server-side only (never exposed to client)
- Debug panel: dev-only collapsible panel showing WS status, last price, update timestamp, and P&L verification per position

## Supabase Integration
- POST `/api/supabase/trades` — Sync trade open to Supabase
- POST `/api/supabase/trades/close` — Sync trade close to Supabase
- POST `/api/supabase/trades/update` — Push live PnL updates (every 800ms)

## File Uploads
- multer handles file uploads to `/uploads/` directory
- Served at `/uploads/` static route
- Used for verification proof documents (PDF/screenshots)
