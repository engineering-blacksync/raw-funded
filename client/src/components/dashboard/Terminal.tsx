import { useEffect, useRef, useState, useCallback } from 'react';

interface TerminalProps {
  tier: any;
  userTierName: string;
}

const INSTRUMENTS = [
  { label: 'Bitcoin', symbol: 'COINBASE:BTCUSD' },
  { label: 'Gold', symbol: 'OANDA:XAUUSD' },
  { label: 'Silver', symbol: 'OANDA:XAGUSD' },
  { label: 'Oil (WTI)', symbol: 'OANDA:WTICOUSD' },
  { label: 'S&P 500', symbol: 'OANDA:SPX500USD' },
  { label: 'Nasdaq', symbol: 'OANDA:NAS100USD' },
  { label: 'MNQ', symbol: 'CME_MINI:MNQ1!' },
  { label: 'MES', symbol: 'CME_MINI:MES1!' },
  { label: 'MGC', symbol: 'COMEX:MGC1!' },
  { label: 'SIL', symbol: 'COMEX:SIL1!' },
  { label: 'MCL', symbol: 'NYMEX:MCL1!' },
];

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

export default function Terminal({ tier, userTierName }: TerminalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvLoaded = useTradingViewScript();
  const [activeInstrument, setActiveInstrument] = useState(INSTRUMENTS[0]);
  const [contracts, setContracts] = useState<number>(1);
  const [positions, setPositions] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'simple' | 'pro'>('simple');

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

  const handleTrade = (side: 'BUY' | 'SELL') => {
    if (contracts > tier.maxContractsVal) {
      alert(`Contract size exceeds your tier limit (${tier.maxContractsText}). Verify to unlock larger positions.`);
      return;
    }

    const newPosition = {
      id: Math.random().toString(36).substring(7),
      instrument: activeInstrument.label,
      side,
      size: contracts,
      entry: side === 'BUY' ? 21005.50 : 21004.50,
      current: 21005.00,
      pnl: 0.00
    };
    
    setPositions([...positions, newPosition]);
  };

  const closePosition = (id: string) => {
    setPositions(positions.filter(p => p.id !== id));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 flex flex-col border-r border-b1 min-w-0">
        
        <div className="flex items-center border-b border-b1 bg-s1 shrink-0">
          <div className="flex overflow-x-auto no-scrollbar flex-1">
            {INSTRUMENTS.map((inst) => (
              <button
                key={inst.symbol}
                onClick={() => setActiveInstrument(inst)}
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
                  onClick={() => setContracts(Math.max(1, contracts - 1))}
                  className="px-4 py-3 text-muted-foreground hover:text-white hover:bg-s3 transition-colors"
                >-</button>
                <input 
                  type="number" 
                  value={contracts}
                  onChange={(e) => setContracts(Number(e.target.value))}
                  step="1"
                  min="1"
                  max={tier.maxContractsVal}
                  className="w-20 bg-transparent text-center text-white font-mono font-bold outline-none"
                  data-testid="input-contracts"
                />
                <button 
                  onClick={() => setContracts(contracts + 1)}
                  className="px-4 py-3 text-muted-foreground hover:text-white hover:bg-s3 transition-colors"
                >+</button>
              </div>
              <span className="text-[10px] text-muted-foreground">Max: {tier.maxContractsText} ({tier.label})</span>
            </div>

            <div className="flex-1 flex gap-4 w-full">
              <button 
                onClick={() => handleTrade('SELL')}
                className="flex-1 bg-red/10 text-red border border-red/30 hover:bg-red hover:text-white py-3 rounded transition-all font-heading text-xl flex flex-col items-center justify-center leading-none"
                data-testid="btn-sell"
              >
                <span>SELL</span>
              </button>
              <button 
                onClick={() => handleTrade('BUY')}
                className="flex-1 bg-green/10 text-green border border-green/30 hover:bg-green hover:text-white py-3 rounded transition-all font-heading text-xl flex flex-col items-center justify-center leading-none"
                data-testid="btn-buy"
              >
                <span>BUY</span>
              </button>
            </div>
            
          </div>
        </div>

      </div>

      <div className="w-full lg:w-80 bg-s1 flex flex-col shrink-0">
        
        <div className="p-4 border-b border-b1 bg-s2 grid grid-cols-2 gap-4 shrink-0">
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Equity</div>
            <div className="data-number text-white font-bold">$10,000.00</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Free Margin</div>
            <div className="data-number text-white font-bold">$9,950.00</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Margin Lvl</div>
            <div className="data-number text-white font-bold">2000%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Open PnL</div>
            <div className="data-number text-white font-bold">$0.00</div>
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
              {positions.map(pos => (
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
                        <div className="text-[10px] text-muted-foreground uppercase">Contracts</div>
                        <div className="data-number text-sm text-white">{pos.size}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Entry</div>
                        <div className="data-number text-sm text-white">{pos.entry}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase">P&L</div>
                      <div className={`data-number text-sm font-bold ${pos.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
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
