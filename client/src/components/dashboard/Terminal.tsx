import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Trade } from '@shared/schema';
import PositionLines from './PositionLines';

interface TerminalProps {
  tier: any;
  userTierName: string;
  balance: number;
  onOpenPnlChange?: (pnl: number) => void;
  allowedInstruments?: string[] | null;
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
  { label: 'Oil (WTI)', symbol: 'OANDA:WTICOUSD', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'S&P 500', symbol: 'OANDA:SPX500USD', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'Nasdaq', symbol: 'OANDA:NAS100USD', default: 1, step: 1, min: 1, max: 20, lotSize: 1 },
  { label: 'MNQ', symbol: 'CME_MINI:MNQ1!', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'MES', symbol: 'CME_MINI:MES1!', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
  { label: 'MGC', symbol: 'OANDA:XAUUSD', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10, spread: 0.03 },
  { label: 'SIL', symbol: 'COMEX:SIL1!', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10, spread: 0.008 },
  { label: 'MCL', symbol: 'NYMEX:MCL1!', default: 1, step: 1, min: 1, max: 20, lotSize: 0.10 },
];


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

const TV_SYMBOL_TO_INSTRUMENTS: Record<string, string[]> = {};
for (const inst of INSTRUMENTS) {
  const sym = inst.symbol.split(':')[1] || inst.symbol;
  if (!TV_SYMBOL_TO_INSTRUMENTS[sym]) TV_SYMBOL_TO_INSTRUMENTS[sym] = [];
  if (!TV_SYMBOL_TO_INSTRUMENTS[sym].includes(inst.label)) TV_SYMBOL_TO_INSTRUMENTS[sym].push(inst.label);
  if (!TV_SYMBOL_TO_INSTRUMENTS[inst.symbol]) TV_SYMBOL_TO_INSTRUMENTS[inst.symbol] = [];
  if (!TV_SYMBOL_TO_INSTRUMENTS[inst.symbol].includes(inst.label)) TV_SYMBOL_TO_INSTRUMENTS[inst.symbol].push(inst.label);
}

type PriceCallback = (label: string, price: number) => void;
let globalPriceCallback: PriceCallback | null = null;
let activeChartSymbol: string = '';

function useLivePrices(instruments: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const pricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    globalPriceCallback = (label: string, price: number) => {
      if (price <= 0) return;
      if (pricesRef.current[label] === price) return;
      pricesRef.current = { ...pricesRef.current, [label]: price };
      setPrices({ ...pricesRef.current });
    };
    return () => { globalPriceCallback = null; };
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let msg = event.data;
      if (typeof msg === 'string') {
        try { msg = JSON.parse(msg); } catch { return; }
      }
      if (!msg || typeof msg !== 'object') return;

      let price: number | null = null;

      if (msg.name === 'quoteUpdate' && msg.data) {
        const d = msg.data;
        const v = d.v || d;
        price = v.lp ?? v.last_price ?? v.close ?? d.lp ?? d.last_price ?? d.close ?? null;
      }

      if (price === null && msg.data && typeof msg.data === 'object') {
        const d = msg.data;
        price = d.lp ?? d.last_price ?? d.price ?? d.close ?? null;
      }

      if (typeof price === 'number' && price > 0 && activeChartSymbol) {
        const labels = TV_SYMBOL_TO_INSTRUMENTS[activeChartSymbol] || TV_SYMBOL_TO_INSTRUMENTS[activeChartSymbol.split(':')[1]] || [];
        for (const label of labels) {
          if (globalPriceCallback) globalPriceCallback(label, price);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (instruments.length === 0) return;
    let active = true;
    const fetchAll = async () => {
      const unique = [...new Set(instruments)];
      try {
        const res = await fetch('/api/prices/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruments: unique }),
        });
        if (!res.ok || !active) return;
        const data = await res.json();
        const updated = { ...pricesRef.current };
        for (const [inst, price] of Object.entries(data.prices)) {
          if (typeof price === 'number' && price > 0) updated[inst] = price;
        }
        pricesRef.current = updated;
        setPrices({ ...updated });
      } catch {}
    };
    fetchAll();
    const interval = setInterval(fetchAll, 1000);
    return () => { active = false; clearInterval(interval); };
  }, [instruments.join(',')]);

