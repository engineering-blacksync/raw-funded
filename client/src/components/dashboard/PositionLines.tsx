import { useEffect, useRef, useCallback } from 'react';
import { ISeriesApi, IChartApi } from 'lightweight-charts';

interface Position {
  id: string;
  instrument: string;
  side: string;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  size: number;
  livePnl?: number;
  currentPrice?: number;
}

interface PositionLinesProps {
  positions: Position[];
  currentPrice: number;
  instrumentLabel: string;
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  onUpdateSL: (tradeId: string, newPrice: number | null) => void;
  onUpdateTP: (tradeId: string, newPrice: number | null) => void;
}

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`;
}

function isValidTP(side: string, entry: number, tp: number): boolean {
  return side === 'BUY' ? tp > entry : tp < entry;
}

function isValidSL(side: string, entry: number, sl: number): boolean {
  return side === 'BUY' ? sl < entry : sl > entry;
}

export default function PositionLines({
  positions, series, onUpdateSL, onUpdateTP,
}: PositionLinesProps) {
  const linesRef = useRef<Map<string, any>>(new Map());

  // Sync price lines to series
  useEffect(() => {
    if (!series) return;

    const currentKeys = new Set<string>();

    positions.forEach(pos => {
      const pnl = pos.livePnl ?? 0;
      const pnlColor = pnl >= 0 ? '#22C55E' : '#EF4444';

      // Entry line
      const entryKey = `entry-${pos.id}`;
      currentKeys.add(entryKey);
      if (!linesRef.current.has(entryKey)) {
        const line = series.createPriceLine({
          price: pos.entryPrice,
          color: pnlColor,
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: `${pos.side}  ${formatPnl(pnl)}`,
        });
        linesRef.current.set(entryKey, line);
      } else {
        linesRef.current.get(entryKey)?.applyOptions({
          price: pos.entryPrice,
          color: pnlColor,
          title: `${pos.side}  ${formatPnl(pnl)}`,
        });
      }

      // TP line
      if (pos.takeProfit) {
        const tpKey = `tp-${pos.id}`;
        currentKeys.add(tpKey);
        if (!linesRef.current.has(tpKey)) {
          const line = series.createPriceLine({
            price: pos.takeProfit,
            color: '#22C55E',
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: 'TP',
          });
          linesRef.current.set(tpKey, line);
        } else {
          linesRef.current.get(tpKey)?.applyOptions({ price: pos.takeProfit });
        }
      }

      // SL line
      if (pos.stopLoss) {
        const slKey = `sl-${pos.id}`;
        currentKeys.add(slKey);
        if (!linesRef.current.has(slKey)) {
          const line = series.createPriceLine({
            price: pos.stopLoss,
            color: '#EF4444',
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: 'SL',
          });
          linesRef.current.set(slKey, line);
        } else {
          linesRef.current.get(slKey)?.applyOptions({ price: pos.stopLoss });
        }
      }
    });

    // Remove stale lines
    linesRef.current.forEach((line, key) => {
      if (!currentKeys.has(key)) {
        try { series.removePriceLine(line); } catch {}
        linesRef.current.delete(key);
      }
    });
  }, [positions, series]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!series) return;
      linesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch {}
      });
      linesRef.current.clear();
    };
  }, [series]);

  // No DOM output — lines are drawn directly on the chart
  return null;
}