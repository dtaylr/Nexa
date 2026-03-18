import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface LoyaltyTransaction {
  id: string;
  type: 'earn' | 'redeem' | 'expire';
  points: number;
  description: string;
  createdAt: string;
}

interface LoyaltyData {
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalEarned: number;
  transactions: LoyaltyTransaction[];
  tierBenefits: string[];
}

const TIER_COLORS: Record<string, { primary: string; light: string; text: string }> = {
  bronze:   { primary: '#cd7f32', light: '#fdf3e7', text: '#7a4a1e' },
  silver:   { primary: '#808080', light: '#f5f5f5', text: '#444' },
  gold:     { primary: '#ffd700', light: '#fffde7', text: '#7a6200' },
  platinum: { primary: '#e5e4e2', light: '#fafafa', text: '#555' },
};

const TIER_THRESHOLDS: Record<string, { next: string; target: number; label: string }> = {
  bronze:   { next: 'silver',   target: 1000,  label: 'Silver' },
  silver:   { next: 'gold',     target: 5000,  label: 'Gold' },
  gold:     { next: 'platinum', target: 10000, label: 'Platinum' },
  platinum: { next: '',         target: 0,     label: '' },
};

const TRANSACTION_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  earn:   { bg: '#e8f5e9', color: '#2e7d32' },
  redeem: { bg: '#e3f2fd', color: '#1565c0' },
  expire: { bg: '#ffebee', color: '#c62828' },
};

