import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Edit2, Shield, X, Key } from "lucide-react";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  const [newUser, setNewUser] = useState({
    username: "", email: "", password: "",
    tier: "verified", balance: 300, leverage: 250, maxContracts: 10, propFirm: "",
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowCreate(false);
      setNewUser({ username: "", email: "", password: "", tier: "verified", balance: 300, leverage: 250, maxContracts: 10, propFirm: "" });
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
    onSuccess: () => {
      setResetPasswordUser(null);
      setNewPassword("");
    },
  });

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) setLocation("/dashboard");
  }, [isLoading, user, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user?.isAdmin) return null;

  const tierColors: Record<string, string> = {
    unverified: "#71717A", verified: "#3B82F6", elite: "#E8C547", titan: "#22C55E", banned: "#EF4444",
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="border-b border-b1 bg-s1">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-gold" />
            <h1 className="font-heading text-2xl tracking-wider uppercase">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/dashboard")} className="text-xs text-muted-foreground hover:text-white transition-colors" data-testid="link-back-dashboard">Back to Dashboard</button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-gold text-black px-4 py-2 rounded font-bold text-sm hover:bg-white transition-colors" data-testid="btn-create-user">
              <Plus className="w-4 h-4" /> Create Account
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-bold uppercase tracking-wider">All Accounts ({allUsers.length})</h2>
        </div>

        <div className="border border-b1 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-s1 border-b border-b1">
                <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Tier</th>
                <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Balance</th>
                <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Leverage</th>
                <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Max Contracts</th>
                <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
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
                  <td className="px-4 py-3 text-right">
                    <span className="data-number text-sm text-muted-foreground">{u.maxContracts}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] font-bold uppercase ${u.isActive ? 'text-green' : 'text-red'}`}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading text-xl font-bold uppercase">Create Account</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
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
              <div>
                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Prop Firm (optional)</label>
                <input value={newUser.propFirm} onChange={e => setNewUser(p => ({ ...p, propFirm: e.target.value }))} className="w-full bg-s2 border border-b1 rounded px-3 py-2 text-sm text-white outline-none focus:border-gold" data-testid="admin-input-propfirm" />
              </div>
              <button type="submit" disabled={createUserMutation.isPending} className="w-full bg-gold text-black font-bold py-3 rounded text-sm hover:bg-white transition-colors disabled:opacity-50" data-testid="btn-submit-create">
                {createUserMutation.isPending ? "Creating..." : "Create Account"}
              </button>
              {createUserMutation.isError && <p className="text-red text-xs text-center">{(createUserMutation.error as any)?.message || "Failed"}</p>}
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setEditingUser(null)}>
          <div className="bg-card border border-b1 rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
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
                    <option value="banned">Banned</option>
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
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-muted-foreground uppercase">Account Active</label>
                <button type="button" onClick={() => setEditingUser((p: any) => ({ ...p, isActive: !p.isActive }))} className={`w-10 h-5 rounded-full transition-colors relative ${editingUser.isActive ? 'bg-green' : 'bg-b2'}`} data-testid="admin-toggle-active">
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${editingUser.isActive ? 'left-5' : 'left-0.5'}`}></div>
                </button>
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
              {resetPasswordMutation.isError && <p className="text-red text-xs text-center">{(resetPasswordMutation.error as any)?.message || "Failed"}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
