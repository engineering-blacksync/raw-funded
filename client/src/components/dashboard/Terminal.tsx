import { useEffect, useRef, useState, useCallback } from 'react';
import type { Trade } from '@shared/schema';

interface TerminalProps {
  tier: any;
  userTierName: string;
  onOpenPnlChange?: (pnl: number) => void;
}

interface InstrumentConfig {
  label: string;
  symbol: string;
  default: number;
  step: number;
  min: number;
  max: number;
  decimals: number;
  spread?: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { label: 'Bitcoin', symbol: 'COINBASE:BTCUSD', default: 0.01, step: 0.01, min: 0.01, max: 1.00, decimals: 2 },
  { label: 'Gold (GC)', symbol: 'OANDA:XAUUSD', default: 1, step: 1, min: 1, max: 10, decimals: 0, spread: 0.30 },
  { label: 'Silver', symbol: 'OANDA:XAGUSD', default: 0.01, step: 0.01, min: 0.01, max: 10.00, decimals: 2, spread: 0.08 },
  { label: 'Oil (WTI)', symbol: 'OANDA:WTICOUSD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'S&P 500', symbol: 'OANDA:SPX500USD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'Nasdaq', symbol: 'OANDA:NAS100USD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MNQ', symbol: 'CME_MINI:MNQ1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MES', symbol: 'CME_MINI:MES1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MGC', symbol: 'OANDA:XAUUSD', default: 1, step: 1, min: 1, max: 20, decimals: 0, spread: 0.30 },
  { label: 'SIL', symbol: 'COMEX:SIL1!', default: 1, step: 1, min: 1, max: 20, decimals: 0, spread: 0.08 },
  { label: 'MCL', symbol: 'NYMEX:MCL1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
];

const CONTRACT_SIZES: Record<string, number> = {
  'Bitcoin': 1, 'Gold (GC)': 100, 'Silver': 5000, 'Oil (WTI)': 1000,
  'S&P 500': 50, 'Nasdaq': 20, 'MNQ': 2, 'MES': 5, 'MGC': 10, 'SIL': 5000, 'MCL': 1000,
};

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

function useLivePrices(instruments: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const pricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (instruments.length === 0) return;
    let active = true;
    const fetchAll = async () => {
      const unique = [...new Set(instruments)];
      const results = await Promise.allSettled(
        unique.map(async (inst) => {
          const res = await fetch(`/api/prices/${encodeURIComponent(inst)}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { inst, price: data.price as number };
        })
      );
      if (!active) return;
      const updated = { ...pricesRef.current };
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value && r.value.price > 0) {
          updated[r.value.inst] = r.value.price;
        }
      }
      pricesRef.current = updated;
      setPrices({ ...updated });
    };
    fetchAll();
    const interval = setInterval(fetchAll, 1000);
    return () => { active = false; clearInterval(interval); };
  }, [instruments.join(',')]);

  return prices;
}

function calcPnl(side: string, entry: number, current: number, size: number, instrument: string): number {
  const contractSize = CONTRACT_SIZES[instrument] ?? 1;
  const direction = side === 'BUY' ? 1 : -1;
  return (current - entry) * direction * size * contractSize;
}

export default function Terminal({ tier, userTierName, onOpenPnlChange }: TerminalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvLoaded = useTradingViewScript();
  const [activeInstrument, setActiveInstrument] = useState(INSTRUMENTS[0]);
  const [quantity, setQuantity] = useState<number>(INSTRUMENTS[0].default);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [viewMode, setViewMode] = useState<'simple' | 'pro'>('pro');
  const [tradeLoading, setTradeLoading] = useState<'BUY' | 'SELL' | null>(null);
  const [tradeStatus, setTradeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const closingIdsRef = useRef<Set<string>>(new Set());
  const [orderSl, setOrderSl] = useState('');
  const [orderTp, setOrderTp] = useState('');
  const [showSltp, setShowSltp] = useState(false);

  const openInstruments = openTrades.map(t => t.instrument);
  const allInstruments = [...new Set([activeInstrument.label, ...openInstruments])];
  const livePrices = useLivePrices(allInstruments);

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
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
  };

  const positionsWithPnl = openTrades.map(trade => {
    const midPrice = livePrices[trade.instrument];
    const inst = INSTRUMENTS.find(i => i.label === trade.instrument);
    const halfSpread = ((inst?.spread) || 0) / 2;
    const exitPrice = midPrice ? (trade.side === 'BUY' ? midPrice - halfSpread : midPrice + halfSpread) : undefined;
    const pnl = exitPrice ? calcPnl(trade.side, trade.entryPrice, exitPrice, trade.size, trade.instrument) : 0;
    return { ...trade, livePnl: pnl, currentPrice: exitPrice };
  });

  const totalOpenPnl = positionsWithPnl.reduce((sum, p) => sum + p.livePnl, 0);
  useEffect(() => {
    onOpenPnlChange?.(totalOpenPnl);
  }, [totalOpenPnl, onOpenPnlChange]);



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

  const handleInstrumentChange = (inst: InstrumentConfig) => {
    setActiveInstrument(inst);
    setQuantity(inst.default);
  };

  const clampQuantity = (val: number, inst: InstrumentConfig) => {
    const rounded = +val.toFixed(inst.decimals);
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
    const midPrice = livePrices[activeInstrument.label];
    if (!midPrice) {
      setTradeStatus({ type: 'error', message: 'Waiting for price data...' });
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

    const halfSpread = (activeInstrument.spread || 0) / 2;
    const entryPrice = side === 'BUY' ? midPrice + halfSpread : midPrice - halfSpread;

    setTradeLoading(side);
    setTradeStatus(null);

    try {
      const body: any = {
        instrument: activeInstrument.label,
        side,
        contracts: activeInstrument.decimals > 0 ? 1 : Math.round(quantity),
        size: quantity,
        entryPrice,
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
        setOpenTrades(prev => [...prev, trade]);
        setTradeStatus({ type: 'success', message: `${side} ${quantity} ${activeInstrument.label} @ ${entryPrice.toLocaleString()}` });
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

    let exitPrice = exitPriceOverride ?? livePrices[trade.instrument];
    if (!exitPrice) { setClosingId(null); return; }
    if (!exitPriceOverride) {
      const inst = INSTRUMENTS.find(i => i.label === trade.instrument);
      const halfSpread = ((inst?.spread) || 0) / 2;
      exitPrice = trade.side === 'BUY' ? exitPrice - halfSpread : exitPrice + halfSpread;
    }

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
      }
    } catch {} finally {
      closingIdsRef.current.delete(tradeId);
      setClosingId(null);
    }
  };


  const displayQty = activeInstrument.decimals > 0
    ? quantity.toFixed(activeInstrument.decimals)
    : String(quantity);

  const formatPnl = (val: number) => `${val >= 0 ? '+' : ''}$${val.toFixed(2)}`;

  const formatPrice = (price: number, instrument: string) => {
    if (['Bitcoin', 'Gold', 'S&P 500', 'Nasdaq', 'MNQ', 'MES'].includes(instrument)) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col min-w-0">

        <div className="flex items-center border-b border-b1 bg-s1 shrink-0">
          <div className="flex overflow-x-auto no-scrollbar flex-1">
            {INSTRUMENTS.map((inst) => (
              <button
                key={inst.symbol}
                onClick={() => handleInstrumentChange(inst)}
                className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2 ${activeInstrument.symbol === inst.symbol ? 'border-gold text-white bg-s2' : 'border-transparent text-muted-foreground hover:text-white hover:bg-s2/50'}`}
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

        <div className="flex-1 relative bg-background">
          <div ref={chartContainerRef} id="tradingview-chart" className="absolute inset-0" />
          {!tvLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}


        </div>

        <div className="border-t border-b1 bg-s1 shrink-0 px-3 py-2">
          {showSltp && (
            <div className="flex gap-3 mb-2">
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

          <div className="flex items-stretch gap-2">
            <button className="flex items-center gap-1 text-[10px] text-white font-medium bg-s2 border border-b2 rounded px-2 py-1 hover:bg-s3 transition-colors shrink-0" data-testid="btn-market-order">
              Market
            </button>

            <button
              onClick={() => handleTrade('BUY')}
              disabled={tradeLoading !== null}
              className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white py-2 rounded font-heading text-base font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-buy"
            >
              {tradeLoading === 'BUY' ? '...' : 'Buy'}
            </button>

            <div className="flex items-center bg-s2 border border-b2 rounded shrink-0">
              <button
                onClick={() => setQuantity(clampQuantity(quantity - activeInstrument.step, activeInstrument))}
                disabled={atMin}
                className={`px-2.5 py-1 text-sm font-bold transition-colors ${atMin ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                data-testid="btn-qty-minus"
              >-</button>
              <div className="flex items-center gap-1 px-0.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayQty}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setQuantity(clampQuantity(val, activeInstrument));
                  }}
                  className="w-8 bg-transparent text-center text-white font-mono font-bold text-sm outline-none"
                  data-testid="input-contracts"
                />
                <span className="text-[10px] text-muted-foreground font-medium">Lot</span>
              </div>
              <button
                onClick={() => setQuantity(clampQuantity(quantity + activeInstrument.step, activeInstrument))}
                disabled={atMax}
                className={`px-2.5 py-1 text-sm font-bold transition-colors ${atMax ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                data-testid="btn-qty-plus"
              >+</button>
            </div>

            <button
              onClick={() => handleTrade('SELL')}
              disabled={tradeLoading !== null}
              className="flex-1 bg-[#EF4444] hover:bg-[#DC2626] text-white py-2 rounded font-heading text-base font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-sell"
            >
              {tradeLoading === 'SELL' ? '...' : 'Sell'}
            </button>

            <button
              onClick={() => setShowSltp(!showSltp)}
              className={`flex items-center gap-1 text-[10px] font-medium border rounded px-2 py-1 transition-colors shrink-0 ${showSltp ? 'text-gold border-gold/50 bg-gold/10' : 'text-white bg-s2 border-b2 hover:bg-s3'}`}
              data-testid="btn-toggle-sltp"
            >
              SL/TP
            </button>
          </div>
          {tradeStatus && (
            <div className={`text-center text-xs font-medium mt-1 ${tradeStatus.type === 'success' ? 'text-green' : 'text-red'}`} data-testid="trade-status">
              {tradeStatus.message}
            </div>
          )}
        </div>

        {positionsWithPnl.length > 0 && (
          <div className="border-t border-b1 bg-[#0A0A0C] shrink-0 overflow-y-auto max-h-[35vh]">
            {positionsWithPnl.map(pos => (
              <div
                key={pos.id}
                className="flex items-center gap-3 px-3 py-2 border-b border-b1 hover:bg-s2/50 transition-colors group"
                data-testid={`position-row-${pos.id}`}
              >
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${pos.side === 'BUY' ? 'bg-[#22C55E] text-white' : 'bg-[#EF4444] text-white'}`}>
                  {pos.side}
                </span>

                <span className="text-white font-bold text-xs shrink-0">{pos.size} {pos.instrument}</span>

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

      </div>
    </div>
  );
}
