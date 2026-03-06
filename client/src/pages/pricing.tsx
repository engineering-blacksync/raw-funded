import { useState } from 'react';
import { useLocation } from 'wouter';

const CARD_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#E8C547',
  black: '#ffffff',
};

const PLANS = [
  {
    amount: 50,
    price: '$50',
    label: '$50 Account',
    levels: [
      { card: 'Bronze', micros: 1 },
      { card: 'Silver', micros: 2 },
      { card: 'Gold', micros: 3 },
    ],
  },
  {
    amount: 200,
    price: '$200',
    label: '$200 Account',
    popular: true,
    levels: [
      { card: 'Bronze', micros: 4 },
      { card: 'Silver', micros: 5 },
      { card: 'Gold', micros: 6 },
    ],
  },
  {
    amount: 1000,
    price: '$1,000',
    label: '$1,000 Account',
    levels: [
      { card: 'Bronze', micros: 7 },
      { card: 'Silver', micros: 8 },
      { card: 'Gold', micros: 9 },
    ],
  },
];

export default function Pricing() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<number | null>(null);

  const handleGetStarted = async (amount: number) => {
    setLoading(amount);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.message || 'Failed to create checkout');
      }
    } catch {
      alert('Connection error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-b1 bg-s1 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-1" data-testid="link-home">
            <span className="font-heading text-xl font-bold tracking-wider text-white">RAW</span>
            <span className="font-heading text-xl font-bold tracking-wider text-gold">FUNDED</span>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-muted-foreground hover:text-white transition-colors"
            data-testid="link-login"
          >
            Already have an account? Log in
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl font-bold text-white uppercase tracking-wider mb-3" data-testid="text-pricing-title">
            Get Your Account
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            No rules. No challenges. Same-day withdrawals. Pick your size and start trading.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          {PLANS.map((plan) => (
            <div
              key={plan.amount}
              className={`relative bg-card border rounded-lg p-6 flex flex-col ${plan.popular ? 'border-gold/50 ring-1 ring-gold/20' : 'border-b1'}`}
              data-testid={`card-plan-${plan.amount}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-black text-[10px] font-bold uppercase px-3 py-1 rounded-full tracking-wider">
                  Most Popular
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-heading text-xl font-bold text-white uppercase tracking-wide">
                  {plan.label}
                </h3>
                <p className="text-[11px] text-muted-foreground uppercase mt-1">One-time payment</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white data-number">{plan.price}</span>
              </div>

              <div className="flex-1 mb-6">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-3">Card Levels</div>
                <div className="space-y-2">
                  {plan.levels.map((level) => (
                    <div key={level.card} className="flex items-center justify-between bg-s1 border border-b1 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: CARD_COLORS[level.card.toLowerCase()] }}
                        />
                        <span className="text-sm font-bold" style={{ color: CARD_COLORS[level.card.toLowerCase()] }}>
                          {level.card}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground data-number">
                        {level.micros} micro{level.micros > 1 ? 's' : ''} per trade
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleGetStarted(plan.amount)}
                disabled={loading !== null}
                className={`w-full py-3 rounded font-heading text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  plan.popular
                    ? 'bg-gold text-black hover:bg-gold/90'
                    : 'bg-s3 text-white hover:bg-b1 border border-b2'
                }`}
                data-testid={`btn-get-started-${plan.amount}`}
              >
                {loading === plan.amount ? 'Redirecting...' : 'Get Started'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-5xl w-full">
          <div className="bg-card border border-b1 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-white text-lg font-bold">B</span>
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-white uppercase tracking-wide">Black Card</h3>
                <p className="text-sm text-muted-foreground">Interview only · Must verify $20,000+ in payouts</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/apply')}
              className="bg-white/10 text-white border border-white/20 px-6 py-2.5 rounded font-heading text-sm font-bold uppercase tracking-wider hover:bg-white/15 transition-colors shrink-0"
              data-testid="btn-apply-black"
            >
              Apply Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
