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
  createUser(user: InsertUser & { password: string }): Promise<User>;
  updateUserTier(id: string, tier: string): Promise<User | undefined>;
  updateUserBalance(id: string, balance: number): Promise<User | undefined>;
  incrementTriesUsed(id: string): Promise<void>;

  createTrade(userId: string, trade: InsertTrade): Promise<Trade>;
  closeTrade(tradeId: string, exitPrice: number, pnl: number): Promise<Trade | undefined>;
  getOpenTrades(userId: string): Promise<Trade[]>;
  getTradeHistory(userId: string, limit?: number): Promise<Trade[]>;
  getTradeStats(userId: string): Promise<{ totalPnl: number; winRate: number; profitFactor: number; avgWinLoss: number; totalTrades: number }>;

  createVerification(userId: string, v: InsertVerification): Promise<Verification>;
  getVerifications(userId: string): Promise<Verification[]>;
  updateVerificationStatus(id: string, status: string): Promise<Verification | undefined>;

  createWithdrawal(userId: string, w: InsertWithdrawal): Promise<Withdrawal>;
  getWithdrawals(userId: string): Promise<Withdrawal[]>;

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

  async createUser(insertUser: InsertUser & { password: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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

  async createVerification(userId: string, v: InsertVerification): Promise<Verification> {
    const [ver] = await db.insert(verifications).values({ ...v, userId }).returning();
    return ver;
  }

  async getVerifications(userId: string): Promise<Verification[]> {
    return db.select().from(verifications).where(eq(verifications.userId, userId)).orderBy(desc(verifications.submittedAt));
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
