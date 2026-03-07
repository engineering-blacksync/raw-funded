import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LogOut, Activity, BarChart2, Shield, Check, CreditCard, ChevronDown, Settings, Clock, Lock, DollarSign, ArrowRight, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
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

const PAYOUT_STAGES = [
  { key: "requested", label: "Requested", color: "#A1A1AA" },
  { key: "payout_accepted", label: "Payout Accepted", color: "#E8C547" },
  { key: "risk_approved", label: "Risk Approved", color: "#3B82F6" },
  { key: "funds_sent", label: "Funds Sent", color: "#22C55E" },
];

const PAYOUT_METHODS = [
  {
    id: 'usdt',
    label: 'USDT (Tether)',
    icon: '₮',
    speed: 'Same Day',
    speedColor: 'text-green',
    addressLabel: 'USDT Wallet Address (TRC-20 or ERC-20)',
    placeholder: 'Enter your USDT wallet address',
  },
  {
    id: 'btc',
    label: 'Bitcoin',
    icon: '₿',
    speed: 'Same Day',
    speedColor: 'text-green',
    addressLabel: 'Bitcoin Wallet Address',
    placeholder: 'Enter your BTC wallet address',
  },
  {
    id: 'eth',
    label: 'Ethereum',
    icon: 'Ξ',
    speed: 'Same Day',
    speedColor: 'text-green',
    addressLabel: 'Ethereum Wallet Address',
    placeholder: 'Enter your ETH wallet address',
  },
  {
    id: 'wise',
    label: 'Wise',
    icon: '🌐',
    speed: '1–3 Business Days',
    speedColor: 'text-gold',
    addressLabel: 'Wise Email Address',
    placeholder: 'Enter your Wise email',
  },
  {
    id: 'rise',
    label: 'Rise',
    icon: '🚀',
    speed: '1–3 Business Days',
    speedColor: 'text-gold',
    addressLabel: 'Rise Account Email',
    placeholder: 'Enter your Rise email',
  },
];

