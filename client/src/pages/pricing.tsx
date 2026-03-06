import { useState } from 'react';
import { useLocation } from 'wouter';
import { PricingContainer, type PricingPlan } from '@/components/ui/pricing-container';
import { motion } from 'framer-motion';

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

  const plans: PricingPlan[] = [
    {
      name: '$50 Account',
      price: 50,
      priceLabel: '$50',
      features: ['Same-day withdrawals', 'No rules or challenges'],
      isPopular: false,
      accent: 'bg-[#CD7F32]',
      levels: [
        { card: 'Bronze', micros: 1, color: '#CD7F32' },
        { card: 'Silver', micros: 2, color: '#C0C0C0' },
        { card: 'Gold', micros: 3, color: '#E8C547' },
      ],
      onGetStarted: () => handleGetStarted(50),
      loading: loading === 50,
    },
    {
      name: '$200 Account',
      price: 200,
      priceLabel: '$200',
      features: ['Same-day withdrawals', 'No rules or challenges'],
      isPopular: true,
      accent: 'bg-[#C0C0C0]',
      levels: [
        { card: 'Bronze', micros: 4, color: '#CD7F32' },
        { card: 'Silver', micros: 5, color: '#C0C0C0' },
        { card: 'Gold', micros: 6, color: '#E8C547' },
      ],
      onGetStarted: () => handleGetStarted(200),
      loading: loading === 200,
    },
    {
      name: '$1,000 Account',
      price: 1000,
      priceLabel: '$1,000',
      features: ['Same-day withdrawals', 'No rules or challenges'],
      isPopular: false,
      accent: 'bg-[#E8C547]',
      levels: [
        { card: 'Bronze', micros: 7, color: '#CD7F32' },
        { card: 'Silver', micros: 8, color: '#C0C0C0' },
        { card: 'Gold', micros: 9, color: '#E8C547' },
      ],
      onGetStarted: () => handleGetStarted(1000),
      loading: loading === 1000,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-b1 bg-s1 px-6 py-4 relative z-20">
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

      <PricingContainer
        title="Get Your Account"
        plans={plans}
        className="flex-1"
        blackCard={
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="bg-[#0F0F12] border-2 border-[#2E2E36] rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4
                shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)]
                hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.08)]
                transition-all duration-200"
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-center gap-4">
                <motion.div
                  className="w-12 h-12 rounded-lg bg-white/5 border-2 border-white/10 flex items-center justify-center
                    shadow-[3px_3px_0px_0px_rgba(255,255,255,0.05)]"
                  animate={{
                    rotate: [0, 5, 0, -5, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <span className="text-white text-lg font-black font-heading">B</span>
                </motion.div>
                <div>
                  <h3 className="font-heading text-lg font-black text-white uppercase tracking-wide">Black Card</h3>
                  <p className="text-sm text-[#71717A]">Interview only · Must verify $20,000+ in payouts</p>
                </div>
              </div>
              <motion.button
                onClick={() => navigate('/apply')}
                className="bg-white/10 text-white border-2 border-white/20 px-6 py-2.5 rounded-lg font-heading text-sm font-black uppercase tracking-wider
                  shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]
                  hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.08)]
                  active:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.05)]
                  transition-all duration-200 shrink-0"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                data-testid="btn-apply-black"
              >
                Apply Now →
              </motion.button>
            </motion.div>
          </div>
        }
      />
    </div>
  );
}
