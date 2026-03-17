import { useRef, useState, useCallback, useEffect } from 'react';

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
  onUpdateSL: (tradeId: string, newPrice: number | null) => void;
  onUpdateTP: (tradeId: string, newPrice: number | null) => void;
}

function getPriceRange(price: number, instrument: string): number {
  if (['Bitcoin', 'MBT'].includes(instrument)) return price * 0.015;
  if (['Gold (GC)', 'MGC'].includes(instrument)) return price * 0.005;
  if (['Silver', 'SIL'].includes(instrument)) return price * 0.008;
  if (['Oil (WTI)', 'MCL'].includes(instrument)) return price * 0.008;
  if (['S&P 500', 'MES'].includes(instrument)) return price * 0.005;
  if (['Nasdaq', 'MNQ'].includes(instrument)) return price * 0.005;
  return price * 0.01;
}

function formatLinePrice(price: number, instrument: string): string {
  if (['Bitcoin', 'MBT', 'S&P 500', 'Nasdaq', 'MNQ', 'MES'].includes(instrument)) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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

interface LineProps {
  price: number;
  label: string;
  color: string;
  dashed?: boolean;
  yPercent: number;
  draggable?: boolean;
  onDrag?: (newPrice: number) => void;
  containerHeight: number;
  currentPrice: number;
  visibleRange: number;
  instrument: string;
  pnl?: number;
  shadeFrom?: number;
  shadeColor?: string;
}

function PriceLine({
  price, label, color, dashed, yPercent, draggable, onDrag,
  containerHeight, currentPrice, visibleRange, instrument, pnl,
  shadeFrom, shadeColor,
}: LineProps) {
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const startYRef = useRef(0);
  const startPriceRef = useRef(price);
  const lastPriceRef = useRef(price);

  const displayPrice = dragY !== null ? lastPriceRef.current : price;
  const yPos = dragY !== null ? dragY : yPercent * containerHeight;
  const visible = yPos >= -40 && yPos <= containerHeight + 40;

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    startPriceRef.current = price;
    lastPriceRef.current = price;
  }, [draggable, price]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startYRef.current;
      const pxPerPrice = containerHeight / (visibleRange * 2);
      const priceDelta = -deltaY / pxPerPrice;
      const newPrice = startPriceRef.current + priceDelta;
      lastPriceRef.current = newPrice;
      // currentPrice here already includes panOffset (passed from parent)
      const newY = ((currentPrice - newPrice) / (visibleRange * 2) + 0.5) * containerHeight;
      setDragY(Math.max(0, Math.min(containerHeight, newY)));
    };
    const handleUp = () => {
      setDragging(false);
      if (onDrag) {
        const finalPrice = Math.max(0, parseFloat(lastPriceRef.current.toFixed(2)));
        onDrag(finalPrice);
      }
      setDragY(null);
    };
    window.addEventListener('mousemove', handleMove, { capture: true, passive: false });
    window.addEventListener('mouseup', handleUp, { capture: true });
    window.addEventListener('touchmove', handleMove, { capture: true, passive: false });
    window.addEventListener('touchend', handleUp, { capture: true });
    return () => {
      window.removeEventListener('mousemove', handleMove, { capture: true });
      window.removeEventListener('mouseup', handleUp, { capture: true });
      window.removeEventListener('touchmove', handleMove, { capture: true });
      window.removeEventListener('touchend', handleUp, { capture: true });
    };
  }, [dragging, containerHeight, visibleRange, currentPrice, onDrag]);

  if (!visible) return null;

  const hasPnl = pnl !== undefined && pnl !== null;
  const pnlColor = hasPnl ? (pnl >= 0 ? '#22C55E' : '#EF4444') : null;
  const lineColor = hasPnl && pnlColor ? pnlColor : color;

  const shadeTop = shadeFrom !== undefined ? Math.min(yPos, shadeFrom) : null;
  const shadeHeight = shadeFrom !== undefined ? Math.abs(yPos - shadeFrom) : null;

  return (
    <>
      {/* Shaded zone */}
      {shadeTop !== null && shadeHeight !== null && shadeColor && (
        <div style={{ position: 'absolute', top: `${shadeTop}px`, left: 0, right: 0, height: `${shadeHeight}px`, background: shadeColor, pointerEvents: 'none', zIndex: 5 }} />
      )}

      {/* Line wrapper */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        style={{ position: 'absolute', top: `${yPos}px`, left: 0, right: 0, zIndex: 15, transform: 'translateY(-50%)', pointerEvents: 'auto', cursor: draggable ? (dragging ? 'grabbing' : 'ns-resize') : 'default' }}
      >
        {/* Wide 40px hit zone */}
        {draggable && (
          <div style={{ position: 'absolute', left: 0, right: 0, height: '40px', top: '-20px', zIndex: 16, cursor: dragging ? 'grabbing' : 'ns-resize' }} />
        )}

        {/* The line */}
        <div style={{
          width: '100%',
          height: dragging ? '2px' : '1px',
          background: dashed
            ? `repeating-linear-gradient(to right, ${lineColor} 0, ${lineColor} 6px, transparent 6px, transparent 12px)`
            : lineColor,
          opacity: dragging ? 1 : 0.9,
        }} />

        {/* Price tag */}
        <div style={{
          position: 'absolute',
          right: '4px',
          top: '-10px',
          background: 'transparent',
          border: `1px solid ${lineColor}`,
          color: lineColor,
          fontSize: '9px',
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.02em',
          userSelect: 'none',
          zIndex: 17,
          backdropFilter: 'blur(2px)',
        }}>
          {label} {formatLinePrice(displayPrice, instrument)}
        </div>

        {/* P&L badge */}
        {hasPnl && pnlColor && (
          <div style={{
            position: 'absolute',
            right: '4px',
            top: '-28px',
            background: 'transparent',
            border: `1px solid ${pnlColor}`,
            color: pnlColor,
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            fontFamily: "'JetBrains Mono', monospace",
            userSelect: 'none',
            zIndex: 17,
            backdropFilter: 'blur(2px)',
          }}>
            {formatPnl(pnl)}
          </div>
        )}

        {/* Drag handle */}
        {draggable && (
          <div style={{ position: 'absolute', left: '6px', top: '-7px', fontSize: '9px', color: lineColor, opacity: dragging ? 1 : 0.6, userSelect: 'none', fontWeight: 700, letterSpacing: '1px' }}>
            ⋮⋮
          </div>
        )}
      </div>
    </>
  );
}

