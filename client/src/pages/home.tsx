import { Navbar } from "@/components/layout/Navbar";
import { Link } from "wouter";
import { Check, X, ArrowRight } from "lucide-react";
import { TIERS } from "@/lib/constants";
import RawFundedDashboard from "@/components/dashboard/RawFundedDashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-grid">
      <Navbar />
      
      {/* Hero Section */}
      <section
        className="relative min-h-[90vh] flex flex-col items-center justify-start pt-24 md:pt-32 pb-20 px-6 overflow-hidden"
        style={{ animation: "fadeIn 0.6s ease-out" }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        
        <div className="max-w-5xl mx-auto text-center z-10 flex flex-col items-center w-full">
          <aside className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-[#2E2E36] bg-[#111113]/50 backdrop-blur-sm max-w-full">
            <span className="text-xs text-center whitespace-nowrap text-[#A1A1AA]">
              Raw Funded is now live for futures traders!
            </span>
            <Link href="/apply" className="flex items-center gap-1 text-xs text-gold hover:text-white transition-all active:scale-95 whitespace-nowrap">
              Read more
              <ArrowRight size={12} />
            </Link>
          </aside>

          <h1
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold text-center max-w-4xl px-6 leading-[1.1] mb-6 font-heading"
            style={{
              background: "linear-gradient(to bottom, #ffffff, #ffffff, rgba(255, 255, 255, 0.5))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.02em"
            }}
          >
            NO RULES. NO CHALLENGES.<br />
            <span style={{
              background: "linear-gradient(to bottom, #E8C547, #E8C547, rgba(232, 197, 71, 0.5))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>JUST PROVE IT.</span>
          </h1>
          
          <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10 text-[#A1A1AA]">
            Taking payouts on Future prop firms before? Trade one good set up, withdraw same day.<br />
            No consistency rules, no minimum trading days, no pass challenge buffer.
          </p>

          <div className="flex items-center gap-4 relative z-10 mb-16">
            <Link href="/apply" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-12 px-8 text-base bg-gradient-to-b from-[#E8C547] via-[#E8C547]/95 to-[#E8C547]/70 text-black hover:scale-105 active:scale-95 shadow-lg shadow-gold/20" data-testid="link-apply-hero">
              Get started
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-12 px-8 text-base hover:bg-white/5 text-white" data-testid="link-login-hero">
              Log in
            </Link>
          </div>

          <div className="w-full relative pb-20 mt-4">
            <div
              className="absolute left-1/2 w-[110%] md:w-[90%] pointer-events-none z-0 opacity-70"
              style={{
                top: "-23%",
                transform: "translateX(-50%)"
              }}
              aria-hidden="true"
            >
              <img
                src="https://i.postimg.cc/Ss6yShGy/glows.png"
                alt=""
                className="w-full h-auto mix-blend-screen"
                loading="eager"
              />
            </div>
            
            <div className="relative z-10 max-w-5xl mx-auto shadow-2xl shadow-gold/5 rounded-xl">
              <RawFundedDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-b1 bg-s1">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap justify-between gap-8">
          <div className="text-center flex-1">
            <div className="data-number text-3xl text-white font-bold">1:2000</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Max Leverage</div>
          </div>
          <div className="text-center flex-1">
            <div className="data-number text-3xl text-white font-bold">94%</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Profit Split</div>
          </div>
          <div className="text-center flex-1">
            <div className="font-heading text-3xl text-white uppercase tracking-wide">Same-Day</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Withdrawals</div>
          </div>
          <div className="text-center flex-1">
            <div className="data-number text-3xl text-gold font-bold">$0</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Access Fees</div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl text-white mb-4">HOW IT WORKS</h2>
          <div className="h-1 w-24 bg-gold mx-auto"></div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="absolute top-12 left-20 right-20 h-[1px] bg-b2 hidden md:block z-0"></div>
          
          <div className="bg-s1 border border-b1 p-8 relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-s2 border border-b2 flex items-center justify-center data-number text-2xl text-gold font-bold mb-6 rounded-full">1</div>
            <h3 className="text-2xl text-white mb-3">PROVE IT</h3>
            <p className="text-muted-foreground">Upload a Certificate PDF or forward your Wise/Stripe payout verification email.</p>
          </div>

          <div className="bg-s1 border border-b1 p-8 relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-s2 border border-b2 flex items-center justify-center data-number text-2xl text-gold font-bold mb-6 rounded-full">2</div>
            <h3 className="text-2xl text-white mb-3">GET VERIFIED</h3>
            <p className="text-muted-foreground">Our compliance team reviews within 24 hours. Your tier unlocks automatically.</p>
          </div>

          <div className="bg-s1 border border-b1 p-8 relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-s2 border border-b2 flex items-center justify-center data-number text-2xl text-gold font-bold mb-6 rounded-full">3</div>
            <h3 className="text-2xl text-white mb-3">TRADE & WITHDRAW</h3>
            <p className="text-muted-foreground">Trade your edge and withdraw the same day. No restrictive consistency rules.</p>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl text-white mb-4">THE NO-RULES DIFFERENCE</h2>
        </div>

        <div className="bg-s1 border border-b1 overflow-hidden">
          <div className="grid grid-cols-3 bg-s2 border-b border-b1 p-4">
            <div className="font-bold text-muted-foreground uppercase text-sm tracking-wider">Rule</div>
            <div className="font-bold text-muted-foreground uppercase text-sm tracking-wider text-center">Other Prop Firms</div>
            <div className="font-bold text-gold uppercase text-sm tracking-wider text-center">Raw Funded</div>
          </div>
          
          {[
            { rule: "Daily Loss Limit", other: true, us: false },
            { rule: "Consistency Rule", other: true, us: false },
            { rule: "Min Trading Days", other: true, us: false },
            { rule: "Pass Challenge Buffer", other: true, us: false },
            { rule: "Challenge Fee", other: "$100–$1,000", us: "$0" },
            { rule: "Withdrawal Wait", other: "14–30 days", us: "Same Day" },
            { rule: "News Trading Ban", other: true, us: false },
          ].map((item, i) => (
            <div key={i} className="grid grid-cols-3 p-4 border-b border-b1 last:border-0 hover:bg-s2/50 transition-colors items-center">
              <div className="font-medium">{item.rule}</div>
              <div className="text-center flex justify-center text-muted-foreground">
                {typeof item.other === 'boolean' ? (item.other ? <Check className="w-5 h-5 text-red/70" /> : <X className="w-5 h-5" />) : <span className="data-number">{item.other}</span>}
              </div>
              <div className="text-center flex justify-center text-white font-bold">
                {typeof item.us === 'boolean' ? (item.us ? <Check className="w-5 h-5" /> : <X className="w-5 h-5 text-green" />) : <span className="data-number text-gold">{item.us}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers Preview */}
      <section className="py-32 px-6 bg-s1 border-y border-b1">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl text-white mb-4">LEVERAGE TIERS</h2>
            <p className="text-muted-foreground">Unlock higher tiers based on your proven track record.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(TIERS).filter(([k]) => k !== 'banned').map(([key, tier]) => (
              <div key={key} className="bg-background border border-b1 p-6 relative overflow-hidden group hover:border-b2 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: tier.color }}></div>
                <h3 className="text-2xl mb-1" style={{ color: tier.color }}>{tier.label}</h3>
                
                {key === 'verified' && <div className="text-xs text-muted-foreground mb-4">For Certified Traders</div>}
                {key === 'elite' && <div className="text-xs text-muted-foreground mb-4">For Traders With Payouts</div>}
                {(key === 'unverified' || key === 'titan') && <div className="text-xs text-transparent mb-4 select-none">Spacer</div>}
                
                <div className="my-6 space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase mb-1">Leverage</div>
                    <div className="data-number text-2xl">1:{tier.leverage}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase mb-1">Max Position Size</div>
                    <div className="data-number text-xl">{tier.maxContractsText}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase mb-1">Instruments</div>
                    <div className="text-sm font-medium text-muted-foreground leading-tight">
                      {tier.instruments.length > 5 ? `Futures (Micros & Minis)` : `Micros Only`}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">Nasdaq, S&P 500, Gold, Silver, Oil</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-b1 text-center text-muted-foreground text-sm">
        <div className="font-heading text-2xl tracking-widest text-white/50 mb-4">RAW FUNDED</div>
        <p>© 2026 Raw Funded. All rights reserved.</p>
      </footer>
    </div>
  );
}