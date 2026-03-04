"use client"

import type React from "react"
import { useState, useRef, useMemo } from "react"

export function BalanceCard({ balance = 10000, equityCurve, totalPnl }: { balance?: number; equityCurve?: number[]; totalPnl?: number }) {
  const weekData = useMemo(() => {
    if (equityCurve && equityCurve.length > 1) {
      const step = Math.max(1, Math.floor(equityCurve.length / 7));
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days.map((day, i) => ({
        day,
        value: balance - (totalPnl ?? 0) + (equityCurve[Math.min(i * step, equityCurve.length - 1)] ?? 0),
      }));
    }
    return [
      { day: 'Sun', value: balance },
      { day: 'Mon', value: balance },
      { day: 'Tue', value: balance },
      { day: 'Wed', value: balance },
      { day: 'Thu', value: balance },
      { day: 'Fri', value: balance },
      { day: 'Sat', value: balance },
    ];
  }, [equityCurve, balance, totalPnl]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(6)
  const chartRef = useRef<SVGSVGElement>(null)

  const maxValue = Math.max(...weekData.map((d) => d.value))
  const minValue = Math.min(...weekData.map((d) => d.value))
  const chartHeight = 100
  const chartWidth = 300
  const padding = { top: 20, bottom: 25, left: 8, right: 8 }

  const getY = (value: number) => {
    const range = maxValue - minValue || 1
    const normalized = (value - minValue) / range
    return chartHeight - padding.bottom - normalized * (chartHeight - padding.top - padding.bottom)
  }

  const getX = (index: number) => {
    return padding.left + (index / (weekData.length - 1)) * (chartWidth - padding.left - padding.right)
  }

  const generatePath = () => {
    const points = weekData.map((d, i) => ({ x: getX(i), y: getY(d.value) }))

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] || p2

      const tension = 0.35
      const cp1x = p1.x + (p2.x - p0.x) * tension
      const cp1y = p1.y + (p2.y - p0.y) * tension
      const cp2x = p2.x - (p3.x - p1.x) * tension
      const cp2y = p2.y - (p3.y - p1.y) * tension

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }

    return path
  }

  const generateAreaPath = () => {
    const linePath = generatePath()
    const lastPoint = weekData.length - 1
    return `${linePath} L ${getX(lastPoint)} ${chartHeight - padding.bottom} L ${getX(0)} ${chartHeight - padding.bottom} Z`
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current) return
    const rect = chartRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const relativeX = (x / rect.width) * chartWidth

    let closestIndex = 0
    let closestDist = Number.POSITIVE_INFINITY
    weekData.forEach((_, i) => {
      const dist = Math.abs(getX(i) - relativeX)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })
    setHoveredIndex(closestIndex)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(6) // default to last day
  }

  const scatteredDots = useMemo(
    () =>
      Array.from({ length: 35 }, (_, i) => ({
        x: 40 + (i % 7) * 42 + (Math.random() - 0.5) * 30,
        y: padding.top + 15 + Math.floor(i / 7) * 15 + (Math.random() - 0.5) * 10,
        opacity: 0.4 + Math.random() * 0.4,
        size: 1.2 + Math.random() * 1.8,
      })),
    [],
  )

  return (
    <div className="bg-[#0F0F12] border border-[#222228] rounded-xl p-3 h-full flex flex-col hover:border-[#2E2E36] transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[10px] font-medium tracking-wide text-[#A1A1AA] uppercase">Balance</p>
            <h2 className="mt-0.5 text-lg font-semibold leading-[1] tracking-[-0.02em] text-white data-number">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[#222228] bg-[#141418] px-2 py-0.5">
              <span className={`text-[9px] font-semibold data-number ${(totalPnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {(totalPnl ?? 0) >= 0 ? '+' : ''} ${(totalPnl ?? 0).toFixed(2)}
              </span>
              {(totalPnl ?? 0) >= 0 ? (
                <svg width="8" height="8" viewBox="0 0 16 16" fill="none" className="text-[#22C55E]">
                  <path d="M2 11L6 7L9 10L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 4H14V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="8" height="8" viewBox="0 0 16 16" fill="none" className="text-[#EF4444]">
                  <path d="M2 5L6 9L9 6L14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 12H14V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-auto pt-1">
          <svg
            ref={chartRef}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: "default" }}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8C547" stopOpacity="0.35" className="dark:stop-opacity-40" />
                <stop offset="50%" stopColor="#E8C547" stopOpacity="0.15" className="dark:stop-opacity-20" />
                <stop offset="100%" stopColor="#E8C547" stopOpacity="0.02" className="dark:stop-opacity-5" />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E8C547" />
                <stop offset="100%" stopColor="#E8C547" />
              </linearGradient>
              <filter id="tooltipShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.2" />
              </filter>
              <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Vertical dashed lines */}
            {weekData.map((_, i) => (
              <line
                key={i}
                x1={getX(i)}
                y1={padding.top}
                x2={getX(i)}
                y2={chartHeight - padding.bottom}
                className="stroke-border transition-opacity duration-200"
                strokeWidth="1"
                strokeDasharray="3 5"
                opacity={hoveredIndex === i ? 0.8 : 0.5}
              />
            ))}

            {/* Scattered decorative dots */}
            {scatteredDots.map((dot, i) => (
              <circle key={i} cx={dot.x} cy={dot.y} r={dot.size} className="fill-card" opacity={dot.opacity} />
            ))}

            {/* Area fill */}
            <path d={generateAreaPath()} fill="url(#areaGradient)" className="transition-all duration-300" />

            {/* Main curve line */}
            <path
              d={generatePath()}
              fill="none"
              stroke="#E8C547"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover data point */}
            {hoveredIndex !== null && (
              <g className="transition-all duration-150 ease-out">
                {/* Outer glow ring */}
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(weekData[hoveredIndex].value)}
                  r="12"
                  className="fill-card"
                  opacity="0.5"
                />
                {/* White fill circle */}
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(weekData[hoveredIndex].value)}
                  r="8"
                  className="fill-card"
                  stroke="#E8C547"
                  strokeWidth="3"
                  filter="url(#dotGlow)"
                />
              </g>
            )}

            {/* Day labels */}
            {weekData.map((d, i) => (
              <text
                key={i}
                x={getX(i)}
                y={chartHeight - 8}
                textAnchor="middle"
                className="text-[9px] font-medium fill-muted-foreground"
              >
                {d.day}
              </text>
            ))}
          </svg>

        </div>
    </div>
  )
}

function MoneyIllustration() {
  return (
    <svg viewBox="0 0 130 110" className="h-full w-full drop-shadow-lg">
      <defs>
        <linearGradient id="bill1" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#141418" />
          <stop offset="40%" stopColor="#1C1C22" />
          <stop offset="100%" stopColor="#222228" />
        </linearGradient>
        <linearGradient id="bill2" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#141418" />
          <stop offset="50%" stopColor="#1C1C22" />
          <stop offset="100%" stopColor="#222228" />
        </linearGradient>
        <linearGradient id="bill3" x1="0" y1="0" x2="0.1" y2="1">
          <stop offset="0%" stopColor="#141418" />
          <stop offset="100%" stopColor="#1C1C22" />
        </linearGradient>
        <linearGradient id="holeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#222228" />
          <stop offset="100%" stopColor="#2E2E36" />
        </linearGradient>
        <filter id="billShadow1" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000" floodOpacity="0.05" />
        </filter>
        <filter id="billShadow2" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.1" />
        </filter>
        <filter id="billShadow3" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
        </filter>
        <filter id="innerShadow">
          <feOffset dx="0" dy="1" />
          <feGaussianBlur stdDeviation="1" result="shadow" />
          <feComposite in="SourceGraphic" in2="shadow" operator="over" />
        </filter>
      </defs>

      {/* Back bill - most tilted */}
      <g transform="translate(8, 12) rotate(-20, 40, 25)" filter="url(#billShadow1)">
        <rect x="0" y="0" width="80" height="48" rx="6" fill="url(#bill1)" />
        {/* Circles - filled to match reference */}
        <circle cx="62" cy="14" r="7" fill="url(#holeGrad)" />
        <circle cx="62" cy="34" r="5" fill="url(#holeGrad)" />
      </g>

      {/* Middle bill */}
      <g transform="translate(22, 28) rotate(-10, 40, 25)" filter="url(#billShadow2)">
        <rect x="0" y="0" width="80" height="48" rx="6" fill="url(#bill2)" />
        <circle cx="62" cy="14" r="7" fill="url(#holeGrad)" />
        <circle cx="62" cy="34" r="5" fill="url(#holeGrad)" />
      </g>

      {/* Front bill - least tilted */}
      <g transform="translate(38, 44) rotate(-2, 40, 25)" filter="url(#billShadow3)">
        <rect x="0" y="0" width="80" height="48" rx="6" fill="url(#bill3)" />
        <circle cx="62" cy="14" r="7" fill="url(#holeGrad)" />
        <circle cx="62" cy="34" r="5" fill="url(#holeGrad)" />
      </g>
    </svg>
  )
}