function PayoutTab({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'method' | 'amount'>('method');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [payoutAddress, setPayoutAddress] = useState('');
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const { data: payouts = [] } = useQuery({
    queryKey: ["/api/payouts"],
  });

  const { data: pendingCheck } = useQuery({
    queryKey: ["/api/payouts/pending"],
    refetchInterval: 5000,
  });

  const hasPending = pendingCheck?.hasPendingPayout;
  const activePayout = payouts.find((p: any) => p.status !== "completed" && p.status !== "rejected");

  const requestPayout = useMutation({
    mutationFn: async (data: { amount: number; payoutMethod: string; payoutAddress: string }) => {
      const res = await apiRequest("POST", "/api/payouts", data);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setAmount("");
      setPayoutAddress("");
      setSelectedMethod(null);
      setStep('method');
      setError("");
    },
    onError: (err: any) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > user.balance) { setError("Amount exceeds your balance"); return; }
    if (!payoutAddress.trim()) { setError("Enter your payout address"); return; }
    if (!selectedMethod) { setError("Select a payout method"); return; }
    requestPayout.mutate({ amount: amt, payoutMethod: selectedMethod, payoutAddress: payoutAddress.trim() });
  };

  const activeMethodConfig = PAYOUT_METHODS.find(m => m.id === selectedMethod);
  const stageIndex = activePayout ? PAYOUT_STAGES.findIndex(s => s.key === activePayout.stage) : -1;
  const activeMethodLabel = activePayout?.payoutMethod ? PAYOUT_METHODS.find(m => m.id === activePayout.payoutMethod)?.label || activePayout.payoutMethod : null;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="font-heading text-3xl text-white uppercase tracking-wider mb-1">Payout</h2>
          <p className="text-sm text-muted-foreground">Request a withdrawal from your funded account. Trading is paused until your payout is processed.</p>
        </div>

        {hasPending && activePayout && (
          <div className="bg-s1 border border-b1 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Active Payout Request</div>
                <div className="data-number text-3xl font-bold text-white">${activePayout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Submitted {new Date(activePayout.requestedAt).toLocaleDateString()}
                  {activeMethodLabel && <> &middot; <span className="text-white">{activeMethodLabel}</span></>}
                </div>
                {activePayout.payoutAddress && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    To: <span className="text-white font-mono text-[9px]">{activePayout.payoutAddress}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-gold/10 border border-gold/30 rounded px-3 py-1.5">
                <AlertTriangle className="w-4 h-4 text-gold" />
                <span className="text-xs font-bold text-gold uppercase">Trading Paused</span>
              </div>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                {PAYOUT_STAGES.map((stage, i) => {
                  const isComplete = i <= stageIndex;
                  const isCurrent = i === stageIndex;
                  return (
                    <div key={stage.key} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${isComplete ? 'border-transparent' : 'border-b2'}`}
                        style={{ backgroundColor: isComplete ? stage.color + '20' : '#141418', borderColor: isCurrent ? stage.color : undefined }}
                        data-testid={`stage-${stage.key}`}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-5 h-5" style={{ color: stage.color }} />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-b2" />
                        )}
                      </div>
                      <span className={`text-[10px] mt-2 text-center font-bold uppercase tracking-wider ${isComplete ? 'text-white' : 'text-muted-foreground'}`}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-b2 -z-0">
                <div
                  className="h-full bg-gold transition-all duration-500"
                  style={{ width: `${Math.max(0, (stageIndex / (PAYOUT_STAGES.length - 1)) * 100)}%` }}
                />
              </div>
            </div>

            {activePayout.stage === "funds_sent" && (
              <div className="mt-6 bg-green/10 border border-green/30 rounded p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green mx-auto mb-2" />
                <p className="text-sm text-green font-bold">Funds have been sent! Check your payment method.</p>
              </div>
            )}
          </div>
        )}

        {!hasPending && step === 'method' && (
          <div className="bg-s1 border border-b1 rounded-lg p-6">
            <div className="mb-6">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Available Balance</div>
              <div className="data-number text-4xl font-bold text-white">${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>

            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Choose Payout Method</div>
            <div className="space-y-2">
              {PAYOUT_METHODS.map(method => (
                <button
                  key={method.id}
                  onClick={() => { setSelectedMethod(method.id); setStep('amount'); setError(''); }}
                  className={`w-full flex items-center gap-4 bg-background border rounded-lg px-5 py-4 text-left transition-all hover:border-gold/50 hover:bg-s1 ${selectedMethod === method.id ? 'border-gold bg-gold/5' : 'border-b1'}`}
                  data-testid={`method-${method.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-s3 flex items-center justify-center text-xl shrink-0">
                    {method.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{method.label}</div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${method.speedColor}`}>{method.speed}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasPending && step === 'amount' && activeMethodConfig && (
          <div className="bg-s1 border border-b1 rounded-lg p-6">
            <button
              onClick={() => { setStep('method'); setError(''); }}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors mb-4"
              data-testid="btn-back-method"
            >
              <ArrowRight className="w-3 h-3 rotate-180" /> Change Method
            </button>

            <div className="flex items-center gap-3 mb-6 bg-background border border-b1 rounded-lg px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-s3 flex items-center justify-center text-lg shrink-0">
                {activeMethodConfig.icon}
              </div>
              <div>
                <div className="text-sm font-bold text-white">{activeMethodConfig.label}</div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${activeMethodConfig.speedColor}`}>{activeMethodConfig.speed}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Available Balance</div>
              <div className="data-number text-4xl font-bold text-white">${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{activeMethodConfig.addressLabel}</label>
                <input
                  type="text"
                  value={payoutAddress}
                  onChange={e => setPayoutAddress(e.target.value)}
                  placeholder={activeMethodConfig.placeholder}
                  className="w-full bg-background border border-b1 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-gold transition-colors font-mono"
                  data-testid="input-payout-address"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Payout Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={user.balance}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-background border border-b1 rounded-lg pl-10 pr-4 py-4 text-2xl text-white data-number outline-none focus:border-gold transition-colors"
                    data-testid="input-payout-amount"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">Min: $1.00</span>
                  <button type="button" onClick={() => setAmount(String(user.balance))} className="text-[10px] text-gold hover:text-white transition-colors" data-testid="btn-max-payout">
                    MAX: ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red/10 border border-red/30 rounded px-4 py-3 text-sm text-red flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="bg-background border border-b1 rounded p-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Method</span><span className="text-white font-bold">{activeMethodConfig.label}</span></div>
                <div className="flex justify-between"><span>Processing</span><span className={`font-bold ${activeMethodConfig.speedColor}`}>{activeMethodConfig.speed}</span></div>
                <div className="flex justify-between"><span>Trading Status</span><span className="text-gold font-bold">Will be paused</span></div>
                <div className="flex justify-between"><span>Open Positions</span><span className="text-white">Must be closed first</span></div>
              </div>

              <button
                type="submit"
                disabled={requestPayout.isPending || !amount || parseFloat(amount) <= 0 || !payoutAddress.trim()}
                className="w-full bg-gold text-black font-heading text-lg font-bold py-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="btn-submit-payout"
              >
                {requestPayout.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                ) : (
                  <>Request Payout <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>
          </div>
        )}

        {payouts.length > 0 && (
          <div>
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Payout History</h3>
            <div className="space-y-2">
              {payouts.filter((p: any) => p.status === "completed" || p.status === "rejected").map((p: any) => {
                const methodLabel = p.payoutMethod ? PAYOUT_METHODS.find(m => m.id === p.payoutMethod)?.label || p.payoutMethod : 'N/A';
                return (
                  <div key={p.id} className="bg-s1 border border-b1 rounded-lg px-4 py-3 flex items-center justify-between" data-testid={`payout-${p.id}`}>
                    <div>
                      <span className="data-number text-sm font-bold text-white">${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-muted-foreground ml-3">{methodLabel}</span>
                      <span className="text-[10px] text-muted-foreground ml-3">{new Date(p.requestedAt).toLocaleDateString()}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${p.status === 'completed' ? 'text-green' : 'text-red'}`}>
                      {p.status === 'completed' ? 'Paid' : 'Rejected'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("terminal");
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const nyTime = useNYTime();
  const [liveOpenPnl, setLiveOpenPnl] = useState(0);
  const handleOpenPnlChange = useCallback((pnl: number) => setLiveOpenPnl(pnl), []);

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

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) { setLocation("/login"); return; }
    if (!isLoading && user && user.status !== "approved") { setLocation("/pending"); return; }
  }, [isLoading, isAuthenticated, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
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
          <div className="hidden md:flex items-center gap-6 mr-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Balance</span>
              <span className="data-number text-lg text-white font-bold">${(user.balance || 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="w-px h-8 bg-b1"></div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Open P&L</span>
              <span className={`data-number text-lg font-bold ${liveOpenPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {liveOpenPnl >= 0 ? '+' : ''}${liveOpenPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div 
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider border"
            style={{ color: currentTier.color, borderColor: currentTier.color }}
          >
            {currentTier.label}
          </div>

          <button onClick={() => setActiveTab("payout")} className="bg-gold text-black text-xs font-bold uppercase px-4 py-2 hover:bg-white transition-colors" data-testid="btn-payout">
            Request Payout
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
              { id: 'payout', icon: DollarSign, label: 'Payout' },
              { id: 'leaderboard', icon: Shield, label: 'Leaderboard' },
              { id: 'verification', icon: Check, label: 'Verification' },
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
            {user?.isAdmin && (
              <button onClick={() => setLocation("/admin")} title="Admin Panel" className="w-10 h-10 flex items-center justify-center rounded text-gold/70 hover:bg-gold/10 hover:text-gold transition-colors" data-testid="btn-admin-panel">
                <Lock className="w-5 h-5" />
              </button>
            )}
            <button title="Settings" className="w-10 h-10 flex items-center justify-center rounded text-muted-foreground hover:bg-s2/50 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} title="Logout" className="w-10 h-10 flex items-center justify-center rounded text-red/70 hover:bg-red/10 hover:text-red transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col bg-background">
          {activeTab === 'terminal' && <Terminal tier={currentTier} userTierName={user.tier} balance={user.balance} onOpenPnlChange={handleOpenPnlChange} allowedInstruments={user.allowedInstruments} />}
          {activeTab === 'data' && (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-6xl mx-auto space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
                      title="Lots Traded" 
                      value={<span>{(analytics?.totalLotsTraded ?? 0).toFixed(2)}</span>}
                      subtext={`${analytics?.totalTrades ?? 0} total trades`} 
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
          {activeTab === 'payout' && <PayoutTab user={user} />}
          {activeTab !== 'terminal' && activeTab !== 'data' && activeTab !== 'payout' && (
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