export default function PositionLines({
  positions, currentPrice, instrumentLabel, onUpdateSL, onUpdateTP,
}: PositionLinesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  // Dynamic visible range — starts from instrument default, adjusts via scroll
  const [visibleRange, setVisibleRange] = useState(() => getPriceRange(currentPrice, instrumentLabel));

  // Pan offset in price units — how far the view is shifted from currentPrice center
  const [panOffset, setPanOffset] = useState(0);

  // Background drag state for panning
  const [bgDragging, setBgDragging] = useState(false);
  const bgDragStartRef = useRef({ y: 0, offset: 0 });

  // Reset zoom + pan when instrument changes
  useEffect(() => {
    setVisibleRange(getPriceRange(currentPrice, instrumentLabel));
    setPanOffset(0);
  }, [instrumentLabel]);

  // Auto-expand visibleRange to always keep all SL/TP lines on screen.
  // Never shrinks automatically — user controls that via scroll wheel.
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    let maxDist = getPriceRange(currentPrice, instrumentLabel);
    for (const pos of positions) {
      if (pos.stopLoss)   maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.stopLoss)   * 1.5);
      if (pos.takeProfit) maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.takeProfit) * 1.5);
      if (pos.entryPrice) maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.entryPrice) * 1.5);
    }
    setVisibleRange(prev => Math.max(prev, maxDist));
  }, [positions, currentPrice, instrumentLabel]);

  // Container height observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    setContainerHeight(containerRef.current.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Background drag → pan
  useEffect(() => {
    if (!bgDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - bgDragStartRef.current.y;
      if (containerHeight === 0) return;
      // Moving down (positive deltaY) shifts view down → price center goes up
      const priceDelta = (deltaY / containerHeight) * visibleRange * 2;
      setPanOffset(bgDragStartRef.current.offset + priceDelta);
    };
    const handleUp = () => setBgDragging(false);
    window.addEventListener('mousemove', handleMove, { capture: true, passive: true });
    window.addEventListener('mouseup', handleUp, { capture: true });
    window.addEventListener('touchmove', handleMove, { capture: true, passive: true });
    window.addEventListener('touchend', handleUp, { capture: true });
    return () => {
      window.removeEventListener('mousemove', handleMove, { capture: true });
      window.removeEventListener('mouseup', handleUp, { capture: true });
      window.removeEventListener('touchmove', handleMove, { capture: true });
      window.removeEventListener('touchend', handleUp, { capture: true });
    };
  }, [bgDragging, containerHeight, visibleRange]);

  if (!currentPrice || currentPrice <= 0 || positions.length === 0 || containerHeight === 0) {
    return <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
  }

  // Effective price center = live price + pan offset
  const priceCenter = currentPrice + panOffset;

  // Convert a price to a pixel Y position using current zoom + pan
  const priceToY = (p: number) =>
    ((priceCenter - p) / (visibleRange * 2) + 0.5) * containerHeight;

  // Zoom via scroll wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomFactor = e.deltaY > 0 ? 1.12 : 0.89; // scroll down = zoom out, scroll up = zoom in
    const baseRange = getPriceRange(currentPrice, instrumentLabel);
    const minRange = baseRange * 0.05;
    const maxRange = baseRange * 25;
    setVisibleRange(prev => Math.min(maxRange, Math.max(minRange, prev * zoomFactor)));
  };

  // Start background pan drag
  const handleBgMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Only trigger on left mouse button (button === 0), not on line drag handles
    if ('button' in e && e.button !== 0) return;
    setBgDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    bgDragStartRef.current = { y: clientY, offset: panOffset };
  };

  // Reset zoom and pan
  const handleReset = () => {
    setVisibleRange(getPriceRange(currentPrice, instrumentLabel));
    setPanOffset(0);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleBgMouseDown}
      onTouchStart={handleBgMouseDown}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #09090B 0%, #0F0F12 50%, #09090B 100%)',
        pointerEvents: 'auto',
        overflow: 'hidden',
        cursor: bgDragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Lines */}
      {positions.map(pos => (
        <div key={`pos-${pos.id}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Entry line (dashed) */}
          <PriceLine
            price={pos.entryPrice}
            label="ENTRY"
            color="#9CA3AF"
            dashed
            yPercent={priceToY(pos.entryPrice) / containerHeight}
            containerHeight={containerHeight}
            currentPrice={priceCenter}
            visibleRange={visibleRange}
            instrument={pos.instrument}
            pnl={pos.livePnl}
          />

          {/* TP line (green) */}
          {pos.takeProfit && (
            <PriceLine
              price={pos.takeProfit}
              label="TP"
              color="#22C55E"
              yPercent={priceToY(pos.takeProfit) / containerHeight}
              draggable
              onDrag={(newPrice) => onUpdateTP(pos.id, newPrice)}
              containerHeight={containerHeight}
              currentPrice={priceCenter}
              visibleRange={visibleRange}
              instrument={pos.instrument}
              shadeFrom={priceToY(pos.entryPrice)}
              shadeColor="rgba(34, 197, 94, 0.08)"
            />
          )}

          {/* SL line (red) */}
          {pos.stopLoss && (
            <PriceLine
              price={pos.stopLoss}
              label="SL"
              color="#EF4444"
              yPercent={priceToY(pos.stopLoss) / containerHeight}
              draggable
              onDrag={(newPrice) => onUpdateSL(pos.id, newPrice)}
              containerHeight={containerHeight}
              currentPrice={priceCenter}
              visibleRange={visibleRange}
              instrument={pos.instrument}
              shadeFrom={priceToY(pos.entryPrice)}
              shadeColor="rgba(239, 68, 68, 0.08)"
            />
          )}
        </div>
      ))}

      {/* Reset button */}
      <button
        onClick={handleReset}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 600,
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid #6366F1',
          color: '#A5B4FC',
          borderRadius: '3px',
          cursor: 'pointer',
          zIndex: 50,
          transition: 'all 0.2s ease',
        }}
      >
        Reset Zoom
      </button>
    </div>
  );
}