  return prices;
}

function pushTvPrice(symbol: string, price: number) {
  if (!globalPriceCallback || price <= 0) return;
  const labels = TV_SYMBOL_TO_INSTRUMENTS[symbol] || [];
  const shortSym = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  const moreLabels = TV_SYMBOL_TO_INSTRUMENTS[shortSym] || [];
  const allLabels = [...new Set([...labels, ...moreLabels])];
  for (const label of allLabels) globalPriceCallback(label, price);
}

function getTickSize(instrument: string): number | undefined {
  return INSTRUMENTS.find(i => i.label === instrument)?.tickSize;
}

function roundToTick(price: number, instrument: string): number {
  const tick = getTickSize(instrument);
  if (!tick) return price;
  return Math.round(price / tick) * tick;
}

function calcPnl(side: string, entry: number, current: number, size: number): number {
  const direction = side === 'BUY' ? 1 : -1;
  return (current - entry) * direction * size;
}

function isMarketOpen(instrument: string): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcTime = utcHour * 60 + utcMinute;

  if (['MBT', 'Bitcoin', 'BTCUSD'].includes(instrument)) {
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

export default function Terminal({ tier, userTierName, balance, onOpenPnlChange, allowedInstruments }: TerminalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvLoaded = useTradingViewScript();

  const visibleInstruments = allowedInstruments && allowedInstruments.length > 0
    ? INSTRUMENTS.filter(i => allowedInstruments.includes(i.label))
    : INSTRUMENTS;

  const defaultInstrument = visibleInstruments.find(i => i.label === 'MGC') || visibleInstruments[0];
  const [activeInstrument, setActiveInstrument] = useState(defaultInstrument);
  const [quantity, setQuantity] = useState<number>(defaultInstrument.default);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
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

  const openInstruments = openTrades.map(t => t.instrument);
  const allInstruments = [...new Set([activeInstrument.label, ...openInstruments])];
  const livePrices = useLivePrices(allInstruments);

  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const supabaseTradeIdsRef = useRef<Record<string, string>>({});
  useEffect(() => { supabaseTradeIdsRef.current = supabaseTradeIds; }, [supabaseTradeIds]);

  const loadTrades = useCallback(async () => {
    try {
      const [openRes, historyRes] = await Promise.all([
        fetch('/api/trades/open'),
        fetch('/api/trades'),
      ]);
      if (openRes.ok) setOpenTrades(await openRes.json());
      if (historyRes.ok) {
        const all: Trade[] = await historyRes.json();
        setClosedTrades(all.filter(t => t.status === 'closed'));
      }
    } catch {}
  }, []);

  const rtProcessedRef = useRef<Record<string, string>>({});

  const handleRealtimeChange = useCallback((payload: any) => {
    const { eventType, new: row } = payload;
    if (!row) return;

    const sbId = row.id;
    const dedupKey = `${sbId}:${row.status}:${row.open_price || ''}`;
    if (rtProcessedRef.current[sbId] === dedupKey) return;
    rtProcessedRef.current[sbId] = dedupKey;

    const idMap = supabaseTradeIdsRef.current;
    const localId = Object.entries(idMap).find(([, v]) => v === sbId)?.[0];

    if (eventType === 'UPDATE' && localId) {
      const newStatus = row.status;

      if (newStatus === 'closed' || newStatus === 'failed') {
        setOpenTrades(prev => prev.filter(t => t.id !== localId));
        if (newStatus === 'closed') loadTrades();
        return;
      }

      if (newStatus === 'executed' && row.open_price) {
        setOpenTrades(prev => prev.map(t => {
          if (t.id !== localId || t.status === 'executed') return t;
          return { ...t, status: 'executed', entryPrice: row.open_price };
        }));
        fetch(`/api/trades/${localId}/entry-price`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryPrice: row.open_price }),
        }).catch(() => {});
        console.log('RT: status→executed, fill price:', row.open_price, 'for', localId);
        return;
      }

      setOpenTrades(prev => prev.map(t => t.id === localId ? { ...t, status: newStatus } : t));
    } else if (eventType === 'INSERT') {
      loadTrades();
    }
  }, [loadTrades]);

  useEffect(() => {
    loadTrades();

    let channel: RealtimeChannel | null = null;
    (async () => {
      try {
        const configRes = await fetch('/api/supabase/config');
        if (!configRes.ok) return;
        const { url, anonKey } = await configRes.json();
        const supabase = createClient(url, anonKey);
        channel = supabase
          .channel('trades-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
            handleRealtimeChange(payload);
          })
          .subscribe();
        supabaseChannelRef.current = channel;
      } catch {}
    })();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [loadTrades, handleRealtimeChange]);

  const visibleOpenTrades = openTrades.filter(t => t.status === 'open' || t.status === 'executed');

  const positionsWithPnl = visibleOpenTrades.map(trade => {
    const currentPrice = livePrices[trade.instrument];
    const pnl = currentPrice ? calcPnl(trade.side, trade.entryPrice, currentPrice, trade.size) : 0;
    return { ...trade, livePnl: pnl, currentPrice };
  });

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
      const sbId = supabaseTradeIds[pos.id];
      if (!sbId) continue;
      fetch('/api/supabase/trades/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supabaseId: sbId, pnl: pos.livePnl }) }).catch(() => {});
    }
  }, [positionsWithPnl]);

  useEffect(() => {
    if (openTrades.length === 0) return;
    for (const pos of positionsWithPnl) {
      if (!pos.currentPrice) continue;
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
                const sbId = supabaseTradeIds[trade.id];
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

    const tvWidget = new window.TradingView.widget({
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
    try {
      tvWidget.onChartReady(() => {
        try {
          const sym = activeInstrument.symbol;
          tvWidget.activeChart().onDataLoaded().subscribe(null, () => {});
          tvWidget.subscribe('onTick', (tick: any) => {
            if (tick && typeof tick.close === 'number') {
              pushTvPrice(sym, tick.close);
            }
          });
          const iframe = tvWidget.iframe;
          if (iframe && iframe.contentWindow) {
            const poll = () => {
              try {
                tvWidget.activeChart().exportData({ from: Math.floor(Date.now() / 1000) - 60, to: Math.floor(Date.now() / 1000) + 60 }).then((data: any) => {
                  if (data && data.data && data.data.length > 0) {
                    const last = data.data[data.data.length - 1];
                    if (last && last[4] != null) pushTvPrice(sym, last[4]);
                  }
                }).catch(() => {});
              } catch {}
            };
            setInterval(poll, 1000);
          }
        } catch {}
      });
    } catch {}
  }, [activeInstrument.symbol, viewMode]);

  useEffect(() => {
    if (tvLoaded) createChart();
  }, [tvLoaded, createChart]);

  const pollSupabaseFillPrice = async (supabaseId: string, localTradeId: string, initialPrice: number) => {
    const maxAttempts = 10;
    const delayMs = 500;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, delayMs));
      try {
        const res = await fetch(`/api/supabase/trades/${supabaseId}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.open_price && data.open_price !== initialPrice) {
          const fillPrice = data.open_price;
          setOpenTrades(prev => prev.map(t => t.id === localTradeId ? { ...t, entryPrice: fillPrice } : t));
          fetch(`/api/trades/${localTradeId}/entry-price`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryPrice: fillPrice }),
          }).catch(() => {});
          console.log('MT5 fill price received:', fillPrice, 'for trade', localTradeId);
          return;
        }
      } catch {}
    }
  };

  const handleTrade = async (side: 'BUY' | 'SELL') => {
    if (!isMarketOpen(activeInstrument.label)) {
      setTradeStatus({ type: 'error', message: `Market closed for ${activeInstrument.label}` });
      setTimeout(() => setTradeStatus(null), 5000);
      return;
    }

    const rawMidPrice = livePrices[activeInstrument.label];
    if (!rawMidPrice) {
      setTradeStatus({ type: 'error', message: 'Waiting for price data...' });
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

    const tick = activeInstrument.tickSize;
    const midPrice = tick ? Math.round(rawMidPrice / tick) * tick : rawMidPrice;
    const prelimPrice = midPrice;

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
          console.log('Supabase trade ID mapped:', trade.id, '->', supabaseId);
          pollSupabaseFillPrice(supabaseId, trade.id, prelimPrice);
        }
        setOpenTrades(prev => [...prev, trade]);
        setTradeStatus({ type: 'success', message: `${side} ${quantity} ${activeInstrument.label} @ ${fillPrice.toLocaleString()}` });

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

  const handleClose = async (tradeId: string, exitPriceOverride?: number) => {
    if (closingId === tradeId || closingIdsRef.current.has(tradeId)) return;
    closingIdsRef.current.add(tradeId);
    setClosingId(tradeId);

    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) { setClosingId(null); return; }

    const rawExitPrice = exitPriceOverride ?? livePrices[trade.instrument];
    if (!rawExitPrice) { setClosingId(null); return; }
    const exitPrice = roundToTick(rawExitPrice, trade.instrument);

    try {
      const res = await fetch(`/api/trades/${tradeId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitPrice }),
      });
      if (res.ok) {
        const closed: Trade = await res.json();
        try { const sbId = supabaseTradeIds[tradeId]; if (sbId) { await fetch('/api/supabase/trades/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supabaseId: sbId, close_price: closed.exitPrice, pnl: closed.pnl, close_time: new Date().toISOString(), status: 'closed' }) }); } } catch { }
        setOpenTrades(prev => prev.filter(t => t.id !== tradeId));
        setClosedTrades(prev => [closed, ...prev]);
      }
    } catch {} finally {
      closingIdsRef.current.delete(tradeId);
      setClosingId(null);
    }
  };

  const [closingAll, setClosingAll] = useState(false);
  const handleCloseAll = async () => {
    if (closingAll || openTrades.length === 0) return;
    setClosingAll(true);
    const tradesToClose = openTrades.filter(t => t.status === 'open' || t.status === 'executed');
    for (const trade of tradesToClose) {
      await handleClose(trade.id);
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
      const sbId = supabaseTradeIds[tradeId];
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

          <div className="w-14 shrink-0 border-l border-b1 bg-s1 flex flex-col items-center justify-center gap-1.5 py-2">
            <button
              onClick={() => handleTrade('BUY')}
              disabled={tradeLoading !== null}
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
              disabled={tradeLoading !== null}
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
              <div className={`text-[7px] font-medium text-center px-0.5 ${tradeStatus.type === 'success' ? 'text-green' : 'text-red'}`} data-testid="trade-status">
                {tradeStatus.type === 'success' ? '✓' : '✗'}
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
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Open Positions</span>
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
              key={pos.id}
              className="flex items-center gap-3 px-3 py-2 border-b border-b1 hover:bg-s2/50 transition-colors group"
              data-testid={`position-row-${pos.id}`}
            >
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${pos.side === 'BUY' ? 'bg-[#22C55E] text-white' : 'bg-[#EF4444] text-white'}`}>
                {pos.side}
              </span>

              <span className="text-white font-bold text-xs shrink-0">{(() => { const inst = INSTRUMENTS.find(i => i.label === pos.instrument); return inst ? Math.round(pos.size / inst.lotSize) : pos.size; })()} {pos.instrument}</span>
              {pos.status === 'open' && <span className="text-[8px] text-gold animate-pulse shrink-0">PENDING</span>}

              <span className="text-muted-foreground text-[11px] shrink-0">Entry <span className="text-gold data-number">{pos.status === 'open' ? '---' : formatPrice(pos.entryPrice, pos.instrument)}</span></span>
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
    </div>
  );
}
