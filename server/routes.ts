import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireApproved, hashPassword } from "./auth";
import { sendApprovalEmail, sendRejectionEmail, sendWelcomeEmail, sendPayoutUpdateEmail, sendLiquidationEmail } from "./email";
import {
  insertUserSchema, loginSchema, insertTradeSchema,
  insertVerificationSchema, insertWithdrawalSchema,
} from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

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

  app.get("/api/stripe/publishable-key", async (_req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      return res.json({ publishableKey: key });
    } catch (err: any) {
      return res.status(500).json({ message: "Stripe not configured" });
    }
  });

  app.post("/api/stripe/create-checkout", async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      const validAmounts = [50, 200, 1000];
      if (!validAmounts.includes(amount)) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const stripe = await getUncachableStripeClient();
      const productNames: Record<number, string> = {
        50: 'Raw Funded — $50 Account',
        200: 'Raw Funded — $200 Account',
        1000: 'Raw Funded — $1,000 Account',
      };

      const products = await stripe.products.search({ query: `name:'${productNames[amount]}'` });
      if (products.data.length === 0) {
        return res.status(404).json({ message: "Product not found in Stripe" });
      }
      const product = products.data[0];
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 1 });
      if (prices.data.length === 0) {
        return res.status(404).json({ message: "Price not found" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: prices.data[0].id, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}&amount=${amount}`,
        cancel_url: `${baseUrl}/pricing`,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error('[stripe] Checkout error:', err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/stripe/verify-session/:sessionId", async (req: Request, res: Response) => {
    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      if (session.payment_status === 'paid') {
        return res.json({ paid: true, amountPaid: (session.amount_total || 0) / 100 });
      }
      return res.json({ paid: false });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/register-paid", async (req: Request, res: Response) => {
    try {
      const { email, username, password, sessionId } = req.body;
      if (!email || !username || !password || !sessionId) {
        return res.status(400).json({ message: "All fields required" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: "Payment not verified" });
      }

      const verifiedAmount = (session.amount_total || 0) / 100;
      const validAmounts = [50, 200, 1000];
      if (!validAmounts.includes(verifiedAmount)) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }

      const existingSession = await storage.getUserByStripeSessionId(sessionId);
      if (existingSession) {
        return res.status(409).json({ message: "This payment has already been used to create an account" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(409).json({ message: "Email already registered" });
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) return res.status(409).json({ message: "Username taken" });

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ username, email, password: hashedPassword });

      await storage.updateUser(user.id, {
        balance: verifiedAmount,
        stripePaid: true,
        amountPaid: verifiedAmount,
        stripeSessionId: sessionId,
        status: 'pending',
      } as any);

      sendWelcomeEmail(email, username).catch(() => {});

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        const { password: _pw, ...safeUser } = user;
        return res.status(201).json({ ...safeUser, balance: verifiedAmount, stripePaid: true, amountPaid: verifiedAmount });
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Registration failed" });
    }
  });

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

      sendWelcomeEmail(user.email, user.username).catch(() => {});

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

      {
        const updates: any = { status: "approved", isActive: true, approvedBy: req.user!.email, verifiedAt: new Date() };
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
      const { tier, balance, leverage, maxContracts, isActive, propFirm, payoutsReceived, status, adminNotes, card, allowedInstruments } = req.body;
      const updates: any = {};
      if (tier !== undefined) updates.tier = tier;
      if (balance !== undefined) updates.balance = balance;
      if (leverage !== undefined) updates.leverage = leverage;
      if (maxContracts !== undefined) updates.maxContracts = maxContracts;
      if (isActive !== undefined) updates.isActive = isActive;
      if (propFirm !== undefined) updates.propFirm = propFirm;
      if (payoutsReceived !== undefined) updates.payoutsReceived = payoutsReceived;
      if (status !== undefined) updates.status = status;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;
      if (card !== undefined) updates.card = card;
      if (allowedInstruments !== undefined) updates.allowedInstruments = allowedInstruments;

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { password, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/users/:id/assign-card", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { card: cardTier } = req.body;
      if (!cardTier || !['bronze', 'silver', 'gold', 'black'].includes(cardTier)) {
        return res.status(400).json({ message: "Invalid card tier" });
      }

      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const accountSize = user.amountPaid || 50;
      const microsByAccountAndCard: Record<number, Record<string, number>> = {
        50:   { bronze: 1, silver: 2, gold: 3 },
        200:  { bronze: 4, silver: 5, gold: 6 },
        1000: { bronze: 7, silver: 8, gold: 9 },
      };
      const maxMicros = cardTier === 'black' ? 999 : (microsByAccountAndCard[accountSize]?.[cardTier] || 1);

      const finalBalance = user.amountPaid || user.balance;
      const updated = await storage.updateUser(user.id, {
        card: cardTier,
        tier: cardTier === 'black' ? 'titan' : cardTier === 'gold' ? 'elite' : cardTier === 'silver' ? 'elite' : 'verified',
        status: "approved",
        balance: finalBalance,
        maxContracts: maxMicros,
        isActive: true,
        approvedBy: req.user!.email,
        verifiedAt: new Date(),
      } as any);

      if (updated) {
        sendApprovalEmail(updated.email, updated.username, cardTier, finalBalance);
      }

      const { password, ...safeUser } = updated!;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/verifications", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const vers = await storage.getAllVerifications();
      return res.json(vers);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/verifications/:id/approve", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { tier, balance, leverage, maxContracts } = req.body;
      const ver = await storage.updateVerificationStatus(req.params.id, "approved");
      if (!ver) return res.status(404).json({ message: "Verification not found" });

      const { card: cardTier } = req.body;
      const tierContracts: Record<string, number> = { verified: 10, elite: 50, titan: 999 };
      const selectedTier = tier || "verified";

      const user = await storage.getUser(ver.userId);
      const finalBalance = balance || (user?.amountPaid ? user.amountPaid : 10000);
      const finalCard = cardTier || null;

      let finalMaxContracts = maxContracts || tierContracts[selectedTier] || 10;
      if (finalCard && user?.amountPaid) {
        const microsByAccountAndCard: Record<number, Record<string, number>> = {
          50:   { bronze: 1, silver: 2, gold: 3 },
          200:  { bronze: 4, silver: 5, gold: 6 },
          1000: { bronze: 7, silver: 8, gold: 9 },
        };
        finalMaxContracts = finalCard === 'black' ? 999 : (microsByAccountAndCard[user.amountPaid]?.[finalCard] || finalMaxContracts);
      }

      await storage.updateUser(ver.userId, {
        tier: selectedTier,
        status: "approved",
        balance: finalBalance,
        maxContracts: finalMaxContracts,
        isActive: true,
        approvedBy: req.user!.email,
        verifiedAt: new Date(),
        card: finalCard,
      } as any);

      const approvedUser = await storage.getUser(ver.userId);
      if (approvedUser) {
        sendApprovalEmail(approvedUser.email, approvedUser.username, selectedTier, finalBalance);
      }

      return res.json({ message: "Approved", verification: ver });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/verifications/:id/reject", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const ver = await storage.updateVerificationStatus(req.params.id, "rejected");
      if (!ver) return res.status(404).json({ message: "Verification not found" });

      await storage.updateUser(ver.userId, {
        status: "rejected",
        adminNotes: reason || "Verification rejected",
      });

      const rejectedUser = await storage.getUser(ver.userId);
      if (rejectedUser) {
        sendRejectionEmail(rejectedUser.email, rejectedUser.username, reason);
      }

      return res.json({ message: "Rejected", verification: ver });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allVers = await storage.getAllVerifications();
      const pendingCount = allVers.filter(v => v.status === "pending").length;
      const tierCounts: Record<string, number> = { unverified: 0, verified: 0, elite: 0, titan: 0 };
      let totalOpenPositions = 0;
      for (const u of allUsers) {
        if (tierCounts[u.tier] !== undefined) tierCounts[u.tier]++;
        const open = await storage.getOpenTrades(u.id);
        totalOpenPositions += open.length;
      }
      return res.json({
        totalUsers: allUsers.length,
        pendingVerifications: pendingCount,
        tierCounts,
        totalOpenPositions,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users/:id/trades", requireAdmin, async (req: Request, res: Response) => {
    try {
      const open = await storage.getOpenTrades(req.params.id);
      const history = await storage.getTradeHistory(req.params.id, 100);
      return res.json({ open, history });
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

  app.get("/api/trades", requireApproved, async (req: Request, res: Response) => {
    const history = await storage.getTradeHistory(req.user!.id);
    return res.json(history);
  });

  app.get("/api/trades/open", requireApproved, async (req: Request, res: Response) => {
    const open = await storage.getOpenTrades(req.user!.id);
    return res.json(open);
  });

  app.get("/api/trades/stats", requireApproved, async (req: Request, res: Response) => {
    const stats = await storage.getTradeStats(req.user!.id);
    return res.json(stats);
  });

  app.get("/api/trades/analytics", requireApproved, async (req: Request, res: Response) => {
    const analytics = await storage.getDetailedAnalytics(req.user!.id);
    return res.json(analytics);
  });

  app.post("/api/trades", requireApproved, async (req: Request, res: Response) => {
    try {
      const hasPending = await storage.hasPendingPayout(req.user!.id);
      if (hasPending) return res.status(403).json({ message: "Trading is paused while your payout is being processed" });

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
    'MBT': 0.1,
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

  app.post("/api/trades/:id/close", requireApproved, async (req: Request, res: Response) => {
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

  app.patch("/api/trades/:id/sltp", requireApproved, async (req: Request, res: Response) => {
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

  app.post("/api/payouts", requireApproved, async (req: Request, res: Response) => {
    try {
      const parsed = insertWithdrawalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payout data" });

      const user = req.user!;
      if (parsed.data.amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero" });
      if (parsed.data.amount > user.balance) return res.status(400).json({ message: "Insufficient balance" });

      const hasPending = await storage.hasPendingPayout(user.id);
      if (hasPending) return res.status(400).json({ message: "You already have a pending payout request" });

      const openTrades = await storage.getOpenTrades(user.id);
      if (openTrades.length > 0) return res.status(400).json({ message: "Close all open positions before requesting a payout" });

      const wd = await storage.createWithdrawal(user.id, parsed.data);
      await storage.updateUserBalance(user.id, user.balance - parsed.data.amount);

      return res.status(201).json(wd);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payouts", requireAuth, async (req: Request, res: Response) => {
    const wds = await storage.getWithdrawals(req.user!.id);
    return res.json(wds);
  });

  app.get("/api/payouts/pending", requireApproved, async (req: Request, res: Response) => {
    const hasPending = await storage.hasPendingPayout(req.user!.id);
    return res.json({ hasPendingPayout: hasPending });
  });

  app.get("/api/admin/payouts", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allWds = await storage.getAllWithdrawals();
      return res.json(allWds);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/payouts/:id/advance", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { stage, adminNotes } = req.body;

      const allowedTransitions: Record<string, string[]> = {
        requested: ["payout_accepted", "rejected"],
        payout_accepted: ["risk_approved", "rejected"],
        risk_approved: ["funds_sent", "rejected"],
      };

      const allPayouts = await storage.getAllWithdrawals();
      const current = allPayouts.find((p: any) => p.id === req.params.id);
      if (!current) return res.status(404).json({ message: "Payout not found" });

      if (current.status === "completed" || current.status === "rejected") {
        return res.status(400).json({ message: "Cannot modify a completed or rejected payout" });
      }

      const allowed = allowedTransitions[current.stage];
      if (!allowed || !allowed.includes(stage)) {
        return res.status(400).json({ message: `Cannot transition from '${current.stage}' to '${stage}'` });
      }

      const wd = await storage.updateWithdrawalStatus(req.params.id, stage, adminNotes);
      if (!wd) return res.status(404).json({ message: "Payout not found" });

      const user = await storage.getUser(wd.userId);

      if (stage === "rejected") {
        if (user) {
          await storage.updateUserBalance(wd.userId, user.balance + wd.amount);
        }
      }

      if (stage === "funds_sent") {
        if (user) {
          await storage.updateUser(wd.userId, { payoutsReceived: (user.payoutsReceived || 0) + 1 } as any);
        }
      }

      if (user) {
        sendPayoutUpdateEmail(user.email, user.username, wd.amount, stage).catch(() => {});
      }

      return res.json(wd);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
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

  const liquidationNotifySent = new Map<number, number>();
  app.post("/api/account/liquidation-notify", requireApproved, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const lastSent = liquidationNotifySent.get(user.id) || 0;
      if (Date.now() - lastSent < 60_000) {
        return res.json({ success: true, skipped: true });
      }
      const freshUser = await storage.getUser(user.id);
      if (freshUser && freshUser.balance <= 0) {
        liquidationNotifySent.set(user.id, Date.now());
        sendLiquidationEmail(freshUser.email, freshUser.username, freshUser.balance).catch(() => {});
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/supabase/trades", requireApproved, async (req: Request, res: Response) => {
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

  app.post("/api/supabase/trades/close", requireApproved, async (req, res) => { const { supabaseId, close_price, pnl, close_time, status } = req.body; const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_ANON_KEY; if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" }); try { const response = await fetch(supabaseUrl + "/rest/v1/trades?id=eq." + supabaseId, { method: "PATCH", headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": "Bearer " + supabaseKey, "Prefer": "return=representation" }, body: JSON.stringify({ close_price, pnl, close_time, status, updated_at: new Date().toISOString() }) }); if (response.ok) return res.json({ success: true }); return res.status(500).json({ message: "Supabase update failed" }); } catch { return res.status(502).json({ message: "Connection failed" }); } });

  app.post("/api/supabase/trades/sltp", requireApproved, async (req, res) => { const { supabaseId, stopLoss, takeProfit } = req.body; const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_ANON_KEY; if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" }); try { const response = await fetch(supabaseUrl + "/rest/v1/trades?id=eq." + supabaseId, { method: "PATCH", headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": "Bearer " + supabaseKey, "Prefer": "return=minimal" }, body: JSON.stringify({ stop_loss: stopLoss, take_profit: takeProfit, updated_at: new Date().toISOString() }) }); if (response.ok) return res.json({ success: true }); return res.status(500).json({ message: "Supabase update failed" }); } catch { return res.status(502).json({ message: "Connection failed" }); } });

  app.post("/api/supabase/trades/update", requireApproved, async (req, res) => { const { supabaseId, pnl } = req.body; const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_ANON_KEY; if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" }); try { const response = await fetch(supabaseUrl + "/rest/v1/trades?id=eq." + supabaseId, { method: "PATCH", headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": "Bearer " + supabaseKey, "Prefer": "return=minimal" }, body: JSON.stringify({ pnl, updated_at: new Date().toISOString() }) }); if (response.ok) return res.json({ success: true }); return res.status(500).json({ message: "Supabase update failed" }); } catch { return res.status(502).json({ message: "Connection failed" }); } });

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
    'MBT': () => fetchCoinbasePrice('BTC-USD'),
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
    if (cached && Date.now() - cached.ts < 400) {
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
