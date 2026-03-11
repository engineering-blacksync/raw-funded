import OpenAI from "openai";
import type { Trade, User } from "@shared/schema";

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface TradeAnalysis {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  roi: number;
  maxDrawdown: number;
  avgDurationMs: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  instrumentBreakdown: Record<string, { trades: number; pnl: number; wins: number; losses: number; winRate: number; avgPnl: number }>;
  sideBreakdown: { buyTrades: number; sellTrades: number; buyPnl: number; sellPnl: number };
  riskRewardRatio: number;
  tradesWithSL: number;
  tradesWithTP: number;
  slPercentage: number;
  tpPercentage: number;
  recentTrades: Array<{ instrument: string; side: string; pnl: number; closedAt: string | null }>;
}

export function analyzeTradeHistory(trades: Trade[], user: User): TradeAnalysis {
  const closedTrades = trades.filter(t => t.status === 'closed');
  const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);

  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
  const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl ?? 0)) : 0;
  const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl ?? 0)) : 0;

  const startingBalance = user.amountPaid || 10000;
  const roi = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0;

  let maxDrawdown = 0;
  let peak = 0;
  let runningPnl = 0;
  const sorted = [...closedTrades].sort((a, b) => new Date(a.closedAt || 0).getTime() - new Date(b.closedAt || 0).getTime());
  for (const t of sorted) {
    runningPnl += t.pnl ?? 0;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  let avgDurationMs = 0;
  const durTrades = closedTrades.filter(t => t.openedAt && t.closedAt);
  if (durTrades.length > 0) {
    const totalMs = durTrades.reduce((sum, t) => sum + (new Date(t.closedAt!).getTime() - new Date(t.openedAt!).getTime()), 0);
    avgDurationMs = totalMs / durTrades.length;
  }

  let longestWinStreak = 0;
  let longestLoseStreak = 0;
  let currentWin = 0;
  let currentLose = 0;
  for (const t of sorted) {
    if ((t.pnl ?? 0) > 0) {
      currentWin++;
      currentLose = 0;
      if (currentWin > longestWinStreak) longestWinStreak = currentWin;
    } else if ((t.pnl ?? 0) < 0) {
      currentLose++;
      currentWin = 0;
      if (currentLose > longestLoseStreak) longestLoseStreak = currentLose;
    }
  }

  const instrumentBreakdown: TradeAnalysis['instrumentBreakdown'] = {};
  for (const t of closedTrades) {
    if (!instrumentBreakdown[t.instrument]) {
      instrumentBreakdown[t.instrument] = { trades: 0, pnl: 0, wins: 0, losses: 0, winRate: 0, avgPnl: 0 };
    }
    const inst = instrumentBreakdown[t.instrument];
    inst.trades++;
    inst.pnl += t.pnl ?? 0;
    if ((t.pnl ?? 0) > 0) inst.wins++;
    else if ((t.pnl ?? 0) < 0) inst.losses++;
  }
  for (const key of Object.keys(instrumentBreakdown)) {
    const inst = instrumentBreakdown[key];
    inst.winRate = inst.trades > 0 ? (inst.wins / inst.trades) * 100 : 0;
    inst.avgPnl = inst.trades > 0 ? inst.pnl / inst.trades : 0;
  }

  const sideBreakdown = {
    buyTrades: closedTrades.filter(t => t.side === 'BUY').length,
    sellTrades: closedTrades.filter(t => t.side === 'SELL').length,
    buyPnl: closedTrades.filter(t => t.side === 'BUY').reduce((s, t) => s + (t.pnl ?? 0), 0),
    sellPnl: closedTrades.filter(t => t.side === 'SELL').reduce((s, t) => s + (t.pnl ?? 0), 0),
  };

  const tradesWithSL = closedTrades.filter(t => t.stopLoss != null).length;
  const tradesWithTP = closedTrades.filter(t => t.takeProfit != null).length;
  const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  return {
    totalTrades: closedTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    avgPnl,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    profitFactor: profitFactor === Infinity ? 999 : profitFactor,
    roi,
    maxDrawdown,
    avgDurationMs,
    longestWinStreak,
    longestLoseStreak,
    instrumentBreakdown,
    sideBreakdown,
    riskRewardRatio,
    tradesWithSL,
    tradesWithTP,
    slPercentage: closedTrades.length > 0 ? (tradesWithSL / closedTrades.length) * 100 : 0,
    tpPercentage: closedTrades.length > 0 ? (tradesWithTP / closedTrades.length) * 100 : 0,
    recentTrades: sorted.slice(-10).reverse().map(t => ({
      instrument: t.instrument,
      side: t.side,
      pnl: t.pnl ?? 0,
      closedAt: t.closedAt?.toISOString() || null,
    })),
  };
}

