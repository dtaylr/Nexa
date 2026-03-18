import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  name?: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

type StatusFilter = 'all' | 'processing' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  paid:       { bg: '#e8f5e9', color: '#2e7d32' },
  processing: { bg: '#e3f2fd', color: '#1565c0' },
  shipped:    { bg: '#f3e5f5', color: '#6a1b9a' },
  delivered:  { bg: '#f5f5f5', color: '#555' },
  cancelled:  { bg: '#ffebee', color: '#c62828' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_COLORS[status] || { bg: '#f5f5f5', color: '#555' };
  return (
    <span style={{ background: style.bg, color: style.color, padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

export default function OrderHistory() {
  const { show } = useToast();
  const [token, setToken] = useState<string | null>(localStorage.getItem('shop_token'));
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [email, setEmail] = useState('shopper@1platform.dev');
  const [password, setPassword] = useState('password123');
  const PAGE_SIZE = 10;

  async function loadOrders(tok: string, currentFilter: StatusFilter, currentOffset: number, append = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) });
      if (currentFilter !== 'all') params.set('status', currentFilter);
      const res = await fetch(`/api/commerce/orders?${params}`, { headers: { Authorization: `Bearer ${tok}` } });
      if (res.status === 401) { localStorage.removeItem('shop_token'); setToken(null); return; }
      const data = await res.json();
      if (append) setOrders(prev => [...prev, ...(data.orders || [])]);
      else setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch {
      show('Could not load orders', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    loadOrders(token, filter, 0);
    setOffset(0);
  }, [token, filter]);

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

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadMore() {
    if (!token) return;
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    await loadOrders(token, filter, newOffset, true);
  }

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'processing', label: 'Processing' },
    { key: 'paid', label: 'Paid' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '3rem auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ margin: '0 0 0.25rem', color: '#1a1a2e' }}>Sign in to view your orders</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Access your order history by signing in to your account.</p>
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="oh-email">Email</label>
              <input
                id="oh-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="oh-password">Password</label>
              <input
                id="oh-password"
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Order History</h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {loading ? 'Loading…' : `${total} order${total !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <Link to="/BuyItAll/products" style={{ textDecoration: 'none' }}>
          <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            Continue shopping
          </button>
        </Link>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '0.45rem 1rem', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: filter === tab.key ? '#e65100' : '#f0f2f5',
              color: filter === tab.key ? '#fff' : '#555',
              fontWeight: filter === tab.key ? 700 : 500,
              fontSize: '0.88rem',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading orders…</div>
      )}

      {!loading && orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <p style={{ color: '#666', fontSize: '1rem', margin: '0 0 1.5rem' }}>
            {filter !== 'all' ? `No ${filter} orders found.` : 'No orders yet. Start shopping!'}
          </p>
          <Link to="/BuyItAll/products">
            <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Browse products
            </button>
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {orders.map(order => {
          const isExpanded = expanded.has(order.id);
          return (
            <div key={order.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}
                onClick={() => toggleExpand(order.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '0.95rem', fontFamily: 'monospace' }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                      {new Date(order.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a1a2e' }}>${order.total.toFixed(2)}</div>
                    <div style={{ color: '#888', fontSize: '0.78rem' }}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
                  </div>
                  <span style={{ color: '#aaa', fontSize: '0.9rem', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '1rem 1.5rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    {order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: idx < order.items.length - 1 ? '1px solid #f5f5f5' : 'none', fontSize: '0.9rem', color: '#444' }}>
                          <span style={{ color: '#444', fontSize: '0.9rem' }}>{item.name || item.productId.slice(0, 8)}</span>
                          <span style={{ color: '#888' }}>× {item.quantity}</span>
                          <span style={{ fontWeight: 600 }}>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#aaa', fontSize: '0.9rem' }}>No item details available</div>
                    )}
                  </div>
                  {order.status === 'paid' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Link to={`/BuyItAll/returns?orderId=${order.id}`} style={{ textDecoration: 'none' }}>
                        <button style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffccbc', padding: '0.45rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                          Request Return
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {orders.length < total && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{ background: loading ? '#f0f2f5' : '#fff', color: loading ? '#aaa' : '#e65100', border: '1px solid #e65100', padding: '0.65rem 2rem', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            {loading ? 'Loading…' : `Load more (${total - orders.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
