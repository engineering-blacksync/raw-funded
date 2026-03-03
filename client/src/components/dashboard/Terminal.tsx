import { useEffect, useRef, useState, useCallback } from 'react';

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

interface Position {
  id: string;
  instrument: string;
  side: 'BUY' | 'SELL';
  size: number;
  entry: number;
  pnl: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { label: 'Bitcoin', symbol: 'COINBASE:BTCUSD', default: 0.01, step: 0.01, min: 0.01, max: 1.00, decimals: 2 },
  { label: 'Gold', symbol: 'OANDA:XAUUSD', default: 0.01, step: 0.01, min: 0.01, max: 10.00, decimals: 2 },
  { label: 'Silver', symbol: 'OANDA:XAGUSD', default: 0.01, step: 0.01, min: 0.01, max: 10.00, decimals: 2 },
  { label: 'Oil (WTI)', symbol: 'OANDA:WTICOUSD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'S&P 500', symbol: 'OANDA:SPX500USD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'Nasdaq', symbol: 'OANDA:NAS100USD', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MNQ', symbol: 'CME_MINI:MNQ1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MES', symbol: 'CME_MINI:MES1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MGC', symbol: 'COMEX:MGC1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'SIL', symbol: 'COMEX:SIL1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
  { label: 'MCL', symbol: 'NYMEX:MCL1!', default: 1, step: 1, min: 1, max: 20, decimals: 0 },
];

const CONTRACT_SIZES: Record<string, number> = {
  'Bitcoin': 1,
  'Gold': 100,
  'Silver': 5000,
  'Oil (WTI)': 1000,
  'S&P 500': 50,
  'Nasdaq': 20,
  'MNQ': 2,
  'MES': 5,
  'MGC': 10,
  'SIL': 5000,
  'MCL': 1000,
};

declare global {
  interface Window {
    TradingView: any;
  }
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
    return () => {};
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

function calcPnl(pos: Position, currentPrice: number): number {
  const contractSize = CONTRACT_SIZES[pos.instrument] ?? 1;
  if (pos.side === 'BUY') {
    return (currentPrice - pos.entry) * pos.size * contractSize;
  } else {
    return (pos.entry - currentPrice) * pos.size * contractSize;
  }
}

export default function Terminal({ tier, userTierName }: TerminalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvLoaded = useTradingViewScript();
  const [activeInstrument, setActiveInstrument] = useState(INSTRUMENTS[0]);
  const [quantity, setQuantity] = useState<number>(INSTRUMENTS[0].default);
  const [positions, setPositions] = useState<Position[]>([]);
  const [viewMode, setViewMode] = useState<'simple' | 'pro'>('simple');
  const [tradeLoading, setTradeLoading] = useState<'BUY' | 'SELL' | null>(null);
  const [tradeStatus, setTradeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [closedPnl, setClosedPnl] = useState(0);
  const BASE_EQUITY = 10000;

  const openInstruments = positions.map(p => p.instrument);
  const allInstruments = [...new Set([activeInstrument.label, ...openInstruments])];
  const livePrices = useLivePrices(allInstruments);

  const positionsWithPnl = positions.map(pos => {
    const currentPrice = livePrices[pos.instrument];
    const pnl = currentPrice ? calcPnl(pos, currentPrice) : 0;
    return { ...pos, pnl, currentPrice };
  });

  const totalOpenPnl = positionsWithPnl.reduce((sum, p) => sum + p.pnl, 0);
  const equity = BASE_EQUITY + closedPnl + totalOpenPnl;

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
      ? { hide_side_toolbar: false, studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies"], withdateranges: true, save_image: true }
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
    if (quantity > tier.maxContractsVal) {
      alert(`Quantity exceeds your tier limit (${tier.maxContractsText}). Verify to unlock larger positions.`);
      return;
    }

    const entryPrice = livePrices[activeInstrument.label];
    if (!entryPrice) {
      setTradeStatus({ type: 'error', message: 'Waiting for price data...' });
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

    setTradeLoading(side);
    setTradeStatus(null);

    try {
      const response = await fetch('/api/supabase/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: activeInstrument.label,
          side,
          size: quantity,
          status: 'pending',
        }),
      });

      if (response.ok) {
        const newPosition: Position = {
          id: Math.random().toString(36).substring(7),
          instrument: activeInstrument.label,
          side,
          size: quantity,
          entry: entryPrice,
          pnl: 0,
        };
        setPositions(prev => [...prev, newPosition]);
        setTradeStatus({ type: 'success', message: `${side} ${activeInstrument.label} @ ${entryPrice.toLocaleString()}` });
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

  const closePosition = (id: string) => {
    const pos = positionsWithPnl.find(p => p.id === id);
    if (pos) {
      setClosedPnl(prev => prev + pos.pnl);
    }
    setPositions(prev => prev.filter(p => p.id !== id));
  };

  const displayQty = activeInstrument.decimals > 0
    ? quantity.toFixed(activeInstrument.decimals)
    : String(quantity);

  const formatPnl = (val: number) => `${val >= 0 ? '+' : ''}$${val.toFixed(2)}`;

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
            >
              Simple
            </button>
            <button
              onClick={() => setViewMode('pro')}
              className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors ${viewMode === 'pro' ? 'text-gold border border-gold/50 bg-gold/10' : 'text-muted-foreground hover:text-white'}`}
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
        </div>

        <div className="border-t border-b1 bg-s1 p-4 shrink-0">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-6">
            
            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] text-gold font-bold uppercase tracking-wider mb-1">{activeInstrument.label}</div>
              <div className="flex items-center bg-s2 border border-b2 rounded overflow-hidden">
                <button 
                  onClick={() => setQuantity(clampQuantity(quantity - activeInstrument.step, activeInstrument))}
                  disabled={atMin}
                  className={`px-4 py-3 transition-colors ${atMin ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                >-</button>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={displayQty}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setQuantity(clampQuantity(val, activeInstrument));
                  }}
                  className="w-20 bg-transparent text-center text-white font-mono font-bold outline-none"
                  data-testid="input-contracts"
                />
                <button 
                  onClick={() => setQuantity(clampQuantity(quantity + activeInstrument.step, activeInstrument))}
                  disabled={atMax}
                  className={`px-4 py-3 transition-colors ${atMax ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-white hover:bg-s3'}`}
                >+</button>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Min: {activeInstrument.min} · Max: {activeInstrument.max} · Step: {activeInstrument.step}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-2 w-full">
              <div className="flex gap-4">
                <button 
                  onClick={() => handleTrade('SELL')}
                  disabled={tradeLoading !== null}
                  className="flex-1 bg-red/10 text-red border border-red/30 hover:bg-red hover:text-white py-3 rounded transition-all font-heading text-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="btn-sell"
                >
                  {tradeLoading === 'SELL' ? 'Placing...' : 'SELL'}
                </button>
                <button 
                  onClick={() => handleTrade('BUY')}
                  disabled={tradeLoading !== null}
                  className="flex-1 bg-green/10 text-green border border-green/30 hover:bg-green hover:text-white py-3 rounded transition-all font-heading text-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="btn-buy"
                >
                  {tradeLoading === 'BUY' ? 'Placing...' : 'BUY'}
                </button>
              </div>
              {tradeStatus && (
                <div className={`text-center text-xs font-medium ${tradeStatus.type === 'success' ? 'text-green' : 'text-red'}`} data-testid="trade-status">
                  {tradeStatus.message}
                </div>
              )}
            </div>
            
          </div>
        </div>

      </div>

      <div className="w-full lg:w-80 bg-s1 flex flex-col shrink-0">
        
        <div className="p-4 border-b border-b1 bg-s2 grid grid-cols-2 gap-4 shrink-0">
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Equity</div>
            <div className={`data-number font-bold ${equity >= BASE_EQUITY ? 'text-white' : 'text-red'}`}>
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Closed PnL</div>
            <div className={`data-number font-bold ${closedPnl >= 0 ? 'text-green' : 'text-red'}`}>
              {formatPnl(closedPnl)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Positions</div>
            <div className="data-number text-white font-bold">{positions.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Open PnL</div>
            <div className={`data-number font-bold ${totalOpenPnl >= 0 ? 'text-green' : 'text-red'}`} data-testid="text-open-pnl">
              {formatPnl(totalOpenPnl)}
            </div>
          </div>
        </div>

        <div className="p-3 border-b border-b2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between shrink-0">
          <span>Open Positions ({positions.length})</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {positions.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
              No open positions. Select an instrument and execute a trade.
            </div>
          ) : (
            <div className="divide-y divide-b2">
              {positionsWithPnl.map(pos => (
                <div key={pos.id} className="p-4 hover:bg-s2 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pos.side === 'BUY' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'}`}>
                        {pos.side}
                      </span>
                      <span className="font-bold text-white text-sm">{pos.instrument}</span>
                    </div>
                    <button 
                      onClick={() => closePosition(pos.id)}
                      className="text-xs text-muted-foreground hover:text-white bg-b1 px-2 py-1 rounded transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-end mt-3">
                    <div className="flex gap-4">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Qty</div>
                        <div className="data-number text-sm text-white">{pos.size}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Entry</div>
                        <div className="data-number text-sm text-white">{pos.entry.toLocaleString()}</div>
                      </div>
                      {pos.currentPrice && (
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Current</div>
                          <div className="data-number text-sm text-white">{pos.currentPrice.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase">P&L</div>
                      <div className={`data-number text-sm font-bold ${pos.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                        {formatPnl(pos.pnl)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
