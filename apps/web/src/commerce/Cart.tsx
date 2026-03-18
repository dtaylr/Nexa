import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface CartItem { productId: string; name: string; price: number; quantity: number; }

export default function Cart() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [items, setItems] = useState<CartItem[]>(() => JSON.parse(localStorage.getItem('cart') || '[]'));
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Update badge when cart changes
  useEffect(() => {
    window.dispatchEvent(new Event('cartUpdate'));
  }, [items]);

  function persist(updated: CartItem[]) {
    setItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
  }

  function updateQty(productId: string, delta: number) {
    const updated = items
      .map(i => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      .filter(i => i.quantity > 0);
    persist(updated);
    if (delta < 0 && !updated.find(i => i.productId === productId)) {
      show('Item removed from basket', 'info');
    }
  }

  function removeItem(productId: string) {
    const item = items.find(i => i.productId === productId);
    persist(items.filter(i => i.productId !== productId));
    if (item) show(`${item.name} removed`, 'info');
  }

  async function applyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) { setPromoError('Please enter a promo code'); return; }
    setPromoError('');
    setPromoLoading(true);
    try {
      // Authenticate as demo shopper to call the promotions API
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'shopper@1platform.dev', password: 'password123' }),
      });
      if (!loginRes.ok) throw new Error('auth');
      const { token } = await loginRes.json();

      // BUG PROMO_CODE_STACKING: validate doesn't check if code was already applied — can stack
      const res = await fetch('/api/commerce/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error || 'Invalid promo code');
        return;
      }
      setPromoApplied({ code, discountPercent: data.discountPercent || 10 });
      show(`Promo code "${code}" applied — ${data.discountPercent || 10}% off!`, 'success');
    } catch {
      setPromoError('Could not validate code. Please try again.');
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setPromoApplied(null);
    setPromoCode('');
    show('Promo code removed', 'info');
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = promoApplied ? subtotal * (promoApplied.discountPercent / 100) : 0;
  const total = subtotal - discount;

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 560 }}>
        <h2>Basket</h2>
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem 2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🛒</div>
          <p style={{ color: '#555', marginBottom: '1.5rem' }}>Your basket is empty.</p>
          <Link to="/BuyItAll/products" style={{ textDecoration: 'none' }}>
            <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.85rem 2rem', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
              Continue shopping
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0 }}>Basket</h2>
        <Link to="/BuyItAll/products" style={{ fontSize: '0.88rem', color: '#e65100', textDecoration: 'none', fontWeight: 600 }}>← Continue shopping</Link>
      </div>

      {/* Items */}
      <div style={{ marginBottom: '1rem' }}>
        {items.map(item => (
          <div key={item.productId} style={{ background: '#fff', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.2rem' }}>${Number(item.price).toFixed(2)} each</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #d0d7de', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <button
                aria-label="Decrease quantity"
                onClick={() => updateQty(item.productId, -1)}
                style={{ width: 36, height: 36, border: 'none', background: '#f0f2f5', cursor: 'pointer', fontSize: '1.1rem', color: '#444' }}
              >−</button>
              <span data-testid={`qty-${item.productId}`} style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => updateQty(item.productId, 1)}
                style={{ width: 36, height: 36, border: 'none', background: '#f0f2f5', cursor: 'pointer', fontSize: '1.1rem', color: '#444' }}
              >+</button>
            </div>

            <div style={{ textAlign: 'right', minWidth: 70, flexShrink: 0 }}>
              <div style={{ fontWeight: 800, color: '#1a1a2e' }}>${(item.price * item.quantity).toFixed(2)}</div>
              <button
                onClick={() => removeItem(item.productId)}
                style={{ background: 'none', border: 'none', color: '#b71c1c', fontSize: '0.8rem', cursor: 'pointer', padding: 0, marginTop: '0.2rem', textDecoration: 'underline' }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Promo code */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', marginBottom: '0.875rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333', marginBottom: '0.75rem' }}>Promo code</div>
        {promoApplied ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e8f5e9', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <span style={{ fontWeight: 700, color: '#1b5e20' }}>✓ {promoApplied.code} — {promoApplied.discountPercent}% off</span>
            <button onClick={removePromo} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>Remove</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                placeholder="Enter code"
                onKeyDown={e => e.key === 'Enter' && applyPromo()}
                style={{ flex: 1, padding: '0.65rem 1rem', border: `1px solid ${promoError ? '#ef5350' : '#d0d7de'}`, borderRadius: 8, fontSize: '0.9rem', textTransform: 'uppercase', fontFamily: 'monospace' }}
              />
              <button
                onClick={applyPromo}
                disabled={promoLoading}
                style={{ background: promoLoading ? '#bbb' : '#e65100', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: promoLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
              >
                {promoLoading ? '…' : 'Apply'}
              </button>
            </div>
            {promoError && <p style={{ color: '#b71c1c', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>{promoError}</p>}
          </>
        )}
      </div>

      {/* Order summary */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#333' }}>Order summary</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
          <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {promoApplied && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1b5e20', fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 600 }}>
            <span>Discount ({promoApplied.code})</span>
            <span>−${discount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          <span>Delivery</span>
          <span style={{ color: subtotal >= 50 ? '#1b5e20' : '#555' }}>{subtotal >= 50 ? 'FREE' : '$3.99'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.15rem', borderTop: '2px solid #f0f2f5', paddingTop: '0.75rem' }}>
          <span>Total</span>
          <span data-testid="cart-total">${(total + (subtotal < 50 ? 3.99 : 0)).toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={() => navigate('/BuyItAll/checkout')}
        style={{ width: '100%', background: '#e65100', color: '#fff', border: 'none', padding: '1rem', borderRadius: 12, fontSize: '1.05rem', fontWeight: 800, minHeight: 52, cursor: 'pointer', transition: 'opacity 0.15s' }}
      >
        Proceed to checkout →
      </button>
    </div>
  );
}
