import React, { useMemo } from "react";

export function StatCard({ title, value, subtext }: { title: string, value: string | React.ReactNode, subtext: string }) {
  return (
    <div className="bg-[#0F0F12] border border-[#222228] rounded-xl p-3 flex flex-col justify-between h-full hover:border-[#2E2E36] transition-colors">
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">{title}</span>
        <svg className="w-2.5 h-2.5 text-[#71717A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-lg font-semibold text-white mb-2 tracking-tight flex items-end data-number">{value}</div>
      <div className="flex items-center gap-1 text-[9px] font-medium text-[#52525B]">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        {subtext}
      </div>
    </div>
  );
}

interface DateStat {
  trades: number;
  pnl: number;
  wins: number;
}

export function CalendarGrid({ dateStats }: { dateStats?: Record<string, DateStat> }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const { year, month, calendarDays, weekSummaries } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    
    const cells: Array<{ dayNum: number | null; dateKey: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ dayNum: null, dateKey: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, dateKey });
    }
    while (cells.length % 7 !== 0) cells.push({ dayNum: null, dateKey: null });

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const summaries = weeks.map((week, idx) => {
      let pnl = 0;
      let tradingDays = 0;
      week.forEach(cell => {
        if (cell.dateKey && dateStats?.[cell.dateKey]) {
          pnl += dateStats[cell.dateKey].pnl;
          tradingDays++;
        }
      });
      return { week: idx + 1, pnl, tradingDays };
    });

    return { year: y, month: m, calendarDays: weeks, weekSummaries: summaries };
  }, [dateStats]);

  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long' });

  return (
    <div className="bg-[#111113] border border-[#222228] rounded-xl p-6">
      <div className="text-sm text-[#A1A1AA] font-medium mb-3 uppercase tracking-wide">{monthName} {year}</div>
      <div className="grid grid-cols-8 gap-3 mb-3 text-center text-xs font-medium text-[#71717A] uppercase tracking-wider">
        {days.map(d => <div key={d}>{d}</div>)}
        <div>Weekly</div>
      </div>
      
      <div className="grid grid-cols-8 gap-3">
        {calendarDays.map((week, weekIdx) => (
          <React.Fragment key={weekIdx}>
            {week.map((cell, dayIdx) => {
              if (cell.dayNum === null) {
                return (
                  <div key={dayIdx} className="aspect-[4/3] bg-[#111113] border border-[#1C1C22] rounded-lg diagonal-stripes" />
                );
              }
              const stat = cell.dateKey ? dateStats?.[cell.dateKey] : undefined;
              const hasTrades = stat && stat.trades > 0;
              const isProfit = hasTrades && stat.pnl >= 0;
              const borderColor = hasTrades
                ? (isProfit ? 'border-[#36B37E]/40' : 'border-[#EF4444]/40')
                : 'border-[#222228]';
              return (
                <div
                  key={dayIdx}
                  className={`aspect-[4/3] bg-[#1A1A1F] ${borderColor} border rounded-lg p-2 flex flex-col items-center justify-center relative hover:bg-[#222228] transition-colors cursor-pointer`}
                >
                  <span className="absolute top-1.5 right-2 text-[10px] text-[#A1A1AA]">{cell.dayNum}</span>
                  {hasTrades && (
                    <>
                      <span className={`${isProfit ? 'text-[#36B37E]' : 'text-[#EF4444]'} font-semibold text-sm data-number`}>
                        {isProfit ? '+' : ''}${stat.pnl.toFixed(0)}
                      </span>
                      <div className="flex flex-col items-center text-[10px] text-[#71717A] mt-0.5 leading-tight">
                        <span>{stat.trades} trade{stat.trades !== 1 ? 's' : ''}</span>
                        <span>{stat.trades > 0 ? Math.round((stat.wins / stat.trades) * 100) : 0}% win</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            <div className="aspect-[4/3] bg-transparent border border-[#2E2E36] rounded-lg p-2 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-[#71717A] mb-1">Week {weekSummaries[weekIdx].week}</span>
              <span className={`font-semibold text-sm data-number ${weekSummaries[weekIdx].pnl >= 0 ? 'text-[#36B37E]' : 'text-[#EF4444]'}`}>
                {weekSummaries[weekIdx].pnl >= 0 ? '+' : ''}${weekSummaries[weekIdx].pnl.toFixed(2)}
              </span>
              <span className="text-[10px] text-[#71717A] mt-0.5">{weekSummaries[weekIdx].tradingDays} day{weekSummaries[weekIdx].tradingDays !== 1 ? 's' : ''}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      
      <style>{`
        .diagonal-stripes {
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255, 255, 255, 0.02) 10px,
            rgba(255, 255, 255, 0.02) 20px
          );
        }
      `}</style>
    </div>
  );
}
