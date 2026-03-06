import { useState } from 'react';
import { useLocation } from 'wouter';

const PLANS = [
  {
    name: 'Bronze',
    amount: 50,
    price: '$50',
    color: '#CD7F32',
    features: [
      '1 Micro Gold · 1 Micro NQ · 1 Micro ES',
      '$2,500 Trading Capital',
    ],
    maxMicros: 1,
  },
  {
    name: 'Silver',
    amount: 200,
    price: '$200',
    color: '#C0C0C0',
    features: [
      '3 Micros · 1 Mini Gold',
      '$12,500 Trading Capital',
    ],
    maxMicros: 3,
    popular: true,
  },
  {
    name: 'Gold',
    amount: 1000,
    price: '$1,000',
    color: '#E8C547',
    features: [
      '10 Micros · 5 Minis',
      '$62,500 Trading Capital',
    ],
    maxMicros: 10,
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
            No rules. No challenges. Same-day withdrawals. Pick your card and start trading.
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

              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                  style={{ background: `${plan.color}20`, color: plan.color }}
                >
                  {plan.name[0]}
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-white uppercase tracking-wide" style={{ color: plan.color }}>
                    {plan.name} Card
                  </h3>
                  <p className="text-[11px] text-muted-foreground uppercase">Included</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-white data-number">{plan.price}</span>
                <span className="text-muted-foreground text-sm ml-1">one-time</span>
              </div>

              <div className="flex-1 mb-6 space-y-3">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gold text-sm mt-0.5">✓</span>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
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
      </div>
    </div>
  );
}
