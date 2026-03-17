import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
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
  finnhubSymbol: string;
  default: number;
  step: number;
  min: number;
  max: number;
  lotSize: number;
  spread?: number;
  tickSize?: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { label: 'MBT',      finnhubSymbol: 'BINANCE:BTCUSDT',  default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'Gold (GC)', finnhubSymbol: 'OANDA:XAU_USD',   default: 1, step: 1, min: 1, max: 10, lotSize: 1, spread: 0.30, tickSize: 0.10 },
  { label: 'Silver',   finnhubSymbol: 'OANDA:XAG_USD',    default: 1, step: 1, min: 1, max: 10, lotSize: 1, spread: 0.008 },
  { label: 'Oil (WTI)', finnhubSymbol: 'OANDA:BCO_USD',   default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'S&P 500',  finnhubSymbol: 'OANDA:SPX500_USD', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'Nasdaq',   finnhubSymbol: 'OANDA:NAS100_USD', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'MNQ',      finnhubSymbol: 'OANDA:NAS100_USD', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'MES',      finnhubSymbol: 'OANDA:SPX500_USD', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'MGC',      finnhubSymbol: 'OANDA:XAU_USD',    default: 1, step: 1, min: 1, max: 20, lotSize: 0.10, spread: 0.03 },
  { label: 'SIL',      finnhubSymbol: 'OANDA:XAG_USD',    default: 1, step: 1, min: 1, max: 20, lotSize: 0.10, spread: 0.008 },
  { label: 'MCL',      finnhubSymbol: 'OANDA:BCO_USD',    default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
];

const PLATFORM_SPREAD_PER_CONTRACT = 2;
const CLIENT_LOT_SIZE_MAP: Record<string, number> = Object.fromEntries(
  INSTRUMENTS.map(i => [i.label, i.lotSize])
);

