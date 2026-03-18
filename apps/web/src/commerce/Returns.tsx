import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface ReturnRecord {
  id: string;
  orderId: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  refundAmount: number;
  requestedAt: string;
  resolvedAt?: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  createdAt: string;
}

const RETURN_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  requested: { bg: '#fff8e1', color: '#f57f17' },
  approved:  { bg: '#e8f5e9', color: '#2e7d32' },
  rejected:  { bg: '#ffebee', color: '#c62828' },
  refunded:  { bg: '#e3f2fd', color: '#1565c0' },
};

function ReturnStatusBadge({ status }: { status: string }) {
  const style = RETURN_STATUS_COLORS[status] || { bg: '#f5f5f5', color: '#555' };
  return (
    <span style={{ background: style.bg, color: style.color, padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

export default function Returns() {
  const { show } = useToast();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(localStorage.getItem('shop_token'));
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [paidOrders, setPaidOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [email, setEmail] = useState('shopper@1platform.dev');
  const [password, setPassword] = useState('password123');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('/api/commerce/returns', { headers }).then(r => r.json()),
      fetch('/api/commerce/orders?limit=50', { headers }).then(r => r.json()),
    ]).then(([returnsData, ordersData]) => {
      setReturns(returnsData.returns || []);
      const paid: Order[] = (ordersData.orders || []).filter((o: Order) => o.status === 'paid');
      setPaidOrders(paid);
      const preselect = searchParams.get('orderId');
      if (preselect && paid.some(o => o.id === preselect)) {
        setSelectedOrderId(preselect);
      }
    }).catch(() => show('Could not load data', 'error'))
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

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!selectedOrderId) { setFormError('Please select an order'); return; }
    if (!reason.trim()) { setFormError('Please provide a reason for the return'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/commerce/orders/${selectedOrderId}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'RETURN_WINDOW_EXPIRED') {
          setFormError('The 30-day return window for this order has passed.');
        } else if (data.error === 'INVALID_STATUS') {
          setFormError('Only paid orders can be returned.');
        } else if (res.status === 409) {
          setFormError('A return has already been requested for this order.');
        } else {
          setFormError(data.message || data.error || 'Failed to submit return request');
        }
        return;
      }
      show('Return request submitted successfully', 'success');
      setReturns(prev => [{ id: data.id, orderId: selectedOrderId, reason: reason.trim(), status: 'requested', refundAmount: data.refundAmount, requestedAt: new Date().toISOString() }, ...prev]);
      setSelectedOrderId('');
      setReason('');
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '3rem auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ margin: '0 0 0.25rem', color: '#1a1a2e' }}>Sign in to manage returns</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Access your returns and refunds by signing in.</p>
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="rt-email">Email</label>
              <input
                id="rt-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="rt-password">Password</label>
              <input
                id="rt-password"
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
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Returns &amp; Refunds</h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Manage your return requests</p>
        </div>
        <Link to="/BuyItAll/orders" style={{ textDecoration: 'none' }}>
          <button style={{ background: '#f0f2f5', color: '#444', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            Order History
          </button>
        </Link>
      </div>

      {/* 30-day policy notice */}
      <div style={{ background: '#fff8e1', border: '1px solid #ffecb3', borderRadius: 8, padding: '0.875rem 1.25rem', marginBottom: '1.75rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#5d4037', marginBottom: '0.2rem' }}>30-Day Return Policy</div>
          <div style={{ fontSize: '0.85rem', color: '#6d4c41', lineHeight: 1.5 }}>
            You can return paid orders within 30 days of purchase. Once approved, you'll receive a prepaid return label within 2 business days. Refunds are processed within 5-7 business days of receiving the returned item.
          </div>
        </div>
      </div>

      {/* Submit a return */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#1a1a2e', fontSize: '1.05rem' }}>Submit a Return</h3>
        {paidOrders.length === 0 ? (
          <div style={{ color: '#888', fontSize: '0.9rem', padding: '1rem 0', textAlign: 'center' }}>
            No paid orders are eligible for return.{' '}
            <Link to="/BuyItAll/orders" style={{ color: '#e65100' }}>View all orders</Link>
          </div>
        ) : (
          <form onSubmit={submitReturn}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="return-order">
                Select order <span style={{ color: '#c62828' }}>*</span>
              </label>
              <select
                id="return-order"
                value={selectedOrderId}
                onChange={e => setSelectedOrderId(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.95rem', background: '#fff', boxSizing: 'border-box' }}
              >
                <option value="">— Choose a paid order —</option>
                {paidOrders.map(order => (
                  <option key={order.id} value={order.id}>
                    #{order.id.slice(0, 8).toUpperCase()} — ${order.total.toFixed(2)} — {new Date(order.createdAt).toLocaleDateString('en-US')}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="return-reason">
                Reason for return <span style={{ color: '#c62828' }}>*</span>
              </label>
              <textarea
                id="return-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Please describe why you want to return this order…"
                rows={4}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            {formError && <p role="alert" style={{ color: '#c62828', fontSize: '0.875rem', margin: '0 0 1rem' }}>{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              style={{ background: submitting ? '#aaa' : '#e65100', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem' }}
            >
              {submitting ? 'Submitting…' : 'Submit Return Request'}
            </button>
          </form>
        )}
      </div>

      {/* Active returns */}
      <div>
        <h3 style={{ margin: '0 0 1rem', color: '#1a1a2e', fontSize: '1.05rem' }}>
          Active Returns {returns.length > 0 && <span style={{ color: '#888', fontWeight: 400, fontSize: '0.9rem' }}>({returns.length})</span>}
        </h3>
        {returns.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '2.5rem', textAlign: 'center', color: '#888' }}>
            No return requests yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {returns.map(ret => (
              <div key={ret.id} style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      Order #{ret.orderId.slice(0, 8).toUpperCase()}
                    </div>
                    <div style={{ color: '#888', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                      Requested {new Date(ret.requestedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: '#1a1a2e' }}>${ret.refundAmount.toFixed(2)}</span>
                    <ReturnStatusBadge status={ret.status} />
                  </div>
                </div>
                <div style={{ fontSize: '0.88rem', color: '#555', lineHeight: 1.5, background: '#fafafa', borderRadius: 6, padding: '0.65rem 0.875rem' }}>
                  {ret.reason}
                </div>
                {ret.resolvedAt && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#888' }}>
                    Resolved {new Date(ret.resolvedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
