import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Check, UploadCloud, Link as LinkIcon, Mail, FileText } from "lucide-react";
import { TIERS } from "@/lib/constants";

export default function Apply() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [payouts, setPayouts] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived tier preview: 0 = Verified (Certified), 1+ = Elite (Payouts)
  const previewTier = payouts === 0 ? TIERS.verified : payouts === 1 ? TIERS.elite : TIERS.titan;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else {
      setIsSubmitting(true);
      setTimeout(() => {
        setLocation("/dashboard");
      }, 2000);
    }
  };

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
            {/* Left Column - Form */}
            <div className="bg-s1 border border-b1 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {step === 1 ? (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-muted-foreground uppercase mb-2">Email</label>
                        <input required type="email" placeholder="trader@example.com" className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-email" />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground uppercase mb-2">Username</label>
                        <input required type="text" placeholder="trader123" className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-username" />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground uppercase mb-2">Password</label>
                        <input required type="password" placeholder="••••••••" className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-password" />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-gold text-black font-heading text-xl py-3 mt-4 hover:bg-white transition-colors" data-testid="button-next-step">
                      CONTINUE TO PROOF →
                    </button>
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Already have an account? <Link href="/login" className="text-white hover:text-gold" data-testid="link-login">Login</Link>
                    </p>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm text-muted-foreground uppercase mb-2">Select Prop Firm</label>
                      <select required className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none">
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
                        <div className="border border-b1 bg-s2 p-3 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-b2">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                          <span className="text-[10px] uppercase font-bold text-muted-foreground text-center leading-tight">Certificate PDF</span>
                        </div>
                        <div className="border border-gold bg-gold/5 p-3 flex flex-col items-center justify-center gap-2 cursor-pointer">
                          <Mail className="w-6 h-6 text-gold" />
                          <span className="text-[10px] uppercase font-bold text-gold text-center leading-tight">Wise/Stripe Email Forward</span>
                        </div>
                        <div className="border border-b1 bg-s2 p-3 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-b2">
                          <UploadCloud className="w-6 h-6 text-muted-foreground" />
                          <span className="text-[10px] uppercase font-bold text-muted-foreground text-center leading-tight">Screenshot</span>
                        </div>
                        <div className="border border-b1 bg-s2 p-3 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-b2">
                          <LinkIcon className="w-6 h-6 text-muted-foreground" />
                          <span className="text-[10px] uppercase font-bold text-muted-foreground text-center leading-tight">Profile URL</span>
                        </div>
                      </div>
                      
                      <div className="bg-s2/50 border border-gold/50 p-6 text-center rounded-sm">
                        <p className="text-sm text-white mb-3">Forward your payout confirmation email to:</p>
                        <div className="inline-block bg-background px-4 py-2 border border-b1 rounded text-gold font-mono mb-3 select-all">
                          compliance@rawfunded.com
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Include your Raw Funded username in the subject line.
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-muted-foreground uppercase mb-2">Additional Notes (Optional)</label>
                      <textarea className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none h-24 resize-none" placeholder="Anything else we should know?"></textarea>
                    </div>

                    <button type="submit" className="w-full bg-gold text-black font-heading text-xl py-3 mt-4 hover:bg-white transition-colors" data-testid="button-submit-proof">
                      SUBMIT FOR VERIFICATION
                    </button>
                  </>
                )}
              </form>
            </div>

            {/* Right Column - Info */}
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