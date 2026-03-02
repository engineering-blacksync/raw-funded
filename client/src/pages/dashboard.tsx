import { useState } from "react";
import { Link } from "wouter";
import { LogOut, Activity, BarChart2, Shield, Settings, CreditCard, ChevronDown } from "lucide-react";
import Terminal from "@/components/dashboard/Terminal";
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
          <Link href="/dashboard/verification"><a className="underline ml-2">VERIFY NOW →</a></Link>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-b1 bg-s1 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/">
            <a className="flex items-center gap-2 mr-4">
              <span className="font-heading text-xl text-white tracking-wider">RAW</span>
              <span className="font-heading text-xl text-gold tracking-wider">FUNDED</span>
            </a>
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
              { id: 'compass', icon: BarChart2, label: 'Compass' },
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
          {activeTab !== 'terminal' && (
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