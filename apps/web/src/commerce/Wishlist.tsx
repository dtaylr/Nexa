import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface WishlistItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  inventory: number;
  description: string;
  addedAt: string;
}

export default function Wishlist() {
  const { show } = useToast();
  const [token, setToken] = useState<string | null>(localStorage.getItem('shop_token'));
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [email, setEmail] = useState('shopper@1platform.dev');
  const [password, setPassword] = useState('password123');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/commerce/wishlist', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { localStorage.removeItem('shop_token'); setToken(null); return null; }
        return r.json();
      })
      .then(d => { if (d) setItems(d.wishlist || []); })
      .catch(() => show('Could not load wishlist', 'error'))
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

  async function removeItem(productId: string, name: string) {
    if (!token) return;
    const res = await fetch(`/api/commerce/wishlist/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setItems(prev => prev.filter(i => i.productId !== productId));
      show(`${name} removed from wishlist`, 'info');
    } else {
      show('Could not remove item', 'error');
    }
  }

  function addToBasket(item: WishlistItem) {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((i: any) => i.productId === item.productId);
    if (existing) existing.quantity += 1;
    else cart.push({ productId: item.productId, name: item.name, price: item.price, quantity: 1 });
    localStorage.setItem('cart', JSON.stringify(cart));
    show(`${item.name} added to basket`, 'success');
    window.dispatchEvent(new Event('cartUpdate'));
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '3rem auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ margin: '0 0 0.25rem', color: '#1a1a2e' }}>Sign in to view your wishlist</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Access your saved items by signing in to your account.</p>
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="wl-email">Email</label>
              <input
                id="wl-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' }} htmlFor="wl-password">Password</label>
              <input
                id="wl-password"
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
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link to="/BuyItAll/products" style={{ color: '#e65100', textDecoration: 'none', fontSize: '0.9rem' }}>
              Continue browsing without signing in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading wishlist…</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>
            My Wishlist{items.length > 0 ? ` (${items.length} item${items.length !== 1 ? 's' : ''})` : ''}
          </h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Items you've saved for later</p>
        </div>
        <Link to="/BuyItAll/products" style={{ textDecoration: 'none' }}>
          <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            Continue shopping
          </button>
        </Link>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>♡</div>
          <p style={{ color: '#666', fontSize: '1rem', margin: '0 0 1.5rem' }}>Your wishlist is empty. Browse products to save your favourites.</p>
          <Link to="/BuyItAll/products">
            <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Browse products
            </button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; }}
            >
              <div style={{ height: 180, background: '#f5f5f5', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.productId}/400/180`; }}
                />
                {item.inventory === 0 && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,0.5)', padding: '0.3rem 0.75rem', borderRadius: 6, fontSize: '0.85rem' }}>Out of stock</span>
                  </div>
                )}
                {item.inventory > 0 && item.inventory <= 5 && (
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: '#e65100', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 6 }}>
                    Only {item.inventory} left
                  </div>
                )}
                <button
                  onClick={() => removeItem(item.productId, item.name)}
                  title="Remove from wishlist"
                  style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#c62828', fontWeight: 700, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: '#1a1a2e', fontSize: '0.95rem', lineHeight: 1.3 }}>{item.name}</div>
                <div style={{ color: '#666', fontSize: '0.82rem', flex: 1, marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  {item.description?.slice(0, 80)}{item.description?.length > 80 ? '…' : ''}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1a1a2e' }}>${item.price}</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => item.inventory > 0 && addToBasket(item)}
                      disabled={item.inventory === 0}
                      title={item.inventory === 0 ? 'Out of stock' : 'Add to basket'}
                      style={{ padding: '0.45rem 0.75rem', borderRadius: 8, border: 'none', background: item.inventory === 0 ? '#f0f2f5' : '#fff3e0', color: item.inventory === 0 ? '#bbb' : '#e65100', cursor: item.inventory === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem' }}
                    >
                      +🛒
                    </button>
                    <Link to={`/BuyItAll/products/${item.productId}`}>
                      <button style={{ padding: '0.45rem 0.875rem', borderRadius: 8, border: '1px solid #d0d7de', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#444' }}>
                        View
                      </button>
                    </Link>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#999' }}>
                  Added {new Date(item.addedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
