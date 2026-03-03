import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Cart() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>(() => JSON.parse(localStorage.getItem('cart') || '[]'));

  function updateQty(productId: string, delta: number) {
    const updated = items
      .map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0);
    setItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
  }

  function removeItem(productId: string) {
    const updated = items.filter(i => i.productId !== productId);
    setItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div style={{ maxWidth: 560 }}>
      <h2>Basket</h2>

      {items.length === 0 ? (
        <p>Your basket is empty. <Link to="/products">Continue shopping</Link></p>
      ) : (
        <>
          {items.map(item => (
            <div key={item.productId} style={{ background: '#fff', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>£{Number(item.price).toFixed(2)} each</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  aria-label="Decrease quantity"
                  onClick={() => updateQty(item.productId, -1)}
                  style={{ width: 28, height: 28, border: '1px solid #ddd', borderRadius: 4, background: '#f5f5f5', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                >−</button>
                <span data-testid={`qty-${item.productId}`} style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => updateQty(item.productId, 1)}
                  style={{ width: 28, height: 28, border: '1px solid #ddd', borderRadius: 4, background: '#f5f5f5', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                >+</button>
              </div>
              <div style={{ marginLeft: '1.25rem', minWidth: 70, textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>£{(item.price * item.quantity).toFixed(2)}</div>
                <button
                  onClick={() => removeItem(item.productId)}
                  style={{ background: 'none', border: 'none', color: '#999', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >Remove</button>
              </div>
            </div>
          ))}

          <div style={{ background: '#fff', borderRadius: 8, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <span>Total</span>
            <span data-testid="cart-total">£{total.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/products" style={{ flex: 1, textDecoration: 'none' }}>
              <button style={{ width: '100%', background: '#f5f5f5', border: '1px solid #ddd', padding: '0.9rem', borderRadius: 8, fontSize: '1rem', cursor: 'pointer' }}>
                Continue shopping
              </button>
            </Link>
            <button
              onClick={() => navigate('/checkout')}
              style={{ flex: 2, background: '#e65100', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: 8, fontSize: '1rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}
            >
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
