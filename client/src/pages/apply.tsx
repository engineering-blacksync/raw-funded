import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Check, UploadCloud, Link as LinkIcon, Mail, FileText } from "lucide-react";
import { TIERS } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function Apply() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [payouts, setPayouts] = useState<number>(0);
  const [proofMethod, setProofMethod] = useState("email");
  const [propFirm, setPropFirm] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileUrl, setProofFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleFileUpload = async (file: File) => {
    setProofFile(file);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setProofFileUrl(data.url);
        toast({ title: "File uploaded", description: file.name });
      } else {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        setProofFile(null);
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
      setProofFile(null);
    } finally {
      setUploading(false);
    }
  };

  const previewTier = payouts === 0 ? TIERS.verified : payouts === 1 ? TIERS.elite : TIERS.titan;

  const submitVerification = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/verifications", {
        proofMethod,
        propFirm,
        payoutsReceived: payouts,
        proofFileUrl: proofFileUrl || null,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register.mutateAsync({ email, username, password });
      setStep(2);
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message?.includes("409") ? "Email or username already taken" : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propFirm) {
      toast({ title: "Select a prop firm", variant: "destructive" });
      return;
    }
    if ((proofMethod === "certificate" || proofMethod === "screenshot") && !proofFileUrl) {
      toast({ title: "Please upload your proof file", variant: "destructive" });
      return;
    }
    try {
      await submitVerification.mutateAsync();
      toast({ title: "Verification submitted!", description: "Our team will review within 24 hours." });
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    }
  };

  const isSubmitting = submitVerification.isPending;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl text-white mb-4">
            {step === 1 ? "CREATE ACCOUNT" : "SUBMIT PROOF"}
          </h1>
          <div className="flex gap-2">
            <div className={`h-1 w-16 ${step >= 1 ? 'bg-gold' : 'bg-b1'}`}></div>
            <div className={`h-1 w-16 ${step >= 2 ? 'bg-gold' : 'bg-b1'}`}></div>
          </div>
        </div>

        {isSubmitting ? (
          <div className="bg-s1 border border-b1 p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-3xl text-white mb-2">VERIFYING UPLOAD</h2>
            <p className="text-muted-foreground max-w-md">
              Your proof is being securely transmitted. Our team will review it within 24 hours. You will receive an email when your tier updates.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-s1 border border-b1 p-8">
              {step === 1 ? (
                <form onSubmit={handleStep1} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-muted-foreground uppercase mb-2">Email</label>
                      <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="trader@example.com" className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-email" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground uppercase mb-2">Username</label>
                      <input required type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="trader123" className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-username" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground uppercase mb-2">Password</label>
                      <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-password" />
                    </div>
                  </div>
                  <button type="submit" disabled={register.isPending} className="w-full bg-gold text-black font-heading text-xl py-3 mt-4 hover:bg-white transition-colors flex justify-center items-center h-14" data-testid="button-next-step">
                    {register.isPending ? <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : "CONTINUE TO PROOF →"}
                  </button>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Already have an account? <Link href="/login" className="text-white hover:text-gold" data-testid="link-login">Login</Link>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleStep2} className="space-y-6">
                  <div>
                    <label className="block text-sm text-muted-foreground uppercase mb-2">Select Prop Firm</label>
                    <select required value={propFirm} onChange={e => setPropFirm(e.target.value)} className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none">
                      <option value="">Select Firm...</option>
                      <option>TopStep</option>
                      <option>Apex</option>
                      <option>Earn2Trade</option>
                      <option>TradeDay</option>
                      <option>MyFundedFutures</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-muted-foreground uppercase mb-2">Payouts Received</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map(num => (
                        <div 
                          key={num}
                          onClick={() => setPayouts(num)}
                          className={`cursor-pointer border text-center py-2 font-bold data-number ${payouts === num ? 'border-gold text-gold bg-gold/10' : 'border-b1 text-muted-foreground hover:border-b2'}`}
                        >
                          {num}{num === 3 ? '+' : ''}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {payouts === 0 ? "You are applying for the Verified Tier (Certified)." : "You are applying for the Elite/Titan Tier (Payouts)."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-muted-foreground uppercase mb-2">Proof Method</label>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { id: "certificate", icon: FileText, label: "Certificate PDF" },
                        { id: "email", icon: Mail, label: "Wise/Stripe Email Forward" },
                        { id: "screenshot", icon: UploadCloud, label: "Screenshot" },
                        { id: "profile_url", icon: LinkIcon, label: "Profile URL" },
                      ].map(m => (
                        <div key={m.id} onClick={() => setProofMethod(m.id)} className={`border p-3 flex flex-col items-center justify-center gap-2 cursor-pointer ${proofMethod === m.id ? 'border-gold bg-gold/5' : 'border-b1 bg-s2 hover:border-b2'}`}>
                          <m.icon className={`w-6 h-6 ${proofMethod === m.id ? 'text-gold' : 'text-muted-foreground'}`} />
                          <span className={`text-[10px] uppercase font-bold text-center leading-tight ${proofMethod === m.id ? 'text-gold' : 'text-muted-foreground'}`}>{m.label}</span>
                        </div>
                      ))}
                    </div>
                    
                    {proofMethod === "email" && (
                      <div className="bg-s2/50 border border-gold/50 p-6 text-center rounded-sm">
                        <p className="text-sm text-white mb-3">Forward your payout confirmation email to:</p>
                        <div className="inline-block bg-background px-4 py-2 border border-b1 rounded text-gold font-mono mb-3 select-all">
                          compliance@rawfunded.com
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Include your Raw Funded username in the subject line.
                        </p>
                      </div>
                    )}

                    {(proofMethod === "certificate" || proofMethod === "screenshot") && (
                      <div className="bg-s2/50 border border-b1 rounded-sm">
                        {proofFile ? (
                          <div className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                              {proofFile.name.endsWith('.pdf') ? (
                                <FileText className="w-5 h-5 text-gold" />
                              ) : (
                                <UploadCloud className="w-5 h-5 text-gold" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{proofFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {uploading ? 'Uploading...' : 'Uploaded successfully'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setProofFile(null); setProofFileUrl(null); }}
                              className="text-xs text-muted-foreground hover:text-red transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center gap-3 p-8 cursor-pointer hover:bg-s2 transition-colors" data-testid="upload-area">
                            <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                              <UploadCloud className="w-7 h-7 text-gold" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-white font-medium mb-1">
                                {proofMethod === "certificate" ? "Upload Certificate PDF" : "Upload Screenshot"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {proofMethod === "certificate" ? "PDF files up to 10MB" : "PNG, JPG, or WebP up to 10MB"}
                              </p>
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept={proofMethod === "certificate" ? ".pdf" : ".png,.jpg,.jpeg,.webp"}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file);
                              }}
                              data-testid="input-proof-file"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm text-muted-foreground uppercase mb-2">Additional Notes (Optional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none h-24 resize-none" placeholder="Anything else we should know?"></textarea>
                  </div>

                  <button type="submit" className="w-full bg-gold text-black font-heading text-xl py-3 mt-4 hover:bg-white transition-colors" data-testid="button-submit-proof">
                    SUBMIT FOR VERIFICATION
                  </button>
                </form>
              )}
            </div>

            <div>
              {step === 2 && (
                <div className="bg-background border border-b1 p-6 relative overflow-hidden mb-8">
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: previewTier.color }}></div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">You are applying for</div>
                  <h3 className="text-3xl mb-4" style={{ color: previewTier.color }}>{previewTier.label} Tier</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase">Leverage</div>
                      <div className="data-number text-xl">1:{previewTier.leverage}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase">Max Position Size</div>
                      <div className="data-number text-xl">{previewTier.maxContractsText}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl text-white mb-4">ACCEPTED PROOF</h3>
                  <ul className="space-y-3">
                    <li className="flex gap-3 items-start">
                      <Check className="w-5 h-5 text-green shrink-0" />
                      <span className="text-sm text-muted-foreground"><strong className="text-white">Elite (Payouts):</strong> Forwarded Wise or Stripe verification emails of past prop firm payouts.</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <Check className="w-5 h-5 text-green shrink-0" />
                      <span className="text-sm text-muted-foreground"><strong className="text-white">Verified (Certified):</strong> Certificate proofs or verification PDFs showing you passed an evaluation.</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <Check className="w-5 h-5 text-green shrink-0" />
                      <span className="text-sm text-muted-foreground">Public profile URLs (e.g., TopStep public profile) demonstrating funded status.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-s2 border border-b1 p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-full bg-b1 flex items-center justify-center shrink-0">
                    <span className="text-xl">⏱</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">24 Hour Review</h4>
                    <p className="text-xs text-muted-foreground mt-1">Our manual review team processes all applications within 24 hours. No automated rejections.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
