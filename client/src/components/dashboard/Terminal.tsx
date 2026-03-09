import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Trade } from '@shared/schema';
import PositionLines from './PositionLines';

type Mt5Status = 'pending' | 'filled' | 'rejected';
interface LocalTrade extends Trade {
  mt5Status?: Mt5Status;
  rejectReason?: string;
  supabaseId?: string;
}

interface TerminalProps {
  tier: any;
  userTierName: string;
  balance: number;
  onOpenPnlChange?: (pnl: number) => void;
  allowedInstruments?: string[] | null;
  username: string;
}

interface InstrumentConfig {
  label: string;
  symbol: string;
  default: number;
  step: number;
  min: number;
  max: number;
  lotSize: number;
  spread?: number;
  tickSize?: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { label: 'MBT', symbol: 'COINBASE:BTCUSD', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'Gold (GC)', symbol: 'OANDA:XAUUSD', default: 1, step: 1, min: 1, max: 10, lotSize: 1, spread: 0.30, tickSize: 0.10 },
  { label: 'Silver', symbol: 'OANDA:XAGUSD', default: 1, step: 1, min: 1, max: 10, lotSize: 1, spread: 0.008 },
  { label: 'Oil (WTI)', symbol: 'TVC:USOIL', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'S&P 500', symbol: 'TVC:SPX', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'Nasdaq', symbol: 'NASDAQ:NDX', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'MNQ', symbol: 'NASDAQ:NDX', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'MES', symbol: 'TVC:SPX', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'MGC', symbol: 'OANDA:XAUUSD', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10, spread: 0.03 },
  { label: 'SIL', symbol: 'OANDA:XAGUSD', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10, spread: 0.008 },
  { label: 'MCL', symbol: 'TVC:USOIL', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
];

const PLATFORM_SPREAD_PER_CONTRACT = 2;
const CLIENT_LOT_SIZE_MAP: Record<string, number> = Object.fromEntries(
  INSTRUMENTS.map(i => [i.label, i.lotSize])
);
function getSpreadAdjustedEntry(instrument: string, side: string, size: number, fillPrice: number): number {
  const lotSize = CLIENT_LOT_SIZE_MAP[instrument] || 1;
  const contracts = Math.round(size / lotSize);
  const spread = PLATFORM_SPREAD_PER_CONTRACT * contracts;
  return side === 'BUY' ? fillPrice + spread : fillPrice - spread;
}

declare global {
  interface Window { TradingView: any; }
}

function useTradingViewScript() {
  const [loaded, setLoaded] = useState(!!window.TradingView);
  useEffect(() => {
    if (window.TradingView) { setLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
}


interface FinnhubDebugInfo {
  wsStatus: 'connected' | 'disconnected' | 'connecting';
  lastPrice: number | null;
  lastUpdateTs: number | null;
  tickCount: number;
}

let globalFinnhubDebug: FinnhubDebugInfo = { wsStatus: 'disconnected', lastPrice: null, lastUpdateTs: null, tickCount: 0 };

function useLivePrices(instruments: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const pricesRef = useRef<Record<string, number>>({});
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [finnhubDebug, setFinnhubDebug] = useState<FinnhubDebugInfo>(globalFinnhubDebug);
  const instrumentsRef = useRef<string[]>(instruments);
  instrumentsRef.current = instruments;

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;

    const connect = () => {
      if (cancelled) return;
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }

      globalFinnhubDebug = { ...globalFinnhubDebug, wsStatus: 'connecting' };
      setFinnhubDebug({ ...globalFinnhubDebug });

      const sse = new EventSource('/api/prices/stream');
      sseRef.current = sse;

      sse.onopen = () => {
        retryCount = 0;
        globalFinnhubDebug = { ...globalFinnhubDebug, wsStatus: 'connected' };
        setFinnhubDebug({ ...globalFinnhubDebug });
        console.log('[price-feed] SSE connected to Finnhub relay');
      };

      let debugThrottle = 0;
      sse.onmessage = (event) => {
        try {
          const updatedPrices: Record<string, number> = JSON.parse(event.data);
          const currentInstruments = instrumentsRef.current;
          const newPrices = { ...pricesRef.current };
          let anyUpdated = false;

          for (const [inst, price] of Object.entries(updatedPrices)) {
            if (typeof price === 'number' && price > 0 && currentInstruments.includes(inst)) {
              if (newPrices[inst] !== price) {
                newPrices[inst] = price;
                anyUpdated = true;
              }
            }
          }

          if (anyUpdated) {
            pricesRef.current = newPrices;
            setPrices(newPrices);
          }

          const firstPrice = Object.values(updatedPrices)[0];
          if (typeof firstPrice === 'number') {
            globalFinnhubDebug = {
              wsStatus: 'connected',
              lastPrice: firstPrice,
              lastUpdateTs: Date.now(),
              tickCount: globalFinnhubDebug.tickCount + 1,
            };
            const now = Date.now();
            if (now - debugThrottle > 1000) {
              debugThrottle = now;
              setFinnhubDebug({ ...globalFinnhubDebug });
              console.log('[price-feed] tick', Object.entries(updatedPrices).map(([k, v]) => `${k}=${v}`).join(', '));
            }
          }
        } catch {}
      };

      sse.onerror = () => {
        globalFinnhubDebug = { ...globalFinnhubDebug, wsStatus: 'disconnected' };
        setFinnhubDebug({ ...globalFinnhubDebug });
        sse.close();
        sseRef.current = null;
        if (!cancelled) {
          retryCount++;
          const delay = Math.min(3000 * retryCount, 15000);
          console.log(`[price-feed] SSE disconnected, retry #${retryCount} in ${delay / 1000}s...`);
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, []);

  return { prices, finnhubDebug };
}

function getTickSize(instrument: string): number | undefined {
  return INSTRUMENTS.find(i => i.label === instrument)?.tickSize;
}

function roundToTick(price: number, instrument: string): number {
  const tick = getTickSize(instrument);
  if (!tick) return price;
  return Math.round(price / tick) * tick;
}

const PNL_TICK_MAP: Record<string, number> = {
  'MBT': 0.50,
  'Bitcoin': 0.50,
  'BTCUSD': 0.50,
  'Gold (GC)': 10,
  'MGC': 10,
};

function calcPnl(side: string, entry: number, current: number, size: number, instrument?: string): number {
  const direction = side === 'BUY' ? 1 : -1;
  const priceDiff = (current - entry) * direction;
  
  if (instrument === 'MGC') {
    // Every $0.10 move = $1.00 PnL (for 1 contract / 0.10 lot)
    // Formula: (Price Diff / 0.10) * size / 0.10
    return (priceDiff / 0.1) * (size / 0.1);
  }
  
  if (instrument === 'Gold (GC)' || instrument === 'XAUUSD') {
    // Every $0.10 move = $10.00 PnL (for 1 contract / 1.0 lot)
    // Formula: (Price Diff / 0.10) * 10 * size
    return (priceDiff / 0.1) * 10 * size;
  }

  const rawPnl = priceDiff * size;
  const tick = instrument ? PNL_TICK_MAP[instrument] : undefined;
  if (!tick) return rawPnl;
  return Math.trunc(rawPnl / tick) * tick;
}

function isMarketOpen(instrument: string): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcTime = utcHour * 60 + utcMinute;

  const btcNames = ['MBT', 'Bitcoin', 'BTCUSD'];
  if (btcNames.includes(instrument) || instrument.toLowerCase().includes('btc') || instrument.toLowerCase().includes('bitcoin')) {
    return true;
  }

  if (['Gold (GC)', 'Silver', 'Oil (WTI)', 'MGC', 'SIL', 'MCL'].includes(instrument)) {
    if (utcDay === 6) return false;
    if (utcDay === 0 && utcTime < 23 * 60) return false;
    if (utcDay === 5 && utcTime >= 22 * 60) return false;
    return true;
  }

  if (['S&P 500', 'Nasdaq', 'MNQ', 'MES'].includes(instrument)) {
    if (utcDay === 6) return false;
    if (utcDay === 0 && utcTime < 23 * 60) return false;
    if (utcDay === 5 && utcTime >= 22 * 60) return false;
    return true;
  }

  return true;
}

export default function Terminal({ tier, userTierName, balance, onOpenPnlChange, allowedInstruments, username }: TerminalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvLoaded = useTradingViewScript();

  const visibleInstruments = allowedInstruments && allowedInstruments.length > 0
    ? INSTRUMENTS.filter(i => allowedInstruments.includes(i.label))
    : INSTRUMENTS;

  const defaultInstrument = visibleInstruments.find(i => i.label === 'MGC') || visibleInstruments[0];
  const [activeInstrument, setActiveInstrument] = useState(defaultInstrument);
  const [quantity, setQuantity] = useState<number>(defaultInstrument.default);
  const [openTrades, setOpenTrades] = useState<LocalTrade[]>([]);
  const openTradesRef = useRef<LocalTrade[]>([]);
  useEffect(() => { openTradesRef.current = openTrades; }, [openTrades]);
  const [closedTrades, setClosedTrades] = useState<LocalTrade[]>([]);
  const [viewMode, setViewMode] = useState<'simple' | 'pro'>('pro');
  const [tradeLoading, setTradeLoading] = useState<'BUY' | 'SELL' | null>(null);
  const [tradeStatus, setTradeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const closingIdsRef = useRef<Set<string>>(new Set());
  const liquidatingRef = useRef(false);
  const [orderSl, setOrderSl] = useState('');
  const [orderTp, setOrderTp] = useState('');
  const [showSltp, setShowSltp] = useState(false);
  const [supabaseTradeIds, setSupabaseTradeIds] = useState<Record<string, string>>({});
  const [bridgeOnline, setBridgeOnline] = useState(false);

  useEffect(() => {
    const checkBridge = async () => {
      try {
        const res = await fetch('/api/supabase/bridge-status');
        if (res.ok) {
          const data = await res.json();
          setBridgeOnline(!!data.online);
        } else {
          setBridgeOnline(false);
        }
      } catch {
        setBridgeOnline(false);
      }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  const openInstruments = openTrades.map(t => t.instrument);
  const allInstruments = [...new Set([activeInstrument.label, ...openInstruments])];
  const { prices: livePrices, finnhubDebug } = useLivePrices(allInstruments);

  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const supabaseTradeIdsRef = useRef<Record<string, string>>({});
  useEffect(() => { supabaseTradeIdsRef.current = supabaseTradeIds; }, [supabaseTradeIds]);

  const fetchPositionsFromSupabase = useCallback(async () => {
    try {
      const res = await fetch('/api/supabase/positions');
      if (!res.ok) return;
      const positions: any[] = await res.json();
      const mapped: LocalTrade[] = positions.map((p: any) => ({
        id: p.localId || p.supabaseId,
        userId: '',
        instrument: p.instrument,
        side: p.side,
        size: p.size,
        contracts: 1,
        entryPrice: p.entryPrice,
        exitPrice: null,
        pnl: null,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        status: 'executed',
        openedAt: p.openedAt ? new Date(p.openedAt) : new Date(),
        closedAt: null,
        mt5Status: 'filled' as Mt5Status,
        supabaseId: p.supabaseId,
      }));
      setOpenTrades(mapped);
      const idMap: Record<string, string> = {};
      for (const p of positions) {
        const key = p.localId || p.supabaseId;
        idMap[key] = p.supabaseId;
      }
      setSupabaseTradeIds(idMap);
    } catch {}
  }, []);

  const loadClosedTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/trades');
      if (res.ok) {
        const all: Trade[] = await res.json();
        setClosedTrades(all.filter(t => t.status === 'closed'));
      }
    } catch {}
  }, []);

  const handleRealtimeChange = useCallback((payload: any) => {
    const { eventType, new: row, old: oldRow } = payload;

    if (eventType === 'DELETE') {
      if (!oldRow?.id) return;
      const sbId = oldRow.id;
      setOpenTrades(prev => prev.filter(t => t.supabaseId !== sbId));
      return;
    }

    if (!row) return;
    const sbId = row.id;

    if (eventType === 'UPDATE') {
      if (row.status === 'closed' || row.status === 'failed') {
        setOpenTrades(prev => prev.filter(t => t.supabaseId !== sbId));
        if (row.status === 'closed') {
          const existing = openTradesRef.current.find(t => t.supabaseId === sbId);
          if (existing) {
            setClosedTrades(prev => [{ ...existing, status: 'closed', exitPrice: row.close_price, pnl: row.pnl }, ...prev]);
          }
        }
        return;
      }

      if (row.mt5_status === 'rejected') {
        setOpenTrades(prev => prev.filter(t => t.supabaseId !== sbId));
        const reason = row.reject_reason || 'Order rejected by MT5';
        setTradeStatus({ type: 'error', message: reason });
        setTimeout(() => setTradeStatus(null), 8000);
        return;
      }

      if (row.mt5_status === 'filled' && row.open_price) {
        addOrUpdateFilledTrade(sbId, row);
        return;
      }
    }

    if (eventType === 'INSERT') {
      if (row.mt5_status === 'filled' && row.open_price && row.status !== 'closed') {
        addOrUpdateFilledTrade(sbId, row);
      }
    }
  }, []);

  const addOrUpdateFilledTrade = useCallback((sbId: string, row: any) => {
    const adjustedEntry = getSpreadAdjustedEntry(row.instrument, row.side, row.size, row.open_price);
    setOpenTrades(prev => {
      const exists = prev.some(t => t.supabaseId === sbId);
      if (exists) {
        return prev.map(t => t.supabaseId === sbId ? { ...t, entryPrice: adjustedEntry } : t);
      }
      return [...prev, {
        id: sbId,
        userId: '',
        instrument: row.instrument,
        side: row.side,
        size: row.size,
        contracts: 1,
        entryPrice: adjustedEntry,
        exitPrice: null,
        pnl: null,
        stopLoss: row.stop_loss || null,
        takeProfit: row.take_profit || null,
        status: 'executed',
        openedAt: row.created_at ? new Date(row.created_at) : new Date(),
        closedAt: null,
        mt5Status: 'filled' as Mt5Status,
        supabaseId: sbId,
      }];
    });
    setSupabaseTradeIds(prev => ({ ...prev, [sbId]: sbId }));
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      await Promise.all([fetchPositionsFromSupabase(), loadClosedTrades()]);

      if (!mounted) return;

      pollInterval = setInterval(() => {
        if (mounted) fetchPositionsFromSupabase();
      }, 3000);

      try {
        const configRes = await fetch('/api/supabase/config');
        if (!configRes.ok) return;
        const { url, anonKey } = await configRes.json();
        if (!username) return;
        const supabase = createClient(url, anonKey);
        const rtFilter = `trader_username=eq.${username}`;
        channel = supabase
          .channel('trades-realtime')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trades', filter: rtFilter }, (payload) => {
            handleRealtimeChange(payload);
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trades', filter: rtFilter }, (payload) => {
            handleRealtimeChange(payload);
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades', filter: rtFilter }, (payload) => {
            handleRealtimeChange(payload);
          })
          .subscribe();
        supabaseChannelRef.current = channel;
      } catch {}
    })();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (channel) {
        channel.unsubscribe();
        channel = null;
      }
      supabaseChannelRef.current = null;
      setOpenTrades([]);
      setClosedTrades([]);
      setSupabaseTradeIds({});
    };
  }, [fetchPositionsFromSupabase, loadClosedTrades, handleRealtimeChange, username]);