function buildSystemPrompt(analysis: TradeAnalysis, user: any): string {
  const startingBalance = user.amountPaid || 10000;
  const currentBalance = user.balance || startingBalance;

  const instrumentSummary = Object.entries(analysis.instrumentBreakdown)
    .map(([inst, data]) => `  ${inst}: ${data.trades} trades, P&L $${data.pnl.toFixed(2)}, Win Rate ${data.winRate.toFixed(1)}%, Avg P&L $${data.avgPnl.toFixed(2)}`)
    .join('\n');

  const recentTradesSummary = analysis.recentTrades
    .map(t => `  ${t.instrument} ${t.side} → $${t.pnl.toFixed(2)}`)
    .join('\n');

  return `You are Blacksync Colleague, an elite AI trading analyst embedded in the Raw Funded trading platform. You are direct, honest, and data-driven. You never sugarcoat poor performance. You speak like a seasoned trading desk analyst — concise, sharp, and real.

Your personality:
- You are blunt but constructive. If a trader is bleeding money, you tell them straight.
- You use trading jargon naturally (drawdown, risk/reward, edge, etc.)
- You back every observation with numbers from their actual data
- You identify patterns others miss — overtrading, revenge trading, instrument bias, time-of-day issues
- You never recommend specific trades or signals — you analyze past performance only
- You are encouraging when there's genuine improvement, but never fake

TRADER PROFILE:
- Username: ${user.username}
- Account Tier: ${user.tier}
- Starting Balance: $${startingBalance.toLocaleString()}
- Current Balance: $${currentBalance.toLocaleString()}
- Account Card: ${user.card || 'None'}

TRADE STATISTICS:
- Total Closed Trades: ${analysis.totalTrades}
- Wins: ${analysis.wins} | Losses: ${analysis.losses}
- Win Rate: ${analysis.winRate.toFixed(1)}%
- Total P&L: $${analysis.totalPnl.toFixed(2)}
- ROI: ${analysis.roi.toFixed(2)}%
- Average P&L per Trade: $${analysis.avgPnl.toFixed(2)}
- Average Win: $${analysis.avgWin.toFixed(2)}
- Average Loss: -$${analysis.avgLoss.toFixed(2)}
- Best Trade: $${analysis.bestTrade.toFixed(2)}
- Worst Trade: $${analysis.worstTrade.toFixed(2)}
- Profit Factor: ${analysis.profitFactor.toFixed(2)}
- Risk/Reward Ratio: ${analysis.riskRewardRatio.toFixed(2)}
- Max Drawdown: $${analysis.maxDrawdown.toFixed(2)}
- Longest Win Streak: ${analysis.longestWinStreak}
- Longest Lose Streak: ${analysis.longestLoseStreak}
- Avg Trade Duration: ${Math.round(analysis.avgDurationMs / 1000)}s
- Stop Loss Usage: ${analysis.slPercentage.toFixed(0)}% of trades
- Take Profit Usage: ${analysis.tpPercentage.toFixed(0)}% of trades

INSTRUMENT BREAKDOWN:
${instrumentSummary || '  No instrument data available'}

SIDE BREAKDOWN:
  BUY: ${analysis.sideBreakdown.buyTrades} trades, P&L $${analysis.sideBreakdown.buyPnl.toFixed(2)}
  SELL: ${analysis.sideBreakdown.sellTrades} trades, P&L $${analysis.sideBreakdown.sellPnl.toFixed(2)}

RECENT TRADES (last 10):
${recentTradesSummary || '  No recent trades'}

Rules:
1. Always reference actual numbers from the data above
2. Never make up statistics — only use what's provided
3. If the trader has no trades, tell them to go trade first
4. Keep responses focused and actionable
5. Use formatting with bold, bullet points, and sections for readability
6. Never recommend entering specific trades or give signals`;
}

export async function getChatResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  trades: Trade[],
  user: any
): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    return "I'm not fully connected yet — the platform needs an OpenAI API key configured to power my analysis engine. Ask your admin to set the OPENAI_API_KEY environment variable.";
  }

  const analysis = analyzeTradeHistory(trades, user);
  const systemPrompt = buildSystemPrompt(analysis, user);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "I couldn't generate a response. Try again.";
  } catch (error: any) {
    console.error("[ai] Chat error:", error.message);
    if (error.message?.includes('API key')) {
      return "Invalid OpenAI API key. Please check your OPENAI_API_KEY configuration.";
    }
    return `Analysis error: ${error.message}. Try again in a moment.`;
  }
}
