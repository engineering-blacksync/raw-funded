import { useState } from "react";
import { Link } from "wouter";
import { LogOut, Activity, BarChart2, Shield, Settings, CreditCard, ChevronDown, Check } from "lucide-react";
import Terminal from "@/components/dashboard/Terminal";
import { BalanceCard } from "@/components/ui/analytics-bento";
import { StatCard, CalendarGrid } from "@/components/ui/data-components";
import { TIERS } from "@/lib/constants";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("terminal");
  
  // Mock User State
  const user = {
    username: "trader123",
    tier: "unverified", // switch this to test other states
    balance: 10000.00,
    triesUsed: 1,
    triesVisible: true
  };

  const currentTier = TIERS[user.tier as keyof typeof TIERS];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Banner for Unverified if tries > 0 */}
      {user.tier === "unverified" && user.triesVisible && (
        <div className="bg-gold text-black px-4 py-2 flex justify-center items-center gap-2 text-sm font-bold font-heading tracking-wide z-50">
          <span className="text-lg">⚠</span>
          TRY {user.triesUsed + 1} OF 3 — PROVE YOUR FUNDED STATUS TO REMOVE THIS LIMIT ENTIRELY 
          <Link href="/dashboard/verification" className="underline ml-2">VERIFY NOW →</Link>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-b1 bg-s1 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 mr-4">
            <span className="font-heading text-xl text-white tracking-wider">RAW</span>
            <span className="font-heading text-xl text-gold tracking-wider">FUNDED</span>
          </Link>

          {/* Ticker */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">XAUUSD</span>
              <span className="text-white">2641.80</span>
              <span className="text-green">+0.34%</span>
            </div>
            <div className="w-px h-3 bg-b1"></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">MNQ</span>
              <span className="text-white">21204.00</span>
              <span className="text-green">+0.67%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Balance</span>
            <span className="data-number text-lg text-white font-bold">${user.balance.toFixed(2)}</span>
          </div>

          <div 
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider border"
            style={{ color: currentTier.color, borderColor: currentTier.color }}
          >
            {currentTier.label}
          </div>

          <button className="bg-gold text-black text-xs font-bold uppercase px-4 py-2 hover:bg-white transition-colors" data-testid="btn-withdraw">
            Withdraw
          </button>

          <div className="w-px h-6 bg-b1 mx-2"></div>

          <div className="flex items-center gap-2 cursor-pointer hover:bg-s2 p-2 rounded transition-colors">
            <div className="w-8 h-8 bg-s2 border border-b2 flex items-center justify-center rounded-full text-sm font-bold text-white">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 md:w-56 border-r border-b1 bg-s1 flex flex-col py-4 shrink-0">
          <nav className="flex-1 space-y-2 px-2">
            {[
              { id: 'terminal', icon: Activity, label: 'Terminal' },
              { id: 'data', icon: BarChart2, label: 'Your Data' },
              { id: 'leaderboard', icon: Shield, label: 'Leaderboard' },
              { id: 'verification', icon: Check, label: 'Verification' },
              { id: 'withdraw', icon: CreditCard, label: 'Withdraw' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded text-left transition-colors ${activeTab === item.id ? 'bg-s2 text-white border border-b2' : 'text-muted-foreground hover:bg-s2/50 hover:text-white'}`}
                data-testid={`tab-${item.id}`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="hidden md:block font-medium text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
          
          <div className="px-2 mt-auto pt-4 border-t border-b1">
            <button className="w-full flex items-center gap-3 p-3 rounded text-left text-muted-foreground hover:bg-s2/50 hover:text-white transition-colors">
              <Settings className="w-5 h-5 shrink-0" />
              <span className="hidden md:block font-medium text-sm">Settings</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded text-left text-red/70 hover:bg-red/10 hover:text-red transition-colors mt-2">
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="hidden md:block font-medium text-sm">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col bg-background">
          {activeTab === 'terminal' && <Terminal tier={currentTier} userTierName={user.tier} />}
          {activeTab === 'data' && (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-6xl mx-auto space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                  {/* Balance Card - spans 2 columns */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-2">
                    <BalanceCard />
                  </div>
                  
                  {/* Stats */}
                  <div className="col-span-1">
                    <StatCard 
                      title="Net P&L" 
                      value={<span className="text-[#36B37E]">$1,340.00</span>}
                      subtext="Track your daily change" 
                    />
                  </div>
                  <div className="col-span-1">
                    <StatCard 
                      title="Win Rate" 
                      value={
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>73.68%</span>
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full border-4 border-[#36B37E] border-l-[#EF4444] border-b-[#EF4444] rotate-45 relative shrink-0">
                            <div className="absolute -bottom-2 -right-4 bg-white text-black text-[9px] px-1 rounded -rotate-45 font-bold">73.68%</div>
                          </div>
                        </div>
                      }
                      subtext="Track your daily change" 
                    />
                  </div>
                  <div className="col-span-1">
                    <StatCard 
                      title="Profit Factor" 
                      value={
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>3.16</span>
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full border-4 border-[#36B37E] border-r-transparent border-t-[#EF4444] shrink-0"></div>
                        </div>
                      }
                      subtext="Track your daily change" 
                    />
                  </div>
                  <div className="col-span-1">
                    <StatCard 
                      title="Avg. Win/Loss Ratio" 
                      value={<span>1.13</span>}
                      subtext="Track your daily change" 
                    />
                  </div>
                </div>
                
                {/* Calendar View */}
                <div>
                  <CalendarGrid />
                </div>
                
                {/* Bottom Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-s1 border border-b1 p-4 rounded-xl flex gap-8">
                    <div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mb-1">Most Active <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                      <div className="text-xl font-medium text-white">Monday</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mb-1">Most Profitable <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                      <div className="text-xl font-medium text-[#36B37E]">Friday<br/>$908.20</div>
                    </div>
                  </div>
                  
                  <div className="bg-s1 border border-b1 p-4 rounded-xl flex flex-col justify-between">
                     <div className="text-sm text-muted-foreground flex items-center gap-1">Drawdown Curve <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                     <div className="h-10 border-b border-b2 flex items-end relative">
                       <span className="text-[10px] text-muted-foreground absolute -left-2 -bottom-2">$0</span>
                     </div>
                  </div>
                  
                  <div className="bg-s1 border border-b1 p-4 rounded-xl flex flex-col justify-between">
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">Trade Duration <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div className="flex justify-between text-sm mb-2">
                      <div className="text-muted-foreground">Avg Win <span className="text-[#36B37E] font-medium ml-1">$74.72</span></div>
                      <div className="text-muted-foreground">Avg Loss <span className="text-[#EF4444] font-medium ml-1">-$30.10</span></div>
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Trade Duration <span className="text-white font-medium ml-1">4 mins 55 secs</span></div>
                  </div>
                </div>

              </div>
            </div>
          )}
          {activeTab !== 'terminal' && activeTab !== 'data' && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <h2 className="text-2xl text-white mb-2 uppercase font-heading">{activeTab}</h2>
                <p>Component under construction in Mockup mode.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}