function getSpreadAdjustedEntry(instrument: string, side: string, size: number, fillPrice: number): number {
  const lotSize = CLIENT_LOT_SIZE_MAP[instrument] || 1;
  const contracts = Math.round(size / lotSize);
  let spreadPerContract = PLATFORM_SPREAD_PER_CONTRACT;
  if (instrument === 'MGC') spreadPerContract = 0.15;
  else if (instrument === 'Gold (GC)' || instrument === 'XAUUSD') spreadPerContract = 0.15;
  const spread = spreadPerContract * contracts;
  return side === 'BUY' ? fillPrice + spread : fillPrice - spread;
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
  'MBT': 0.50, 'Bitcoin': 0.50, 'BTCUSD': 0.50,
  'Gold (GC)': 10, 'MGC': 10,
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
  if (btcNames.includes(instrument) || instrument.toLowerCase().includes('btc')) return true;
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

// ── Finnhub price feed (SSE) ──────────────────────────────────────────────────
function useLivePrices(instruments: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const pricesRef = useRef<Record<string, number>>({});
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instrumentsRef = useRef<string[]>(instruments);
  instrumentsRef.current = instruments;

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;

    const connect = () => {
      if (cancelled) return;
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      const sse = new EventSource('/api/prices/stream');
      sseRef.current = sse;
      sse.onopen = () => { retryCount = 0; };
      sse.onmessage = (event) => {
        try {
          const updatedPrices: Record<string, number> = JSON.parse(event.data);
          const newPrices = { ...pricesRef.current };
          let anyUpdated = false;
          for (const [inst, price] of Object.entries(updatedPrices)) {
            if (typeof price === 'number' && price > 0 && instrumentsRef.current.includes(inst)) {
              if (newPrices[inst] !== price) { newPrices[inst] = price; anyUpdated = true; }
            }
          }
          if (anyUpdated) { pricesRef.current = newPrices; setPrices(newPrices); }
        } catch {}
      };
      sse.onerror = () => {
        sse.close(); sseRef.current = null;
        if (!cancelled) {
          retryCount++;
          reconnectTimer.current = setTimeout(connect, Math.min(3000 * retryCount, 15000));
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    };
  }, []);

  return prices;
}

// ── Lightweight Charts hook ───────────────────────────────────────────────────
function useChart(
  containerRef: React.RefObject<HTMLDivElement>,
  instrument: InstrumentConfig,
  viewMode: 'simple' | 'pro',
  livePrices: Record<string, number>,
) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [series, setSeries] = useState<ISeriesApi<'Candlestick'> | null>(null);
  const lastCandleRef = useRef<CandlestickData | null>(null);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;
    const c = createChart(containerRef.current, {
      layout: { background: { color: '#09090B' }, textColor: '#9CA3AF' },
      grid: { vertLines: { color: '#1C1C22' }, horzLines: { color: '#1C1C22' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1C1C22' },
      timeScale: { borderColor: '#1C1C22', timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const s = c.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    });

    chartRef.current = c;
    seriesRef.current = s;
    setChart(c);
    setSeries(s);

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        c.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      c.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setChart(null);
      setSeries(null);
    };
  }, []);

  // Load historical candles when instrument changes
  useEffect(() => {
    if (!seriesRef.current) return;
    lastCandleRef.current = null;

    const loadCandles = async () => {
      try {
        const res = await fetch(
          `/api/candles?instrument=${encodeURIComponent(instrument.label)}&resolution=5&count=300`
        );
        if (!res.ok) return;
        const candles: CandlestickData[] = await res.json();
        if (candles.length > 0) {
          seriesRef.current?.setData(candles);
          lastCandleRef.current = candles[candles.length - 1];
          chartRef.current?.timeScale().fitContent();
        }
      } catch (e) {
        console.error('[chart] Failed to load candles:', e);
      }
    };

    loadCandles();
  }, [instrument.label]);

  // Push live ticks into the chart
  useEffect(() => {
    const price = livePrices[instrument.label];
    if (!price || !seriesRef.current) return;

    const now = Math.floor(Date.now() / 1000);
    const bucket = (now - (now % 300)) as Time; // 5m bucket

    if (lastCandleRef.current && lastCandleRef.current.time === bucket) {
      const prev = lastCandleRef.current;
      const updated: CandlestickData = {
        time: bucket,
        open: prev.open,
        high: Math.max(prev.high, price),
        low: Math.min(prev.low, price),
        close: price,
      };
      seriesRef.current.update(updated);
      lastCandleRef.current = updated;
    } else {
      const newCandle: CandlestickData = {
        time: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      seriesRef.current.update(newCandle);
      lastCandleRef.current = newCandle;
    }
  }, [livePrices, instrument.label]);

  return { chart, series };
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function formatPrice(price: number, instrument: string) {
  if (['MBT', 'Gold', 'S&P 500', 'Nasdaq', 'MNQ', 'MES'].includes(instrument)) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatPnl(val: number) { return `${val >= 0 ? '+' : ''}$${val.toFixed(2)}`; }

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const SPREAD_MAP: Record<string, number> = {
  BTCUSD: 20, XAUUSD: 0.30, XAGUSD: 0.03, WTIUSD: 0.05, SPX: 0.50, NDX: 1.50,
  MBT: 20, MNQ: 1.50, MES: 0.25, MGC: 0.30, MCL: 0.05, SIL: 0.03,
  'Gold (GC)': 0.30, 'Silver': 0.03, 'Oil (WTI)': 0.05, 'S&P 500': 0.50, 'Nasdaq': 1.50,
};

function getNowPrice(symbol: string, side: string, tvPrice: number) {
  const spread = SPREAD_MAP[symbol] ?? 0;
  return side === 'BUY' ? tvPrice - spread / 2 : tvPrice + spread / 2;
}

// ── Main Terminal component ───────────────────────────────────────────────────
export default function Terminal({ tier, userTierName, balance, onOpenPnlChange, allowedInstruments, username }: TerminalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

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
  const [sltpEdit, setSltpEdit] = useState<{ id: string; field: 'sl' | 'tp'; value: string } | null>(null);

  useEffect(() => {
    const checkBridge = async () => {
      try {
        const res = await fetch('/api/supabase/bridge-status');
        setBridgeOnline(res.ok ? !!(await res.json()).online : false);
      } catch { setBridgeOnline(false); }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  const openInstruments = openTrades.map(t => t.instrument);
  const allInstruments = [...new Set([activeInstrument.label, ...openInstruments])];
  const livePrices = useLivePrices(allInstruments);

  const { chart, series } = useChart(chartContainerRef, activeInstrument, viewMode, livePrices);

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
      for (const p of positions) { idMap[p.localId || p.supabaseId] = p.supabaseId; }
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

  const addOrUpdateFilledTrade = useCallback((sbId: string, row: any) => {
    const adjustedEntry = getSpreadAdjustedEntry(row.instrument, row.side, row.size, row.open_price);
    setOpenTrades(prev => {
      const exists = prev.some(t => t.supabaseId === sbId);
      if (exists) return prev.map(t => t.supabaseId === sbId ? { ...t, entryPrice: adjustedEntry } : t);
      return [...prev, {
        id: sbId, userId: '', instrument: row.instrument, side: row.side, size: row.size, contracts: 1,
        entryPrice: adjustedEntry, exitPrice: null, pnl: null,
        stopLoss: row.stop_loss || null, takeProfit: row.take_profit || null,
        status: 'executed', openedAt: row.created_at ? new Date(row.created_at) : new Date(),
        closedAt: null, mt5Status: 'filled' as Mt5Status, supabaseId: sbId,
      }];
    });
    setSupabaseTradeIds(prev => ({ ...prev, [sbId]: sbId }));
  }, []);

  const handleRealtimeChange = useCallback((payload: any) => {
    const { eventType, new: row, old: oldRow } = payload;
    if (eventType === 'DELETE') {
      if (!oldRow?.id) return;
      setOpenTrades(prev => prev.filter(t => t.supabaseId !== oldRow.id));
      return;
    }
    if (!row) return;
    const sbId = row.id;
    if (eventType === 'UPDATE') {
      if (row.status === 'closed' || row.status === 'failed') {
        setOpenTrades(prev => prev.filter(t => t.supabaseId !== sbId));
        if (row.status === 'closed') {
          const existing = openTradesRef.current.find(t => t.supabaseId === sbId);
          if (existing) setClosedTrades(prev => [{ ...existing, status: 'closed', exitPrice: row.close_price, pnl: row.pnl }, ...prev]);
        }
        return;
      }
      if (row.mt5_status === 'rejected') {
        setOpenTrades(prev => prev.filter(t => t.supabaseId !== sbId));
        setTradeStatus({ type: 'error', message: row.reject_reason || 'Order rejected by MT5' });
        setTimeout(() => setTradeStatus(null), 8000);
        return;
      }
      if (row.mt5_status === 'filled' && row.open_price) { addOrUpdateFilledTrade(sbId, row); return; }
    }
    if (eventType === 'INSERT' && row.mt5_status === 'filled' && row.open_price && row.status !== 'closed') {
      addOrUpdateFilledTrade(sbId, row);
    }
  }, [addOrUpdateFilledTrade]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      await Promise.all([fetchPositionsFromSupabase(), loadClosedTrades()]);
      if (!mounted) return;
      pollInterval = setInterval(() => { if (mounted) fetchPositionsFromSupabase(); }, 3000);
      try {
        const configRes = await fetch('/api/supabase/config');
        if (!configRes.ok) return;
        const { url, anonKey } = await configRes.json();
        if (!username) return;
        const supabase = createClient(url, anonKey);
        const rtFilter = `trader_username=eq.${username}`;
        channel = supabase.channel('trades-realtime')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trades', filter: rtFilter }, handleRealtimeChange)
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trades', filter: rtFilter }, handleRealtimeChange)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades', filter: rtFilter }, handleRealtimeChange)
          .subscribe();
        supabaseChannelRef.current = channel;
      } catch {}
    })();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (channel) { channel.unsubscribe(); }
      supabaseChannelRef.current = null;
      setOpenTrades([]); setClosedTrades([]); setSupabaseTradeIds({});
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

  const positionsWithPnl = (() => {
    const mapped = visibleOpenTrades.map(trade => {
      const rawPrice = livePrices[trade.instrument];
      const currentPrice = rawPrice ? getNowPrice(trade.instrument, trade.side, rawPrice) : undefined;
      const pnl = (currentPrice && trade.entryPrice > 0) ? calcPnl(trade.side, trade.entryPrice, currentPrice, trade.size, trade.instrument) : 0;
      return { ...trade, livePnl: pnl, currentPrice };
    });
    const sorted = [...mapped];
    if (positionSort === 'oldest') sorted.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
    else if (positionSort === 'newest') sorted.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
    else if (positionSort === 'loss') sorted.sort((a, b) => a.livePnl - b.livePnl);
    return sorted;
  })();

  const totalOpenPnl = positionsWithPnl.reduce((sum, p) => sum + p.livePnl, 0);
  useEffect(() => { onOpenPnlChange?.(totalOpenPnl); }, [totalOpenPnl, onOpenPnlChange]);

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
      if (pos.stopLoss && pos.side === 'BUY' && pos.currentPrice <= pos.stopLoss) handleClose(pos.id, pos.currentPrice);
      else if (pos.stopLoss && pos.side === 'SELL' && pos.currentPrice >= pos.stopLoss) handleClose(pos.id, pos.currentPrice);
      if (pos.takeProfit && pos.side === 'BUY' && pos.currentPrice >= pos.takeProfit) handleClose(pos.id, pos.currentPrice);
      else if (pos.takeProfit && pos.side === 'SELL' && pos.currentPrice <= pos.takeProfit) handleClose(pos.id, pos.currentPrice);
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
            const res = await fetch(`/api/trades/${trade.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exitPrice }) });
            if (res.ok) {
              const closed: Trade = await res.json();
              setOpenTrades(prev => prev.filter(t => t.id !== trade.id));
              setClosedTrades(prev => [closed, ...prev]);
              const sbId = trade.supabaseId || supabaseTradeIds[trade.id];
              if (sbId) {
                await fetch('/api/supabase/trades/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supabaseId: sbId, close_price: closed.exitPrice, pnl: closed.pnl, close_time: new Date().toISOString(), status: 'closed' }) });
              }
            }
          } catch {}
        }
        try { await fetch('/api/account/liquidation-notify', { method: 'POST' }); } catch {}
        liquidatingRef.current = false;
      })();
    }
  }, [totalOpenPnl, balance, openTrades, livePrices]);

  const handleInstrumentChange = (inst: InstrumentConfig) => {
    setActiveInstrument(inst);
    setQuantity(inst.default);
  };

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
        const fallbackRes = await fetch('/api/prices/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruments: [activeInstrument.label] }) });
        if (fallbackRes.ok) { const d = await fallbackRes.json(); rawMidPrice = d.prices?.[activeInstrument.label]; }
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
      const sbRes = await fetch('/api/supabase/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instrument: activeInstrument.label, side, size, entryPrice: prelimPrice, status: 'open', stopLoss: orderSl ? parseFloat(orderSl) : null, takeProfit: orderTp ? parseFloat(orderTp) : null, ticket: null }) });
      let supabaseId: string | null = null;
      let fillPrice = prelimPrice;
      if (sbRes.ok) {
        const sbData = await sbRes.json();
        if (sbData?.trade?.id) { supabaseId = sbData.trade.id; if (sbData.trade.open_price) fillPrice = sbData.trade.open_price; }
      }
      const body: any = { instrument: activeInstrument.label, side, contracts: quantity, size, entryPrice: fillPrice };
      if (orderSl) body.stopLoss = parseFloat(orderSl);
      if (orderTp) body.takeProfit = parseFloat(orderTp);
      const response = await fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) {
        const trade: Trade = await response.json();
        if (supabaseId) setSupabaseTradeIds(prev => ({ ...prev, [trade.id]: supabaseId! }));
        setTradeStatus({ type: 'success', message: `${side} ${quantity} ${activeInstrument.label} submitted — awaiting MT5 fill` });
        setOrderSl(''); setOrderTp('');
        setTimeout(() => setTradeStatus(null), 3000);
      } else {
        const err = await response.json().catch(() => ({ message: 'Unknown error' }));
        setTradeStatus({ type: 'error', message: err.message || 'Order failed' });
        setTimeout(() => setTradeStatus(null), 5000);
      }
    } catch {
      setTradeStatus({ type: 'error', message: 'Connection error' });
      setTimeout(() => setTradeStatus(null), 5000);
    } finally { setTradeLoading(null); }
  };

  const closeTradeViaServer = async (localTradeId: string | null, supabaseId: string | null, exitPrice: number) => {
    const res = await fetch('/api/trades/close-with-supabase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localTradeId, supabaseId, exitPrice }) });
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
      if (closed) { setOpenTrades(prev => prev.filter(t => t.id !== tradeId)); setClosedTrades(prev => [closed, ...prev]); }
    } catch {} finally { closingIdsRef.current.delete(tradeId); setClosingId(null); }
  };

  const [closingAll, setClosingAll] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const isDev = import.meta.env.DEV;

  const handleCloseAll = async () => {
    if (closingAll) return;
    setClosingAll(true);
    for (const trade of openTrades.filter(t => t.mt5Status === 'filled')) {
      const sbId = trade.supabaseId || supabaseTradeIds[trade.id] || null;
      const rawPrice = livePrices[trade.instrument];
      if (!rawPrice) continue;
      const exitPrice = roundToTick(rawPrice, trade.instrument);
      try {
        closingIdsRef.current.add(trade.id);
        const closed = await closeTradeViaServer(trade.id, sbId, exitPrice);
        if (closed) { setOpenTrades(prev => prev.filter(t => t.id !== trade.id)); setClosedTrades(prev => [closed, ...prev]); }
      } catch {} finally { closingIdsRef.current.delete(trade.id); }
    }
    setClosingAll(false);
  };

  const handleUpdateSLTP = useCallback(async (tradeId: string, field: 'stopLoss' | 'takeProfit', newPrice: number | null) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;
    const body: any = { stopLoss: field === 'stopLoss' ? newPrice : trade.stopLoss, takeProfit: field === 'takeProfit' ? newPrice : trade.takeProfit };
    setOpenTrades(prev => prev.map(t => t.id === tradeId ? { ...t, [field]: newPrice } : t));
    try {
      await fetch(`/api/trades/${tradeId}/sltp`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const sbId = trade.supabaseId || supabaseTradeIds[tradeId];
      if (sbId) fetch('/api/supabase/trades/sltp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supabaseId: sbId, stopLoss: body.stopLoss, takeProfit: body.takeProfit }) }).catch(() => {});
    } catch {}
  }, [openTrades, supabaseTradeIds]);

  const activePositions = positionsWithPnl.filter(p => p.instrument === activeInstrument.label);

  return (
    <div className="overflow-y-auto h-full">
      <div className="flex flex-col" style={{ height: '100vh' }}>
        {!bridgeOnline && (
          <div className="bg-[#EF4444] text-white text-center text-xs font-bold py-2 px-3 shrink-0" data-testid="banner-bridge-offline">
            Trading unavailable — market is closed or bridge is offline.
          </div>
        )}

        {/* Instrument bar */}
        <div className="flex items-center justify-between shrink-0 backdrop-blur-md mx-2 mt-2" style={{ height: '32px', background: 'rgba(40,40,40,0.65)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.12)' }} data-testid="instrument-menu-bar">
          <div className="flex items-center overflow-x-auto no-scrollbar px-4 space-x-5">
            {visibleInstruments.map((inst) => (
              <button key={inst.label} onClick={() => handleInstrumentChange(inst)}
                className={`text-[13px] whitespace-nowrap transition-all duration-150 relative pb-0.5 ${activeInstrument.label === inst.label ? 'text-white font-semibold' : 'text-white/50 hover:text-white/80 font-normal'}`}
                data-testid={`instrument-${inst.label}`}>
                {inst.label}
                {activeInstrument.label === inst.label && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: '#E8C547' }} />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 shrink-0">
            <button onClick={() => setViewMode('simple')} className={`text-[12px] uppercase tracking-wide transition-all duration-150 ${viewMode === 'simple' ? 'text-white font-semibold' : 'text-white/50 hover:text-white/80 font-normal'}`} data-testid="btn-simple-mode">Simple</button>
            <button onClick={() => setViewMode('pro')} className={`text-[12px] uppercase tracking-wide transition-all duration-150 px-3 py-0.5 rounded-full ${viewMode === 'pro' ? 'text-white font-semibold border border-white/30 bg-white/10' : 'text-white/50 hover:text-white/80 font-normal border border-white/15 bg-transparent'}`} data-testid="btn-pro-mode">Pro</button>
          </div>
        </div>

        {/* Quick trade bar */}
        <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-b1 bg-s1/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Quick Trade</span>
              <div className="flex gap-2">
                <button onClick={() => handleTrade('BUY')} disabled={tradeLoading !== null || !bridgeOnline}
                  className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${bridgeOnline ? 'bg-green/20 text-green border border-green/30 hover:bg-green/30' : 'bg-s2 text-muted-foreground border border-b2 opacity-50 cursor-not-allowed'}`}
                  data-testid="btn-buy-mkt-top">
                  {tradeLoading === 'BUY' ? '...' : 'Buy Mkt'}
                </button>
                <button onClick={() => handleTrade('SELL')} disabled={tradeLoading !== null || !bridgeOnline}
                  className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${bridgeOnline ? 'bg-red/20 text-red border border-red/30 hover:bg-red/30' : 'bg-s2 text-muted-foreground border border-b2 opacity-50 cursor-not-allowed'}`}
                  data-testid="btn-sell-mkt-top">
                  {tradeLoading === 'SELL' ? '...' : 'Sell Mkt'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Open P&L</span>
              <span className={`data-number text-sm font-bold ${totalOpenPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {totalOpenPnl >= 0 ? '+' : ''}${totalOpenPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{openTrades.length} open</div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 flex relative">
          <div className="flex-1 relative bg-background">
            <div ref={chartContainerRef} className="absolute inset-0" />
            <PositionLines
              positions={activePositions}
              currentPrice={livePrices[activeInstrument.label] || 0}
              instrumentLabel={activeInstrument.label}
              chart={chart}
              series={series}
              onUpdateSL={(tradeId, newPrice) => handleUpdateSLTP(tradeId, 'stopLoss', newPrice)}
              onUpdateTP={(tradeId, newPrice) => handleUpdateSLTP(tradeId, 'takeProfit', newPrice)}
            />
          </div>
        </div>

        {/* Trade status */}
        {tradeStatus && (
          <div className={`shrink-0 px-4 py-2 text-xs font-bold text-center ${tradeStatus.type === 'success' ? 'bg-green/10 text-green border-t border-green/20' : 'bg-red/10 text-red border-t border-red/20'}`}>
            {tradeStatus.message}
          </div>
        )}
      </div>

      {/* Open positions panel */}
      {positionsWithPnl.length > 0 && (
        <div className="bg-[#0A0A0C]">
          <div className="px-3 py-2 border-b border-b1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Open Positions</span>
              <div className="flex items-center gap-0.5 bg-[#141418] rounded px-1 py-0.5" data-testid="sort-control">
                {([['oldest', 'Old'], ['newest', 'New'], ['loss', 'Loss']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setPositionSort(val)}
                    className={`text-[8px] px-1.5 py-0.5 rounded transition-colors ${positionSort === val ? 'bg-[#222228] text-white font-bold' : 'text-muted-foreground hover:text-white'}`}
                    data-testid={`sort-${val}`}>{label}</button>
                ))}
              </div>
            </div>
            <button onClick={handleCloseAll} disabled={closingAll}
              className="text-[9px] font-bold uppercase text-red hover:text-white bg-red/10 border border-red/30 hover:bg-red/20 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
              data-testid="btn-close-all">
              {closingAll ? 'Closing...' : 'Close All'}
            </button>
          </div>

          {positionsWithPnl.map(pos => {
            const editingSlHere = sltpEdit?.id === pos.id && sltpEdit?.field === 'sl';
            const editingTpHere = sltpEdit?.id === pos.id && sltpEdit?.field === 'tp';
            const confirmSltp = (id: string, field: 'sl' | 'tp') => {
              const val = parseFloat(sltpEdit?.value || '');
              if (!isNaN(val) && val > 0) handleUpdateSLTP(id, field === 'sl' ? 'stopLoss' : 'takeProfit', val);
              setSltpEdit(null);
            };

            return (
              <div key={pos.supabaseId || pos.id} data-testid={`position-row-${pos.id}`}>
                <div className="flex items-center gap-3 px-3 py-2 border-b border-b1 hover:bg-s2/50 transition-colors group">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${pos.side === 'BUY' ? 'bg-[#22C55E] text-white' : 'bg-[#EF4444] text-white'}`}>{pos.side}</span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-[#22C55E]/20 text-[#22C55E]" data-testid={`badge-mt5-${pos.id}`}>Live</span>
                  <span className="text-white font-bold text-xs shrink-0">
                    {(() => { const inst = INSTRUMENTS.find(i => i.label === pos.instrument); return inst ? Math.round(pos.size / inst.lotSize) : pos.size; })()} {pos.instrument}
                  </span>
                  <span className="text-muted-foreground text-[11px] shrink-0">Entry <span className="text-gold data-number">{formatPrice(pos.entryPrice, pos.instrument)}</span></span>
                  <span className="text-muted-foreground text-[11px] shrink-0">Now <span className="text-white data-number">{pos.currentPrice ? formatPrice(pos.currentPrice, pos.instrument) : '---'}</span></span>
                  <div className="flex items-center gap-1 shrink-0">
                    {pos.stopLoss ? (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'sl', value: String(pos.stopLoss) })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/40 transition-colors">
                        SL {formatPrice(pos.stopLoss, pos.instrument)}
                      </button>
                    ) : (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'sl', value: '' })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-s2 text-muted-foreground border border-b2 hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors">+ SL</button>
                    )}
                    {pos.takeProfit ? (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'tp', value: String(pos.takeProfit) })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 hover:bg-[#22C55E]/40 transition-colors">
                        TP {formatPrice(pos.takeProfit, pos.instrument)}
                      </button>
                    ) : (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'tp', value: '' })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-s2 text-muted-foreground border border-b2 hover:text-[#22C55E] hover:border-[#22C55E]/30 transition-colors">+ TP</button>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`data-number font-bold text-sm ${pos.livePnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{formatPnl(pos.livePnl)}</span>
                    <button onClick={() => handleClose(pos.id)} disabled={closingId === pos.id}
                      className="opacity-0 group-hover:opacity-100 text-[9px] text-muted-foreground hover:text-white bg-b1 border border-b2 px-1.5 py-0.5 rounded transition-all disabled:opacity-50"
                      data-testid={`btn-close-${pos.id}`}>
                      {closingId === pos.id ? '...' : 'Close'}
                    </button>
                  </div>
                </div>

                {editingSlHere && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#EF4444]/5 border-b border-b1">
                    <span className="text-[9px] font-bold text-[#EF4444] uppercase shrink-0">Stop Loss</span>
                    <input autoFocus type="number" value={sltpEdit?.value || ''} onChange={e => setSltpEdit(prev => prev ? { ...prev, value: e.target.value } : null)} onKeyDown={e => { if (e.key === 'Enter') confirmSltp(pos.id, 'sl'); if (e.key === 'Escape') setSltpEdit(null); }} placeholder="Enter SL price" className="flex-1 bg-s2 border border-[#EF4444]/40 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-[#EF4444]" />
                    <button onClick={() => confirmSltp(pos.id, 'sl')} className="text-[9px] font-bold px-2 py-1 rounded bg-[#EF4444] text-white hover:bg-[#EF4444]/80 transition-colors shrink-0">Set</button>
                    {pos.stopLoss && <button onClick={() => { handleUpdateSLTP(pos.id, 'stopLoss', null); setSltpEdit(null); }} className="text-[9px] font-bold px-2 py-1 rounded bg-s2 text-muted-foreground border border-b2 hover:text-white transition-colors shrink-0">Remove</button>}
                    <button onClick={() => setSltpEdit(null)} className="text-[9px] text-muted-foreground hover:text-white transition-colors shrink-0">✕</button>
                  </div>
                )}

                {editingTpHere && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#22C55E]/5 border-b border-b1">
                    <span className="text-[9px] font-bold text-[#22C55E] uppercase shrink-0">Take Profit</span>
                    <input autoFocus type="number" value={sltpEdit?.value || ''} onChange={e => setSltpEdit(prev => prev ? { ...prev, value: e.target.value } : null)} onKeyDown={e => { if (e.key === 'Enter') confirmSltp(pos.id, 'tp'); if (e.key === 'Escape') setSltpEdit(null); }} placeholder="Enter TP price" className="flex-1 bg-s2 border border-[#22C55E]/40 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-[#22C55E]" />
                    <button onClick={() => confirmSltp(pos.id, 'tp')} className="text-[9px] font-bold px-2 py-1 rounded bg-[#22C55E] text-white hover:bg-[#22C55E]/80 transition-colors shrink-0">Set</button>
                    {pos.takeProfit && <button onClick={() => { handleUpdateSLTP(pos.id, 'takeProfit', null); setSltpEdit(null); }} className="text-[9px] font-bold px-2 py-1 rounded bg-s2 text-muted-foreground border border-b2 hover:text-white transition-colors shrink-0">Remove</button>}
                    <button onClick={() => setSltpEdit(null)} className="text-[9px] text-muted-foreground hover:text-white transition-colors shrink-0">✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}