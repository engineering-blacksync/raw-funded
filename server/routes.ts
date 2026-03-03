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

  async function fetchCoinbaseBidAsk(pair: string): Promise<{ bid: number; ask: number }> {
    const [buyRes, sellRes] = await Promise.all([
      fetch(`https://api.coinbase.com/v2/prices/${pair}/buy`),
      fetch(`https://api.coinbase.com/v2/prices/${pair}/sell`),
    ]);
    if (!buyRes.ok || !sellRes.ok) throw new Error('Coinbase API error');
    const [buyData, sellData] = await Promise.all([buyRes.json(), sellRes.json()]);
    const ask = parseFloat(buyData?.data?.amount);
    const bid = parseFloat(sellData?.data?.amount);
    if (isNaN(bid) || isNaN(ask) || bid <= 0 || ask <= 0) throw new Error('Invalid Coinbase prices');
    return { bid, ask };
  }

  const YAHOO_SPREADS: Record<string, number> = {
    'GC=F': 0.60, 'SI=F': 0.04, 'CL=F': 0.03,
    '%5EGSPC': 0.50, 'NQ=F': 1.00,
    'MNQ=F': 0.50, 'MES=F': 0.25,
    'MGC=F': 0.60, 'SIL=F': 0.04, 'MCL=F': 0.03,
  };

  async function fetchYahooFinance(symbol: string): Promise<{ bid: number; ask: number }> {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== 'number' || isNaN(price) || price <= 0) throw new Error('Invalid Yahoo price');
    const halfSpread = (YAHOO_SPREADS[symbol] ?? price * 0.0002) / 2;
    return {
      bid: +(price - halfSpread).toFixed(4),
      ask: +(price + halfSpread).toFixed(4),
    };
  }

  const priceCache: Record<string, { bid: number; ask: number; ts: number }> = {};

  const PRICE_FETCHERS: Record<string, () => Promise<{ bid: number; ask: number }>> = {
    'Bitcoin': () => fetchCoinbaseBidAsk('BTC-USD'),
    'Gold': () => fetchYahooFinance('GC=F'),
    'Silver': () => fetchYahooFinance('SI=F'),
    'Oil (WTI)': () => fetchYahooFinance('CL=F'),
    'S&P 500': () => fetchYahooFinance('%5EGSPC'),
    'Nasdaq': () => fetchYahooFinance('NQ=F'),
    'MNQ': () => fetchYahooFinance('MNQ=F'),
    'MES': () => fetchYahooFinance('MES=F'),
    'MGC': () => fetchYahooFinance('MGC=F'),
    'SIL': () => fetchYahooFinance('SIL=F'),
    'MCL': () => fetchYahooFinance('MCL=F'),
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
