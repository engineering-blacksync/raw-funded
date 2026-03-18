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

export interface PendingLine {
  type: 'sl' | 'tp';
  price: number;
}

interface PositionLinesProps {
  positions: Position[];
  currentPrice: number;
  instrumentLabel: string;
  onUpdateSL: (tradeId: string, newPrice: number | null) => void;
  onUpdateTP: (tradeId: string, newPrice: number | null) => void;
  pendingLines?: PendingLine[];
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
  yPx: number;
  draggable?: boolean;
  onDragEnd?: (newPrice: number) => void;
  containerHeight: number;
  pxPerPrice: number;
  instrument: string;
  pnl?: number;
  shadeFromPx?: number;
  shadeColor?: string;
  preview?: boolean;
}

function PriceLine({
  price, label, color, dashed, yPx, draggable, onDragEnd,
  containerHeight, pxPerPrice,
  instrument, pnl, shadeFromPx, shadeColor, preview,
}: LineProps) {
  const [dragging, setDragging] = useState(false);
  const [liveY, setLiveY] = useState<number | null>(null);
  const startRef = useRef({ clientY: 0, startY: 0, startPrice: price });
  const lastPriceRef = useRef(price);

  const yPos = liveY !== null ? liveY : yPx;
  const visible = yPos >= -40 && yPos <= containerHeight + 40;

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startRef.current = { clientY, startY: yPx, startPrice: price };
    lastPriceRef.current = price;
    setDragging(true);
  }, [draggable, yPx, price]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startRef.current.clientY;
      const newY = Math.max(0, Math.min(containerHeight, startRef.current.startY + deltaY));
      lastPriceRef.current = startRef.current.startPrice - (deltaY / pxPerPrice);
      setLiveY(newY);
    };
    const handleUp = () => {
      setDragging(false);
      setLiveY(null);
      if (onDragEnd) {
        const finalPrice = Math.max(0, parseFloat(lastPriceRef.current.toFixed(2)));
        onDragEnd(finalPrice);
      }
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
  }, [dragging, containerHeight, pxPerPrice, onDragEnd]);

  if (!visible) return null;

  const displayPrice = liveY !== null ? lastPriceRef.current : price;
  const hasPnl = pnl !== undefined && pnl !== null;
  const pnlColor = hasPnl ? (pnl >= 0 ? '#22C55E' : '#EF4444') : null;
  const lineColor = hasPnl && pnlColor ? pnlColor : color;
  const opacity = preview ? 0.45 : (dragging ? 1 : 0.9);

  const shadeTop = shadeFromPx !== undefined ? Math.min(yPos, shadeFromPx) : null;
  const shadeHeight = shadeFromPx !== undefined ? Math.abs(yPos - shadeFromPx) : null;

  return (
    <>
      {shadeTop !== null && shadeHeight !== null && shadeColor && (
        <div style={{ position: 'absolute', top: `${shadeTop}px`, left: 0, right: 0, height: `${shadeHeight}px`, background: shadeColor, pointerEvents: 'none', zIndex: 5, opacity }} />
      )}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        style={{
          position: 'absolute',
          top: `${yPos}px`,
          left: 0, right: 0,
          zIndex: 15,
          transform: 'translateY(-50%)',
          pointerEvents: draggable ? 'auto' : 'none',
          cursor: draggable ? (dragging ? 'grabbing' : 'ns-resize') : 'default',
          opacity,
          animation: preview ? 'plPulse 1.4s ease-in-out infinite' : 'none',
        }}
      >
        {draggable && !preview && (
          <div style={{ position: 'absolute', left: 0, right: 0, height: '40px', top: '-20px', zIndex: 16, cursor: dragging ? 'grabbing' : 'ns-resize' }} />
        )}
        <div style={{
          width: '100%',
          height: dragging ? '2px' : '1px',
          background: dashed || preview
            ? `repeating-linear-gradient(to right, ${lineColor} 0, ${lineColor} 6px, transparent 6px, transparent 12px)`
            : lineColor,
        }} />
        <div style={{
          position: 'absolute', right: '4px', top: '-10px',
          background: 'transparent',
          border: `1px solid ${lineColor}`,
          color: lineColor,
          fontSize: '9px', fontWeight: 700,
          padding: '1px 5px', borderRadius: '2px',
          whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.02em',
          userSelect: 'none', zIndex: 17,
          backdropFilter: 'blur(2px)',
        }}>
          {label} {formatLinePrice(displayPrice, instrument)}
          {preview && <span style={{ marginLeft: '4px', fontSize: '8px', opacity: 0.7 }}>preview</span>}
        </div>
        {hasPnl && pnlColor && (
          <div style={{
            position: 'absolute', right: '4px', top: '-28px',
            background: 'transparent',
            border: `1px solid ${pnlColor}`,
            color: pnlColor,
            fontSize: '10px', fontWeight: 800,
            padding: '2px 8px', borderRadius: '3px',
            whiteSpace: 'nowrap',
            fontFamily: "'JetBrains Mono', monospace",
            userSelect: 'none', zIndex: 17,
            backdropFilter: 'blur(2px)',
          }}>
            {formatPnl(pnl)}
          </div>
        )}
        {draggable && !preview && (
          <div style={{ position: 'absolute', left: '6px', top: '-7px', fontSize: '9px', color: lineColor, opacity: dragging ? 1 : 0.6, userSelect: 'none', fontWeight: 700, letterSpacing: '1px' }}>
            ⋮⋮
          </div>
        )}
      </div>
    </>
  );
}

