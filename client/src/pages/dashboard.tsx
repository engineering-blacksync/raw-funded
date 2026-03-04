import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Activity, BarChart2, Shield, Check, CreditCard, ChevronDown, Settings, Clock } from "lucide-react";
import Terminal from "@/components/dashboard/Terminal";
import { BalanceCard } from "@/components/ui/analytics-bento";
import { StatCard, CalendarGrid } from "@/components/ui/data-components";
import { TIERS } from "@/lib/constants";
import { useAuth } from "@/lib/auth";

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function useNYTime() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("terminal");
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const nyTime = useNYTime();

  const { data: tradeStats } = useQuery({
    queryKey: ["/api/trades/stats"],
    enabled: isAuthenticated,
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ["/api/trades/analytics"],
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  const { data: trades } = useQuery({
    queryKey: ["/api/trades"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    setLocation("/login");
    return null;
  }

  const currentTier = TIERS[user.tier as keyof typeof TIERS] || TIERS.unverified;
  const stats = tradeStats as any;

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {user.tier === "unverified" && (
        <div className="bg-gold text-black px-4 py-2 flex justify-center items-center gap-2 text-sm font-bold font-heading tracking-wide z-50">
          <span className="text-lg">⚠</span>
          TRY {(user.triesUsed || 0) + 1} OF 3 — PROVE YOUR FUNDED STATUS TO REMOVE THIS LIMIT ENTIRELY 
          <button onClick={() => setActiveTab("verification")} className="underline ml-2">VERIFY NOW →</button>
        </div>
      )}

      <header className="h-16 border-b border-b1 bg-s1 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 mr-4">
            <span className="font-heading text-xl text-white tracking-wider">RAW</span>
            <span className="font-heading text-xl text-gold tracking-wider">FUNDED</span>
          </Link>

          <div className="hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground bg-s2 border border-b1 rounded px-2 py-1 mr-2">
            <Clock className="w-3 h-3 text-gold" />
            <span className="uppercase tracking-wider font-medium">NY</span>
            <span className="data-number text-white font-semibold">{nyTime}</span>
          </div>

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
            <span className="data-number text-lg text-white font-bold">${(user.balance || 10000).toFixed(2)}</span>
          </div>

          <div 
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider border"
            style={{ color: currentTier.color, borderColor: currentTier.color }}
          >
            {currentTier.label}
          </div>

          <button onClick={() => setActiveTab("withdraw")} className="bg-gold text-black text-xs font-bold uppercase px-4 py-2 hover:bg-white transition-colors" data-testid="btn-withdraw">
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
        <aside className="w-14 border-r border-b1 bg-s1 flex flex-col py-3 shrink-0">
          <nav className="flex-1 flex flex-col items-center gap-1">
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
                title={item.label}
                className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${activeTab === item.id ? 'bg-s2 text-white border border-b2' : 'text-muted-foreground hover:bg-s2/50 hover:text-white'}`}
                data-testid={`tab-${item.id}`}
              >
                <item.icon className="w-5 h-5" />
              </button>
            ))}
          </nav>
          
          <div className="flex flex-col items-center gap-1 mt-auto pt-3 border-t border-b1">
            <button title="Settings" className="w-10 h-10 flex items-center justify-center rounded text-muted-foreground hover:bg-s2/50 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} title="Logout" className="w-10 h-10 flex items-center justify-center rounded text-red/70 hover:bg-red/10 hover:text-red transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col bg-background">
          {activeTab === 'terminal' && <Terminal tier={currentTier} userTierName={user.tier} />}
          {activeTab === 'data' && (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-6xl mx-auto space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <div>
                    <BalanceCard balance={user.balance} equityCurve={analytics?.equityCurve} totalPnl={analytics?.totalPnl} />
                  </div>
                  <div>
                    <StatCard 
                      title="Net P&L" 
                      value={<span className={`${(stats?.totalPnl ?? 0) >= 0 ? 'text-[#36B37E]' : 'text-[#EF4444]'}`}>${(stats?.totalPnl ?? 0).toFixed(2)}</span>}
                      subtext={`${analytics?.totalTrades ?? 0} closed trades`} 
                    />
                  </div>
                  <div>
                    <StatCard 
                      title="Win Rate" 
                      value={
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{(stats?.winRate ?? 0).toFixed(1)}%</span>
                          <div className="text-xs text-muted-foreground">
                            <span className="text-[#36B37E]">{analytics?.wins ?? 0}W</span>
                            {' / '}
                            <span className="text-[#EF4444]">{analytics?.losses ?? 0}L</span>
                          </div>
                        </div>
                      }
                      subtext={`${analytics?.totalTrades ?? 0} total trades`} 
                    />
                  </div>
                  <div>
                    <StatCard 
                      title="Profit Factor" 
                      value={<span>{stats?.profitFactor != null ? (!isFinite(stats.profitFactor) ? '∞' : stats.profitFactor.toFixed(2)) : '0.00'}</span>}
                      subtext="Gross profit / gross loss" 
                    />
                  </div>
                  <div>
                    <StatCard 
                      title="Avg. Win/Loss" 
                      value={<span>{(stats?.avgWinLoss ?? 0).toFixed(2)}</span>}
                      subtext={`Best: $${(analytics?.bestTrade ?? 0).toFixed(2)} / Worst: $${(analytics?.worstTrade ?? 0).toFixed(2)}`} 
                    />
                  </div>
                </div>
                
                <div>
                  <CalendarGrid dateStats={analytics?.dateStats} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-s1 border border-b1 p-4 rounded-xl flex gap-8">
                    <div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mb-1">Most Active</div>
                      <div className="text-xl font-medium text-white">{analytics?.mostActiveDay?.day ?? '—'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{analytics?.mostActiveDay?.trades ?? 0} trades</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mb-1">Most Profitable</div>
                      <div className={`text-xl font-medium ${(analytics?.mostProfitableDay?.pnl ?? 0) >= 0 ? 'text-[#36B37E]' : 'text-[#EF4444]'}`}>
                        {analytics?.mostProfitableDay?.day ?? '—'}
                        {analytics?.mostProfitableDay?.pnl != null && <><br/>${analytics.mostProfitableDay.pnl.toFixed(2)}</>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-s1 border border-b1 p-4 rounded-xl flex flex-col justify-between">
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">Equity Curve</div>
                    {analytics?.equityCurve?.length > 1 ? (
                      <svg viewBox={`0 0 ${Math.max(analytics.equityCurve.length * 4, 100)} 50`} className="w-full h-12" preserveAspectRatio="none">
                        {(() => {
                          const curve = analytics.equityCurve as number[];
                          const maxV = Math.max(...curve);
                          const minV = Math.min(...curve);
                          const range = maxV - minV || 1;
                          const points = curve.map((v: number, i: number) => `${(i / (curve.length - 1)) * 100},${50 - ((v - minV) / range) * 46}`).join(' ');
                          const lastVal = curve[curve.length - 1];
                          return <polyline points={points} fill="none" stroke={lastVal >= 0 ? '#22C55E' : '#EF4444'} strokeWidth="1.5" />;
                        })()}
                      </svg>
                    ) : (
                      <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
                    )}
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Max DD</span>
                      <span className="text-[#EF4444] data-number">-${(analytics?.maxDrawdown ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-s1 border border-b1 p-4 rounded-xl flex flex-col justify-between">
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">Trade Details</div>
                    <div className="flex justify-between text-sm mb-2">
                      <div className="text-muted-foreground">Avg Win <span className="text-[#36B37E] font-medium ml-1 data-number">${(analytics?.avgWin ?? 0).toFixed(2)}</span></div>
                      <div className="text-muted-foreground">Avg Loss <span className="text-[#EF4444] font-medium ml-1 data-number">-${(analytics?.avgLoss ?? 0).toFixed(2)}</span></div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg Duration <span className="text-white font-medium ml-1 data-number">{formatDuration(analytics?.avgDurationMs ?? 0)}</span>
                    </div>
                    {analytics?.instrumentStats && Object.keys(analytics.instrumentStats).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-b1">
                        <div className="text-xs text-muted-foreground mb-1">By Instrument</div>
                        {Object.entries(analytics.instrumentStats).map(([inst, data]: [string, any]) => (
                          <div key={inst} className="flex justify-between text-xs">
                            <span className="text-white">{inst}</span>
                            <span className={`data-number ${data.pnl >= 0 ? 'text-[#36B37E]' : 'text-[#EF4444]'}`}>${data.pnl.toFixed(2)} ({data.trades})</span>
                          </div>
                        ))}
                      </div>
                    )}
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
