import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  tier: text("tier").notNull().default("unverified"),
  balance: real("balance").notNull().default(10000),
  propFirm: text("prop_firm"),
  payoutsReceived: integer("payouts_received").default(0),
  triesUsed: integer("tries_used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  instrument: text("instrument").notNull(),
  side: text("side").notNull(),
  contracts: integer("contracts").notNull().default(1),
  size: real("size").notNull().default(1),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  pnl: real("pnl"),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  proofMethod: text("proof_method").notNull(),
  propFirm: text("prop_firm").notNull(),
  payoutsReceived: integer("payouts_received").notNull().default(0),
  proofFileUrl: text("proof_file_url"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const insertTradeSchema = createInsertSchema(trades).pick({
  instrument: true,
  side: true,
  contracts: true,
  size: true,
  entryPrice: true,
  stopLoss: true,
  takeProfit: true,
});

export const insertVerificationSchema = createInsertSchema(verifications).pick({
  proofMethod: true,
  propFirm: true,
  payoutsReceived: true,
  proofFileUrl: true,
  notes: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).pick({
  amount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Verification = typeof verifications.$inferSelect;
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
