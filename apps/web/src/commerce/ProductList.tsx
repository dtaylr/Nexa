import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const grid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem',
};

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 8, overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
};

export default function ProductList() {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/commerce/products')
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(console.error);
  }, []);

  return (
    <div>
      <h2>Shop</h2>
      <div style={grid}>
        {products.map(p => (
          <div key={p.id} style={card}>
            <div style={{ height: 160, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.85rem' }}>
              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Image unavailable'}
            </div>
            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{p.name}</div>
              <div style={{ color: '#555', fontSize: '0.85rem', flex: 1 }}>{p.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                {/* BUG COM-006: price not rounded — could display as £89.98999999 */}
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>£{p.price}</span>
                <Link to={`/products/${p.id}`}>
                  <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: 6 }}>
                    View
                  </button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
