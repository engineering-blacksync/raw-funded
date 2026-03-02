import { Navbar } from "@/components/layout/Navbar";
import { LEADERBOARD_MOCK, TIERS } from "@/lib/constants";

export default function Leaderboard() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl text-white mb-4">THE VERIFIED BOARD</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Only traders who've proven their funded status make it here. No demo accounts. No simulations.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <button className="bg-s2 text-white border border-gold px-4 py-2 text-sm font-bold uppercase">All Tiers</button>
          <button className="bg-s1 text-muted-foreground border border-b1 hover:border-b2 px-4 py-2 text-sm font-bold uppercase transition-colors">Titan Only</button>
          <button className="bg-s1 text-muted-foreground border border-b1 hover:border-b2 px-4 py-2 text-sm font-bold uppercase transition-colors">Elite Only</button>
        </div>

        <div className="bg-s1 border border-b1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-s2 border-b border-b1">
                  <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Rank</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Trader</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Tier</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Net P&L</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Win Rate</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Profit Factor</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Instruments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-b1">
                {LEADERBOARD_MOCK.map((trader, i) => {
                  const tier = TIERS[trader.tier as keyof typeof TIERS];
                  
                  return (
                    <tr key={i} className="hover:bg-s2/50 transition-colors group">
                      <td className="p-4">
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold data-number ${
                          trader.rank === 1 ? 'bg-gold/20 text-gold border border-gold/50' : 
                          trader.rank === 2 ? 'bg-[#C0C0C0]/20 text-[#C0C0C0] border border-[#C0C0C0]/50' :
                          trader.rank === 3 ? 'bg-[#CD7F32]/20 text-[#CD7F32] border border-[#CD7F32]/50' :
                          'bg-s2 text-muted-foreground'
                        }`}>
                          {trader.rank}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-b1 flex items-center justify-center text-xs font-bold text-white">
                            {trader.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white">{trader.name}</div>
                            <div className="text-xs text-muted-foreground">Since {trader.since}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span 
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-sm"
                          style={{ color: tier.color, borderColor: `${tier.color}40`, backgroundColor: `${tier.color}10` }}
                        >
                          {tier.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="data-number text-green font-bold text-lg">
                          ${trader.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="data-number text-white">{trader.winRate}%</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="data-number text-white">{trader.profitFactor}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{trader.instruments}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Want to be on this board?</p>
          <a href="/apply" className="inline-block border border-gold text-gold hover:bg-gold hover:text-black font-heading tracking-wide px-8 py-3 transition-colors">
            VERIFY YOUR FUNDED STATUS →
          </a>
        </div>
      </div>
    </div>
  );
}