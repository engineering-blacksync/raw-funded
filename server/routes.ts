import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { setupAuth, requireAuth, hashPassword } from "./auth";
import {
  insertUserSchema, loginSchema, insertTradeSchema,
  insertVerificationSchema, insertWithdrawalSchema,
} from "@shared/schema";

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  const express = await import("express");
  app.use("/uploads", express.default.static("uploads"));

  app.post("/api/upload", requireAuth, upload.single("file"), (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded or invalid file type" });
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({ url: fileUrl, filename: req.file.originalname });
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    return res.status(403).json({ message: "Public registration is disabled. Accounts are assigned by admin." });
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

  const requireAdmin = (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    if (!req.user!.isAdmin) return res.status(403).json({ message: "Admin access required" });
    next();
  };

  app.get("/api/admin/users", requireAdmin, async (_req: Request, res: Response) => {
    const allUsers = await storage.getAllUsers();
    const safeUsers = allUsers.map(({ password, ...u }) => u);
    return res.json(safeUsers);
  });

  app.post("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { username, email, password: rawPassword, tier, balance, leverage, maxContracts, propFirm } = req.body;
      if (!username || !email || !rawPassword) return res.status(400).json({ message: "Username, email, and password are required" });

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(409).json({ message: "Email already exists" });
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) return res.status(409).json({ message: "Username already exists" });

      const hashedPw = await hashPassword(rawPassword);
      const user = await storage.createUser({ username, email, password: hashedPw });

      if (tier || balance || leverage || maxContracts || propFirm) {
        const updates: any = {};
        if (tier) updates.tier = tier;
        if (balance !== undefined) updates.balance = balance;
        if (leverage !== undefined) updates.leverage = leverage;
        if (maxContracts !== undefined) updates.maxContracts = maxContracts;
        if (propFirm) updates.propFirm = propFirm;
        const updated = await storage.updateUser(user.id, updates);
        if (updated) {
          const { password, ...safeUser } = updated;
          return res.status(201).json(safeUser);
        }
      }

      const { password, ...safeUser } = user;
      return res.status(201).json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { tier, balance, leverage, maxContracts, isActive, propFirm, payoutsReceived } = req.body;
      const updates: any = {};
      if (tier !== undefined) updates.tier = tier;
      if (balance !== undefined) updates.balance = balance;
      if (leverage !== undefined) updates.leverage = leverage;
      if (maxContracts !== undefined) updates.maxContracts = maxContracts;
      if (isActive !== undefined) updates.isActive = isActive;
      if (propFirm !== undefined) updates.propFirm = propFirm;
      if (payoutsReceived !== undefined) updates.payoutsReceived = payoutsReceived;

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { password, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hashed = await hashPassword(newPassword);
      const user = await storage.updateUserPassword(req.params.id, hashed);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ message: "Password reset" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
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

  app.get("/api/trades/analytics", requireAuth, async (req: Request, res: Response) => {
    const analytics = await storage.getDetailedAnalytics(req.user!.id);
    return res.json(analytics);
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

  const CONTRACT_SIZES: Record<string, number> = {
    'Bitcoin': 1,
    'Gold (GC)': 100,
    'Silver': 5000,
    'Oil (WTI)': 1000,
    'S&P 500': 50,
    'Nasdaq': 20,
    'MNQ': 2,
    'MES': 5,
    'MGC': 10,
    'SIL': 5000,
    'MCL': 1000,
  };

  app.post("/api/trades/:id/close", requireAuth, async (req: Request, res: Response) => {
    try {
      const { exitPrice } = req.body;
      if (typeof exitPrice !== "number") return res.status(400).json({ message: "exitPrice required" });

      const openTrades = await storage.getOpenTrades(req.user!.id);
      const trade = openTrades.find(t => t.id === req.params.id);
      if (!trade) return res.status(404).json({ message: "Trade not found" });

      const contractSize = CONTRACT_SIZES[trade.instrument] ?? 1;
      const direction = trade.side === "BUY" ? 1 : -1;
      const pnl = (exitPrice - trade.entryPrice) * direction * trade.size * contractSize;

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

  app.patch("/api/trades/:id/sltp", requireAuth, async (req: Request, res: Response) => {
    try {
      const { stopLoss, takeProfit } = req.body;
      const openTrades = await storage.getOpenTrades(req.user!.id);
      const trade = openTrades.find(t => t.id === req.params.id);
      if (!trade) return res.status(404).json({ message: "Trade not found" });

      const sl = typeof stopLoss === "number" ? stopLoss : null;
      const tp = typeof takeProfit === "number" ? takeProfit : null;
      const updated = await storage.updateTradeSLTP(trade.id, sl, tp);
      return res.json(updated);
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

  app.post("/api/supabase/trades", requireAuth, async (req: Request, res: Response) => {
    const { instrument, side, size, status, entryPrice, stopLoss, takeProfit, ticket } = req.body;
    if (!instrument || !side || !size || !entryPrice) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ message: "Supabase not configured" });
    }

    const payload = {
      trader_username: req.user!.username,
      instrument,
      side,
      size,
      open_price: entryPrice,
      close_price: null,
      stop_loss: stopLoss || null,
      take_profit: takeProfit || null,
      pnl: 0,
      status: status || "open",
      ticket: ticket || null,
      close_time: null,
      updated_at: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/trades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, trade: data[0] });
      } else {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ message: err.message || 'Supabase insert failed' });
      }
    } catch (err: any) {
      return res.status(502).json({ message: "Connection to Supabase failed" });
    }
  });

  const priceCache: Record<string, { price: number; ts: number }> = {};

  async function fetchYahooPrice(symbol: string): Promise<number> {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price !== 'number' || isNaN(price) || price <= 0) throw new Error('Invalid price');
    return price;
  }

  async function fetchCoinbasePrice(pair: string): Promise<number> {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
    if (!res.ok) throw new Error(`Coinbase returned ${res.status}`);
    const data = await res.json();
    const price = parseFloat(data?.data?.amount);
    if (isNaN(price) || price <= 0) throw new Error('Invalid price');
    return price;
  }

  const PRICE_SOURCES: Record<string, () => Promise<number>> = {
    'Bitcoin': () => fetchCoinbasePrice('BTC-USD'),
    'Gold (GC)': () => fetchYahooPrice('GC=F'),
    'Silver': () => fetchYahooPrice('SI=F'),
    'Oil (WTI)': () => fetchYahooPrice('CL=F'),
    'S&P 500': () => fetchYahooPrice('%5EGSPC'),
    'Nasdaq': () => fetchYahooPrice('NQ=F'),
    'MNQ': () => fetchYahooPrice('MNQ=F'),
    'MES': () => fetchYahooPrice('MES=F'),
    'MGC': () => fetchYahooPrice('GC=F'),
    'SIL': () => fetchYahooPrice('SIL=F'),
    'MCL': () => fetchYahooPrice('MCL=F'),
  };

  app.get("/api/prices/:instrument", async (req: Request, res: Response) => {
    const instrument = decodeURIComponent(req.params.instrument);
    const fetcher = PRICE_SOURCES[instrument];
    if (!fetcher) return res.status(404).json({ message: "Unknown instrument" });

    const cached = priceCache[instrument];
    if (cached && Date.now() - cached.ts < 800) {
      return res.json({ price: cached.price });
    }

    try {
      const price = await fetcher();
      priceCache[instrument] = { price, ts: Date.now() };
      return res.json({ price });
    } catch {
      if (cached) return res.json({ price: cached.price });
      return res.status(502).json({ message: "Price fetch failed" });
    }
  });

  return httpServer;
}
