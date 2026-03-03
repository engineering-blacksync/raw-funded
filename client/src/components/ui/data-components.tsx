import React from "react";

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

export function CalendarGrid() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  return (
    <div className="bg-[#111113] border border-[#222228] rounded-xl p-6">
      <div className="grid grid-cols-8 gap-3 mb-3 text-center text-xs font-medium text-[#71717A] uppercase tracking-wider">
        {days.map(d => <div key={d}>{d}</div>)}
        <div>Weekly</div>
      </div>
      
      <div className="grid grid-cols-8 gap-3">
        {/* Week 1 */}
        <div className="aspect-[4/3] bg-[#1A1A1F] border border-[#36B37E]/40 rounded-lg p-2 flex flex-col items-center justify-center relative hover:bg-[#222228] transition-colors cursor-pointer group">
          <span className="absolute top-1.5 right-2 text-[10px] text-[#A1A1AA]">1</span>
          <span className="text-[#36B37E] font-semibold text-lg">$609</span>
          <div className="flex flex-col items-center text-[10px] text-[#71717A] mt-0.5 leading-tight">
            <span>7 trades</span>
            <span>86% win rate</span>
          </div>
        </div>
        <div className="aspect-[4/3] bg-[#1A1A1F] border border-[#36B37E]/40 rounded-lg p-2 flex flex-col items-center justify-center relative hover:bg-[#222228] transition-colors cursor-pointer group">
          <span className="absolute top-1.5 right-2 text-[10px] text-[#A1A1AA]">2</span>
          <span className="text-[#36B37E] font-semibold text-lg">$319.6</span>
          <div className="flex flex-col items-center text-[10px] text-[#71717A] mt-0.5 leading-tight">
            <span>16 trades</span>
            <span>69% win rate</span>
          </div>
        </div>
        {[3,4,5,6,7].map(d => (
          <div key={d} className="aspect-[4/3] bg-[#1A1A1F] border border-[#222228] rounded-lg relative hover:bg-[#222228] transition-colors cursor-pointer">
            <span className="absolute top-1.5 right-2 text-[10px] text-[#52525B]">{d}</span>
          </div>
        ))}
        {/* Weekly Summary */}
        <div className="aspect-[4/3] bg-transparent border border-[#2E2E36] rounded-lg p-2 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-[#71717A] mb-1">Week 1</span>
          <span className="text-[#36B37E] font-semibold text-sm">$928.60</span>
          <span className="text-[10px] text-[#71717A] mt-0.5">2 days</span>
        </div>

        {/* Mock Remaining Weeks */}
        {Array.from({ length: 4 }).map((_, weekIdx) => (
          <React.Fragment key={weekIdx}>
            {Array.from({ length: 7 }).map((_, dayIdx) => {
              const dayNum = 8 + weekIdx * 7 + dayIdx;
              const isStriped = dayNum > 31;
              return (
                <div key={dayIdx} className={`aspect-[4/3] rounded-lg relative hover:bg-[#222228] transition-colors cursor-pointer ${isStriped ? 'bg-[#111113] border border-[#1C1C22] diagonal-stripes' : 'bg-[#1A1A1F] border border-[#222228]'}`}>
                  <span className={`absolute top-1.5 right-2 text-[10px] ${isStriped ? 'text-[#3F3F46]' : 'text-[#52525B]'}`}>
                    {dayNum <= 31 ? dayNum : (dayNum) % 31}
                  </span>
                </div>
              )
            })}
            <div className="aspect-[4/3] bg-transparent border border-[#2E2E36] rounded-lg p-2 flex flex-col items-center justify-center text-center opacity-50">
              <span className="text-[10px] text-[#71717A] mb-1">Week {weekIdx + 2}</span>
              <span className="text-white font-semibold text-sm">$0.00</span>
              <span className="text-[10px] text-[#71717A] mt-0.5">0 days</span>
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