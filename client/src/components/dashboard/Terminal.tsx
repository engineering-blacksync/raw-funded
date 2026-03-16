import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Trade } from '@shared/schema';
import PositionLines from './PositionLines';

interface Terminal {
  chart: any;
  series: any;
}

interface TerminalRef {
  chart: any | null;
  series: any | null;
}

interface TradeRun {
  trades: Trade[];
  position: number;
  pnl: number;
  openedAt: string;
}

interface TerminalProps {
  tradeLoading: boolean;
  onTrade: (side: 'BUY' | 'SELL') => void;
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
  INSTRUMENTS.map((i) => [i.label, i.lotSize])
);

let tvWidget: any = null;

function Terminal({ tradeLoading, onTrade }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<number>(0);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentConfig>(INSTRUMENTS[0]);
  const [openPnL, setOpenPnL] = useState<number>(0);
  const [tradeRuns, setTradeRuns] = useState<Map<string, TradeRun>>(new Map());
  const [chart, setChart] = useState<any>(null);
  const [series, setSeries] = useState<any>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/prices/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setPrices((prev) => {
        const updated = { ...prev, ...data };
        if (data[selectedInstrument.label] !== undefined) {
          priceRef.current = data[selectedInstrument.label];
        }
        return updated;
      });

      console.log('[price-feed] tick', Object.entries(data).map(([k, v]) => `${k}=${v}`).join(', '));
    };

    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(() => window.location.reload(), 3000);
    };

    return () => {
      eventSource.close();
    };
  }, [selectedInstrument]);

  useEffect(() => {
    if (window.TradingView && chartContainerRef.current) {
      if (tvWidget) tvWidget.remove();

      tvWidget = new window.TradingView.widget({
        autosize: true,
        symbol: selectedInstrument.symbol,
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
    }
  }, [selectedInstrument]);

  useEffect(() => {
    const loadTrades = async () => {
      const res = await fetch('/api/trades/all');
      if (!res.ok) return;
      const data: Trade[] = await res.json();

      const tradeMap = new Map<string, TradeRun>();

      const openTrades = data.filter((t) => !t.closedAt);
      for (const trade of openTrades) {
        const key = `${trade.instrument}-${trade.openedAt}`;
        const current = tradeMap.get(key) || { trades: [], position: 0, pnl: 0, openedAt: trade.openedAt };
        current.trades.push(trade);
        current.position += trade.side === 'BUY' ? trade.size : -trade.size;
        tradeMap.set(key, current);
      }

      setTradeRuns(tradeMap);

      const totalPnL = openTrades.reduce((sum, t) => {
        if (!t.closedAt) return sum;
        const closedTrades = data.filter((dt) => dt.closedAt === t.closedAt);
        const closedPnL = closedTrades.reduce((s, dt) => s + dt.pnl, 0);
        return sum + closedPnL;
      }, 0);

      const openPnL = openTrades.reduce((sum, t) => {
        const price = prices[t.instrument] || 0;
        if (price === 0) return sum;
        if (t.side === 'BUY') {
          return sum + (price - t.entryPrice) * t.size * (CLIENT_LOT_SIZE_MAP[t.instrument] || 1);
        } else {
          return sum + (t.entryPrice - price) * t.size * (CLIENT_LOT_SIZE_MAP[t.instrument] || 1);
        }
      }, totalPnL);

      setOpenPnL(openPnL);
    };

    loadTrades();
    const interval = setInterval(loadTrades, 2000);
    return () => clearInterval(interval);
  }, [prices]);

  const handleTrade = useCallback(async (side: 'BUY' | 'SELL') => {
    onTrade(side);
  }, [onTrade]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col bg-black text-white"
      style={{ backgroundColor: '#09090B' }}
    >
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-4">
          <select
            value={selectedInstrument.label}
            onChange={(e) => {
              const newInstrument = INSTRUMENTS.find((i) => i.label === e.target.value);
              if (newInstrument) setSelectedInstrument(newInstrument);
            }}
            className="rounded bg-slate-800 px-2 py-1 text-sm"
            data-testid="select-instrument"
          >
            {INSTRUMENTS.map((i) => (
              <option key={i.label} value={i.label}>
                {i.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => handleTrade('BUY')}
              disabled={tradeLoading}
              className="rounded bg-green-600 px-3 py-1 text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              data-testid="button-buy-mkt"
            >
              Buy Mkt
            </button>
            <button
              onClick={() => handleTrade('SELL')}
              disabled={tradeLoading}
              className="rounded bg-red-600 px-3 py-1 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              data-testid="button-sell-mkt"
            >
              Sell Mkt
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400">Open P&L</div>
            <div
              className={`text-lg font-bold ${openPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}
              data-testid="text-open-pnl"
            >
              ${openPnL.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Price</div>
            <div className="text-lg font-bold text-slate-200" data-testid="text-current-price">
              ${(prices[selectedInstrument.label] || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} id="chart-container" className="flex-1" />

      <PositionLines
        tradeRuns={tradeRuns}
        instrument={selectedInstrument}
        prices={prices}
      />
    </div>
  );
}

export default Terminal;
