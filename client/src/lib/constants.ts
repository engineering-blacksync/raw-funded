export const TIERS = {
  unverified: {
    leverage: 50,
    maxContractsText: "1 Micro",
    maxContractsVal: 1,
    instruments: ['MNQ', 'MES', 'MGC', 'SIL', 'MCL'],
    tries: 3,
    label: 'Unverified',
    color: '#71717A'
  },
  verified: {
    leverage: 250,
    maxContractsText: "10 Micros / 1 Mini",
    maxContractsVal: 10,
    instruments: ['MNQ', 'MES', 'MGC', 'SIL', 'MCL', 'NQ', 'ES', 'GC', 'SI', 'CL'],
    tries: null,
    label: 'Verified',
    color: '#3B82F6'
  },
  elite: {
    leverage: 500,
    maxContractsText: "50 Micros / 5 Minis",
    maxContractsVal: 50,
    instruments: ['MNQ', 'MES', 'MGC', 'SIL', 'MCL', 'NQ', 'ES', 'GC', 'SI', 'CL'],
    tries: null,
    label: 'Elite',
    color: '#E8C547'
  },
  titan: {
    leverage: 2000,
    maxContractsText: "Unlimited",
    maxContractsVal: 999,
    instruments: ['MNQ', 'MES', 'MGC', 'SIL', 'MCL', 'NQ', 'ES', 'GC', 'SI', 'CL'],
    tries: null,
    label: 'Titan',
    color: '#22C55E'
  },
  banned: {
    leverage: 0,
    maxContractsText: "0",
    maxContractsVal: 0,
    instruments: [],
    label: 'Banned',
    color: '#EF4444'
  }
};

export const LEADERBOARD_MOCK = [
  { rank: 1, name: "AlphaTrader", tier: "titan", pnl: 145020.50, winRate: 68, profitFactor: 2.4, avgWL: 1.8, instruments: "NQ, GC", since: "2023" },
  { rank: 2, name: "SniperFX", tier: "elite", pnl: 89340.00, winRate: 72, profitFactor: 2.1, avgWL: 1.5, instruments: "ES, CL", since: "2023" },
  { rank: 3, name: "MacroKing", tier: "titan", pnl: 65100.25, winRate: 55, profitFactor: 1.9, avgWL: 2.2, instruments: "NQ, CL", since: "2024" },
  { rank: 4, name: "ZenState", tier: "verified", pnl: 34500.00, winRate: 62, profitFactor: 1.7, avgWL: 1.4, instruments: "MNQ, MES", since: "2024" },
  { rank: 5, name: "PipCatcher", tier: "elite", pnl: 28900.50, winRate: 58, profitFactor: 1.6, avgWL: 1.6, instruments: "GC, SI", since: "2024" },
];