export default function Loyalty() {
  const { show } = useToast();
  const [token, setToken] = useState<string | null>(localStorage.getItem('shop_token'));
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [email, setEmail] = useState('shopper@1platform.dev');
  const [password, setPassword] = useState('password123');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/commerce/loyalty', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { localStorage.removeItem('shop_token'); setToken(null); return null; }
        return r.json();
      })
      .then(d => { if (d) setLoyalty(d); })
      .catch(() => show('Could not load loyalty data', 'error'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setSignInError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { setSignInError('Invalid email or password'); return; }
      const { token: t } = await res.json();
      localStorage.setItem('shop_token', t);
      setToken(t);
      setLoading(true);
    } catch {
      setSignInError('Cannot reach API server. Run: npm run dev');
    } finally {
      setSigningIn(false);
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setRedeemError('');
    const pts = parseInt(redeemAmount, 10);
    if (!pts || isNaN(pts)) { setRedeemError('Please enter a valid number of points'); return; }
    if (pts < 100) { setRedeemError('Minimum redemption is 100 points'); return; }

    setRedeeming(true);
    try {
      const res = await fetch('/api/commerce/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ points: pts }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_POINTS') {
          setRedeemError('You don\'t have enough points to redeem.');
        } else {
          setRedeemError(data.error || 'Redemption failed');
        }
        return;
      }
      show(data.message, 'success');
      setRedeemAmount('');
      // Update local state
      setLoyalty(prev => prev ? {
        ...prev,
        points: prev.points - pts,
        transactions: [
          { id: Date.now().toString(), type: 'redeem', points: -pts, description: `Redeemed ${pts} points for $${(pts / 100).toFixed(2)} discount`, createdAt: new Date().toISOString() },
          ...prev.transactions,
        ],
      } : prev);
    } catch {
      setRedeemError('Something went wrong. Please try again.');
    } finally {
      setRedeeming(false);
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '3rem auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ margin: '0 0 0.25rem', color: '#1a1a2e' }}>Sign in to view loyalty rewards</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Access your points and tier status by signing in.</p>
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="ly-email">Email</label>
              <input
                id="ly-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="ly-password">Password</label>
              <input
                id="ly-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            {signInError && <p role="alert" style={{ color: '#c62828', fontSize: '0.875rem', margin: '0 0 1rem' }}>{signInError}</p>}
            <button
              type="submit"
              disabled={signingIn}
              style={{ width: '100%', background: signingIn ? '#aaa' : '#e65100', color: '#fff', border: 'none', padding: '0.85rem', borderRadius: 8, fontSize: '1rem', cursor: signingIn ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >
              {signingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading loyalty data…</div>;
  }

  if (!loyalty) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', maxWidth: 480 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>★</div>
        <h3 style={{ margin: '0 0 0.75rem', color: '#1a1a2e' }}>No loyalty account yet</h3>
        <p style={{ color: '#666', fontSize: '0.95rem', margin: '0 0 1.5rem' }}>
          Earn points with every purchase! Place your first order to join the rewards programme.
        </p>
        <Link to="/BuyItAll/products">
          <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Start shopping
          </button>
        </Link>
      </div>
    );
  }

  const tierColors = TIER_COLORS[loyalty.tier] || TIER_COLORS.bronze;
  const tierInfo = TIER_THRESHOLDS[loyalty.tier];
  const progressPct = tierInfo?.target ? Math.min(100, Math.round((loyalty.totalEarned / tierInfo.target) * 100)) : 100;
  const redeemPts = parseInt(redeemAmount, 10) || 0;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Loyalty Rewards</h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Earn points and unlock exclusive benefits</p>
        </div>
        <Link to="/BuyItAll/products" style={{ textDecoration: 'none' }}>
          <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            Shop &amp; earn points
          </button>
        </Link>
      </div>

      {/* Hero tier card */}
      <div style={{ background: `linear-gradient(135deg, ${tierColors.primary}22, ${tierColors.light})`, border: `2px solid ${tierColors.primary}44`, borderRadius: 16, padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-1rem', right: '-1rem', fontSize: '6rem', opacity: 0.07, userSelect: 'none' }}>★</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ background: tierColors.primary, color: '#fff', padding: '0.25rem 0.875rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {loyalty.tier}
              </span>
              <span style={{ color: tierColors.text, fontSize: '0.85rem', fontWeight: 500 }}>Member</span>
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#1a1a2e', lineHeight: 1, marginBottom: '0.25rem' }}>
              {loyalty.points.toLocaleString()}
            </div>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>points available · {loyalty.totalEarned.toLocaleString()} earned total</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '1rem 1.25rem', minWidth: 160 }}>
            <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Cash value</div>
            <div style={{ fontWeight: 800, fontSize: '1.5rem', color: '#e65100' }}>${(loyalty.points / 100).toFixed(2)}</div>
            <div style={{ color: '#888', fontSize: '0.78rem', marginTop: '0.25rem' }}>100 pts = $1.00</div>
          </div>
        </div>

        {/* Tier progress bar */}
        {tierInfo && tierInfo.target > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: tierColors.text, marginBottom: '0.4rem' }}>
              <span>{loyalty.totalEarned.toLocaleString()} pts</span>
              <span>{tierInfo.label} tier at {tierInfo.target.toLocaleString()} pts</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{ background: tierColors.primary, height: '100%', width: `${progressPct}%`, borderRadius: 8, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.3rem' }}>
              {tierInfo.target - loyalty.totalEarned > 0
                ? `${(tierInfo.target - loyalty.totalEarned).toLocaleString()} points to ${tierInfo.label}`
                : `You've reached ${tierInfo.label}!`}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Tier benefits */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#1a1a2e', fontSize: '1rem' }}>
            <span style={{ color: tierColors.primary }}>★</span> {loyalty.tier.charAt(0).toUpperCase() + loyalty.tier.slice(1)} Benefits
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {loyalty.tierBenefits.map((benefit, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.4rem 0', borderBottom: idx < loyalty.tierBenefits.length - 1 ? '1px solid #f5f5f5' : 'none', fontSize: '0.9rem', color: '#444' }}>
                <span style={{ color: '#4caf50', fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>✓</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Redeem points */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.25rem', color: '#1a1a2e', fontSize: '1rem' }}>Redeem Points</h3>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>Convert points to shopping credit (100 pts = $1.00)</p>
          {loyalty.points < 100 ? (
            <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '1rem', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
              You need at least 100 points to redeem.<br />
              <span style={{ fontWeight: 700, color: '#e65100' }}>{100 - loyalty.points} more points needed.</span>
            </div>
          ) : (
            <form onSubmit={handleRedeem}>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.88rem' }} htmlFor="redeem-pts">
                  Points to redeem <span style={{ color: '#888', fontWeight: 400 }}>(min 100)</span>
                </label>
                <input
                  id="redeem-pts"
                  type="number"
                  min={100}
                  max={loyalty.points}
                  step={100}
                  value={redeemAmount}
                  onChange={e => { setRedeemAmount(e.target.value); setRedeemError(''); }}
                  placeholder="e.g. 500"
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' }}
                />
              </div>
              {redeemPts >= 100 && (
                <div style={{ background: '#fff3e0', border: '1px solid #ffccbc', borderRadius: 6, padding: '0.5rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.88rem', color: '#bf360c' }}>
                  = <strong>${(redeemPts / 100).toFixed(2)}</strong> discount on your next order
                </div>
              )}
              {redeemError && <p role="alert" style={{ color: '#c62828', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{redeemError}</p>}
              <button
                type="submit"
                disabled={redeeming || !redeemAmount}
                style={{ width: '100%', background: redeeming || !redeemAmount ? '#aaa' : '#e65100', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: redeeming || !redeemAmount ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {redeeming ? 'Redeeming…' : 'Redeem Points'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#1a1a2e', fontSize: '1rem' }}>Recent Transactions</h3>
        {loyalty.transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '0.9rem' }}>No transactions yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#888', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#888', fontWeight: 600 }}>Points</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#888', fontWeight: 600 }}>Description</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#888', fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {loyalty.transactions.map(tx => {
                  const txColors = TRANSACTION_TYPE_COLORS[tx.type] || { bg: '#f5f5f5', color: '#555' };
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span style={{ background: txColors.bg, color: txColors.color, padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: tx.points > 0 ? '#2e7d32' : '#c62828' }}>
                        {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#444', maxWidth: 220 }}>{tx.description}</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#888', whiteSpace: 'nowrap' }}>
                        {new Date(tx.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
