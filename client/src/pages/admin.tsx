import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Edit2, Shield, X, Key, Check, XCircle, Eye, BarChart2, Clock, UserPlus, DollarSign, ArrowRight, CheckCircle } from "lucide-react";

type AdminTab = "queue" | "traders" | "create" | "payouts";

const ALL_INSTRUMENTS = [
  'Bitcoin', 'Gold (GC)', 'Silver', 'Oil (WTI)', 'S&P 500', 'Nasdaq',
  'MNQ', 'MES', 'MGC', 'SIL', 'MCL'
];

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("queue");
  const [editingUser, setEditingUser] = useState<any>(null);
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
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Amount</div>
                              <div className="data-number text-xl font-bold text-white">${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
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
            <form onSubmit={e => { e.preventDefault(); updateUserMutation.mutate(editingUser); }} className="space-y-4">
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
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Internal Notes</label>
                <textarea value={editingUser.adminNotes || ""} onChange={e => setEditingUser((p: any) => ({ ...p, adminNotes: e.target.value }))} rows={2} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold resize-none" data-testid="admin-edit-notes" />
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
