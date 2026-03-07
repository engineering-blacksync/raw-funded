import { eq, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, trades, verifications, withdrawals,
  type User, type InsertUser, type Trade, type InsertTrade,
  type Verification, type InsertVerification, type Withdrawal, type InsertWithdrawal,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeSessionId(sessionId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<Pick<User, 'tier' | 'status' | 'balance' | 'leverage' | 'maxContracts' | 'isActive' | 'propFirm' | 'payoutsReceived' | 'approvedBy' | 'adminNotes' | 'verifiedAt' | 'stripePaid' | 'amountPaid' | 'card' | 'stripeSessionId' | 'allowedInstruments'>>): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  updateUserTier(id: string, tier: string): Promise<User | undefined>;
  updateUserBalance(id: string, balance: number): Promise<User | undefined>;
  incrementTriesUsed(id: string): Promise<void>;

  createTrade(userId: string, trade: InsertTrade): Promise<Trade>;
  closeTrade(tradeId: string, exitPrice: number, pnl: number): Promise<Trade | undefined>;
  updateTradeEntryPrice(tradeId: string, entryPrice: number): Promise<Trade | undefined>;
  updateTradeSLTP(tradeId: string, stopLoss: number | null, takeProfit: number | null): Promise<Trade | undefined>;
  getOpenTrades(userId: string): Promise<Trade[]>;
  getTradeHistory(userId: string, limit?: number): Promise<Trade[]>;
  getTradeStats(userId: string): Promise<{ totalPnl: number; winRate: number; profitFactor: number; avgWinLoss: number; totalTrades: number }>;
  getDetailedAnalytics(userId: string): Promise<any>;

  createVerification(userId: string, v: InsertVerification): Promise<Verification>;
  getVerifications(userId: string): Promise<Verification[]>;
  getAllVerifications(): Promise<Array<Verification & { username: string; email: string }>>;
  updateVerificationStatus(id: string, status: string): Promise<Verification | undefined>;

  createWithdrawal(userId: string, w: InsertWithdrawal): Promise<Withdrawal>;
  getWithdrawals(userId: string): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<Array<Withdrawal & { username: string; email: string }>>;
  updateWithdrawalStatus(id: string, stage: string, adminNotes?: string): Promise<Withdrawal | undefined>;
  hasPendingPayout(userId: string): Promise<boolean>;

  getLeaderboard(): Promise<Array<User & { totalPnl: number; winRate: number; profitFactor: number; totalTrades: number }>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByStripeSessionId(sessionId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeSessionId, sessionId));
    return user;
  }

  async createUser(insertUser: InsertUser & { password: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: string, data: Partial<Pick<User, 'tier' | 'status' | 'balance' | 'leverage' | 'maxContracts' | 'isActive' | 'propFirm' | 'payoutsReceived' | 'approvedBy' | 'adminNotes' | 'verifiedAt' | 'stripePaid' | 'amountPaid' | 'card' | 'stripeSessionId' | 'allowedInstruments'>>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserTier(id: string, tier: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ tier }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserBalance(id: string, balance: number): Promise<User | undefined> {
    const [user] = await db.update(users).set({ balance }).where(eq(users.id, id)).returning();
    return user;
  }

  async incrementTriesUsed(id: string): Promise<void> {
    await db.update(users).set({ triesUsed: sql`${users.triesUsed} + 1` }).where(eq(users.id, id));
  }

  async createTrade(userId: string, trade: InsertTrade): Promise<Trade> {
    const [t] = await db.insert(trades).values({ ...trade, userId }).returning();
    return t;
  }

  async closeTrade(tradeId: string, exitPrice: number, pnl: number): Promise<Trade | undefined> {
    const [t] = await db
      .update(trades)
      .set({ exitPrice, pnl, status: "closed", closedAt: new Date() })
      .where(eq(trades.id, tradeId))
      .returning();
    return t;
  }

  async updateTradeEntryPrice(tradeId: string, entryPrice: number): Promise<Trade | undefined> {
    const [t] = await db
      .update(trades)
      .set({ entryPrice })
      .where(eq(trades.id, tradeId))
      .returning();
    return t;
  }

  async updateTradeSLTP(tradeId: string, stopLoss: number | null, takeProfit: number | null): Promise<Trade | undefined> {
    const [t] = await db
      .update(trades)
      .set({ stopLoss, takeProfit })
      .where(eq(trades.id, tradeId))
      .returning();
    return t;
  }

  async getOpenTrades(userId: string): Promise<Trade[]> {
    return db.select().from(trades).where(sql`${trades.userId} = ${userId} AND ${trades.status} = 'open'`);
  }

  async getTradeHistory(userId: string, limit = 50): Promise<Trade[]> {
    return db.select().from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.openedAt)).limit(limit);
  }

  async getTradeStats(userId: string) {
    const closedTrades = await db.select().from(trades).where(sql`${trades.userId} = ${userId} AND ${trades.status} = 'closed'`);

    if (closedTrades.length === 0) {
      return { totalPnl: 0, winRate: 0, profitFactor: 0, avgWinLoss: 0, totalTrades: 0 };
    }

    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winRate = (wins.length / closedTrades.length) * 100;
    const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 1;
    const avgWinLoss = avgLoss > 0 ? avgWin / avgLoss : 0;

    return { totalPnl, winRate, profitFactor, avgWinLoss, totalTrades: closedTrades.length };
  }

  async getDetailedAnalytics(userId: string) {
    const allTrades = await db.select().from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.openedAt));
    const closedTrades = allTrades.filter(t => t.status === 'closed');
    const openTrades = allTrades.filter(t => t.status === 'open');

    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats: Record<string, { trades: number; pnl: number }> = {};
    dayNames.forEach(d => { dayStats[d] = { trades: 0, pnl: 0 }; });
    for (const t of closedTrades) {
      if (t.closedAt) {
        const day = dayNames[new Date(t.closedAt).getDay()];
        dayStats[day].trades++;
        dayStats[day].pnl += t.pnl ?? 0;
      }
    }
    const mostActiveDay = Object.entries(dayStats).sort((a, b) => b[1].trades - a[1].trades)[0];
    const mostProfitableDay = Object.entries(dayStats).sort((a, b) => b[1].pnl - a[1].pnl)[0];

    const dateStats: Record<string, { trades: number; pnl: number; wins: number }> = {};
    for (const t of closedTrades) {
      if (t.closedAt) {
        const dateKey = new Date(t.closedAt).toISOString().slice(0, 10);
        if (!dateStats[dateKey]) dateStats[dateKey] = { trades: 0, pnl: 0, wins: 0 };
        dateStats[dateKey].trades++;
        dateStats[dateKey].pnl += t.pnl ?? 0;
        if ((t.pnl ?? 0) > 0) dateStats[dateKey].wins++;
      }
    }

    const instrumentStats: Record<string, { trades: number; pnl: number; wins: number }> = {};
    for (const t of closedTrades) {
      if (!instrumentStats[t.instrument]) instrumentStats[t.instrument] = { trades: 0, pnl: 0, wins: 0 };
      instrumentStats[t.instrument].trades++;
      instrumentStats[t.instrument].pnl += t.pnl ?? 0;
      if ((t.pnl ?? 0) > 0) instrumentStats[t.instrument].wins++;
    }

    let avgDurationMs = 0;
    const durTrades = closedTrades.filter(t => t.openedAt && t.closedAt);
    if (durTrades.length > 0) {
      const totalMs = durTrades.reduce((sum, t) => sum + (new Date(t.closedAt!).getTime() - new Date(t.openedAt!).getTime()), 0);
      avgDurationMs = totalMs / durTrades.length;
    }

    let maxDrawdown = 0;
    let peak = 0;
    let runningPnl = 0;
    const equityCurve: number[] = [];
    for (const t of [...closedTrades].reverse()) {
      runningPnl += t.pnl ?? 0;
      equityCurve.push(runningPnl);
      if (runningPnl > peak) peak = runningPnl;
      const dd = peak - runningPnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const totalLotsTraded = allTrades.reduce((sum, t) => sum + (Number(t.size) || 0), 0);

    return {
      totalTrades: closedTrades.length,
      totalLotsTraded,
      openPositions: openTrades.length,
      totalPnl,
      winRate,
      profitFactor: profitFactor === Infinity ? null : profitFactor,
      avgWin,
      avgLoss,
      wins: wins.length,
      losses: losses.length,
      bestTrade: closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl ?? 0)) : 0,
      worstTrade: closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl ?? 0)) : 0,
      maxDrawdown,
      avgDurationMs,
      mostActiveDay: mostActiveDay ? { day: mostActiveDay[0], trades: mostActiveDay[1].trades } : null,
      mostProfitableDay: mostProfitableDay ? { day: mostProfitableDay[0], pnl: mostProfitableDay[1].pnl } : null,
      dayStats,
      dateStats,
      instrumentStats,
      equityCurve,
      recentTrades: closedTrades.slice(0, 20).map(t => ({
        id: t.id,
        instrument: t.instrument,
        side: t.side,
        size: t.size,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        pnl: t.pnl,
        openedAt: t.openedAt,
        closedAt: t.closedAt,
      })),
    };
  }

  async createVerification(userId: string, v: InsertVerification): Promise<Verification> {
    const [ver] = await db.insert(verifications).values({ ...v, userId }).returning();
    return ver;
  }

  async getVerifications(userId: string): Promise<Verification[]> {
    return db.select().from(verifications).where(eq(verifications.userId, userId)).orderBy(desc(verifications.submittedAt));
  }

  async getAllVerifications(): Promise<Array<Verification & { username: string; email: string }>> {
    const allVers = await db.select().from(verifications).orderBy(desc(verifications.submittedAt));
    const results = [];
    for (const v of allVers) {
      const [user] = await db.select().from(users).where(eq(users.id, v.userId));
      results.push({ ...v, username: user?.username || 'Unknown', email: user?.email || '' });
    }
    return results;
  }

  async updateVerificationStatus(id: string, status: string): Promise<Verification | undefined> {
    const [ver] = await db.update(verifications).set({ status, reviewedAt: new Date() }).where(eq(verifications.id, id)).returning();
    return ver;
  }

  async createWithdrawal(userId: string, w: InsertWithdrawal): Promise<Withdrawal> {
    const [wd] = await db.insert(withdrawals).values({ ...w, userId }).returning();
    return wd;
  }

  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.requestedAt));
  }

  async getAllWithdrawals(): Promise<Array<Withdrawal & { username: string; email: string }>> {
    const allWds = await db.select().from(withdrawals).orderBy(desc(withdrawals.requestedAt));
    const results = [];
    for (const w of allWds) {
      const [user] = await db.select().from(users).where(eq(users.id, w.userId));
      results.push({ ...w, username: user?.username || 'Unknown', email: user?.email || '' });
    }
    return results;
  }

  async updateWithdrawalStatus(id: string, stage: string, adminNotes?: string): Promise<Withdrawal | undefined> {
    const updates: any = { stage };
    if (stage === "funds_sent") {
      updates.status = "completed";
      updates.processedAt = new Date();
    } else if (stage === "rejected") {
      updates.status = "rejected";
      updates.processedAt = new Date();
    } else {
      updates.status = "processing";
    }
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    const [wd] = await db.update(withdrawals).set(updates).where(eq(withdrawals.id, id)).returning();
    return wd;
  }

  async hasPendingPayout(userId: string): Promise<boolean> {
    const pending = await db.select().from(withdrawals).where(
      sql`${withdrawals.userId} = ${userId} AND ${withdrawals.status} != 'completed' AND ${withdrawals.status} != 'rejected'`
    );
    return pending.length > 0;
  }

  async getLeaderboard() {
    const allUsers = await db.select().from(users).where(sql`${users.tier} != 'banned' AND ${users.tier} != 'unverified'`);
    
    const results = [];
    for (const user of allUsers) {
      const stats = await this.getTradeStats(user.id);
      results.push({ ...user, ...stats });
    }

    return results.sort((a, b) => b.totalPnl - a.totalPnl).slice(0, 20);
  }
}

export const storage = new DatabaseStorage();
