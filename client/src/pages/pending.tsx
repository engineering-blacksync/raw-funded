import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Clock, CheckCircle, XCircle, FileText } from "lucide-react";

export default function Pending() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  const { data: verifications = [] } = useQuery({
    queryKey: ["/api/verifications"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
    if (!isLoading && user) {
      if (user.isAdmin) { setLocation("/admin"); return; }
      if (user.status === "approved") { setLocation("/dashboard"); return; }
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return null;

  const statusConfig: Record<string, { icon: any; color: string; label: string; bg: string }> = {
    pending: { icon: Clock, color: "#E8C547", label: "Pending Review", bg: "#E8C54715" },
    approved: { icon: CheckCircle, color: "#22C55E", label: "Approved", bg: "#22C55E15" },
    rejected: { icon: XCircle, color: "#EF4444", label: "Rejected", bg: "#EF444415" },
  };

  const config = statusConfig[user.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center min-h-[80vh] px-6">
        <div className="w-full max-w-lg">
          <div className="bg-s1 border border-b1 p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: config.bg }}>
                <StatusIcon className="w-8 h-8" style={{ color: config.color }} />
              </div>
              <h1 className="font-heading text-2xl text-white uppercase tracking-wider">{config.label}</h1>
              <div className="mt-1 px-3 py-0.5 rounded text-[10px] font-bold uppercase" style={{ color: config.color, backgroundColor: config.bg, border: `1px solid ${config.color}30` }} data-testid="status-badge">
                {user.status}
              </div>
            </div>

            {user.status === "pending" && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm text-center leading-relaxed">
                  Your verification is under review. Our team reviews submissions within 24 hours. You'll receive an email when approved.
                </p>
                <div className="border border-b1 rounded p-4 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Account Details</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Username</span><span className="text-white font-bold" data-testid="text-username">{user.username}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-white" data-testid="text-email">{user.email}</span></div>
                  </div>
                </div>
              </div>
            )}

            {user.status === "rejected" && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm text-center leading-relaxed">
                  Your verification was not approved. You can resubmit with additional proof.
                </p>
                {user.adminNotes && (
                  <div className="border border-red/30 rounded p-4 bg-red/5">
                    <div className="text-[10px] text-red uppercase tracking-wider mb-1">Rejection Reason</div>
                    <p className="text-sm text-white">{user.adminNotes}</p>
                  </div>
                )}
                <button onClick={() => setLocation("/apply")} className="w-full bg-gold text-black font-heading text-lg py-3 hover:bg-white transition-colors" data-testid="btn-resubmit">
                  RESUBMIT VERIFICATION
                </button>
              </div>
            )}

            {verifications.length > 0 && (
              <div className="mt-6 border-t border-b1 pt-6">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-3 h-3" /> Submitted Proofs
                </div>
                <div className="space-y-2">
                  {verifications.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between bg-background border border-b1 rounded px-3 py-2" data-testid={`verification-${v.id}`}>
                      <div>
                        <span className="text-xs text-white font-bold">{v.propFirm}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{v.proofMethod}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase ${v.status === 'approved' ? 'text-green' : v.status === 'rejected' ? 'text-red' : 'text-gold'}`}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
