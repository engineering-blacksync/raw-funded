import { useEffect, useRef, useState, useCallback } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandleChartProps {
  instrument: string;
  currentPrice: number;
}

type Resolution = '1' | '5' | '15' | '60';

const RESOLUTION_LABELS: Record<Resolution, string> = {
  '1': '1m', '5': '5m', '15': '15m', '60': '1h',
};

const BASE_OPTIONS: Highcharts.Options = {
  chart: {
    backgroundColor: '#09090B',
    style: { fontFamily: "'Barlow', sans-serif" },
    animation: false,
    marginRight: 68,
    marginTop: 4,
    marginBottom: 30,
    zooming: { type: 'x' },
  },
  rangeSelector: {
    enabled: true,
    inputEnabled: false,
    buttonPosition: { align: 'right' },
    buttonTheme: {
      fill: 'rgba(255,255,255,0.05)',
      stroke: 'rgba(255,255,255,0.08)',
      'stroke-width': 1,
      r: 4,
      width: 34,
      height: 18,
      style: { color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: '500' },
      states: {
        hover: { fill: 'rgba(255,255,255,0.12)', style: { color: '#fff' } },
        select: {
          fill: 'rgba(232,197,71,0.18)',
          stroke: 'rgba(232,197,71,0.4)',
          style: { color: '#E8C547', fontWeight: '700' },
        },
      },
    },
    labelStyle: { display: 'none' },
    buttons: [
      { type: 'hour',  count: 4,  text: '4H' },
      { type: 'day',   count: 1,  text: '1D' },
      { type: 'day',   count: 3,  text: '3D' },
      { type: 'week',  count: 1,  text: '1W' },
      { type: 'month', count: 1,  text: '1M' },
      { type: 'all',              text: 'All' },
    ],
    selected: 1,
  },
  navigator: { enabled: false },
  scrollbar: { enabled: false },
  credits: { enabled: false },
  xAxis: {
    type: 'datetime',
    lineColor: 'rgba(255,255,255,0.06)',
    tickColor: 'rgba(255,255,255,0.06)',
    labels: { style: { color: 'rgba(255,255,255,0.35)', fontSize: '10px' } },
    crosshair: { color: 'rgba(255,255,255,0.15)', dashStyle: 'ShortDash' as Highcharts.DashStyleValue },
  },
  yAxis: {
    gridLineColor: 'rgba(255,255,255,0.05)',
    lineColor: 'rgba(255,255,255,0.06)',
    labels: {
      style: { color: 'rgba(255,255,255,0.35)', fontSize: '10px' },
      align: 'left',
      x: 4,
    },
    opposite: true,
    crosshair: { color: 'rgba(255,255,255,0.15)', dashStyle: 'ShortDash' as Highcharts.DashStyleValue },
    plotLines: [],
  },
  tooltip: {
    backgroundColor: 'rgba(10, 10, 14, 0.96)',
    borderColor: 'rgba(255,255,255,0.1)',
    style: { color: '#fff', fontSize: '11px' },
    borderRadius: 6,
    shadow: false,
    useHTML: true,
    formatter: function (this: Highcharts.TooltipFormatterContextObject) {
      const pts = (this as any).points as any[];
      if (!pts?.length) return '';
      const p = pts[0].point;
      const d = new Date(this.x as number);
      const dateStr = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const isUp = p.close >= p.open;
      const col = isUp ? '#22C55E' : '#EF4444';
      const fmt = (v: number) => v?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '';
      return `<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-bottom:3px">${dateStr}</div>` +
        `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${col};white-space:nowrap">` +
        `O&nbsp;${fmt(p.open)}&nbsp;&nbsp;H&nbsp;${fmt(p.high)}&nbsp;&nbsp;L&nbsp;${fmt(p.low)}&nbsp;&nbsp;C&nbsp;<b>${fmt(p.close)}</b>` +
        `</div>`;
    },
    shared: true,
  },
  plotOptions: {
    candlestick: {
      color: '#EF4444',
      upColor: '#22C55E',
      lineColor: '#EF4444',
      upLineColor: '#22C55E',
      lineWidth: 1,
    },
  },
  series: [
    {
      type: 'candlestick',
      name: '',
      data: [],
      animation: false,
      dataGrouping: { enabled: false },
    } as Highcharts.SeriesOptionsType,
  ],
};