  const [positionSort, setPositionSort] = useState<'oldest' | 'newest' | 'loss'>('oldest');

  const visibleOpenTrades = (() => {
    const filtered = openTrades.filter(t => t.mt5Status === 'filled');
    const seen = new Set<string>();
    return filtered.filter(t => {
      const key = t.supabaseId || t.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const SPREAD_MAP: Record<string, number> = {
    BTCUSD: 20,
    XAUUSD: 0.30,
    XAGUSD: 0.03,
    WTIUSD: 0.05,
    SPX: 0.50,
    NDX: 1.50,
    MBT: 20,
    MNQ: 1.50,
    MES: 0.25,
    MGC: 0.20,
    MCL: 0.05,
    SIL: 0.03,
    'Gold (GC)': 0.30,
    'Silver': 0.03,
    'Oil (WTI)': 0.05,
    'S&P 500': 0.50,
    'Nasdaq': 1.50,
  };

  const getNowPrice = (symbol: string, side: string, tvPrice: number) => {
    const spread = SPREAD_MAP[symbol] ?? 10;
    return side === 'BUY' ? tvPrice - spread / 2 : tvPrice + spread / 2;
  };

  const positionsWithPnl = (() => {
    const mapped = visibleOpenTrades.map(trade => {
      const rawPrice = livePrices[trade.instrument];
      const currentPrice = rawPrice ? getNowPrice(trade.instrument, trade.side, rawPrice) : undefined;
      const pnl = (currentPrice && trade.entryPrice > 0) ? calcPnl(trade.side, trade.entryPrice, currentPrice, trade.size, trade.instrument) : 0;
      return { ...trade, livePnl: pnl, currentPrice };
    });
    const sorted = [...mapped];
    if (positionSort === 'oldest') {
      sorted.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
    } else if (positionSort === 'newest') {
      sorted.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
    } else if (positionSort === 'loss') {
      sorted.sort((a, b) => a.livePnl - b.livePnl);
    }
    return sorted;
  })();

  const totalOpenPnl = positionsWithPnl.reduce((sum, p) => sum + p.livePnl, 0);
  useEffect(() => {
    onOpenPnlChange?.(totalOpenPnl);
  }, [totalOpenPnl, onOpenPnlChange]);

  const lastPnlSyncRef = useRef<number>(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastPnlSyncRef.current < 3000) return;
    lastPnlSyncRef.current = now;
    for (const pos of positionsWithPnl) {
      if (pos.entryPrice === 0) continue;
      const sbId = pos.supabaseId || supabaseTradeIds[pos.id];
      if (!sbId) continue;
      fetch('/api/supabase/trades/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supabaseId: sbId, pnl: pos.livePnl }) }).catch(() => {});
    }
  }, [positionsWithPnl]);

  useEffect(() => {
    if (openTrades.length === 0) return;
    for (const pos of positionsWithPnl) {
      if (!pos.currentPrice || pos.entryPrice === 0 || pos.status === 'open') continue;
      if (pos.stopLoss && pos.side === 'BUY' && pos.currentPrice <= pos.stopLoss) {
        handleClose(pos.id, pos.currentPrice);
      } else if (pos.stopLoss && pos.side === 'SELL' && pos.currentPrice >= pos.stopLoss) {
        handleClose(pos.id, pos.currentPrice);
      }
      if (pos.takeProfit && pos.side === 'BUY' && pos.currentPrice >= pos.takeProfit) {
        handleClose(pos.id, pos.currentPrice);
      } else if (pos.takeProfit && pos.side === 'SELL' && pos.currentPrice <= pos.takeProfit) {
        handleClose(pos.id, pos.currentPrice);
      }
    }
  }, [livePrices]);

  useEffect(() => {
    if (openTrades.length === 0 || liquidatingRef.current) return;
    const equity = balance + totalOpenPnl;
    if (equity <= 0) {
      liquidatingRef.current = true;
      setTradeStatus({ type: 'error', message: 'Account liquidated — equity reached zero' });
      (async () => {
        for (const trade of openTrades) {
          const exitPrice = livePrices[trade.instrument];
          if (!exitPrice) continue;
          try {
            const res = await fetch(`/api/trades/${trade.id}/close`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ exitPrice }),
            });
            if (res.ok) {
              const closed: Trade = await res.json();
              setOpenTrades(prev => prev.filter(t => t.id !== trade.id));
              setClosedTrades(prev => [closed, ...prev]);
              try {
                const sbId = trade.supabaseId || supabaseTradeIds[trade.id];
                if (sbId) {
                  await fetch('/api/supabase/trades/close', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      supabaseId: sbId,
                      close_price: closed.exitPrice,
                      pnl: closed.pnl,
                      close_time: new Date().toISOString(),
                      status: 'closed'
                    })
                  });
                }
              } catch {}
            }
          } catch {}
        }
        try {
          await fetch('/api/account/liquidation-notify', { method: 'POST' });
        } catch {}
        liquidatingRef.current = false;
      })();
    }
  }, [totalOpenPnl, balance, openTrades, livePrices]);

  const handleInstrumentChange = (inst: InstrumentConfig) => {
    setActiveInstrument(inst);
    setQuantity(inst.default);
  };

  const clampQuantity = (val: number, inst: InstrumentConfig) => {
    const rounded = Math.round(val);
    return Math.min(inst.max, Math.max(inst.min, rounded));
  };

  const atMin = quantity <= activeInstrument.min;
  const atMax = quantity >= activeInstrument.max;

  const createChart = useCallback(() => {
    if (!chartContainerRef.current || !window.TradingView) return;
    chartContainerRef.current.innerHTML = '';
    const modeConfig = viewMode === 'pro'
      ? { hide_side_toolbar: false, studies: [] as string[], withdateranges: true, save_image: true }
      : { hide_side_toolbar: true, studies: [] as string[], withdateranges: false, save_image: false };

    new window.TradingView.widget({
      symbol: activeInstrument.symbol,
      interval: "5",
      container_id: "tradingview-chart",
      autosize: true,
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: "#09090B",
      hide_side_toolbar: modeConfig.hide_side_toolbar,
      studies: modeConfig.studies,
      allow_symbol_change: false,
      withdateranges: modeConfig.withdateranges,
      save_image: modeConfig.save_image,
      enable_publishing: false,
      backgroundColor: "#09090B",
      gridColor: "#1C1C22",
    });
  }, [activeInstrument.symbol, viewMode]);

  useEffect(() => {
    if (tvLoaded) createChart();
  }, [tvLoaded, createChart]);

  const handleTrade = async (side: 'BUY' | 'SELL') => {
    if (!bridgeOnline) {
      setTradeStatus({ type: 'error', message: 'Trading unavailable — market is closed or bridge is offline.' });
      setTimeout(() => setTradeStatus(null), 5000);
      return;
    }
    if (!isMarketOpen(activeInstrument.label)) {
      setTradeStatus({ type: 'error', message: `Market closed for ${activeInstrument.label}` });
      setTimeout(() => setTradeStatus(null), 5000);
      return;
    }

    let rawMidPrice = livePrices[activeInstrument.label];
    if (!rawMidPrice) {
      try {
        const fallbackRes = await fetch('/api/prices/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruments: [activeInstrument.label] }),
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          rawMidPrice = fallbackData.prices?.[activeInstrument.label];
        }
      } catch {}
    }
    if (!rawMidPrice) {
      setTradeStatus({ type: 'error', message: 'Waiting for price data...' });
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

    const tick = activeInstrument.tickSize;
    const midPrice = tick ? Math.round(rawMidPrice / tick) * tick : rawMidPrice;
    const platformSpread = 2 * quantity;
    const prelimPrice = side === 'BUY' ? midPrice + platformSpread : midPrice - platformSpread;

    setTradeLoading(side);
    setTradeStatus(null);

    try {
      const size = quantity * activeInstrument.lotSize;

      const sbRes = await fetch('/api/supabase/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: activeInstrument.label,
          side,
          size,
          entryPrice: prelimPrice,
          status: 'open',
          stopLoss: orderSl ? parseFloat(orderSl) : null,
          takeProfit: orderTp ? parseFloat(orderTp) : null,
          ticket: null,
        }),
      });

      let supabaseId: string | null = null;
      let fillPrice = prelimPrice;

      if (sbRes.ok) {
        const sbData = await sbRes.json();
        if (sbData?.trade?.id) {
          supabaseId = sbData.trade.id;
          if (sbData.trade.open_price) {
            fillPrice = sbData.trade.open_price;
          }
        }
      }

      const body: any = {
        instrument: activeInstrument.label,
        side,
        contracts: quantity,
        size,
        entryPrice: fillPrice,
      };
      if (orderSl) body.stopLoss = parseFloat(orderSl);
      if (orderTp) body.takeProfit = parseFloat(orderTp);

      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const trade: Trade = await response.json();
        if (supabaseId) {
          setSupabaseTradeIds(prev => ({ ...prev, [trade.id]: supabaseId! }));
        }
        setTradeStatus({ type: 'success', message: `${side} ${quantity} ${activeInstrument.label} submitted — awaiting MT5 fill` });

        setOrderSl('');
        setOrderTp('');
        setTimeout(() => setTradeStatus(null), 3000);
      } else {
        const err = await response.json().catch(() => ({ message: 'Unknown error' }));
        setTradeStatus({ type: 'error', message: err.message || 'Order failed' });
        setTimeout(() => setTradeStatus(null), 5000);
      }
    } catch {
      setTradeStatus({ type: 'error', message: 'Connection error' });
      setTimeout(() => setTradeStatus(null), 5000);
    } finally {
      setTradeLoading(null);
    }
  };

  const closeTradeViaServer = async (localTradeId: string | null, supabaseId: string | null, exitPrice: number) => {
    const res = await fetch('/api/trades/close-with-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localTradeId, supabaseId, exitPrice }),
    });
    if (res.ok) return await res.json();
    return null;
  };

  const handleClose = async (tradeId: string, exitPriceOverride?: number) => {
    if (closingId === tradeId || closingIdsRef.current.has(tradeId)) return;
    const localTrade = openTrades.find(t => t.id === tradeId);
    if (!localTrade || localTrade.mt5Status !== 'filled') return;
    closingIdsRef.current.add(tradeId);
    setClosingId(tradeId);
    const instrument = localTrade.instrument;
    const sbId = localTrade.supabaseId || supabaseTradeIds[tradeId] || null;

    const rawExitPrice = exitPriceOverride ?? livePrices[instrument];
    if (!rawExitPrice) { closingIdsRef.current.delete(tradeId); setClosingId(null); return; }
    const exitPrice = roundToTick(rawExitPrice, instrument);

    try {
      const closed = await closeTradeViaServer(tradeId, sbId, exitPrice);
      if (closed) {
        setOpenTrades(prev => prev.filter(t => t.id !== tradeId));
        setClosedTrades(prev => [closed, ...prev]);
      }
    } catch {} finally {
      closingIdsRef.current.delete(tradeId);
      setClosingId(null);
    }
  };

  const [closingAll, setClosingAll] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const isDev = import.meta.env.DEV;
  const handleCloseAll = async () => {
    if (closingAll) return;
    setClosingAll(true);

    const filledTrades = openTrades.filter(t => t.mt5Status === 'filled');

    for (const trade of filledTrades) {
      const sbId = trade.supabaseId || supabaseTradeIds[trade.id] || null;
      const rawPrice = livePrices[trade.instrument];
      if (!rawPrice) continue;
      const exitPrice = roundToTick(rawPrice, trade.instrument);

      try {
        closingIdsRef.current.add(trade.id);
        const closed = await closeTradeViaServer(trade.id, sbId, exitPrice);
        if (closed) {
          setOpenTrades(prev => prev.filter(t => t.id !== trade.id));
          setClosedTrades(prev => [closed, ...prev]);
        }
      } catch {} finally {
        closingIdsRef.current.delete(trade.id);
      }
    }

    setClosingAll(false);
  };

  const handleUpdateSLTP = useCallback(async (tradeId: string, field: 'stopLoss' | 'takeProfit', newPrice: number | null) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;
    const body: any = {
      stopLoss: field === 'stopLoss' ? newPrice : trade.stopLoss,
      takeProfit: field === 'takeProfit' ? newPrice : trade.takeProfit,
    };
    setOpenTrades(prev => prev.map(t => t.id === tradeId ? { ...t, [field]: newPrice } : t));
    try {
      await fetch(`/api/trades/${tradeId}/sltp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const sbId = trade.supabaseId || supabaseTradeIds[tradeId];
      if (sbId) {
        fetch('/api/supabase/trades/sltp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supabaseId: sbId, stopLoss: body.stopLoss, takeProfit: body.takeProfit }),
        }).catch(() => {});
      }
    } catch {}
  }, [openTrades, supabaseTradeIds]);

  const activePositions = positionsWithPnl.filter(p => p.instrument === activeInstrument.label);

  const displayQty = String(quantity);

  const formatPnl = (val: number) => `${val >= 0 ? '+' : ''}$${val.toFixed(2)}`;

  const formatPrice = (price: number, instrument: string) => {
    if (['MBT', 'Gold', 'S&P 500', 'Nasdaq', 'MNQ', 'MES'].includes(instrument)) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  return (
    <div className="overflow-y-auto h-full">
      <div className="flex flex-col" style={{ height: '100vh' }}>
        {!bridgeOnline && (
          <div className="bg-[#EF4444] text-white text-center text-xs font-bold py-2 px-3 shrink-0" data-testid="banner-bridge-offline">
            Trading unavailable — market is closed or bridge is offline.
          </div>
        )}
        <div className="flex items-center border-b border-b1 bg-s1 shrink-0">
          <div className="flex overflow-x-auto no-scrollbar flex-1">
            {visibleInstruments.map((inst) => (
              <button
                key={inst.label}
                onClick={() => handleInstrumentChange(inst)}
                className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2 ${activeInstrument.label === inst.label ? 'border-gold text-white bg-s2' : 'border-transparent text-muted-foreground hover:text-white hover:bg-s2/50'}`}
                data-testid={`instrument-${inst.label}`}
              >
                {inst.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 px-3 border-l border-b1 shrink-0">
            <button
              onClick={() => setViewMode('simple')}
              className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors ${viewMode === 'simple' ? 'text-gold border border-gold/50 bg-gold/10' : 'text-muted-foreground hover:text-white'}`}
              data-testid="btn-simple-mode"
            >
              Simple
            </button>
            <button
              onClick={() => setViewMode('pro')}
              className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors ${viewMode === 'pro' ? 'text-gold border border-gold/50 bg-gold/10' : 'text-muted-foreground hover:text-white'}`}
              data-testid="btn-pro-mode"
            >
              Pro
            </button>
          </div>
        </div>

        <div className="flex-1 flex relative">
          <div className="flex-1 relative bg-background">
            <div ref={chartContainerRef} id="tradingview-chart" className="absolute inset-0" />
            {!tvLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <PositionLines
              positions={activePositions}
              currentPrice={livePrices[activeInstrument.label] || 0}
              instrumentLabel={activeInstrument.label}
              onUpdateSL={(tradeId, newPrice) => handleUpdateSLTP(tradeId, 'stopLoss', newPrice)}
              onUpdateTP={(tradeId, newPrice) => handleUpdateSLTP(tradeId, 'takeProfit', newPrice)}
            />
          </div>

          <div className="w-14 shrink-0 border-l border-b1 bg-s1 flex flex-col items-center justify-center gap-1.5 py-2 text-[17px] text-[#f4f4f5] text-left">
            <button
              onClick={() => handleTrade('BUY')}
              disabled={tradeLoading !== null || !bridgeOnline}
              className="w-11 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded font-heading text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-buy"
            >
              {tradeLoading === 'BUY' ? '...' : 'Buy'}
            </button>

            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => setQuantity(clampQuantity(quantity + activeInstrument.step, activeInstrument))}
                disabled={atMax}
                className={`w-7 h-5 flex items-center justify-center text-[10px] font-bold rounded transition-colors ${atMax ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                data-testid="btn-qty-plus"
              >+</button>
              <input
                type="text"
                inputMode="decimal"
                value={displayQty}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setQuantity(clampQuantity(val, activeInstrument));
                }}
                className="w-10 bg-s2 border border-b2 rounded text-center text-white font-mono font-bold text-[10px] py-1 outline-none"
                data-testid="input-contracts"
              />
              <button
                onClick={() => setQuantity(clampQuantity(quantity - activeInstrument.step, activeInstrument))}
                disabled={atMin}
                className={`w-7 h-5 flex items-center justify-center text-[10px] font-bold rounded transition-colors ${atMin ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                data-testid="btn-qty-minus"
              >-</button>
            </div>

            <button
              onClick={() => handleTrade('SELL')}
              disabled={tradeLoading !== null || !bridgeOnline}
              className="w-11 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded font-heading text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-sell"
            >
              {tradeLoading === 'SELL' ? '...' : 'Sell'}
            </button>

            <div className="w-full border-t border-b1 my-0.5"></div>

            <button
              onClick={() => setShowSltp(!showSltp)}
              className={`text-[8px] font-bold uppercase transition-colors ${showSltp ? 'text-gold' : 'text-muted-foreground hover:text-white'}`}
              data-testid="btn-toggle-sltp"
            >
              SL/TP
            </button>

            {tradeStatus && (
              <div className={`text-[10px] font-medium text-center px-1 py-0.5 rounded ${tradeStatus.type === 'success' ? 'text-green' : 'text-red bg-red/10 border border-red/20'}`} data-testid="trade-status">
                {tradeStatus.type === 'success' ? '✓' : `✗ ${tradeStatus.message}`}
              </div>
            )}
          </div>
        </div>

        {showSltp && (
          <div className="shrink-0 border-t border-b1 bg-s1 px-3 py-2 flex gap-3">
            <div className="flex-1 flex items-center gap-1.5">
              <label className="text-[9px] text-red font-bold uppercase shrink-0">SL</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="None"
                value={orderSl}
                onChange={(e) => setOrderSl(e.target.value)}
                className="w-full bg-s2 border border-b2 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-red/50"
                data-testid="input-order-sl"
              />
            </div>
            <div className="flex-1 flex items-center gap-1.5">
              <label className="text-[9px] text-green font-bold uppercase shrink-0">TP</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="None"
                value={orderTp}
                onChange={(e) => setOrderTp(e.target.value)}
                className="w-full bg-s2 border border-b2 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-green/50"
                data-testid="input-order-tp"
              />
            </div>
          </div>
        )}
      </div>
      {positionsWithPnl.length > 0 && (
        <div className="bg-[#0A0A0C]">
          <div className="px-3 py-2 border-b border-b1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Open Positions</span>
              <div className="flex items-center gap-0.5 bg-[#141418] rounded px-1 py-0.5" data-testid="sort-control">
                {([['oldest', 'Old'], ['newest', 'New'], ['loss', 'Loss']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPositionSort(val)}
                    className={`text-[8px] px-1.5 py-0.5 rounded transition-colors ${positionSort === val ? 'bg-[#222228] text-white font-bold' : 'text-muted-foreground hover:text-white'}`}
                    data-testid={`sort-${val}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCloseAll}
              disabled={closingAll}
              className="text-[9px] font-bold uppercase text-red hover:text-white bg-red/10 border border-red/30 hover:bg-red/20 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
              data-testid="btn-close-all"
            >
              {closingAll ? 'Closing...' : 'Close All'}
            </button>
          </div>
          {positionsWithPnl.map(pos => (
            <div
              key={pos.supabaseId || pos.id}
              className="flex items-center gap-3 px-3 py-2 border-b border-b1 hover:bg-s2/50 transition-colors group"
              data-testid={`position-row-${pos.id}`}
            >
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${pos.side === 'BUY' ? 'bg-[#22C55E] text-white' : 'bg-[#EF4444] text-white'}`}>
                {pos.side}
              </span>

              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-[#22C55E]/20 text-[#22C55E]" data-testid={`badge-mt5-${pos.id}`}>
                Live
              </span>

              <span className="text-white font-bold text-xs shrink-0">{(() => { const inst = INSTRUMENTS.find(i => i.label === pos.instrument); return inst ? Math.round(pos.size / inst.lotSize) : pos.size; })()} {pos.instrument}</span>
              <span className="text-muted-foreground text-[11px] shrink-0">Entry <span className="text-gold data-number">{formatPrice(pos.entryPrice, pos.instrument)}</span></span>
              <span className="text-muted-foreground text-[11px] shrink-0">Now <span className="text-white data-number">{pos.currentPrice ? formatPrice(pos.currentPrice, pos.instrument) : '---'}</span></span>

              <div className="ml-auto flex items-center gap-2">
                <span className={`data-number font-bold text-sm ${pos.livePnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {formatPnl(pos.livePnl)}
                </span>
                <button
                  onClick={() => handleClose(pos.id)}
                  disabled={closingId === pos.id}
                  className="opacity-0 group-hover:opacity-100 text-[9px] text-muted-foreground hover:text-white bg-b1 border border-b2 px-1.5 py-0.5 rounded transition-all disabled:opacity-50"
                  data-testid={`btn-close-${pos.id}`}
                >
                  {closingId === pos.id ? '...' : 'Close'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isDev && (
        <div className="bg-[#0A0A0C] border-t border-b1">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full px-3 py-1 text-[9px] text-muted-foreground hover:text-white text-left font-mono uppercase tracking-wider"
            data-testid="btn-toggle-debug"
          >
            {showDebug ? '▼' : '▶'} Debug Panel
          </button>
          {showDebug && (
            <div className="px-3 pb-2 space-y-2 text-[10px] font-mono">
              <div className="flex gap-4">
                <span className="text-muted-foreground">WS Status:</span>
                <span className={finnhubDebug.wsStatus === 'connected' ? 'text-[#22C55E]' : finnhubDebug.wsStatus === 'connecting' ? 'text-gold' : 'text-[#EF4444]'}>
                  {finnhubDebug.wsStatus.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground">Last Price:</span>
                <span className="text-white">{finnhubDebug.lastPrice !== null ? `$${finnhubDebug.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground">Last Update:</span>
                <DebugTimestamp ts={finnhubDebug.lastUpdateTs} />
              </div>
              {positionsWithPnl.length > 0 && (
                <div className="border-t border-b1 pt-2 space-y-1">
                  <span className="text-muted-foreground uppercase tracking-wider">P&L Check</span>
                  {positionsWithPnl.map(pos => {
                    const expectedPnl = pos.currentPrice ? calcPnl(pos.side, pos.entryPrice, pos.currentPrice, pos.size, pos.instrument) : 0;
                    const match = Math.abs(expectedPnl - pos.livePnl) < 0.01;
                    return (
                      <div key={pos.id} className="grid grid-cols-6 gap-1 items-center text-[9px]" data-testid={`debug-row-${pos.id}`}>
                        <span className="text-white">{pos.instrument}</span>
                        <span className="text-muted-foreground">Entry: {pos.entryPrice.toFixed(2)}</span>
                        <span className="text-muted-foreground">Now: {pos.currentPrice ? pos.currentPrice.toFixed(2) : '---'}</span>
                        <span className="text-muted-foreground">Calc: ${expectedPnl.toFixed(2)}</span>
                        <span className="text-muted-foreground">Disp: ${pos.livePnl.toFixed(2)}</span>
                        <span className={match ? 'text-[#22C55E] font-bold' : 'text-[#EF4444] font-bold'}>{match ? 'PASS' : 'FAIL'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DebugTimestamp({ ts }: { ts: number | null }) {
  const [ago, setAgo] = useState<string>('---');
  useEffect(() => {
    if (ts === null) { setAgo('---'); return; }
    const update = () => setAgo(`${Date.now() - ts}ms ago`);
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [ts]);
  return <span className="text-white">{ago}</span>;
}
