import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import multer from "multer";
import path from "path";
import WebSocketWs from "ws";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireApproved, hashPassword } from "./auth";
import { sendApprovalEmail, sendRejectionEmail, sendWelcomeEmail, sendPayoutUpdateEmail, sendLiquidationEmail } from "./email";
import {
  insertUserSchema, loginSchema, insertTradeSchema,
  insertVerificationSchema, insertWithdrawalSchema,
} from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { getChatResponse } from "./ai";

const PLATFORM_SPREAD_PER_CONTRACT = 2;
const LOT_SIZE_MAP: Record<string, number> = {
  MBT: 0.10, 'Gold (GC)': 1, Silver: 1, 'Oil (WTI)': 1,
  'S&P 500': 1, Nasdaq: 1, MNQ: 0.10, MES: 0.10,
  MGC: 0.10, SIL: 0.10, MCL: 0.10, Bitcoin: 0.10, BTCUSD: 0.10,
  XAUUSD: 1, XAGUSD: 1, WTIUSD: 1, SPX: 1, NDX: 1,
};
const TICK_MAP: Record<string, number> = {
  MBT: 0.50, Bitcoin: 0.50, BTCUSD: 0.50,
  'Gold (GC)': 10, XAUUSD: 10,
  MGC: 0.10,
  Silver: 0.50, SIL: 0.50, XAGUSD: 0.50,
  'Oil (WTI)': 0.10, MCL: 0.10, WTIUSD: 0.10,
  'S&P 500': 0.25, MES: 0.25, SPX: 0.25,
  Nasdaq: 0.25, MNQ: 0.25, NDX: 0.25,
};
function roundToTick(price: number, instrument: string): number {
  const tick = TICK_MAP[instrument] ?? 1;
  return Math.floor(price / tick) * tick;
}
function getSpreadAdjustedEntry(instrument: string, side: string, size: number, fillPrice: number): number {
  const lotSize = LOT_SIZE_MAP[instrument] || 1;
  const contracts = Math.round(size / lotSize);
  let spreadPerContract = PLATFORM_SPREAD_PER_CONTRACT;

  if (instrument === 'MGC') {
    spreadPerContract = 0.15; // results in -$1.50 start, total -$3.00 with frontend spread
  } else if (instrument === 'Gold (GC)' || instrument === 'XAUUSD') {
    spreadPerContract = 0.15; // results in -$15.00 start, total -$30.00 with frontend spread
  }

  const spread = spreadPerContract * contracts;
  return side === 'BUY' ? fillPrice + spread : fillPrice - spread;
}

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
      const { tier, balance, leverage, maxContracts, isActive, propFirm, payoutsReceived, status, adminNotes, card, allowedInstruments, mt5Account } = req.body;
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
      if (mt5Account !== undefined) updates.mt5Account = mt5Account;

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });

      // mt5Account sync logic
      if (mt5Account !== undefined) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          try {
            const oldUser = await storage.getUser(req.params.id);
            const oldMt5 = oldUser?.mt5Account;

            // Cleanup step 1: Clear any trader assigned to the new MT5 account
            if (mt5Account) {
              console.log(`[admin] Clearing any existing assignment for MT5 account ${mt5Account}`);
              await fetch(`${supabaseUrl}/rest/v1/accounts?mt5_account=eq.${encodeURIComponent(mt5Account)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ trader_username: null })
              });
            }

            // Cleanup step 2: Clear the old MT5 account that this trader currently has
            if (oldMt5 && oldMt5 !== mt5Account) {
              console.log(`[admin] Clearing old MT5 account ${oldMt5} for trader ${user.username}`);
              await fetch(`${supabaseUrl}/rest/v1/accounts?mt5_account=eq.${encodeURIComponent(oldMt5)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ trader_username: null })
              });
            }

            // Assign the new account to the trader
            if (mt5Account) {
              console.log(`[admin] Assigning trader ${user.username} to MT5 account ${mt5Account}`);
              await fetch(`${supabaseUrl}/rest/v1/accounts?mt5_account=eq.${encodeURIComponent(mt5Account)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ trader_username: user.username })
              });

              // Also sync trades
              await fetch(`${supabaseUrl}/rest/v1/trades?trader_username=eq.${encodeURIComponent(user.username)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ mt5_account: mt5Account })
              });
            }
          } catch (e) {
            console.error("[admin] Failed to sync mt5_account to Supabase:", e);
          }
        }
      }

      const { password, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err: any) {
      console.error("[admin] User update error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/supabase/accounts", requireAdmin, async (req: Request, res: Response) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" });
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/accounts?select=trader_username,mt5_account`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      return res.status(response.status).json({ message: "Supabase fetch failed" });
    } catch {
      return res.status(502).json({ message: "Connection failed" });
    }
  });

  app.post("/api/admin/supabase/accounts", requireAdmin, async (req: Request, res: Response) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" });

    const { trader_username, mt5_account, mt5_password, mt5_server } = req.body;
    if (!trader_username || !mt5_account || !mt5_password || !mt5_server) {
      return res.status(400).json({ message: "All fields required" });
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_mt5_account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          p_trader_username: trader_username,
          p_mt5_account: parseInt(mt5_account),
          p_mt5_password: mt5_password,
          p_mt5_server: mt5_server,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ message: err });
      }

      // Update the user in local database with the new mt5Account
      const user = await storage.getUserByUsername(trader_username);
      if (user) {
        await storage.updateUser(user.id, { mt5Account: mt5_account });
      }

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/accounts/assign-mt5", requireAdmin, async (req: Request, res: Response) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" });

    const { trader_username, mt5_account } = req.body;
    if (!trader_username) {
      return res.status(400).json({ message: "trader_username required" });
    }

    try {
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

      // Handle unassignment case (mt5_account is null/empty)
      if (!mt5_account) {
        console.log(`[admin] Unassigning trader ${trader_username} from all accounts`);
        // Find and clear the account where this trader is assigned
        const unassignResponse = await fetch(`${supabaseUrl}/rest/v1/accounts?trader_username=eq.${encodeURIComponent(trader_username)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ trader_username: null })
        });
        if (!unassignResponse.ok) {
          throw new Error(`Failed to unassign trader from Supabase: ${unassignResponse.statusText}`);
        }

        // Update local database to clear mt5Account
        const traderUser = await storage.getUserByUsername(trader_username);
        if (traderUser) {
          console.log(`[admin] Clearing MT5 account for user ${trader_username}`);
          await storage.updateUser(traderUser.id, { mt5Account: null });
        }

        return res.json({ success: true });
      }

      // Assignment case (mt5_account is provided)
      // Step 1: Unassign current trader from whatever account they currently have
      console.log(`[admin] Unassigning trader ${trader_username} from their current account`);
      const step1Response = await fetch(`${supabaseUrl}/rest/v1/accounts?trader_username=eq.${encodeURIComponent(trader_username)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ trader_username: null })
      });
      if (!step1Response.ok) {
        throw new Error(`Step 1 failed: ${step1Response.statusText}`);
      }

      // Step 2: Unassign whoever currently owns the selected MT5 account
      console.log(`[admin] Clearing previous owner of MT5 account ${mt5_account}`);
      const step2Response = await fetch(`${supabaseUrl}/rest/v1/accounts?mt5_account=eq.${encodeURIComponent(mt5_account)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ trader_username: null })
      });
      if (!step2Response.ok) {
        throw new Error(`Step 2 failed: ${step2Response.statusText}`);
      }

      // Step 3: Assign the selected MT5 account to the new trader
      console.log(`[admin] Assigning MT5 account ${mt5_account} to trader ${trader_username}`);
      const step3Response = await fetch(`${supabaseUrl}/rest/v1/accounts?mt5_account=eq.${encodeURIComponent(mt5_account)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ trader_username: trader_username })
      });
      if (!step3Response.ok) {
        throw new Error(`Step 3 failed: ${step3Response.statusText}`);
      }

      // Step 4: Update the current trader's user record in local database to set mt5Account to the new account number
      const traderUser = await storage.getUserByUsername(trader_username);
      if (traderUser) {
        console.log(`[admin] Setting MT5 account ${mt5_account} for user ${trader_username}`);
        await storage.updateUser(traderUser.id, { mt5Account: mt5_account });
      }

      // Step 5: Find any other user in the local database where mt5Account equals the new account number and set their mt5Account to null
      const usersToUnassign = await storage.db.query.users.findMany();
      const userWithPreviousMt5 = usersToUnassign.find((u: any) => u.mt5Account === mt5_account && u.username !== trader_username);
      if (userWithPreviousMt5) {
        console.log(`[admin] Clearing MT5 account ${mt5_account} from user ${userWithPreviousMt5.username}`);
        await storage.updateUser(userWithPreviousMt5.id, { mt5Account: null });
      }

      return res.json({ success: true });
    } catch (e: any) {
      console.error("[admin] Failed to assign MT5 account:", e);
      return res.status(500).json({ message: e.message });
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

  app.get("/api/admin/dashboard", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const data = await storage.getPlatformDashboard();
      return res.json(data);
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

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const sbRes = await fetch(
          `${supabaseUrl}/rest/v1/trades?trader_username=eq.${encodeURIComponent(req.user!.username)}&status=in.(open,executed)&select=id,open_price,status,instrument,side,size,mt5_status,reject_reason`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        if (sbRes.ok) {
          const sbTrades: any[] = await sbRes.json();
          const rejectedLocalIds: string[] = [];
          for (const local of open) {
            if (local.status === 'open' || local.entryPrice === 0) {
              const match = sbTrades.find(
                s => s.instrument === local.instrument && s.side === local.side && s.size === local.size
              );
              if (match && match.mt5_status === 'rejected') {
                rejectedLocalIds.push(local.id);
                storage.updateTradeStatus(local.id, 'closed').catch(() => {});
                continue;
              }
              if (match && match.open_price > 0 && (match.mt5_status === 'filled' || !match.mt5_status)) {
                const roundedPrice = roundToTick(match.open_price, local.instrument);
                local.entryPrice = roundedPrice;
                local.status = 'executed';
                storage.updateTradeEntryPrice(local.id, roundedPrice).catch(() => {});
                storage.updateTradeStatus(local.id, 'executed').catch(() => {});
              }
            }
          }
          if (rejectedLocalIds.length > 0) {
            const filtered = open.filter(t => !rejectedLocalIds.includes(t.id));
            return res.json(filtered);
          }
        }
      } catch {}
    }

    return res.json(open);
  });

  app.get("/api/trades/stats", requireApproved, async (req: Request, res: Response) => {
    const stats = await storage.getTradeStats(req.user!.id);
    return res.json(stats);
  });

  app.get("/api/supabase/trades/open", requireApproved, async (req: Request, res: Response) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" });
    try {
      const sbRes = await fetch(
        `${supabaseUrl}/rest/v1/trades?trader_username=eq.${encodeURIComponent(req.user!.username)}&status=in.(open,executed)&select=id,instrument,side,size,open_price,status,ticket,stop_loss,take_profit,created_at`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (!sbRes.ok) return res.status(502).json({ message: "Supabase query failed" });
      return res.json(await sbRes.json());
    } catch {
      return res.status(502).json({ message: "Connection to Supabase failed" });
    }
  });

  app.get("/api/supabase/positions", requireApproved, async (req: Request, res: Response) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.json([]);
    try {
      const sbRes = await fetch(
        `${supabaseUrl}/rest/v1/trades?trader_username=eq.${encodeURIComponent(req.user!.username)}&status=in.(open,executed)&mt5_status=eq.filled&select=id,instrument,side,size,open_price,status,ticket,stop_loss,take_profit,created_at`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (!sbRes.ok) return res.json([]);
      const sbTrades: any[] = await sbRes.json();

      const localOpen = await storage.getOpenTrades(req.user!.id);
      const usedLocalIds = new Set<string>();

      const positions = sbTrades
        .filter((s: any) => s.open_price && s.open_price > 0)
        .map((s: any) => {
          const localMatch = localOpen.find(
            l => !usedLocalIds.has(l.id) && l.instrument === s.instrument && l.side === s.side && l.size === s.size
          );
          if (localMatch) usedLocalIds.add(localMatch.id);
          if (localMatch && (localMatch.entryPrice !== s.open_price || localMatch.status !== 'executed')) {
            const roundedPrice = roundToTick(s.open_price, s.instrument);
            storage.updateTradeEntryPrice(localMatch.id, roundedPrice).catch(() => {});
            storage.updateTradeStatus(localMatch.id, 'executed').catch(() => {});
          }
          return {
            supabaseId: s.id,
            localId: localMatch?.id || null,
            instrument: s.instrument,
            side: s.side,
            size: s.size,
            entryPrice: getSpreadAdjustedEntry(s.instrument, s.side, s.size, roundToTick(s.open_price, s.instrument)),
            stopLoss: s.stop_loss || null,
            takeProfit: s.take_profit || null,
            openedAt: s.created_at,
          };
        });

      return res.json(positions);
    } catch {
      return res.json([]);
    }
  });

  app.post("/api/trades/close-with-supabase", requireApproved, async (req: Request, res: Response) => {
    const { localTradeId, supabaseId, exitPrice } = req.body;
    if (typeof exitPrice !== "number") return res.status(400).json({ message: "exitPrice required" });

    try {
      const openTrades = await storage.getOpenTrades(req.user!.id);
      const trade = localTradeId ? openTrades.find(t => t.id === localTradeId) : null;

      if (trade) {
        const direction = trade.side === "BUY" ? 1 : -1;
        const adjustedEntry = getSpreadAdjustedEntry(trade.instrument, trade.side, trade.size, trade.entryPrice);
        const pnl = (exitPrice - adjustedEntry) * direction * trade.size;
        const closedTrade = await storage.closeTrade(trade.id, exitPrice, pnl);
        const user = await storage.getUser(req.user!.id);
        if (user) await storage.updateUserBalance(user.id, user.balance + pnl);

        if (supabaseId) {
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseKey) {
            fetch(`${supabaseUrl}/rest/v1/trades?id=eq.${supabaseId}&trader_username=eq.${encodeURIComponent(req.user!.username)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=minimal" },
              body: JSON.stringify({ close_price: exitPrice, pnl, close_time: new Date().toISOString(), status: "closed", updated_at: new Date().toISOString() }),
            }).catch(() => {});
          }
        }
        return res.json(closedTrade);
      }

      if (supabaseId) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" });
        const sbRes = await fetch(`${supabaseUrl}/rest/v1/trades?id=eq.${supabaseId}&trader_username=eq.${encodeURIComponent(req.user!.username)}&select=*`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        });
        if (!sbRes.ok) return res.status(502).json({ message: "Supabase query failed" });
        const sbTrades = await sbRes.json();
        const sbTrade = sbTrades[0];
        if (!sbTrade) return res.status(404).json({ message: "Trade not found in Supabase" });

        const direction = sbTrade.side === "BUY" ? 1 : -1;
        const rawEntry = sbTrade.open_price || 0;
        const roundedEntry = rawEntry ? roundToTick(rawEntry, sbTrade.instrument) : 0;
        const entryPrice = roundedEntry ? getSpreadAdjustedEntry(sbTrade.instrument, sbTrade.side, sbTrade.size, roundedEntry) : 0;
        const pnl = entryPrice ? (exitPrice - entryPrice) * direction * sbTrade.size : 0;

        await fetch(`${supabaseUrl}/rest/v1/trades?id=eq.${supabaseId}&trader_username=eq.${encodeURIComponent(req.user!.username)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=minimal" },
          body: JSON.stringify({ close_price: exitPrice, pnl, close_time: new Date().toISOString(), status: "closed", updated_at: new Date().toISOString() }),
        });

        const user = await storage.getUser(req.user!.id);
        if (user) await storage.updateUserBalance(user.id, user.balance + pnl);

        return res.json({ id: supabaseId, exitPrice, pnl, status: "closed", instrument: sbTrade.instrument, side: sbTrade.side, size: sbTrade.size, entryPrice });
      }

      return res.status(404).json({ message: "Trade not found" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/trades/analytics", requireApproved, async (req: Request, res: Response) => {
    const analytics = await storage.getDetailedAnalytics(req.user!.id);
    return res.json(analytics);
  });

  const checkBridgeOnline = async (): Promise<boolean> => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return false;
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/bridge_status?id=eq.1&select=last_ping,status`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (!data.length) return false;
      const row = data[0];
      const lastPing = new Date(row.last_ping).getTime();
      const stale = !Number.isFinite(lastPing) || Date.now() - lastPing > 30000;
      return row.status === 'online' && !stale;
    } catch { return false; }
  };

  app.post("/api/trades", requireApproved, async (req: Request, res: Response) => {
    try {
      const bridgeUp = await checkBridgeOnline();
      if (!bridgeUp) return res.status(503).json({ message: "Trading unavailable — market is closed or bridge is offline." });

      const hasPending = await storage.hasPendingPayout(req.user!.id);
      if (hasPending) return res.status(403).json({ message: "Trading is paused while your payout is being processed" });

      const parsed = insertTradeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid trade data" });

      // Auto-populate mt5_account from user profile
      const user = await storage.getUser(req.user!.id);
      const mt5Acc = user?.mt5Account || null;

      const tradeData = {
        ...parsed.data,
        mt5Account: mt5Acc
      };

      const trade = await storage.createTrade(req.user!.id, tradeData);

      if (req.user!.tier === "unverified") {
        await storage.incrementTriesUsed(req.user!.id);
      }

      // Sync to Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const sbTrade = {
            trader_username: req.user!.username,
            instrument: trade.instrument,
            side: trade.side,
            size: Number(trade.size),
            entry_price: Number(trade.entryPrice),
            status: trade.status || 'open',
            opened_at: trade.openedAt?.toISOString(),
            mt5_account: mt5Acc // Use the looked up value
          };

          await fetch(`${supabaseUrl}/rest/v1/trades`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(sbTrade)
          });
        } catch (e) {
          console.error("[trades] Supabase sync failed:", e);
        }
      }

      return res.status(201).json(trade);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/trades/:id/close", requireApproved, async (req: Request, res: Response) => {
    try {
      const { exitPrice: rawExitPrice } = req.body;
      if (typeof rawExitPrice !== "number") return res.status(400).json({ message: "exitPrice required" });

      const openTrades = await storage.getOpenTrades(req.user!.id);
      const trade = openTrades.find(t => t.id === req.params.id);
      if (!trade) return res.status(404).json({ message: "Trade not found" });

      const exitPrice = roundToTick(rawExitPrice, trade.instrument);
      const direction = trade.side === "BUY" ? 1 : -1;
      const adjustedEntry = getSpreadAdjustedEntry(trade.instrument, trade.side, trade.size, trade.entryPrice);
      const pnl = (exitPrice - adjustedEntry) * direction * trade.size;

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

  app.patch("/api/trades/:id/entry-price", requireApproved, async (req: Request, res: Response) => {
    try {
      const { entryPrice } = req.body;
      if (typeof entryPrice !== "number") return res.status(400).json({ message: "entryPrice required" });
      const openTrades = await storage.getOpenTrades(req.user!.id);
      const trade = openTrades.find(t => t.id === req.params.id);
      if (!trade) return res.status(404).json({ message: "Trade not found" });
      const updated = await storage.updateTradeEntryPrice(trade.id, entryPrice);
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/trades/:id/status", requireApproved, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status || typeof status !== "string") return res.status(400).json({ message: "status required" });
      const allTrades = await storage.getOpenTrades(req.user!.id);
      const trade = allTrades.find(t => t.id === req.params.id);
      if (!trade) return res.status(404).json({ message: "Trade not found" });
      const updated = await storage.updateTradeStatus(trade.id, status);
      return res.json(updated);
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

  const VALID_PAYOUT_METHODS = ['usdt', 'btc', 'eth', 'wise', 'rise'];

  app.post("/api/payouts", requireApproved, async (req: Request, res: Response) => {
    try {
      const parsed = insertWithdrawalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payout data" });

      const user = req.user!;
      if (parsed.data.amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero" });
      if (parsed.data.amount > user.balance) return res.status(400).json({ message: "Insufficient balance" });
      if (!parsed.data.payoutMethod || !VALID_PAYOUT_METHODS.includes(parsed.data.payoutMethod)) return res.status(400).json({ message: "Select a valid payout method" });
      if (!parsed.data.payoutAddress?.trim()) return res.status(400).json({ message: "Payout address is required" });

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

  app.get("/api/supabase/bridge-status", requireApproved, async (req: Request, res: Response) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.json({ online: false, reason: "Supabase not configured" });
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/bridge_status?id=eq.1&select=last_ping,status`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      });
      if (!response.ok) return res.json({ online: false, reason: "Failed to fetch bridge status" });
      const data = await response.json();
      if (!data.length) return res.json({ online: false, reason: "No bridge status row" });
      const row = data[0];
      const lastPing = new Date(row.last_ping).getTime();
      const stale = !Number.isFinite(lastPing) || Date.now() - lastPing > 30000;
      const online = row.status === 'online' && !stale;
      return res.json({ online, status: row.status, lastPing: row.last_ping, stale });
    } catch {
      return res.json({ online: false, reason: "Connection failed" });
    }
  });

  app.get("/api/supabase/config", requireApproved, (req: Request, res: Response) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" });
    return res.json({ url: supabaseUrl, anonKey: supabaseKey });
  });

  app.get("/api/supabase/trades/:supabaseId", requireApproved, async (req: Request, res: Response) => {
    const { supabaseId } = req.params;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" });
    try {
      const username = req.user!.username;
      const response = await fetch(`${supabaseUrl}/rest/v1/trades?id=eq.${supabaseId}&trader_username=eq.${encodeURIComponent(username)}&select=id,open_price,status,ticket,mt5_status,reject_reason`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) return res.json(data[0]);
        return res.status(404).json({ message: "Trade not found" });
      }
      return res.status(response.status).json({ message: "Supabase fetch failed" });
    } catch {
      return res.status(502).json({ message: "Connection failed" });
    }
  });

  app.post("/api/supabase/trades/close", requireApproved, async (req, res) => { const { supabaseId, close_price, pnl, close_time, status } = req.body; const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_ANON_KEY; if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" }); try { const response = await fetch(supabaseUrl + "/rest/v1/trades?id=eq." + supabaseId + "&trader_username=eq." + encodeURIComponent(req.user!.username), { method: "PATCH", headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": "Bearer " + supabaseKey, "Prefer": "return=representation" }, body: JSON.stringify({ close_price, pnl, close_time, status, updated_at: new Date().toISOString() }) }); if (response.ok) return res.json({ success: true }); return res.status(500).json({ message: "Supabase update failed" }); } catch { return res.status(502).json({ message: "Connection failed" }); } });

  app.post("/api/supabase/trades/sltp", requireApproved, async (req, res) => { const { supabaseId, stopLoss, takeProfit } = req.body; const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_ANON_KEY; if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" }); try { const response = await fetch(supabaseUrl + "/rest/v1/trades?id=eq." + supabaseId + "&trader_username=eq." + encodeURIComponent(req.user!.username), { method: "PATCH", headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": "Bearer " + supabaseKey, "Prefer": "return=minimal" }, body: JSON.stringify({ stop_loss: stopLoss, take_profit: takeProfit, updated_at: new Date().toISOString() }) }); if (response.ok) return res.json({ success: true }); return res.status(500).json({ message: "Supabase update failed" }); } catch { return res.status(502).json({ message: "Connection failed" }); } });

  app.post("/api/supabase/trades/update", requireApproved, async (req, res) => { const { supabaseId, pnl } = req.body; const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_ANON_KEY; if (!supabaseUrl || !supabaseKey) return res.status(500).json({ message: "Supabase not configured" }); try { const response = await fetch(supabaseUrl + "/rest/v1/trades?id=eq." + supabaseId + "&trader_username=eq." + encodeURIComponent(req.user!.username), { method: "PATCH", headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": "Bearer " + supabaseKey, "Prefer": "return=minimal" }, body: JSON.stringify({ pnl, updated_at: new Date().toISOString() }) }); if (response.ok) return res.json({ success: true }); return res.status(500).json({ message: "Supabase update failed" }); } catch { return res.status(502).json({ message: "Connection failed" }); } });

  const priceCache: Record<string, { price: number; ts: number }> = {};

  const FINNHUB_TO_INSTRUMENTS: Record<string, string[]> = {
    "BINANCE:BTCUSDT": ["MBT", "Bitcoin", "BTCUSD"],
    "OANDA:XAU_USD": ["Gold (GC)", "MGC", "XAUUSD"],
    "OANDA:XAG_USD": ["Silver", "SIL", "XAGUSD"],
    "OANDA:BCO_USD": ["Oil (WTI)", "MCL", "WTIUSD"],
    "FXCM:USA500.IDX/USD": ["S&P 500", "MES", "SPX"],
    "FXCM:USATEC.IDX/USD": ["Nasdaq", "MNQ", "NDX"],
  };

  const priceSSEClients: Set<Response> = new Set();

  app.get("/api/prices/stream", requireApproved, (_req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(':\n\n');

    const currentPrices: Record<string, number> = {};
    for (const [inst, cached] of Object.entries(priceCache)) {
      currentPrices[inst] = cached.price;
    }
    if (Object.keys(currentPrices).length > 0) {
      res.write(`data: ${JSON.stringify(currentPrices)}\n\n`);
    }

    priceSSEClients.add(res);
    _req.on('close', () => { priceSSEClients.delete(res); });
  });

  function broadcastPriceUpdate(updated: Record<string, number>) {
    if (Object.keys(updated).length === 0) return;
    const msg = `data: ${JSON.stringify(updated)}\n\n`;
    for (const client of priceSSEClients) {
      try { client.write(msg); } catch { priceSSEClients.delete(client); }
    }
  }

  function startServerFinnhub() {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) { console.log("[finnhub] No API key, price feed disabled"); return; }

    let ws: any = null;
    let reconnectDelay = 3000;

    const connect = () => {
      ws = new WebSocketWs(`wss://ws.finnhub.io?token=${key}`);
      ws.on('open', () => {
        console.log("[finnhub] WS connected, subscribing to symbols...");
        reconnectDelay = 3000;
        const symbols = Object.keys(FINNHUB_TO_INSTRUMENTS);
        symbols.forEach((sym: string) => ws.send(JSON.stringify({ type: "subscribe", symbol: sym })));
      });
      let tickLog = 0;
      ws.on('message', (raw: any) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === "trade" && data.data) {
            const updated: Record<string, number> = {};
            for (const tick of data.data) {
              const instruments = FINNHUB_TO_INSTRUMENTS[tick.s];
              if (instruments) {
                for (const inst of instruments) {
                  priceCache[inst] = { price: tick.p, ts: Date.now() };
                  updated[inst] = tick.p;
                }
              }
            }
            const now = Date.now();
            if (now - tickLog > 5000) {
              tickLog = now;
              console.log(`[finnhub] ticks: ${Object.entries(updated).map(([k, v]) => `${k}=${v}`).join(', ')} | SSE clients: ${priceSSEClients.size}`);
            }
            broadcastPriceUpdate(updated);
          }
        } catch {}
      });
      ws.on('error', (err: any) => {
        console.error("[finnhub] WS error:", err.message);
      });
      ws.on('close', () => {
        console.log(`[finnhub] WS closed, reconnecting in ${reconnectDelay / 1000}s...`);
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
      });
    };
    connect();
  }
  startServerFinnhub();

  const tvTickerCache: Record<string, { price: number; ts: number }> = {};

  async function fetchTvScannerPrices(exchange: string, tickers: string[]): Promise<Record<string, number>> {
    const now = Date.now();
    const results: Record<string, number> = {};
    const uncached: string[] = [];

    for (const t of tickers) {
      const c = tvTickerCache[t];
      if (c && now - c.ts < 250) {
        results[t] = c.price;
      } else {
        uncached.push(t);
      }
    }

    if (uncached.length === 0) return results;

    const res = await fetch(`https://scanner.tradingview.com/${exchange}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        symbols: { tickers: uncached },
        columns: ['close', 'name']
      })
    });
    if (!res.ok) throw new Error(`TV scanner returned ${res.status}`);
    const data = await res.json();
    if (data?.data) {
      for (const row of data.data) {
        const ticker = row.s;
        const closePrice = row.d?.[0];
        if (typeof closePrice === 'number' && closePrice > 0) {
          results[ticker] = closePrice;
          tvTickerCache[ticker] = { price: closePrice, ts: Date.now() };
        }
      }
    }
    return results;
  }

  async function fetchTvPrice(exchange: string, ticker: string): Promise<number> {
    const prices = await fetchTvScannerPrices(exchange, [ticker]);
    const price = prices[ticker];
    if (typeof price !== 'number' || price <= 0) throw new Error(`No price for ${ticker}`);
    return price;
  }

  const TV_INSTRUMENT_MAP: Record<string, { exchange: string; ticker: string }> = {
    'Bitcoin': { exchange: 'crypto', ticker: 'COINBASE:BTCUSD' },
    'MBT': { exchange: 'crypto', ticker: 'COINBASE:BTCUSD' },
    'Gold (GC)': { exchange: 'forex', ticker: 'OANDA:XAUUSD' },
    'Silver': { exchange: 'forex', ticker: 'OANDA:XAGUSD' },
    'Oil (WTI)': { exchange: 'cfd', ticker: 'TVC:USOIL' },
    'S&P 500': { exchange: 'cfd', ticker: 'TVC:SPX' },
    'Nasdaq': { exchange: 'america', ticker: 'NASDAQ:NDX' },
    'MNQ': { exchange: 'america', ticker: 'NASDAQ:NDX' },
    'MES': { exchange: 'cfd', ticker: 'TVC:SPX' },
    'MGC': { exchange: 'forex', ticker: 'OANDA:XAUUSD' },
    'SIL': { exchange: 'forex', ticker: 'OANDA:XAGUSD' },
    'MCL': { exchange: 'cfd', ticker: 'TVC:USOIL' },
  };

  const PRICE_SOURCES: Record<string, () => Promise<number>> = {};
  for (const [inst, { exchange, ticker }] of Object.entries(TV_INSTRUMENT_MAP)) {
    PRICE_SOURCES[inst] = () => fetchTvPrice(exchange, ticker);
  }

  app.post("/api/prices/batch", async (req: Request, res: Response) => {
    const { instruments } = req.body;
    if (!Array.isArray(instruments)) return res.status(400).json({ message: "instruments array required" });

    const now = Date.now();
    const results: Record<string, number> = {};
    const exchangeGroups: Record<string, { inst: string; ticker: string }[]> = {};

    for (const inst of instruments) {
      const cached = priceCache[inst];
      if (cached && now - cached.ts < 250) {
        results[inst] = cached.price;
      } else {
        const mapping = TV_INSTRUMENT_MAP[inst];
        if (mapping) {
          if (!exchangeGroups[mapping.exchange]) exchangeGroups[mapping.exchange] = [];
          exchangeGroups[mapping.exchange].push({ inst, ticker: mapping.ticker });
        }
      }
    }

    const fetches = Object.entries(exchangeGroups).map(async ([exchange, items]) => {
      try {
        const tickers = [...new Set(items.map(i => i.ticker))];
        const prices = await fetchTvScannerPrices(exchange, tickers);
        for (const item of items) {
          const price = prices[item.ticker];
          if (typeof price === 'number' && price > 0) {
            results[item.inst] = price;
            priceCache[item.inst] = { price, ts: Date.now() };
          } else {
            const cached = priceCache[item.inst];
            if (cached) results[item.inst] = cached.price;
          }
        }
      } catch {
        for (const item of items) {
          const cached = priceCache[item.inst];
          if (cached) results[item.inst] = cached.price;
        }
      }
    });

    await Promise.allSettled(fetches);
    return res.json({ prices: results });
  });

  app.get("/api/prices/:instrument", async (req: Request, res: Response) => {
    const instrument = decodeURIComponent(req.params.instrument);
    const fetcher = PRICE_SOURCES[instrument];
    if (!fetcher) return res.status(404).json({ message: "Unknown instrument" });

    const cached = priceCache[instrument];
    if (cached && Date.now() - cached.ts < 250) {
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

  app.post("/api/ai/chat", requireApproved, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "Messages array required" });
      }
      if (messages.length > 50) {
        return res.status(400).json({ message: "Too many messages. Start a new conversation." });
      }
      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role) || typeof msg.content !== 'string' || msg.content.length > 5000) {
          return res.status(400).json({ message: "Invalid message format" });
        }
      }

      const userId = req.user!.id;
      const allTrades = await storage.getTradeHistory(userId, 500);
      const response = await getChatResponse(messages, allTrades, req.user!);
      return res.json({ response });
    } catch (err: any) {
      console.error("[ai] Chat endpoint error:", err.message);
      return res.status(500).json({ message: "AI chat failed" });
    }
  });

  return httpServer;
}