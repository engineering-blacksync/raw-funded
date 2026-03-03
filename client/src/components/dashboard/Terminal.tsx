import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

interface TerminalProps {
  tier: any;
  userTierName: string;
}

export default function Terminal({ tier, userTierName }: TerminalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [instrument, setInstrument] = useState(tier.instruments[0] || 'MNQ');
  const [contracts, setContracts] = useState<number>(1);
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090B' },
        textColor: '#71717A',
      },
      grid: {
        vertLines: { color: '#1C1C22' },
        horzLines: { color: '#1C1C22' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        borderColor: '#222228',
      },
      rightPriceScale: {
        borderColor: '#222228',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    });

    // Generate some realistic looking dummy data for MNQ around 21000
    const data = [];
    let currentPrice = 21000;
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 200; i > 0; i--) {
      const volatility = 5;
      const open = currentPrice + (Math.random() - 0.5) * volatility;
      const close = open + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;
      
      data.push({
        time: (now - i * 60) as any,
        open,
        high,
        low,
        close,
      });
      currentPrice = close;
    }

    candlestickSeries.setData(data);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [instrument]);

  const handleTrade = (side: 'BUY' | 'SELL') => {
    if (contracts > tier.maxContractsVal) {
      alert(`Contract size exceeds your tier limit (${tier.maxContractsText}). Verify to unlock larger positions.`);
      return;
    }

    const newPosition = {
      id: Math.random().toString(36).substring(7),
      instrument,
      side,
      size: contracts,
      entry: side === 'BUY' ? 21005.50 : 21004.50, // mock current price for MNQ
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
      {/* Left Column - Chart & Order Entry */}
      <div className="flex-1 flex flex-col border-r border-b1 min-w-0">
        
        {/* Instrument Tabs */}
        <div className="flex overflow-x-auto border-b border-b1 bg-s1 no-scrollbar shrink-0">
          {tier.instruments.map((inst: string) => (
            <button
              key={inst}
              onClick={() => setInstrument(inst)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${instrument === inst ? 'border-gold text-white bg-s2' : 'border-transparent text-muted-foreground hover:text-white hover:bg-s2/50'}`}
            >
              {inst}
            </button>
          ))}
        </div>

        {/* Chart Area */}
        <div className="flex-1 relative bg-background min-h-[300px]">
          <div ref={chartContainerRef} className="absolute inset-0" />
          
          <div className="absolute top-4 left-4 flex gap-2 z-10">
            {['1m', '5m', '15m', '1H', '4H', '1D'].map(tf => (
              <button key={tf} className="bg-s2/80 backdrop-blur border border-b1 text-muted-foreground hover:text-white px-2 py-1 text-xs rounded transition-colors">
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Order Entry Panel */}
        <div className="border-t border-b1 bg-s1 p-4 shrink-0">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-6">
            
            <div className="flex flex-col items-center gap-2">
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
                />
                <button 
                  onClick={() => setContracts(contracts + 1)}
                  className="px-4 py-3 text-muted-foreground hover:text-white hover:bg-s3 transition-colors"
                >+</button>
              </div>
              <span className="text-xs text-muted-foreground">Max: {tier.maxContractsText} ({tier.label})</span>
            </div>

            <div className="flex-1 flex gap-4 w-full">
              <button 
                onClick={() => handleTrade('SELL')}
                className="flex-1 bg-red/10 text-red border border-red/30 hover:bg-red hover:text-white py-3 rounded transition-all font-heading text-xl flex flex-col items-center justify-center leading-none"
              >
                <span>SELL</span>
                <span className="text-xs font-mono font-normal opacity-80 mt-1">21004.50</span>
              </button>
              <button 
                onClick={() => handleTrade('BUY')}
                className="flex-1 bg-green/10 text-green border border-green/30 hover:bg-green hover:text-white py-3 rounded transition-all font-heading text-xl flex flex-col items-center justify-center leading-none"
              >
                <span>BUY</span>
                <span className="text-xs font-mono font-normal opacity-80 mt-1">21005.50</span>
              </button>
            </div>
            
          </div>
        </div>

      </div>

      {/* Right Column - Positions & Account */}
      <div className="w-full lg:w-80 bg-s1 flex flex-col shrink-0">
        
        {/* Account Summary */}
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

        {/* Positions Header */}
        <div className="p-3 border-b border-b2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between shrink-0">
          <span>Open Positions ({positions.length})</span>
        </div>

        {/* Positions List */}
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