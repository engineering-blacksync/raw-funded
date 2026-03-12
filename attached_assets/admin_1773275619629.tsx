import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { createClient } from "@supabase/supabase-js";
import { Users, Plus, Edit2, Shield, X, Key, Check, XCircle, Eye, BarChart2, Clock, UserPlus, DollarSign, ArrowRight, CheckCircle, Activity, TrendingUp, TrendingDown } from "lucide-react";

type AdminTab = "dashboard" | "queue" | "traders" | "create" | "payouts";

const ALL_INSTRUMENTS = [
  'MBT', 'Gold (GC)', 'Silver', 'Oil (WTI)', 'S&P 500', 'Nasdaq',
  'MNQ', 'MES', 'MGC', 'SIL', 'MCL'
];

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [mt5Accounts, setMt5Accounts] = useState<any[]>([]);

  useEffect(() => {
    if (editingUser) {
      fetch("/api/admin/supabase/accounts")
        .then(res => res.json())
        .then(async (data) => {
          setMt5Accounts(Array.isArray(data) ? data : []);
          // Find this trader's current assignment directly from accounts table
          const assigned = Array.isArray(data) ? data.find((a: any) => a.trader_username === editingUser.username && a.trader_username !== null) : null;
          setEditingUser((p: any) => ({ ...p, mt5Account: assigned ? String(assigned.mt5_account) : null }));
        })
        .catch(() => setMt5Accounts([]));
    }
  }, [editingUser?.id]);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [approveModal, setApproveModal] = useState<any>(null);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [approveTier, setApproveTier] = useState("verified");
  const [approveBalance, setApproveBalance] = useState(10000);
  const [rejectReason, setRejectReason] = useState("");
  const [viewTradesUser, setViewTradesUser] = useState<any>(null);
  const [assignCardUser, setAssignCardUser] = useState<any>(null);
  const [assignCard, setAssignCard] = useState("bronze");
  const [addMt5Modal, setAddMt5Modal] = useState(false);
  const [newMt5Creds, setNewMt5Creds] = useState({ trader_username: "", mt5_account: "", mt5_password: "", mt5_server: "JustMarkets-Live" });

  const [newUser, setNewUser] = useState({
    username: "", email: "", password: "",
    tier: "verified", balance: 10000, leverage: 250, maxContracts: 10, propFirm: "",
  });

  const isAdminUser = user?.isAdmin;

  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: !!isAdminUser,
  });

  const { data: allVerifications = [] } = useQuery({
    queryKey: ["/api/admin/verifications"],
    enabled: !!isAdminUser,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    enabled: !!isAdminUser,
    refetchInterval: 10000,
  });

  const { data: dashboard } = useQuery({
    queryKey: ["/api/admin/dashboard"],
    enabled: !!isAdminUser,
    refetchInterval: 15000,
  });

  const { data: userTrades } = useQuery({
    queryKey: ["/api/admin/users", viewTradesUser?.id, "trades"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${viewTradesUser.id}/trades`);
      return res.json();
    },
    enabled: !!viewTradesUser,
  });

  const { data: allPayouts = [] } = useQuery({
    queryKey: ["/api/admin/payouts"],
    enabled: !!isAdminUser,
    refetchInterval: 10000,
  });

  const advancePayoutMutation = useMutation({
    mutationFn: async ({ id, stage, adminNotes }: { id: string; stage: string; adminNotes?: string }) => {
      const res = await apiRequest("POST", `/api/admin/payouts/${id}/advance`, { stage, adminNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setNewUser({ username: "", email: "", password: "", tier: "verified", balance: 10000, leverage: 250, maxContracts: 10, propFirm: "" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      setEditingUser(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/reset-password`, { newPassword });
      return res.json();
    },
    onSuccess: () => { setResetPasswordUser(null); setNewPassword(""); },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, tier, balance }: any) => {
      const res = await apiRequest("POST", `/api/admin/verifications/${id}/approve`, { tier, balance });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setApproveModal(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: any) => {
      const res = await apiRequest("POST", `/api/admin/verifications/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setRejectModal(null); setRejectReason("");
    },
  });

  const assignCardMutation = useMutation({
    mutationFn: async ({ userId, card }: any) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/assign-card`, { card });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setAssignCardUser(null);
    },
  });

  const addMt5AccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/supabase/accounts", data);
      return res.json();
    },
    onSuccess: () => {
      setAddMt5Modal(false);
      setNewMt5Creds({ trader_username: "", mt5_account: "", mt5_password: "", mt5_server: "JustMarkets-Live" });
    },
  });

  useEffect(() => {
    if (!isLoading && (!user || !isAdminUser)) setLocation("/dashboard");
  }, [isLoading, user, isAdminUser, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div></div>;
  if (!isAdminUser) return null;

  const tierColors: Record<string, string> = {
    unverified: "#71717A", verified: "#3B82F6", elite: "#E8C547", titan: "#22C55E", banned: "#EF4444",
  };

  const tierLeverage: Record<string, number> = { verified: 250, elite: 500, titan: 2000 };
  const pendingVerifications = allVerifications.filter((v: any) => v.status === "pending");
  const approvedUsers = allUsers.filter((u: any) => u.status === "approved");
  const stripePendingUsers = allUsers.filter((u: any) => u.stripePaid && u.status === "pending");

  const pendingPayouts = allPayouts.filter((p: any) => p.status !== "completed" && p.status !== "rejected");

  const tabs = [
    { id: "dashboard" as AdminTab, label: "Dashboard", icon: Activity },
    { id: "queue" as AdminTab, label: "Verification Queue", icon: Clock, count: pendingVerifications.length + stripePendingUsers.length },
    { id: "traders" as AdminTab, label: "All Traders", icon: Users, count: approvedUsers.length },
    { id: "payouts" as AdminTab, label: "Payouts", icon: DollarSign, count: pendingPayouts.length },
    { id: "create" as AdminTab, label: "Create Account", icon: UserPlus },
  ];

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="border-b border-b1 bg-s1">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-gold" />
            <h1 className="font-heading text-2xl tracking-wider uppercase">Admin Panel</h1>
          </div>
          <button onClick={() => setLocation("/dashboard")} className="text-xs text-muted-foreground hover:text-white transition-colors" data-testid="link-back-dashboard">Back to Dashboard</button>
        </div>
      </div>

      {stats && (
        <div className="border-b border-b1 bg-s1/50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground uppercase">Users</span>
              <span className="data-number text-sm font-bold text-white" data-testid="stat-total-users">{stats.totalUsers}</span>
            </div>
            <div className="w-px h-6 bg-b1" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground uppercase">Pending</span>
              <span className={`data-number text-sm font-bold ${stats.pendingVerifications > 0 ? 'text-gold' : 'text-muted-foreground'}`} data-testid="stat-pending">{stats.pendingVerifications}</span>
            </div>
            <div className="w-px h-6 bg-b1" />
            {Object.entries(stats.tierCounts || {}).map(([tier, count]) => (
              <div key={tier} className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase" style={{ color: tierColors[tier] || "#fff" }}>{tier}</span>
                <span className="data-number text-xs font-bold text-white">{count as number}</span>
              </div>
            ))}
            <div className="w-px h-6 bg-b1" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground uppercase">Open Positions</span>
              <span className="data-number text-sm font-bold text-white" data-testid="stat-positions">{stats.totalOpenPositions}</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-1 mb-6 border-b border-b1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab.id ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-white'}`} data-testid={`tab-${tab.id}`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab.count > 0 && tab.id === 'queue' ? 'bg-gold text-black' : 'bg-b2 text-muted-foreground'}`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Trades", value: dashboard.totalTrades, color: "text-white" },
                { label: "Open Positions", value: dashboard.openPositions, color: "text-gold" },
                { label: "Total Volume", value: `${dashboard.totalVolume.toLocaleString()} contracts`, color: "text-white" },
                { label: "Platform P&L", value: `$${dashboard.totalPnl.toFixed(2)}`, color: dashboard.totalPnl >= 0 ? "text-green" : "text-red" },
                { label: "Win Rate", value: `${dashboard.winRate.toFixed(1)}%`, color: "text-white" },
                { label: "Profit Factor", value: dashboard.profitFactor === 0 ? "—" : dashboard.profitFactor.toFixed(2), color: "text-white" },
              ].map((s, i) => (
                <div key={i} className="bg-s1 border border-b1 rounded-lg p-4" data-testid={`dash-stat-${i}`}>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">{s.label}</div>
                  <div className={`data-number text-lg font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-s1 border border-b1 rounded-lg p-5">
                <h3 className="font-heading text-sm uppercase tracking-wider text-gold mb-4">Traders Overview</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green" />
                      <span className="text-sm text-muted-foreground">Profitable</span>
                    </div>
                    <span className="data-number text-sm font-bold text-green" data-testid="dash-traders-up">{dashboard.tradersUp}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red" />
                      <span className="text-sm text-muted-foreground">In Drawdown</span>
                    </div>
                    <span className="data-number text-sm font-bold text-red" data-testid="dash-traders-down">{dashboard.tradersDown}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 text-center text-muted-foreground">—</span>
                      <span className="text-sm text-muted-foreground">Flat / No Trades</span>
                    </div>
                    <span className="data-number text-sm font-bold text-muted-foreground" data-testid="dash-traders-flat">{dashboard.tradersFlat}</span>
                  </div>
                </div>
                {(dashboard.tradersUp + dashboard.tradersDown + dashboard.tradersFlat) > 0 && (
                  <div className="mt-4 h-3 rounded-full bg-b1 overflow-hidden flex">
                    {dashboard.tradersUp > 0 && <div className="bg-green h-full" style={{ width: `${(dashboard.tradersUp / (dashboard.tradersUp + dashboard.tradersDown + dashboard.tradersFlat)) * 100}%` }} />}
                    {dashboard.tradersDown > 0 && <div className="bg-red h-full" style={{ width: `${(dashboard.tradersDown / (dashboard.tradersUp + dashboard.tradersDown + dashboard.tradersFlat)) * 100}%` }} />}
                    {dashboard.tradersFlat > 0 && <div className="bg-b2 h-full" style={{ width: `${(dashboard.tradersFlat / (dashboard.tradersUp + dashboard.tradersDown + dashboard.tradersFlat)) * 100}%` }} />}
                  </div>
                )}
              </div>

              <div className="bg-s1 border border-b1 rounded-lg p-5">
                <h3 className="font-heading text-sm uppercase tracking-wider text-gold mb-4">Buy vs Sell</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Buy Trades</span>
                      <span className="data-number text-sm font-bold text-green">{dashboard.sideBreakdown.buyTrades}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Buy P&L</span>
                      <span className={`data-number text-sm font-bold ${dashboard.sideBreakdown.buyPnl >= 0 ? 'text-green' : 'text-red'}`}>${dashboard.sideBreakdown.buyPnl.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t border-b1 pt-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Sell Trades</span>
                      <span className="data-number text-sm font-bold text-red">{dashboard.sideBreakdown.sellTrades}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Sell P&L</span>
                      <span className={`data-number text-sm font-bold ${dashboard.sideBreakdown.sellPnl >= 0 ? 'text-green' : 'text-red'}`}>${dashboard.sideBreakdown.sellPnl.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                {(dashboard.sideBreakdown.buyTrades + dashboard.sideBreakdown.sellTrades) > 0 && (
                  <div className="mt-4 h-3 rounded-full bg-b1 overflow-hidden flex">
                    <div className="bg-green h-full" style={{ width: `${(dashboard.sideBreakdown.buyTrades / (dashboard.sideBreakdown.buyTrades + dashboard.sideBreakdown.sellTrades)) * 100}%` }} />
                    <div className="bg-red h-full" style={{ width: `${(dashboard.sideBreakdown.sellTrades / (dashboard.sideBreakdown.buyTrades + dashboard.sideBreakdown.sellTrades)) * 100}%` }} />
                  </div>
                )}
              </div>

              <div className="bg-s1 border border-b1 rounded-lg p-5">
                <h3 className="font-heading text-sm uppercase tracking-wider text-gold mb-4">Win / Loss Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Wins</span>
                    <span className="data-number text-sm font-bold text-green">{dashboard.wins} (${dashboard.totalWinAmt.toFixed(2)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Losses</span>
                    <span className="data-number text-sm font-bold text-red">{dashboard.losses} (-${dashboard.totalLossAmt.toFixed(2)})</span>
                  </div>
                  <div className="flex justify-between border-t border-b1 pt-3">
                    <span className="text-sm text-muted-foreground">Net</span>
                    <span className={`data-number text-sm font-bold ${dashboard.totalPnl >= 0 ? 'text-green' : 'text-red'}`}>${dashboard.totalPnl.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-s1 border border-b1 rounded-lg p-5">
              <h3 className="font-heading text-sm uppercase tracking-wider text-gold mb-4">Volume by Instrument</h3>
              {Object.keys(dashboard.instrumentVolume).length === 0 ? (
                <p className="text-sm text-muted-foreground">No trade data yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-b1 text-muted-foreground text-[10px] uppercase tracking-wider">
                        <th className="text-left py-2 px-3">Instrument</th>
                        <th className="text-right py-2 px-3">Contracts</th>
                        <th className="text-right py-2 px-3">Trades</th>
                        <th className="text-right py-2 px-3">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dashboard.instrumentVolume)
                        .sort((a: any, b: any) => b[1].contracts - a[1].contracts)
                        .map(([inst, data]: [string, any]) => (
                          <tr key={inst} className="border-b border-b1/50 hover:bg-s3/30" data-testid={`dash-instrument-${inst}`}>
                            <td className="py-2 px-3 font-bold">{inst}</td>
                            <td className="py-2 px-3 text-right data-number">{data.contracts.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right data-number text-muted-foreground">{data.trades}</td>
                            <td className={`py-2 px-3 text-right data-number font-bold ${data.pnl >= 0 ? 'text-green' : 'text-red'}`}>${data.pnl.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-s1 border border-b1 rounded-lg p-5">
              <h3 className="font-heading text-sm uppercase tracking-wider text-gold mb-4">Trader Leaderboard</h3>
              {dashboard.traderStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No traders yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-b1 text-muted-foreground text-[10px] uppercase tracking-wider">
                        <th className="text-left py-2 px-3">#</th>
                        <th className="text-left py-2 px-3">Trader</th>
                        <th className="text-right py-2 px-3">P&L</th>
                        <th className="text-right py-2 px-3">Win Rate</th>
                        <th className="text-right py-2 px-3">Trades</th>
                        <th className="text-right py-2 px-3">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.traderStats.map((t: any, i: number) => (
                        <tr key={t.username} className="border-b border-b1/50 hover:bg-s3/30" data-testid={`dash-trader-${t.username}`}>
                          <td className="py-2 px-3 text-muted-foreground data-number">{i + 1}</td>
                          <td className="py-2 px-3 font-bold">{t.username}</td>
                          <td className={`py-2 px-3 text-right data-number font-bold ${t.totalPnl >= 0 ? 'text-green' : 'text-red'}`}>${t.totalPnl.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right data-number">{t.winRate.toFixed(1)}%</td>
                          <td className="py-2 px-3 text-right data-number text-muted-foreground">{t.totalTrades}</td>
                          <td className="py-2 px-3 text-right data-number text-gold">{t.openPositions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {Object.keys(dashboard.dailyVolume).length > 0 && (
              <div className="bg-s1 border border-b1 rounded-lg p-5">
                <h3 className="font-heading text-sm uppercase tracking-wider text-gold mb-4">Daily Activity</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-b1 text-muted-foreground text-[10px] uppercase tracking-wider">
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-right py-2 px-3">Trades</th>
                        <th className="text-right py-2 px-3">Volume</th>
                        <th className="text-right py-2 px-3">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dashboard.dailyVolume)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .slice(0, 30)
                        .map(([date, data]: [string, any]) => (
                          <tr key={date} className="border-b border-b1/50 hover:bg-s3/30" data-testid={`dash-daily-${date}`}>
                            <td className="py-2 px-3 font-bold">{date}</td>
                            <td className="py-2 px-3 text-right data-number">{data.trades}</td>
                            <td className="py-2 px-3 text-right data-number text-muted-foreground">{data.volume}</td>
                            <td className={`py-2 px-3 text-right data-number font-bold ${data.pnl >= 0 ? 'text-green' : 'text-red'}`}>${data.pnl.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "dashboard" && !dashboard && (
          <div className="text-center py-16 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse" />
            <p className="text-sm">Loading dashboard data...</p>
          </div>
        )}

        {activeTab === "queue" && (
          <div>
            {pendingVerifications.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending verifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingVerifications.map((v: any) => (
                  <div key={v.id} className="bg-s1 border border-b1 rounded-lg p-4" data-testid={`verification-${v.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-white">{v.username}</span>
                          <span className="text-xs text-muted-foreground">{v.email}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Prop Firm: <span className="text-white">{v.propFirm}</span></span>
                          <span>Payouts: <span className="text-white">{v.payoutsReceived}</span></span>
                          <span>Method: <span className="text-white">{v.proofMethod}</span></span>
                          <span>Submitted: <span className="text-white">{new Date(v.submittedAt).toLocaleDateString()}</span></span>
                        </div>
                        {v.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {v.notes}</p>}
                        {v.proofFileUrl && (
                          <a href={v.proofFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:underline">View Proof →</a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button onClick={() => { setApproveModal(v); setApproveTier("verified"); setApproveBalance(10000); }} className="flex items-center gap-1 bg-green/20 text-green border border-green/30 px-3 py-1.5 rounded text-xs font-bold hover:bg-green/30 transition-colors" data-testid={`btn-approve-${v.id}`}>
                          <Check className="w-3 h-3" /> APPROVE
                        </button>
                        <button onClick={() => { setRejectModal(v); setRejectReason(""); }} className="flex items-center gap-1 bg-red/20 text-red border border-red/30 px-3 py-1.5 rounded text-xs font-bold hover:bg-red/30 transition-colors" data-testid={`btn-reject-${v.id}`}>
                          <XCircle className="w-3 h-3" /> REJECT
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stripePendingUsers.length > 0 && (
              <div className="mt-6">
                <h3 className="font-heading text-lg font-bold uppercase mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green" />
                  Stripe Paid — Awaiting Card Assignment
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green/20 text-green">{stripePendingUsers.length}</span>
                </h3>
                <div className="space-y-3">
                  {stripePendingUsers.map((u: any) => {
                    const cardColors: Record<string, string> = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#E8C547' };
                    const paidCard = u.amountPaid === 50 ? 'bronze' : u.amountPaid === 200 ? 'silver' : u.amountPaid === 1000 ? 'gold' : 'unknown';
                    return (
                      <div key={u.id} className="bg-s1 border border-b1 rounded-lg p-4" data-testid={`stripe-pending-${u.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-white">{u.username}</span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Paid: <span className="text-green font-bold">${u.amountPaid?.toLocaleString()}</span></span>
                              <span>Card: <span className="font-bold" style={{ color: cardColors[paidCard] || '#fff' }}>{paidCard.toUpperCase()}</span></span>
                              <span>Registered: <span className="text-white">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</span></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            <button
                              onClick={() => { setAssignCardUser(u); setAssignCard(paidCard !== 'unknown' ? paidCard : 'bronze'); }}
                              className="flex items-center gap-1 bg-gold/20 text-gold border border-gold/30 px-3 py-1.5 rounded text-xs font-bold hover:bg-gold/30 transition-colors"
                              data-testid={`btn-assign-card-${u.id}`}
                            >
                              <CheckCircle className="w-3 h-3" /> ASSIGN CARD
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "traders" && (
          <div>
            <div className="flex justify-end mb-3">
              <button onClick={() => setAddMt5Modal(true)} className="flex items-center gap-2 text-xs bg-gold text-black font-bold px-4 py-2 rounded hover:bg-white transition-colors">
                <Key className="w-3.5 h-3.5" />
                Add MT5 Account
              </button>
            </div>
          <div className="border border-b1 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-s1 border-b border-b1">
                  <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Tier</th>
                  <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Balance</th>
                  <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Leverage</th>
                  <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Joined</th>
                  <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u: any) => (
                  <tr key={u.id} className="border-b border-b1 hover:bg-s2/30 transition-colors" data-testid={`admin-user-row-${u.id}`}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-white">{u.username}</div>
                      <div className="text-[11px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded" style={{ color: tierColors[u.tier] || "#fff", backgroundColor: (tierColors[u.tier] || "#fff") + "15", border: `1px solid ${tierColors[u.tier] || "#fff"}30` }}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="data-number text-sm font-bold text-white">${u.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="data-number text-sm text-muted-foreground">1:{u.leverage}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold uppercase ${u.isActive ? 'text-green' : 'text-red'}`}>
                        {u.isActive ? (u.status === 'suspended' ? 'Suspended' : 'Active') : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewTradesUser(u)} title="View Trades" className="text-xs text-muted-foreground hover:text-blue-400 transition-colors" data-testid={`btn-trades-${u.id}`}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setResetPasswordUser(u); setNewPassword(""); }} title="Reset Password" className="text-xs text-muted-foreground hover:text-orange-400 transition-colors" data-testid={`btn-resetpw-${u.id}`}>
                          <Key className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingUser({ ...u })} title="Edit Account" className="text-xs text-muted-foreground hover:text-gold transition-colors" data-testid={`btn-edit-${u.id}`}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}

      {addMt5Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setAddMt5Modal(false)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase">Add MT5 Account</h3>
                <p className="text-xs text-muted-foreground mt-1">Credentials are encrypted on save</p>
              </div>
              <button onClick={() => setAddMt5Modal(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); addMt5AccountMutation.mutate(newMt5Creds); }} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Trader Username</label>
                <input required type="text" value={newMt5Creds.trader_username} onChange={e => setNewMt5Creds(p => ({ ...p, trader_username: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" placeholder="rookie" />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">MT5 Account Number</label>
                <input required type="number" value={newMt5Creds.mt5_account} onChange={e => setNewMt5Creds(p => ({ ...p, mt5_account: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" placeholder="2001915796" />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">MT5 Password</label>
                <input required type="password" value={newMt5Creds.mt5_password} onChange={e => setNewMt5Creds(p => ({ ...p, mt5_password: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">MT5 Server</label>
                <input required type="text" value={newMt5Creds.mt5_server} onChange={e => setNewMt5Creds(p => ({ ...p, mt5_server: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" placeholder="JustMarkets-Live" />
              </div>
              <button type="submit" disabled={addMt5AccountMutation.isPending} className="w-full bg-gold text-black font-bold py-3 rounded text-sm hover:bg-white transition-colors disabled:opacity-50">
                {addMt5AccountMutation.isPending ? "Saving..." : "Save Account"}
              </button>
              {addMt5AccountMutation.isSuccess && <p className="text-green text-xs text-center">Account saved successfully</p>}
              {addMt5AccountMutation.isError && <p className="text-red text-xs text-center">Failed to save — check credentials</p>}
            </form>
          </div>
        </div>
      )}

        {activeTab === "payouts" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-heading text-xl font-bold uppercase">Payout Requests</h3>
              <span className="text-xs text-muted-foreground">{allPayouts.length} total</span>
            </div>

            {allPayouts.length === 0 ? (
              <div className="bg-s1 border border-b1 rounded-lg p-12 text-center text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No payout requests yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allPayouts.map((p: any) => {
                  const stageFlow = ["requested", "payout_accepted", "risk_approved", "funds_sent"];
                  const currentStageIdx = stageFlow.indexOf(p.stage);
                  const nextStage = currentStageIdx < stageFlow.length - 1 ? stageFlow[currentStageIdx + 1] : null;
                  const isTerminal = p.status === "completed" || p.status === "rejected";
                  const stageLabels: Record<string, string> = {
                    requested: "Requested",
                    payout_accepted: "Accepted",
                    risk_approved: "Risk Approved",
                    funds_sent: "Funds Sent",
                    rejected: "Rejected",
                  };
                  const stageColors: Record<string, string> = {
                    requested: "#A1A1AA",
                    payout_accepted: "#E8C547",
                    risk_approved: "#3B82F6",
                    funds_sent: "#22C55E",
                    rejected: "#EF4444",
                  };

                  return (
                    <div key={p.id} className="bg-s1 border border-b1 rounded-lg p-5" data-testid={`admin-payout-${p.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-bold text-white">{p.username}</span>
                            <span className="text-xs text-muted-foreground">{p.email}</span>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Amount</div>
                              <div className="data-number text-xl font-bold text-white">${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Method</div>
                              <div className="text-sm text-white font-bold">{p.payoutMethod ? p.payoutMethod.toUpperCase() : 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Requested</div>
                              <div className="text-sm text-white">{new Date(p.requestedAt).toLocaleDateString()}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Stage</div>
                              <span className="text-sm font-bold" style={{ color: stageColors[p.stage] || "#A1A1AA" }}>
                                {stageLabels[p.stage] || p.stage}
                              </span>
                            </div>
                          </div>
                          {p.payoutAddress && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <span className="text-[10px] uppercase">Send to:</span>{' '}
                              <span className="text-white font-mono text-[11px]">{p.payoutAddress}</span>
                            </div>
                          )}
                          {p.adminNotes && (
                            <div className="mt-2 text-xs text-muted-foreground bg-s2 rounded px-3 py-2 border border-b1">
                              <span className="text-[10px] uppercase text-muted-foreground">Notes:</span> {p.adminNotes}
                            </div>
                          )}
                        </div>
                        {!isTerminal && (
                          <div className="flex items-center gap-2 shrink-0">
                            {nextStage && (
                              <button
                                onClick={() => advancePayoutMutation.mutate({ id: p.id, stage: nextStage })}
                                disabled={advancePayoutMutation.isPending}
                                className="bg-gold text-black text-xs font-bold px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-1"
                                data-testid={`btn-advance-${p.id}`}
                              >
                                {stageLabels[nextStage]} <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const notes = prompt("Rejection reason (optional):");
                                advancePayoutMutation.mutate({ id: p.id, stage: "rejected", adminNotes: notes || undefined });
                              }}
                              disabled={advancePayoutMutation.isPending}
                              className="bg-red/20 text-red text-xs font-bold px-4 py-2 rounded hover:bg-red/30 transition-colors disabled:opacity-50"
                              data-testid={`btn-reject-payout-${p.id}`}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {isTerminal && (
                          <div className="shrink-0">
                            <span className={`text-xs font-bold uppercase px-3 py-1 rounded ${p.status === 'completed' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
                              {p.status === 'completed' ? 'Paid' : 'Rejected'}
                            </span>
                          </div>
                        )}
                      </div>

                      {!isTerminal && (
                        <div className="mt-4 flex items-center gap-1">
                          {stageFlow.map((s, i) => (
                            <div key={s} className="flex items-center flex-1">
                              <div className={`h-1.5 flex-1 rounded-full ${i <= currentStageIdx ? 'bg-gold' : 'bg-b2'}`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div className="max-w-lg">
            <div className="bg-s1 border border-b1 rounded-lg p-6">
              <h3 className="font-heading text-xl font-bold uppercase mb-6">Create Account</h3>
              <form onSubmit={e => { e.preventDefault(); createUserMutation.mutate(newUser); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted-foreground uppercase mb-1">Username</label>
                    <input required value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-input-username" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground uppercase mb-1">Email</label>
                    <input required type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-input-email" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">Password</label>
                  <input required type="text" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-input-password" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted-foreground uppercase mb-1">Tier</label>
                    <select value={newUser.tier} onChange={e => setNewUser(p => ({ ...p, tier: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-select-tier">
                      <option value="unverified">Unverified</option>
                      <option value="verified">Verified</option>
                      <option value="elite">Elite</option>
                      <option value="titan">Titan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground uppercase mb-1">Balance ($)</label>
                    <input type="number" value={newUser.balance} onChange={e => setNewUser(p => ({ ...p, balance: parseFloat(e.target.value) || 0 }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" data-testid="admin-input-balance" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted-foreground uppercase mb-1">Leverage (1:X)</label>
                    <input type="number" value={newUser.leverage} onChange={e => setNewUser(p => ({ ...p, leverage: parseInt(e.target.value) || 50 }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" data-testid="admin-input-leverage" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground uppercase mb-1">Max Contracts</label>
                    <input type="number" value={newUser.maxContracts} onChange={e => setNewUser(p => ({ ...p, maxContracts: parseInt(e.target.value) || 1 }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" data-testid="admin-input-maxcontracts" />
                  </div>
                </div>
                <button type="submit" disabled={createUserMutation.isPending} className="w-full bg-gold text-black font-bold py-3 rounded text-sm hover:bg-white transition-colors disabled:opacity-50" data-testid="btn-submit-create">
                  {createUserMutation.isPending ? "Creating..." : "Create Account (Auto-Approved)"}
                </button>
                {createUserMutation.isSuccess && <p className="text-green text-xs text-center">Account created successfully</p>}
                {createUserMutation.isError && <p className="text-red text-xs text-center">{(createUserMutation.error as any)?.message || "Failed"}</p>}
              </form>
            </div>
          </div>
        )}
      </div>

      {assignCardUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setAssignCardUser(null)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase text-gold">Assign Card</h3>
                <p className="text-xs text-muted-foreground mt-1">{assignCardUser.username} — Paid ${assignCardUser.amountPaid?.toLocaleString()}</p>
              </div>
              <button onClick={() => setAssignCardUser(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); assignCardMutation.mutate({ userId: assignCardUser.id, card: assignCard }); }} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Card Tier</label>
                <select value={assignCard} onChange={e => setAssignCard(e.target.value)} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="assign-card-tier">
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="black">Black (Interview)</option>
                </select>
              </div>
              <div className="bg-s2 border border-b1 rounded p-3 space-y-1">
                {(() => {
                  const acctSize = assignCardUser.amountPaid || 50;
                  const microMap: Record<number, Record<string, number>> = {
                    50: { bronze: 1, silver: 2, gold: 3 },
                    200: { bronze: 4, silver: 5, gold: 6 },
                    1000: { bronze: 7, silver: 8, gold: 9 },
                  };
                  const micros = assignCard === 'black' ? 999 : (microMap[acctSize]?.[assignCard] || 1);
                  return (
                    <>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Account Size</span><span className="text-white data-number">${acctSize.toLocaleString()}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Max Micros</span><span className="text-white data-number">{micros}</span></div>
                    </>
                  );
                })()}
              </div>
              <button type="submit" disabled={assignCardMutation.isPending} className="w-full bg-gold text-black font-bold py-3 rounded text-sm hover:bg-gold/80 transition-colors disabled:opacity-50" data-testid="btn-confirm-assign-card">
                {assignCardMutation.isPending ? "Assigning..." : "Confirm & Activate Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setApproveModal(null)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase text-green">Approve Verification</h3>
                <p className="text-xs text-muted-foreground mt-1">{approveModal.username} — {approveModal.propFirm}</p>
              </div>
              <button onClick={() => setApproveModal(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); approveMutation.mutate({ id: approveModal.id, tier: approveTier, balance: approveBalance }); }} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Assign Tier</label>
                <select value={approveTier} onChange={e => setApproveTier(e.target.value)} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="approve-tier">
                  <option value="verified">Verified</option>
                  <option value="elite">Elite</option>
                  <option value="titan">Titan</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Starting Balance ($)</label>
                <input type="number" value={approveBalance} onChange={e => setApproveBalance(parseFloat(e.target.value) || 10000)} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" data-testid="approve-balance" />
              </div>
              <div className="bg-s2 border border-b1 rounded p-3">
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Leverage (auto)</div>
                <div className="text-sm font-bold text-white data-number">1:{tierLeverage[approveTier] || 250}</div>
              </div>
              <button type="submit" disabled={approveMutation.isPending} className="w-full bg-green text-black font-bold py-3 rounded text-sm hover:bg-green/80 transition-colors disabled:opacity-50" data-testid="btn-confirm-approve">
                {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
              </button>
            </form>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase text-red">Reject Verification</h3>
                <p className="text-xs text-muted-foreground mt-1">{rejectModal.username}</p>
              </div>
              <button onClick={() => setRejectModal(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason }); }} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Rejection Reason (optional)</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold resize-none" data-testid="reject-reason" />
              </div>
              <button type="submit" disabled={rejectMutation.isPending} className="w-full bg-red text-white font-bold py-3 rounded text-sm hover:bg-red/80 transition-colors disabled:opacity-50" data-testid="btn-confirm-reject">
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setEditingUser(null)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase">Edit Account</h3>
                <p className="text-xs text-muted-foreground mt-1">{editingUser.username} — {editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => { 
              e.preventDefault();

              const supabaseClient = createClient(
                "https://bwcifxjkiufyshcsfvim.supabase.co",
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Y2lmeGpraXVmeXNoY3NmdmltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjUwMjA5NywiZXhwIjoyMDg4MDc4MDk3fQ.fUxr7U0khgkrdynweiBtUKrWnGxa5ZY1bMQ7dC3O2rw"
              );

              if (!editingUser.mt5Account) {
                await supabaseClient.from('accounts').update({ trader_username: null }).eq('trader_username', editingUser.username);
              } else {
                await supabaseClient.from('accounts').update({ trader_username: null }).eq('trader_username', editingUser.username);
                await supabaseClient.from('accounts').update({ trader_username: editingUser.username }).eq('mt5_account', parseInt(editingUser.mt5Account));
              }

              updateUserMutation.mutate({
                id: editingUser.id,
                tier: editingUser.tier,
                balance: editingUser.balance,
                leverage: editingUser.leverage,
                maxContracts: editingUser.maxContracts,
                isActive: editingUser.isActive,
                propFirm: editingUser.propFirm,
                adminNotes: editingUser.adminNotes,
                allowedInstruments: editingUser.allowedInstruments,
                mt5Account: editingUser.mt5Account || null,
              });
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">Tier</label>
                  <select value={editingUser.tier} onChange={e => setEditingUser((p: any) => ({ ...p, tier: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-edit-tier">
                    <option value="unverified">Unverified</option>
                    <option value="verified">Verified</option>
                    <option value="elite">Elite</option>
                    <option value="titan">Titan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">Balance ($)</label>
                  <input type="number" step="0.01" value={editingUser.balance} onChange={e => setEditingUser((p: any) => ({ ...p, balance: parseFloat(e.target.value) || 0 }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" data-testid="admin-edit-balance" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">Leverage (1:X)</label>
                  <input type="number" value={editingUser.leverage} onChange={e => setEditingUser((p: any) => ({ ...p, leverage: parseInt(e.target.value) || 50 }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" data-testid="admin-edit-leverage" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">Max Contracts</label>
                  <input type="number" value={editingUser.maxContracts} onChange={e => setEditingUser((p: any) => ({ ...p, maxContracts: parseInt(e.target.value) || 1 }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold data-number" data-testid="admin-edit-maxcontracts" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">MT5 Account</label>
                  <select
                    value={editingUser.mt5Account || ""}
                    onChange={(e) => setEditingUser((p: any) => ({ ...p, mt5Account: e.target.value || null }))}
                    className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    data-testid="admin-edit-mt5-account"
                  >
                    <option value="">None</option>
                    {mt5Accounts.map((acc: any) => (
                      <option key={acc.mt5_account} value={acc.mt5_account}>
                        {!acc.trader_username ? 'Available' : acc.trader_username} — {acc.mt5_account}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">Prop Firm</label>
                  <input type="text" value={editingUser.propFirm || ""} onChange={e => setEditingUser((p: any) => ({ ...p, propFirm: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-edit-propfirm" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">Internal Notes</label>
                  <textarea value={editingUser.adminNotes || ""} onChange={e => setEditingUser((p: any) => ({ ...p, adminNotes: e.target.value }))} rows={2} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold resize-none" data-testid="admin-edit-notes" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold">Allowed Instruments</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingUser((p: any) => ({ ...p, allowedInstruments: null }))} className="text-[10px] text-gold hover:text-white transition-colors">All</button>
                    <button type="button" onClick={() => setEditingUser((p: any) => ({ ...p, allowedInstruments: [] }))} className="text-[10px] text-red hover:text-white transition-colors">None</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {ALL_INSTRUMENTS.map(inst => {
                    const allowed = editingUser.allowedInstruments;
                    const isEnabled = !allowed || allowed.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => {
                          setEditingUser((p: any) => {
                            const current = p.allowedInstruments || [...ALL_INSTRUMENTS];
                            if (current.includes(inst)) {
                              return { ...p, allowedInstruments: current.filter((i: string) => i !== inst) };
                            } else {
                              return { ...p, allowedInstruments: [...current, inst] };
                            }
                          });
                        }}
                        className={`px-2 py-1.5 rounded text-[10px] font-bold uppercase border transition-colors ${
                          isEnabled
                            ? 'bg-gold/20 text-gold border-gold/30'
                            : 'bg-s2 text-muted-foreground border-b1 opacity-50'
                        }`}
                        data-testid={`toggle-instrument-${inst}`}
                      >
                        {inst}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-muted-foreground uppercase">Account Active</label>
                  <button type="button" onClick={() => setEditingUser((p: any) => ({ ...p, isActive: !p.isActive }))} className={`w-10 h-5 rounded-full transition-colors relative ${editingUser.isActive ? 'bg-green' : 'bg-b2'}`} data-testid="admin-toggle-active">
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${editingUser.isActive ? 'left-5' : 'left-0.5'}`}></div>
                  </button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { updateUserMutation.mutate({ id: editingUser.id, status: "suspended", isActive: false }); }} className="text-xs text-red border border-red/30 px-3 py-1.5 rounded hover:bg-red/10 transition-colors" data-testid="btn-suspend">Suspend</button>
                  <button type="button" onClick={() => { updateUserMutation.mutate({ id: editingUser.id, balance: 10000 }); }} className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded hover:bg-gold/10 transition-colors" data-testid="btn-reset-balance">Reset $10K</button>
                </div>
              </div>
              <button type="submit" disabled={updateUserMutation.isPending} className="w-full bg-gold text-black font-bold py-3 rounded text-sm hover:bg-white transition-colors disabled:opacity-50" data-testid="btn-submit-edit">
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setResetPasswordUser(null)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase">Reset Password</h3>
                <p className="text-xs text-muted-foreground mt-1">{resetPasswordUser.username}</p>
              </div>
              <button onClick={() => setResetPasswordUser(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); resetPasswordMutation.mutate({ id: resetPasswordUser.id, newPassword }); }} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">New Password</label>
                <input required type="text" minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-input-newpassword" />
              </div>
              <button type="submit" disabled={resetPasswordMutation.isPending} className="w-full bg-orange-500 text-black font-bold py-3 rounded text-sm hover:bg-orange-400 transition-colors disabled:opacity-50" data-testid="btn-submit-resetpw">
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </button>
              {resetPasswordMutation.isSuccess && <p className="text-green text-xs text-center">Password reset successfully</p>}
            </form>
          </div>
        </div>
      )}

      {viewTradesUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-end" onClick={() => setViewTradesUser(null)}>
          <div className="bg-card border-l border-b1 w-full max-w-xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-b1 p-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-heading text-lg font-bold uppercase">{viewTradesUser.username}'s Trades</h3>
                <p className="text-xs text-muted-foreground">{viewTradesUser.email}</p>
              </div>
              <button onClick={() => setViewTradesUser(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-6">
              {userTrades?.open?.length > 0 && (
                <div>
                  <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Open Positions ({userTrades.open.length})</h4>
                  <div className="space-y-2">
                    {userTrades.open.map((t: any) => (
                      <div key={t.id} className="bg-s1 border border-b1 rounded px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className={`text-xs font-bold ${t.side === 'BUY' ? 'text-green' : 'text-red'}`}>{t.side}</span>
                          <span className="text-xs text-white ml-2">{t.instrument}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">@ {t.entryPrice}</span>
                        </div>
                        <span className="data-number text-xs text-muted-foreground">{t.size} lots</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Trade History ({userTrades?.history?.length || 0})</h4>
                {userTrades?.history?.length > 0 ? (
                  <div className="space-y-1">
                    {userTrades.history.filter((t: any) => t.status === 'closed').map((t: any) => (
                      <div key={t.id} className="bg-s1 border border-b1 rounded px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className={`text-xs font-bold ${t.side === 'BUY' ? 'text-green' : 'text-red'}`}>{t.side}</span>
                          <span className="text-xs text-white ml-2">{t.instrument}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{t.entryPrice} → {t.exitPrice}</span>
                        </div>
                        <span className={`data-number text-xs font-bold ${(t.pnl || 0) >= 0 ? 'text-green' : 'text-red'}`}>
                          {(t.pnl || 0) >= 0 ? '+' : ''}{(t.pnl || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No trade history</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}