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
  let spreadPerContract = PLATFORM_SPREAD_PER_CONTRACT;
  
  if (instrument === 'MGC') {
    spreadPerContract = 0.15;
  } else if (instrument === 'Gold (GC)' || instrument === 'XAUUSD') {
    spreadPerContract = 0.15;
  }
  
  const spread = spreadPerContract * contracts;
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
    const contracts = Math.round(size / 0.1);
    const ticks = Math.floor(priceDiff * 10); 
    return ticks * contracts;
  }
  
  if (instrument === 'Gold (GC)' || instrument === 'XAUUSD' || instrument === 'Gold') {
    const contracts = Math.round(size / 1.0);
    const ticks = Math.floor(priceDiff * 10);
    return ticks * 10 * contracts;
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
    MGC: 0.30,
    MCL: 0.05,
    SIL: 0.03,
    'Gold (GC)': 0.30,
    'Silver': 0.03,
    'Oil (WTI)': 0.05,
    'S&P 500': 0.50,
    'Nasdaq': 1.50,
  };

  const getNowPrice = (symbol: string, side: string, tvPrice: number) => {
    const spread = SPREAD_MAP[symbol] ?? 0;
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
    const clamped = Math.max(inst.min, Math.min(inst.max, rounded));
    return clamped;
  };

  useEffect(() => {
    if (!tvLoaded || !chartContainerRef.current) return;
    if (!window.TradingView) return;
    
    const tvWidget = new window.TradingView.widget({
      autosize: true,
      symbol: activeInstrument.symbol,
      interval: '5',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: 1,
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: false,
      toolbar_bg: '#09090B',
      studies_overrides: {},
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#22C55E',
        'mainSeriesProperties.candleStyle.downColor': '#EF4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#22C55E',
        'mainSeriesProperties.candleStyle.borderDownColor': '#EF4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#22C55E',
        'mainSeriesProperties.candleStyle.wickDownColor': '#EF4444',
      },
      container_id: 'chart-container',
    });
  }, [tvLoaded, activeInstrument]);

  const handleTrade = async (side: 'BUY' | 'SELL') => {
    if (tradeLoading || !isMarketOpen(activeInstrument.label)) {
      setTradeStatus({ type: 'error', message: 'Market closed or trade in progress' });
      setTimeout(() => setTradeStatus(null), 5000);
      return;
    }

    if (!bridgeOnline) {
      setTradeStatus({ type: 'error', message: 'MT5 bridge offline' });
      setTimeout(() => setTradeStatus(null), 5000);
      return;
    }

    const price = livePrices[activeInstrument.label];
    if (!price || price === 0) {
      setTradeStatus({ type: 'error', message: 'Price data unavailable' });
      setTimeout(() => setTradeStatus(null), 5000);
      return;
    }

    setTradeLoading(side);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: activeInstrument.label,
          side,
          size: quantity,
          stopLoss: orderSl ? parseFloat(orderSl) : null,
          takeProfit: orderTp ? parseFloat(orderTp) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Trade failed');
      }

      const trade: Trade = await res.json();
      setOpenTrades(prev => [...prev, { ...trade, mt5Status: 'pending' }]);
      setTradeStatus({ type: 'success', message: `${side} order placed` });
      setTimeout(() => setTradeStatus(null), 3000);
    } catch (err) {
      setTradeStatus({ type: 'error', message: (err as Error).message });
      setTimeout(() => setTradeStatus(null), 5000);
    } finally {
      setTradeLoading(null);
    }
  };

  const handleClose = async (tradeId: string, exitPrice: number) => {
    if (closingIdsRef.current.has(tradeId)) return;
    closingIdsRef.current.add(tradeId);
    setClosingId(tradeId);

    try {
      const res = await fetch(`/api/trades/${tradeId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitPrice }),
      });

      if (res.ok) {
        const closed: Trade = await res.json();
        setOpenTrades(prev => prev.filter(t => t.id !== tradeId));
        setClosedTrades(prev => [closed, ...prev]);

        try {
          const sbId = supabaseTradeIds[tradeId];
          if (sbId) {
            await fetch('/api/supabase/trades/close', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                supabaseId: sbId,
                close_price: exitPrice,
                pnl: closed.pnl,
                close_time: new Date().toISOString(),
                status: 'closed'
              })
            });
          }
        } catch {}
      }
    } catch (err) {
      setTradeStatus({ type: 'error', message: (err as Error).message });
      setTimeout(() => setTradeStatus(null), 5000);
    } finally {
      closingIdsRef.current.delete(tradeId);
      setClosingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 bg-black p-3" style={{ backgroundColor: '#09090B' }}>
      <div className="flex justify-between items-center">
        <div className="flex gap-3 flex-wrap">
          <select
            value={activeInstrument.label}
            onChange={(e) => {
              const inst = INSTRUMENTS.find(i => i.label === e.target.value);
              if (inst) handleInstrumentChange(inst);
            }}
            className="rounded px-2 py-1 text-sm bg-slate-700 text-white border border-slate-600"
            data-testid="select-instrument"
          >
            {visibleInstruments.map(i => (
              <option key={i.label} value={i.label}>{i.label}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(clampQuantity(parseFloat(e.target.value) || 0, activeInstrument))}
              min={activeInstrument.min}
              max={activeInstrument.max}
              step={activeInstrument.step}
              className="rounded px-2 py-1 text-sm w-16 bg-slate-700 text-white border border-slate-600"
              data-testid="input-quantity"
            />
            <button
              onClick={() => handleTrade('BUY')}
              disabled={tradeLoading === 'BUY'}
              className="rounded px-3 py-1 text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              data-testid="button-buy-mkt"
            >
              {tradeLoading === 'BUY' ? '...' : 'Buy Mkt'}
            </button>
            <button
              onClick={() => handleTrade('SELL')}
              disabled={tradeLoading === 'SELL'}
              className="rounded px-3 py-1 text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              data-testid="button-sell-mkt"
            >
              {tradeLoading === 'SELL' ? '...' : 'Sell Mkt'}
            </button>
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <div className="text-right">
            <div className="text-xs text-slate-400">Price</div>
            <div className="font-mono text-slate-200" data-testid="text-current-price">
              ${(livePrices[activeInstrument.label] || 0).toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Open P&L</div>
            <div
              className={`font-mono font-bold ${totalOpenPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
              data-testid="text-open-pnl"
            >
              ${totalOpenPnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} id="chart-container" className="flex-1 rounded border border-slate-700" />

      <PositionLines
        positions={positionsWithPnl}
        closingId={closingId}
        onClose={handleClose}
      />
    </div>
  );
}
