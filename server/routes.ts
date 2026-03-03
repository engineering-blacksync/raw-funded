import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, requireAuth, hashPassword } from "./auth";
import {
  insertUserSchema, loginSchema, insertTradeSchema,
  insertVerificationSchema, insertWithdrawalSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

      const existingEmail = await storage.getUserByEmail(parsed.data.email);
      if (existingEmail) return res.status(409).json({ message: "Email already registered" });

      const existingUsername = await storage.getUserByUsername(parsed.data.username);
      if (existingUsername) return res.status(409).json({ message: "Username taken" });

      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({ ...parsed.data, password: hashedPassword });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        const { password, ...safeUser } = user;
        return res.status(201).json(safeUser);
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req: Request, res: Response, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid credentials" });

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      return res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const { password, ...safeUser } = req.user!;
    return res.json(safeUser);
  });

  app.get("/api/trades", requireAuth, async (req: Request, res: Response) => {
    const history = await storage.getTradeHistory(req.user!.id);
    return res.json(history);
  });

  app.get("/api/trades/open", requireAuth, async (req: Request, res: Response) => {
    const open = await storage.getOpenTrades(req.user!.id);
    return res.json(open);
  });

  app.get("/api/trades/stats", requireAuth, async (req: Request, res: Response) => {
    const stats = await storage.getTradeStats(req.user!.id);
    return res.json(stats);
  });

  app.post("/api/trades", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertTradeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid trade data" });

      const trade = await storage.createTrade(req.user!.id, parsed.data);

      if (req.user!.tier === "unverified") {
        await storage.incrementTriesUsed(req.user!.id);
      }

      return res.status(201).json(trade);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/trades/:id/close", requireAuth, async (req: Request, res: Response) => {
    try {
      const { exitPrice } = req.body;
      if (typeof exitPrice !== "number") return res.status(400).json({ message: "exitPrice required" });

      const openTrades = await storage.getOpenTrades(req.user!.id);
      const trade = openTrades.find(t => t.id === req.params.id);
      if (!trade) return res.status(404).json({ message: "Trade not found" });

      const multiplier = trade.instrument.startsWith("M") ? 1 : 10;
      const direction = trade.side === "buy" ? 1 : -1;
      const pnl = (exitPrice - trade.entryPrice) * direction * trade.contracts * multiplier;

      const closedTrade = await storage.closeTrade(trade.id, exitPrice, pnl);

      const user = await storage.getUser(req.user!.id);
      if (user) {
        await storage.updateUserBalance(user.id, user.balance + pnl);
      }

      return res.json(closedTrade);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/verifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertVerificationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid verification data" });

      const ver = await storage.createVerification(req.user!.id, parsed.data);
      return res.status(201).json(ver);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/verifications", requireAuth, async (req: Request, res: Response) => {
    const vers = await storage.getVerifications(req.user!.id);
    return res.json(vers);
  });

  app.post("/api/withdrawals", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertWithdrawalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid withdrawal data" });

      const user = req.user!;
      if (parsed.data.amount > user.balance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const wd = await storage.createWithdrawal(user.id, parsed.data);
      await storage.updateUserBalance(user.id, user.balance - parsed.data.amount);

      return res.status(201).json(wd);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/withdrawals", requireAuth, async (req: Request, res: Response) => {
    const wds = await storage.getWithdrawals(req.user!.id);
    return res.json(wds);
  });

  app.get("/api/leaderboard", async (_req: Request, res: Response) => {
    try {
      const leaders = await storage.getLeaderboard();
      const safe = leaders.map(({ password, ...rest }) => rest);
      return res.json(safe);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  function validatePrices(bid: number, ask: number): { bid: number; ask: number } {
    if (isNaN(bid) || isNaN(ask) || bid <= 0 || ask <= 0) {
      throw new Error('Invalid price data received');
    }
    return { bid, ask };
  }

  async function fetchBinanceUS(symbol: string): Promise<{ bid: number; ask: number }> {
    const res = await fetch(`https://api.binance.us/api/v3/ticker/bookTicker?symbol=${symbol}`);
    if (!res.ok) throw new Error(`Binance US returned ${res.status}`);
    const data = await res.json();
    return validatePrices(parseFloat(data.bidPrice), parseFloat(data.askPrice));
  }

  async function fetchCoinbaseSpot(pair: string, spreadPct: number = 0.0003): Promise<{ bid: number; ask: number }> {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
    if (!res.ok) throw new Error(`Coinbase returned ${res.status}`);
    const data = await res.json();
    const mid = parseFloat(data?.data?.amount);
    if (isNaN(mid) || mid <= 0) throw new Error('Invalid Coinbase price');
    const half = mid * spreadPct;
    return { bid: +(mid - half).toFixed(6), ask: +(mid + half).toFixed(6) };
  }

  async function fetchCoinGecko(id: string, spreadPct: number = 0.0003): Promise<{ bid: number; ask: number }> {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
    const data = await res.json();
    const mid = data?.[id]?.usd;
    if (typeof mid !== 'number' || isNaN(mid) || mid <= 0) throw new Error('Invalid CoinGecko price');
    const half = mid * spreadPct;
    return { bid: +(mid - half).toFixed(6), ask: +(mid + half).toFixed(6) };
  }

  function derivedPrice(base: number, seed: number, range: number, spread: number): { bid: number; ask: number } {
    const variance = (seed % range) - (range / 2);
    const bid = +(base + variance).toFixed(2);
    return { bid, ask: +(bid + spread).toFixed(2) };
  }

  const priceCache: Record<string, { bid: number; ask: number; ts: number }> = {};

  const PRICE_FETCHERS: Record<string, () => Promise<{ bid: number; ask: number }>> = {
    'Bitcoin': () => fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')),
    'Gold': () => fetchCoinGecko('tether-gold', 0.0005).catch(() => fetchCoinbaseSpot('BTC-USD').then(p => derivedPrice(2650, p.bid, 30, 0.30))),
    'Silver': () => fetchCoinGecko('silver-token', 0.001).catch(() => fetchCoinbaseSpot('BTC-USD').then(p => derivedPrice(31.5, p.bid % 100, 3, 0.02))),
    'Oil (WTI)': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(68.5, btc.bid, 5, 0.03); },
    'S&P 500': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(5950, btc.bid, 50, 0.25); },
    'Nasdaq': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(21200, btc.bid, 100, 0.50); },
    'MNQ': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(21200, btc.bid, 100, 0.50); },
    'MES': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(5950, btc.bid, 50, 0.25); },
    'MGC': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(2650, btc.bid, 30, 0.30); },
    'SIL': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(31.5, btc.bid % 100, 3, 0.02); },
    'MCL': async () => { const btc = await fetchBinanceUS('BTCUSDT').catch(() => fetchCoinbaseSpot('BTC-USD')); return derivedPrice(68.5, btc.bid, 5, 0.03); },
  };

  app.get("/api/prices/:instrument", async (req: Request, res: Response) => {
    const instrument = decodeURIComponent(req.params.instrument);
    const fetcher = PRICE_FETCHERS[instrument];
    if (!fetcher) return res.status(404).json({ message: "Unknown instrument" });

    const cached = priceCache[instrument];
    if (cached && Date.now() - cached.ts < 500) {
      return res.json({ bid: cached.bid, ask: cached.ask });
    }

    try {
      const prices = await fetcher();
      if (!isNaN(prices.bid) && !isNaN(prices.ask) && prices.bid > 0 && prices.ask > 0) {
        priceCache[instrument] = { ...prices, ts: Date.now() };
      }
      return res.json(prices);
    } catch (err: any) {
      if (cached) return res.json({ bid: cached.bid, ask: cached.ask });
      return res.status(502).json({ message: "Price fetch failed" });
    }
  });

  return httpServer;
}
