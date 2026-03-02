import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Cart() {
  const navigate = useNavigate();
  const [items] = useState<any[]>(() => JSON.parse(localStorage.getItem('cart') || '[]'));

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div style={{ maxWidth: 560 }}>
      <h2>Basket</h2>

      {items.length === 0 ? (
        <p>Your basket is empty. <Link to="/products">Continue shopping</Link></p>
      ) : (
        <>
          {items.map((item, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>Qty: {item.quantity}</div>
              </div>
              <div style={{ fontWeight: 700 }}>£{(item.price * item.quantity).toFixed(2)}</div>
            </div>
          ))}

          <div style={{ background: '#fff', borderRadius: 8, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <span>Total</span>
            <span>£{total.toFixed(2)}</span>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            style={{ width: '100%', background: '#e65100', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: 8, fontSize: '1rem', fontWeight: 600, minHeight: 44 }}
          >
            Proceed to Checkout
          </button>
        </>
      )}
    </div>
  );
}
