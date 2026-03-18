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
  containerHeight, pxPerPrice, instrument, pnl,
  shadeFromPx, shadeColor, preview,
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
      // price change is inverse of Y change
      const deltaPrice = -deltaY / pxPerPrice;
      lastPriceRef.current = startRef.current.startPrice + deltaPrice;
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

export default function PositionLines({
  positions, currentPrice, instrumentLabel, onUpdateSL, onUpdateTP, pendingLines = [],
}: PositionLinesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  // ── Zoom (price-per-pixel scale) ──────────────────────────────────────────
  const [visibleRange, setVisibleRange] = useState(() => getPriceRange(currentPrice || 1, instrumentLabel));

  // Reset zoom on instrument change
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    setVisibleRange(getPriceRange(currentPrice, instrumentLabel));
  }, [instrumentLabel]);

  // Auto-expand so confirmed lines never clip off screen
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    let maxDist = getPriceRange(currentPrice, instrumentLabel);
    for (const pos of positions) {
      if (pos.stopLoss)   maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.stopLoss)   * 1.5);
      if (pos.takeProfit) maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.takeProfit) * 1.5);
      if (pos.entryPrice) maxDist = Math.max(maxDist, Math.abs(currentPrice - pos.entryPrice) * 1.5);
    }
    for (const pl of pendingLines) {
      if (pl.price > 0) maxDist = Math.max(maxDist, Math.abs(currentPrice - pl.price) * 1.5);
    }
    setVisibleRange(prev => Math.max(prev, maxDist));
  }, [positions, pendingLines, currentPrice, instrumentLabel]);

  // Scroll wheel → zoom both our overlay and TV simultaneously (passive)
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

  // ── Calibration anchor ────────────────────────────────────────────────────
  // anchorY:     pixel Y where current price was placed at calibration time
  // anchorPrice: the currentPrice value at calibration time
  // Together these give us a fixed reference: "price X is at pixel Y"
  // Everything else is derived mathematically from this single reference point.
  const [anchorY, setAnchorY] = useState<number | null>(null);       // null = not yet calibrated
  const [anchorPrice, setAnchorPrice] = useState<number>(currentPrice);
  const [anchorDragging, setAnchorDragging] = useState(false);
  const anchorDragStart = useRef({ clientY: 0, anchorY: 0 });
  const currentPriceRef = useRef(currentPrice);
  useEffect(() => { currentPriceRef.current = currentPrice; }, [currentPrice]);

  // Initialise anchor to center once container height is known
  useEffect(() => {
    if (containerHeight > 0 && anchorY === null) {
      setAnchorY(containerHeight * 0.5);
      setAnchorPrice(currentPrice);
    }
  }, [containerHeight]);

  // Reset anchor when instrument changes
  useEffect(() => {
    setAnchorY(null);
    setAnchorPrice(currentPrice);
  }, [instrumentLabel]);

  const effectiveAnchorY = anchorY ?? (containerHeight * 0.5);
  const isCalibrated = anchorY !== null && Math.abs(anchorY - containerHeight * 0.5) > 5;

  // Anchor drag handlers
  const handleAnchorMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    anchorDragStart.current = { clientY, anchorY: effectiveAnchorY };
    setAnchorDragging(true);
  }, [effectiveAnchorY]);

  useEffect(() => {
    if (!anchorDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - anchorDragStart.current.clientY;
      const newY = Math.max(0, Math.min(containerHeight, anchorDragStart.current.anchorY + deltaY));
      setAnchorY(newY);
    };
    const handleUp = () => {
      // On release, lock anchorPrice to current price — "current price is here"
      setAnchorPrice(currentPriceRef.current);
      setAnchorDragging(false);
    };
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
  }, [anchorDragging, containerHeight]);

  // ── Container height ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    setContainerHeight(containerRef.current.clientHeight);
    return () => observer.disconnect();
  }, []);

  // ── Core math ─────────────────────────────────────────────────────────────
  // pxPerPrice: how many pixels correspond to 1 unit of price
  // priceToY:   convert any price to a pixel Y using the calibrated anchor
  //
  // Formula:
  //   priceToY(p) = anchorY + (anchorPrice - p) * pxPerPrice
  //
  // When p === anchorPrice: returns anchorY  ✓
  // When p > anchorPrice (price is higher): returns a smaller Y (higher on screen) ✓
  // When p < anchorPrice (price is lower):  returns a larger  Y (lower on screen)  ✓
  const canDraw = currentPrice > 0 && containerHeight > 0;
  const pxPerPrice = containerHeight / (visibleRange * 2);
  const priceToY = (p: number) => effectiveAnchorY + (anchorPrice - p) * pxPerPrice;

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <style>{`
        @keyframes plPulse { 0%,100%{opacity:0.45} 50%{opacity:0.75} }
        @keyframes anchorPulse { 0%,100%{opacity:0.5} 50%{opacity:0.9} }
      `}</style>

      {canDraw && (
        <>
          {/* ── Calibration anchor ── */}
          {/* Drag this to match TradingView's current price line on the right axis */}
          <div
            onMouseDown={handleAnchorMouseDown}
            onTouchStart={handleAnchorMouseDown}
            style={{
              position: 'absolute',
              top: `${effectiveAnchorY}px`,
              left: 0, right: 0,
              zIndex: 18,
              transform: 'translateY(-50%)',
              pointerEvents: 'auto',
              cursor: anchorDragging ? 'grabbing' : 'ns-resize',
            }}
          >
            {/* Wide hit zone */}
            <div style={{ position: 'absolute', left: 0, right: 0, height: '32px', top: '-16px', zIndex: 19 }} />

            {/* The anchor line — very subtle when calibrated, more visible when not */}
            <div style={{
              width: '100%',
              height: '1px',
              background: isCalibrated
                ? 'rgba(0,212,255,0.08)'
                : `repeating-linear-gradient(to right, rgba(0,212,255,0.35) 0, rgba(0,212,255,0.35) 4px, transparent 4px, transparent 8px)`,
              animation: isCalibrated ? 'none' : 'anchorPulse 2s ease-in-out infinite',
            }} />

            {/* Anchor handle label */}
            <div style={{
              position: 'absolute',
              left: '40px',
              top: '-11px',
              background: 'rgba(0,0,0,0.6)',
              border: `1px solid ${isCalibrated ? 'rgba(0,212,255,0.2)' : 'rgba(0,212,255,0.5)'}`,
              color: isCalibrated ? 'rgba(0,212,255,0.35)' : 'rgba(0,212,255,0.8)',
              fontSize: '8px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              fontFamily: "'JetBrains Mono', monospace",
              userSelect: 'none',
              backdropFilter: 'blur(4px)',
              animation: isCalibrated ? 'none' : 'anchorPulse 2s ease-in-out infinite',
            }}>
              {isCalibrated
                ? `◎ ${formatLinePrice(anchorPrice, instrumentLabel)}`
                : '↕ drag to sync with chart'}
            </div>
          </div>

          {/* ── Reset controls ── */}
          <div style={{
            position: 'absolute', bottom: '10px', left: '10px',
            display: 'flex', gap: '4px', zIndex: 20, pointerEvents: 'auto',
          }}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setVisibleRange(getPriceRange(currentPrice, instrumentLabel));
              }}
              style={{
                cursor: 'pointer',
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
            {isCalibrated && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setAnchorY(containerHeight * 0.5);
                  setAnchorPrice(currentPrice);
                }}
                style={{
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  color: 'rgba(0,212,255,0.35)',
                  fontSize: '9px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '3px',
                  fontFamily: "'JetBrains Mono', monospace",
                  userSelect: 'none', backdropFilter: 'blur(4px)',
                }}
              >
                ↺ reset sync
              </div>
            )}
          </div>

          {/* ── Preview lines (while typing SL/TP) ── */}
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

          {/* ── Confirmed position lines ── */}
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
