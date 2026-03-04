import { useEffect, useRef, useState, useCallback } from 'react';
import type { Trade } from '@shared/schema';

interface TerminalProps {
  tier: any;
  userTierName: string;
}

interface InstrumentConfig {
  label: string;
  symbol: string;
  default: number;
  step: number;
  min: number;
  max: number;
  decimals: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { label: 'Bitcoin', symbol: 'COINBASE:BTCUSD', default: 0.01, step: 0.01, min: 0.01, max: 1.00, decimals: 2 },
  { label: 'Gold (GC)', symbol: 'OANDA:XAUUSD', default: 1, step: 1, min: 1, max: 10, decimals: 0 },
  { label: 'Silver', symbol: 'OANDA:XAGUSD', default: 0.01, step: 0.01, min: 0.01, max: 10.00, decimals: 2 },
  { label: 'Oil (WTI)', symbol: 'OANDA:WTICOUSD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'S&P 500', symbol: 'OANDA:SPX500USD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'Nasdaq', symbol: 'OANDA:NAS100USD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MNQ', symbol: 'CME_MINI:MNQ1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MES', symbol: 'CME_MINI:MES1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MGC', symbol: 'OANDA:XAUUSD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'SIL', symbol: 'COMEX:SIL1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
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

export default function Terminal({ tier, userTierName }: TerminalProps) {
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
  const [sltpEditing, setSltpEditing] = useState<string | null>(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [orderSl, setOrderSl] = useState('');
  const [orderTp, setOrderTp] = useState('');
  const [showSltp, setShowSltp] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');

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
    const currentPrice = livePrices[trade.instrument];
    const pnl = currentPrice ? calcPnl(trade.side, trade.entryPrice, currentPrice, trade.size, trade.instrument) : 0;
    return { ...trade, livePnl: pnl, currentPrice };
  });

  const totalOpenPnl = positionsWithPnl.reduce((sum, p) => sum + p.livePnl, 0);
  const totalClosedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const SHARED_CHARTS: Record<string, string[]> = {
    'Gold (GC)': ['Gold (GC)', 'MGC'],
    'MGC': ['Gold (GC)', 'MGC'],
  };
  const chartGroup = SHARED_CHARTS[activeInstrument.label] ?? [activeInstrument.label];
  const activePositions = positionsWithPnl.filter(p => chartGroup.includes(p.instrument));

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
    const entryPrice = livePrices[activeInstrument.label];
    if (!entryPrice) {
      setTradeStatus({ type: 'error', message: 'Waiting for price data...' });
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

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

    const exitPrice = exitPriceOverride ?? livePrices[trade.instrument];
    if (!exitPrice) { setClosingId(null); return; }

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

  const handleSaveSLTP = async (tradeId: string) => {
    const sl = slInput ? parseFloat(slInput) : null;
    const tp = tpInput ? parseFloat(tpInput) : null;

    try {
      const res = await fetch(`/api/trades/${tradeId}/sltp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopLoss: sl, takeProfit: tp }),
      });
      if (res.ok) {
        const updated: Trade = await res.json();
        setOpenTrades(prev => prev.map(t => t.id === tradeId ? updated : t));
      }
    } catch {}
    setSltpEditing(null);
  };

  const startEditSLTP = (trade: Trade) => {
    setSltpEditing(trade.id);
    setSlInput(trade.stopLoss?.toString() ?? '');
    setTpInput(trade.takeProfit?.toString() ?? '');
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
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 flex flex-col border-r border-b1 min-w-0">

        <div className="flex items-center border-b border-b1 bg-s1 shrink-0">
          <div className="flex overflow-x-auto no-scrollbar flex-1">
            {INSTRUMENTS.map((inst) => (
              <button
                key={inst.symbol}
                onClick={() => handleInstrumentChange(inst)}
                className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${activeInstrument.symbol === inst.symbol ? 'border-gold text-white bg-s2' : 'border-transparent text-muted-foreground hover:text-white hover:bg-s2/50'}`}
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

        <div className="flex-1 relative bg-background min-h-[400px]">
          <div ref={chartContainerRef} id="tradingview-chart" className="absolute inset-0" />
          {!tvLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {activePositions.length > 0 && (
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 pointer-events-none" data-testid="chart-overlay">
              {activePositions.map(pos => (
                <div
                  key={pos.id}
                  className="pointer-events-auto bg-[#09090B]/85 backdrop-blur-sm border border-b2 rounded px-2.5 py-1.5 shadow-lg flex items-center gap-3 text-[11px]"
                  data-testid={`chart-pos-${pos.id}`}
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${pos.side === 'BUY' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'}`}>
                    {pos.side}
                  </span>
                  <span className="font-bold text-white">{pos.size} {pos.instrument}</span>
                  <span className="text-muted-foreground">Entry <span className="data-number text-gold">{formatPrice(pos.entryPrice, pos.instrument)}</span></span>
                  <span className="text-muted-foreground">Now <span className="data-number text-white">{pos.currentPrice ? formatPrice(pos.currentPrice, pos.instrument) : '---'}</span></span>
                  {pos.stopLoss && <span className="data-number text-red">SL {formatPrice(pos.stopLoss, pos.instrument)}</span>}
                  {pos.takeProfit && <span className="data-number text-green">TP {formatPrice(pos.takeProfit, pos.instrument)}</span>}
                  <span className={`data-number font-bold ${pos.livePnl >= 0 ? 'text-green' : 'text-red'}`}>
                    {formatPnl(pos.livePnl)}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>

        <div className="border-t border-b1 bg-s1 shrink-0">
          <div className="px-3 py-2 flex items-center justify-between border-b border-b1">
            <button className="flex items-center gap-1.5 text-xs text-white font-medium bg-s2 border border-b2 rounded px-3 py-1.5 hover:bg-s3 transition-colors" data-testid="btn-market-order">
              Market
              <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" /></svg>
            </button>

            <button
              onClick={() => setShowSltp(!showSltp)}
              className={`flex items-center gap-1.5 text-xs font-medium border rounded px-3 py-1.5 transition-colors ${showSltp ? 'text-gold border-gold/50 bg-gold/10' : 'text-white bg-s2 border-b2 hover:bg-s3'}`}
              data-testid="btn-toggle-sltp"
            >
              SL/TP
              <svg className={`w-3 h-3 transition-transform ${showSltp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>

          {showSltp && (
            <div className="px-3 py-2 flex gap-3 border-b border-b1 bg-s2/50">
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[9px] text-red font-bold uppercase tracking-wider">Stop Loss</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="None"
                  value={orderSl}
                  onChange={(e) => setOrderSl(e.target.value)}
                  className="w-full bg-s2 border border-b2 rounded px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-red/50"
                  data-testid="input-order-sl"
                />
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[9px] text-green font-bold uppercase tracking-wider">Take Profit</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="None"
                  value={orderTp}
                  onChange={(e) => setOrderTp(e.target.value)}
                  className="w-full bg-s2 border border-b2 rounded px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-green/50"
                  data-testid="input-order-tp"
                />
              </div>
            </div>
          )}

          <div className="px-3 py-3">
            <div className="flex items-stretch gap-2">
              <button
                onClick={() => handleTrade('BUY')}
                disabled={tradeLoading !== null}
                className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white py-3 rounded font-heading text-lg font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="btn-buy"
              >
                {tradeLoading === 'BUY' ? 'Placing...' : 'Buy'}
              </button>

              <div className="flex items-center bg-s2 border border-b2 rounded">
                <button
                  onClick={() => setQuantity(clampQuantity(quantity - activeInstrument.step, activeInstrument))}
                  disabled={atMin}
                  className={`px-3 py-2 text-sm font-bold transition-colors ${atMin ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                  data-testid="btn-qty-minus"
                >-</button>
                <div className="flex items-center gap-1 px-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displayQty}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setQuantity(clampQuantity(val, activeInstrument));
                    }}
                    className="w-10 bg-transparent text-center text-white font-mono font-bold text-sm outline-none"
                    data-testid="input-contracts"
                  />
                  <span className="text-xs text-muted-foreground font-medium">Lot</span>
                </div>
                <button
                  onClick={() => setQuantity(clampQuantity(quantity + activeInstrument.step, activeInstrument))}
                  disabled={atMax}
                  className={`px-3 py-2 text-sm font-bold transition-colors ${atMax ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                  data-testid="btn-qty-plus"
                >+</button>
              </div>

              <button
                onClick={() => handleTrade('SELL')}
                disabled={tradeLoading !== null}
                className="flex-1 bg-[#EF4444] hover:bg-[#DC2626] text-white py-3 rounded font-heading text-lg font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="btn-sell"
              >
                {tradeLoading === 'SELL' ? 'Placing...' : 'Sell'}
              </button>
            </div>
            {tradeStatus && (
              <div className={`text-center text-xs font-medium mt-2 ${tradeStatus.type === 'success' ? 'text-green' : 'text-red'}`} data-testid="trade-status">
                {tradeStatus.message}
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="w-full lg:w-80 bg-s1 flex flex-col shrink-0">

        <div className="p-4 border-b border-b1 bg-s2 grid grid-cols-2 gap-4 shrink-0">
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Open PnL</div>
            <div className={`data-number font-bold ${totalOpenPnl >= 0 ? 'text-green' : 'text-red'}`} data-testid="text-open-pnl">
              {formatPnl(totalOpenPnl)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Closed PnL</div>
            <div className={`data-number font-bold ${totalClosedPnl >= 0 ? 'text-green' : 'text-red'}`} data-testid="text-closed-pnl">
              {formatPnl(totalClosedPnl)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Open</div>
            <div className="data-number text-white font-bold" data-testid="text-open-count">{openTrades.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Closed</div>
            <div className="data-number text-white font-bold" data-testid="text-closed-count">{closedTrades.length}</div>
          </div>
        </div>

        <div className="flex border-b border-b1 shrink-0">
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'positions' ? 'text-gold border-b-2 border-gold bg-s2' : 'text-muted-foreground hover:text-white'}`}
            data-testid="tab-positions"
          >
            Positions ({openTrades.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'history' ? 'text-gold border-b-2 border-gold bg-s2' : 'text-muted-foreground hover:text-white'}`}
            data-testid="tab-history"
          >
            History ({closedTrades.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'positions' && (
            openTrades.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                No open positions. Select an instrument and execute a trade.
              </div>
            ) : (
              <div className="divide-y divide-b2">
                {positionsWithPnl.map(pos => (
                  <div key={pos.id} className="p-4 hover:bg-s2 transition-colors" data-testid={`position-card-${pos.id}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pos.side === 'BUY' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'}`}>
                          {pos.side}
                        </span>
                        <span className="font-bold text-white text-sm">{pos.instrument}</span>
                      </div>
                      <button
                        onClick={() => handleClose(pos.id)}
                        disabled={closingId === pos.id}
                        className="text-xs text-muted-foreground hover:text-white bg-b1 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        data-testid={`btn-close-${pos.id}`}
                      >
                        {closingId === pos.id ? '...' : 'Close'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Size</div>
                        <div className="data-number text-sm text-white">{pos.size}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Entry</div>
                        <div className="data-number text-sm text-white">{formatPrice(pos.entryPrice, pos.instrument)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Current</div>
                        <div className="data-number text-sm text-white">
                          {pos.currentPrice ? formatPrice(pos.currentPrice, pos.instrument) : '---'}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end mt-2">
                      <div className="flex gap-3">
                        <div>
                          <div className="text-[10px] text-red uppercase font-bold">SL</div>
                          <div className="data-number text-xs text-muted-foreground">
                            {pos.stopLoss ? formatPrice(pos.stopLoss, pos.instrument) : '---'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-green uppercase font-bold">TP</div>
                          <div className="data-number text-xs text-muted-foreground">
                            {pos.takeProfit ? formatPrice(pos.takeProfit, pos.instrument) : '---'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground uppercase">P&L</div>
                        <div className={`data-number text-sm font-bold ${pos.livePnl >= 0 ? 'text-green' : 'text-red'}`}>
                          {formatPnl(pos.livePnl)}
                        </div>
                      </div>
                    </div>

                    {sltpEditing === pos.id ? (
                      <div className="mt-3 pt-3 border-t border-b2 flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[9px] text-red font-bold uppercase">SL</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={slInput}
                            onChange={(e) => setSlInput(e.target.value)}
                            placeholder="None"
                            className="w-full bg-s3 border border-b2 rounded px-2 py-1 text-xs text-white font-mono outline-none"
                            data-testid={`input-sl-${pos.id}`}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-green font-bold uppercase">TP</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={tpInput}
                            onChange={(e) => setTpInput(e.target.value)}
                            placeholder="None"
                            className="w-full bg-s3 border border-b2 rounded px-2 py-1 text-xs text-white font-mono outline-none"
                            data-testid={`input-tp-${pos.id}`}
                          />
                        </div>
                        <button
                          onClick={() => handleSaveSLTP(pos.id)}
                          className="text-xs text-gold hover:text-white bg-gold/10 border border-gold/30 px-2 py-1 rounded"
                          data-testid={`btn-save-sltp-${pos.id}`}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setSltpEditing(null)}
                          className="text-xs text-muted-foreground hover:text-white px-1 py-1"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditSLTP(pos)}
                        className="mt-2 w-full text-[10px] text-muted-foreground hover:text-gold uppercase tracking-wider py-1 border border-b2 rounded hover:border-gold/30 transition-colors"
                        data-testid={`btn-edit-sltp-${pos.id}`}
                      >
                        Edit SL / TP
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'history' && (
            closedTrades.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                No closed trades yet.
              </div>
            ) : (
              <div className="divide-y divide-b2">
                {closedTrades.map(trade => (
                  <div key={trade.id} className="p-4 hover:bg-s2 transition-colors" data-testid={`history-card-${trade.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.side === 'BUY' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'}`}>
                        {trade.side}
                      </span>
                      <span className="font-bold text-white text-sm">{trade.instrument}</span>
                      <span className={`ml-auto data-number text-sm font-bold ${(trade.pnl ?? 0) >= 0 ? 'text-green' : 'text-red'}`}>
                        {formatPnl(trade.pnl ?? 0)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Size</div>
                        <div className="data-number text-white">{trade.size}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Entry</div>
                        <div className="data-number text-white">{formatPrice(trade.entryPrice, trade.instrument)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Exit</div>
                        <div className="data-number text-white">{trade.exitPrice ? formatPrice(trade.exitPrice, trade.instrument) : '---'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Date</div>
                        <div className="data-number text-muted-foreground">
                          {trade.closedAt ? new Date(trade.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '---'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
}
