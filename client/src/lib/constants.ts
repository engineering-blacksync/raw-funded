export const TIERS = {
  unverified: {
    leverage: 50,
    maxLot: 0.01,
    instruments: ['XAUUSD_m', 'XAGUSD_m', 'MNQ_m', 'MES_m'],
    tries: 3,
    label: 'Unverified',
    color: '#71717A'
  },
  verified: {
    leverage: 250,
    maxLot: 0.10,
    instruments: ['XAUUSD_m', 'XAGUSD_m', 'MNQ_m', 'MES_m',
                  'XAUUSD', 'XAGUSD', 'MNQ', 'MES'],
    tries: null,
    label: 'Verified',
    color: '#3B82F6'
  },
  elite: {
    leverage: 500,
    maxLot: 0.50,
    instruments: ['XAUUSD_m', 'XAGUSD_m', 'MNQ_m', 'MES_m',
                  'XAUUSD', 'XAGUSD', 'MNQ', 'MES'],
    tries: null,
    label: 'Elite',
    color: '#E8C547'
  },
  titan: {
    leverage: 2000,
    maxLot: 999,
    instruments: ['XAUUSD_m', 'XAGUSD_m', 'MNQ_m', 'MES_m',
                  'XAUUSD', 'XAGUSD', 'MNQ', 'MES', 'EURUSD', 'GBPUSD'],
    tries: null,
    label: 'Titan',
    color: '#22C55E'
  },
  banned: {
    leverage: 0,
    maxLot: 0,
    instruments: [],
    label: 'Banned',
    color: '#EF4444'
  }
};

export const LEADERBOARD_MOCK = [
  { rank: 1, name: "AlphaTrader", tier: "titan", pnl: 145020.50, winRate: 68, profitFactor: 2.4, avgWL: 1.8, instruments: "XAUUSD, MNQ", since: "2023" },
  { rank: 2, name: "SniperFX", tier: "elite", pnl: 89340.00, winRate: 72, profitFactor: 2.1, avgWL: 1.5, instruments: "XAGUSD, MES", since: "2023" },
  { rank: 3, name: "MacroKing", tier: "titan", pnl: 65100.25, winRate: 55, profitFactor: 1.9, avgWL: 2.2, instruments: "EURUSD, MNQ", since: "2024" },
  { rank: 4, name: "ZenState", tier: "verified", pnl: 34500.00, winRate: 62, profitFactor: 1.7, avgWL: 1.4, instruments: "XAUUSD_m", since: "2024" },
  { rank: 5, name: "PipCatcher", tier: "elite", pnl: 28900.50, winRate: 58, profitFactor: 1.6, avgWL: 1.6, instruments: "XAUUSD, GBPUSD", since: "2024" },
];