import { useRef, useState, useCallback, useEffect } from 'react';

interface Position {
  id: string;
  instrument: string;
  side: string;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  size: number;
}

interface PositionLinesProps {
  positions: Position[];
  currentPrice: number;
  instrumentLabel: string;
  onUpdateSL: (tradeId: string, newPrice: number | null) => void;
  onUpdateTP: (tradeId: string, newPrice: number | null) => void;
}

function getPriceRange(price: number, instrument: string): number {
  if (['Bitcoin'].includes(instrument)) return price * 0.015;
  if (['Gold (GC)', 'MGC'].includes(instrument)) return price * 0.005;
  if (['Silver', 'SIL'].includes(instrument)) return price * 0.008;
  if (['Oil (WTI)', 'MCL'].includes(instrument)) return price * 0.008;
  if (['S&P 500', 'MES'].includes(instrument)) return price * 0.005;
  if (['Nasdaq', 'MNQ'].includes(instrument)) return price * 0.005;
  return price * 0.01;
}

function formatLinePrice(price: number, instrument: string): string {
  if (['Bitcoin', 'S&P 500', 'Nasdaq', 'MNQ', 'MES'].includes(instrument)) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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
}

function PriceLine({ price, label, color, dashed, yPercent, draggable, onDrag, containerHeight, currentPrice, visibleRange, instrument }: LineProps) {
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startPriceRef = useRef(price);
  const lastPriceRef = useRef(price);

  const displayPrice = dragY !== null ? lastPriceRef.current : price;

  const yPos = dragY !== null ? dragY : yPercent * containerHeight;

  const visible = yPos >= -20 && yPos <= containerHeight + 20;

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
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startYRef.current;
      const pxPerPrice = containerHeight / (visibleRange * 2);
      const priceDelta = -deltaY / pxPerPrice;
      const newPrice = startPriceRef.current + priceDelta;
      lastPriceRef.current = newPrice;
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
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, containerHeight, visibleRange, currentPrice, onDrag]);

  if (!visible) return null;

  return (
    <div
      ref={lineRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      style={{
        position: 'absolute',
        top: `${yPos}px`,
        left: 0,
        right: 0,
        zIndex: 10,
        cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'default',
        pointerEvents: 'auto',
        transform: 'translateY(-50%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: draggable ? '12px' : '1px',
          top: draggable ? '-6px' : '0',
        }}
      />
      <div
        style={{
          width: '100%',
          height: '1px',
          background: dashed
            ? `repeating-linear-gradient(to right, ${color} 0, ${color} 6px, transparent 6px, transparent 12px)`
            : color,
          opacity: dragging ? 1 : 0.8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '4px',
          top: '-10px',
          background: color,
          color: color === '#ffffff' ? '#000' : '#fff',
          fontSize: '9px',
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.02em',
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          userSelect: 'none',
        }}
      >
        {label} {formatLinePrice(displayPrice, instrument)}
      </div>
      {draggable && (
        <div
          style={{
            position: 'absolute',
            left: '4px',
            top: '-8px',
            fontSize: '8px',
            color: color,
            opacity: dragging ? 1 : 0.5,
            userSelect: 'none',
            fontWeight: 700,
          }}
        >
          ⋮⋮
        </div>
      )}
    </div>
  );
}

export default function PositionLines({ positions, currentPrice, instrumentLabel, onUpdateSL, onUpdateTP }: PositionLinesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    setContainerHeight(containerRef.current.clientHeight);
    return () => observer.disconnect();
  }, []);

  if (!currentPrice || currentPrice <= 0 || positions.length === 0 || containerHeight === 0) {
    return <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
  }

  const visibleRange = getPriceRange(currentPrice, instrumentLabel);

  const priceToY = (p: number) => {
    const ratio = (currentPrice - p) / (visibleRange * 2) + 0.5;
    return ratio;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {positions.map(pos => {
        const entryY = priceToY(pos.entryPrice);
        const lines = [
          <PriceLine
            key={`entry-${pos.id}`}
            price={pos.entryPrice}
            label="ENTRY"
            color="#ffffff"
            dashed
            yPercent={entryY}
            containerHeight={containerHeight}
            currentPrice={currentPrice}
            visibleRange={visibleRange}
            instrument={instrumentLabel}
          />,
        ];

        if (pos.takeProfit) {
          lines.push(
            <PriceLine
              key={`tp-${pos.id}`}
              price={pos.takeProfit}
              label="TP"
              color="#22C55E"
              yPercent={priceToY(pos.takeProfit)}
              draggable
              onDrag={(newPrice) => onUpdateTP(pos.id, newPrice)}
              containerHeight={containerHeight}
              currentPrice={currentPrice}
              visibleRange={visibleRange}
              instrument={instrumentLabel}
            />
          );
        }

        if (pos.stopLoss) {
          lines.push(
            <PriceLine
              key={`sl-${pos.id}`}
              price={pos.stopLoss}
              label="SL"
              color="#EF4444"
              yPercent={priceToY(pos.stopLoss)}
              draggable
              onDrag={(newPrice) => onUpdateSL(pos.id, newPrice)}
              containerHeight={containerHeight}
              currentPrice={currentPrice}
              visibleRange={visibleRange}
              instrument={instrumentLabel}
            />
          );
        }

        return lines;
      })}
    </div>
  );
}