// Track last N price ticks to compute momentum.
// Returns a bias value from -1 (strong downtrend) to +1 (strong uptrend).
// TV places current price lower on screen when trending up (more history visible above),
// and higher on screen when trending down.
function useMomentumBias(currentPrice: number, instrument: string): number {
  const WINDOW = 20; // last 20 ticks
  const historyRef = useRef<number[]>([]);
  const [bias, setBias] = useState(0);

  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    const history = historyRef.current;
    history.push(currentPrice);
    if (history.length > WINDOW) history.shift();
    if (history.length < 3) return;

    const first = history[0];
    const last = history[history.length - 1];
    const range = getPriceRange(currentPrice, instrument);
    // Normalise move relative to visible price range so it's instrument-agnostic
    const rawBias = (last - first) / (range * 2);
    // Clamp to [-1, 1]
    const clamped = Math.max(-1, Math.min(1, rawBias * 8));
    setBias(prev => prev * 0.7 + clamped * 0.3); // smooth
  }, [currentPrice]);

  // Reset on instrument change
  useEffect(() => {
    historyRef.current = [];
    setBias(0);
  }, [instrument]);

  return bias;
}

export default function PositionLines({
  positions, currentPrice, instrumentLabel, onUpdateSL, onUpdateTP, pendingLines = [],
}: PositionLinesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [visibleRange, setVisibleRange] = useState(() => getPriceRange(currentPrice || 1, instrumentLabel));

  // Momentum bias — drives where current price sits vertically on our overlay
  const momentumBias = useMomentumBias(currentPrice, instrumentLabel);

  // CENTER: where current price Y sits on the overlay as a fraction of height.
  // Uptrend  (+bias) → current price pushed lower on screen (larger fraction) → TV shows more history above
  // Downtrend (-bias) → current price pushed higher on screen (smaller fraction) → TV shows more history below
  // Neutral  (0)     → 0.6 (slightly below center, TV's natural resting position for a live chart)
  // Range: 0.40 (strong downtrend) → 0.60 (neutral) → 0.75 (strong uptrend)
  const CENTER = 0.60 + momentumBias * 0.15;

  // Reset zoom when instrument changes
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    setVisibleRange(getPriceRange(currentPrice, instrumentLabel));
  }, [instrumentLabel]);

  // Auto-expand so all SL/TP lines are always visible
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    let maxDist = getPriceRange(currentPrice, instrumentLabel);
    for (const pos of positions) {
      if (pos.stopLoss)   maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.stopLoss)   * 1.3);
      if (pos.takeProfit) maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.takeProfit) * 1.3);
      if (pos.entryPrice) maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.entryPrice) * 1.3);
    }
    for (const pl of pendingLines) {
      if (pl.price > 0) maxDist = Math.max(maxDist, Math.abs(currentPrice - pl.price) * 1.3);
    }
    setVisibleRange(prev => Math.max(prev, maxDist));
  }, [positions, pendingLines, currentPrice, instrumentLabel]);

  // Single containerRef div always mounted
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    setContainerHeight(containerRef.current.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Scroll wheel zoom — passive, TV zooms simultaneously
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    const base = getPriceRange(currentPrice, instrumentLabel);
    const handleWheel = (e: WheelEvent) => {
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      setVisibleRange(prev => Math.min(base * 25, Math.max(base * 0.05, prev * factor)));
    };
    window.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, [currentPrice, instrumentLabel]);

  const canDraw = currentPrice > 0 && containerHeight > 0;

  // pxPerPrice: pixels per 1 unit of price
  const pxPerPrice = containerHeight / (visibleRange * 2);

  // priceToY: converts a price to pixel Y
  // current price sits at CENTER * containerHeight
  // prices above current price → smaller Y (higher on screen)
  // prices below current price → larger Y (lower on screen)
  const priceToY = (p: number) =>
    (CENTER + (currentPrice - p) / (visibleRange * 2)) * containerHeight;

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <style>{`
        @keyframes plPulse { 0%,100%{opacity:0.45} 50%{opacity:0.75} }
      `}</style>

      {canDraw && (
        <>
          {/* Reset zoom */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setVisibleRange(getPriceRange(currentPrice, instrumentLabel));
            }}
            style={{
              position: 'absolute', bottom: '10px', left: '10px',
              zIndex: 20, pointerEvents: 'auto', cursor: 'pointer',
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '9px', fontWeight: 700,
              padding: '2px 7px', borderRadius: '3px',
              fontFamily: "'JetBrains Mono', monospace",
              userSelect: 'none', backdropFilter: 'blur(4px)',
            }}
          >
            ⊙ reset zoom
          </div>

          {/* Preview lines while typing SL/TP */}
          {pendingLines.map((pl, i) => (
            <PriceLine
              key={`pending-${pl.type}-${i}`}
              price={pl.price}
              label={pl.type === 'sl' ? 'SL' : 'TP'}
              color={pl.type === 'sl' ? '#EF4444' : '#22C55E'}
              yPx={priceToY(pl.price)}
              containerHeight={containerHeight}
              pxPerPrice={pxPerPrice}
              instrument={instrumentLabel}
              preview
            />
          ))}

          {/* Confirmed position lines */}
          {positions.map(pos => {
            const entryYpx = priceToY(pos.entryPrice);

            const handleTPDrag = (newPrice: number) => {
              if (!isValidTP(pos.side, pos.entryPrice, newPrice)) return;
              onUpdateTP(pos.id, newPrice);
            };

            const handleSLDrag = (newPrice: number) => {
              if (!isValidSL(pos.side, pos.entryPrice, newPrice)) return;
              onUpdateSL(pos.id, newPrice);
            };

            return (
              <div key={pos.id} style={{ position: 'absolute', inset: 0 }}>
                <PriceLine
                  price={pos.entryPrice}
                  label={pos.side}
                  color="#ffffff"
                  dashed
                  yPx={entryYpx}
                  containerHeight={containerHeight}
                  pxPerPrice={pxPerPrice}
                  instrument={instrumentLabel}
                  pnl={pos.livePnl}
                />
                {pos.takeProfit && (
                  <PriceLine
                    price={pos.takeProfit}
                    label="TP"
                    color="#22C55E"
                    yPx={priceToY(pos.takeProfit)}
                    draggable
                    onDragEnd={handleTPDrag}
                    containerHeight={containerHeight}
                    pxPerPrice={pxPerPrice}
                    instrument={instrumentLabel}
                    shadeFromPx={entryYpx}
                    shadeColor="rgba(34,197,94,0.06)"
                  />
                )}
                {pos.stopLoss && (
                  <PriceLine
                    price={pos.stopLoss}
                    label="SL"
                    color="#EF4444"
                    yPx={priceToY(pos.stopLoss)}
                    draggable
                    onDragEnd={handleSLDrag}
                    containerHeight={containerHeight}
                    pxPerPrice={pxPerPrice}
                    instrument={instrumentLabel}
                    shadeFromPx={entryYpx}
                    shadeColor="rgba(239,68,68,0.06)"
                  />
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
