import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState('');
  const [amount, setAmount] = useState(0);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id') || '';
    const amt = parseInt(params.get('amount') || '0', 10);
    setSessionId(sid);
    setAmount(amt);

    if (!sid) {
      setError('No payment session found');
      setVerifying(false);
      return;
    }

    fetch(`/api/stripe/verify-session/${sid}`)
      .then(r => r.json())
      .then(data => {
        if (data.paid) {
          setVerified(true);
          if (data.amountPaid) setAmount(data.amountPaid);
        } else {
          setError('Payment not completed');
        }
      })
      .catch(() => setError('Failed to verify payment'))
      .finally(() => setVerifying(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password, sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        navigate('/pending');
      } else {
        setFormError(data.message || 'Registration failed');
      }
    } catch {
      setFormError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const cardName = amount === 50 ? 'Bronze' : amount === 200 ? 'Silver' : amount === 1000 ? 'Gold' : '';
  const cardColor = amount === 50 ? '#CD7F32' : amount === 200 ? '#C0C0C0' : '#E8C547';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-b1 bg-s1 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center">
          <button onClick={() => navigate('/')} className="flex items-center gap-1">
            <span className="font-heading text-xl font-bold tracking-wider text-white">RAW</span>
            <span className="font-heading text-xl font-bold tracking-wider text-gold">FUNDED</span>
          </button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {verifying && (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Verifying payment...</p>
            </div>
          )}

          {!verifying && error && (
            <div className="bg-card border border-red/30 rounded-lg p-8 text-center">
              <h2 className="text-red font-heading text-xl font-bold uppercase mb-3">Payment Error</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <button
                onClick={() => navigate('/pricing')}
                className="bg-s3 text-white px-6 py-2 rounded font-heading text-sm font-bold uppercase hover:bg-b1 transition-colors"
                data-testid="btn-back-pricing"
              >
                Back to Pricing
              </button>
            </div>
          )}

          {!verifying && verified && (
            <div className="bg-card border border-b1 rounded-lg p-8">
              <div className="text-center mb-6">
                <div
                  className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center text-xl font-bold"
                  style={{ background: `${cardColor}20`, color: cardColor }}
                >
                  {cardName[0]}
                </div>
                <h2 className="font-heading text-2xl font-bold text-white uppercase tracking-wider mb-1" data-testid="text-onboarding-title">
                  Create Your Account
                </h2>
                <p className="text-muted-foreground text-sm">
                  <span style={{ color: cardColor }} className="font-bold">{cardName} Card</span> · ${amount.toLocaleString()} Trading Capital
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-s1 border border-b1 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold/50"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="w-full bg-s1 border border-b1 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold/50"
                    data-testid="input-username"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-s1 border border-b1 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold/50"
                    data-testid="input-password"
                  />
                </div>

                {formError && (
                  <p className="text-red text-sm" data-testid="text-form-error">{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gold text-black rounded font-heading text-sm font-bold uppercase tracking-wider hover:bg-gold/90 transition-colors disabled:opacity-50"
                  data-testid="btn-create-account"
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