export default function CandleChart({ instrument, currentPrice }: CandleChartProps) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const [resolution, setResolution] = useState<Resolution>('5');
  const [loading, setLoading] = useState(true);
  const resolutionRef = useRef<Resolution>(resolution);
  const currentPriceRef = useRef<number>(0);
  const seededRef = useRef(false);

  useEffect(() => { resolutionRef.current = resolution; }, [resolution]);

  const fetchAndLoad = useCallback(async (inst: string, res: Resolution) => {
    setLoading(true);
    seededRef.current = false;
    try {
      const r = await fetch(`/api/candles?instrument=${encodeURIComponent(inst)}&resolution=${res}&count=300`);
      const data: Candle[] = r.ok ? await r.json() : [];
      const chart = chartRef.current?.chart;
      if (!chart) return;

      const series = chart.series[0] as any;
      const ohlc = data.map(c => [c.time, c.open, c.high, c.low, c.close]);
      series.setData(ohlc, true, false, false);

      if (data.length === 0 && currentPriceRef.current > 0) {
        const p = currentPriceRef.current;
        const resSeconds = parseInt(res) * 60;
        const t = Math.floor(Date.now() / (resSeconds * 1000)) * (resSeconds * 1000);
        series.addPoint([t, p, p, p, p], true, false, false);
        seededRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndLoad(instrument, resolution);
  }, [instrument, resolution, fetchAndLoad]);

  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    currentPriceRef.current = currentPrice;

    const chart = chartRef.current?.chart;
    if (!chart || !chart.series?.[0]) return;

    const series = chart.series[0] as any;
    const resSeconds = parseInt(resolutionRef.current) * 60;
    const now = Date.now();
    const candleTime = Math.floor(now / (resSeconds * 1000)) * (resSeconds * 1000);
    const points = series.points;

    if (points.length === 0) {
      series.addPoint([candleTime, currentPrice, currentPrice, currentPrice, currentPrice], false, false, false);
      chart.redraw(false);
      seededRef.current = true;
    } else {
      const lastPoint = points[points.length - 1];
      if (lastPoint.x === candleTime) {
        const newHigh = Math.max(lastPoint.high as number, currentPrice);
        const newLow = Math.min(lastPoint.low as number, currentPrice);
        lastPoint.update([candleTime, lastPoint.open as number, newHigh, newLow, currentPrice], false, false);
        chart.redraw(false);
      } else if (lastPoint.x < candleTime) {
        series.addPoint([candleTime, currentPrice, currentPrice, currentPrice, currentPrice], false, false, false);
        chart.redraw(false);
      }
    }

    const yAxis = chart.yAxis[0] as any;
    yAxis.update({
      plotLines: [{
        id: 'live-price',
        value: currentPrice,
        color: '#E8C547',
        width: 1,
        dashStyle: 'ShortDash',
        zIndex: 5,
        label: {
          text: currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          align: 'left',
          x: 4,
          style: {
            color: '#E8C547',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: '600',
          },
        },
      }],
    }, false);
    chart.redraw(false);
  }, [currentPrice]);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: '#09090B' }}>
      <div
        className="flex items-center gap-1 px-3 py-1.5 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        {(Object.keys(RESOLUTION_LABELS) as Resolution[]).map(r => (
          <button
            key={r}
            onClick={() => setResolution(r)}
            className="px-2.5 py-0.5 rounded transition-all"
            style={{
              fontSize: '11px',
              background: resolution === r ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: resolution === r ? '#fff' : 'rgba(255,255,255,0.35)',
              fontWeight: resolution === r ? '600' : '400',
            }}
            data-testid={`resolution-${r}`}
          >
            {RESOLUTION_LABELS[r]}
          </button>
        ))}
        <div className="flex-1" />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em' }}>
          {instrument}
        </span>
      </div>

      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#09090B' }}>
            <div
              className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(232,197,71,0.35)', borderTopColor: '#E8C547' }}
            />
          </div>
        )}
        <HighchartsReact
          highcharts={Highcharts}
          constructorType="stockChart"
          options={BASE_OPTIONS}
          ref={chartRef}
          containerProps={{
            style: { width: '100%', height: '100%', position: 'absolute', inset: 0 },
          }}
        />
      </div>
    </div>
  );
}
