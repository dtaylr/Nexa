import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`/api/commerce/products/${id}`)
      .then(r => r.json())
      .then(setProduct)
      .catch(console.error);
  }, [id]);

  function addToBasket() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((i: any) => i.productId === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    setAdded(true);
    setTimeout(() => navigate('/cart'), 500);
  }

  if (!product) return <p>Loading…</p>;

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: 600 }}>
      <div style={{ height: 260, borderRadius: 6, marginBottom: '1.5rem', overflow: 'hidden', background: '#e8e8e8' }}>
        <img
          src={product.imageUrl || `https://picsum.photos/seed/${product.id}/600/260`}
          alt={product.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${product.id}/600/260`; }}
        />
      </div>

      <h1 data-testid="product-title" style={{ marginTop: 0 }}>{product.name}</h1>
      <p style={{ color: '#555' }}>{product.description}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* BUG COM-006: price not formatted — raw float from API */}
        <span data-testid="product-price" style={{ fontSize: '1.75rem', fontWeight: 700 }}>£{product.price}</span>
        <span style={{ color: product.inventory > 0 ? '#2e7d32' : '#c62828', fontWeight: 500 }}>
          {product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}
        </span>
      </div>

      <button
        onClick={addToBasket}
        disabled={product.inventory === 0 || added}
        style={{
          marginTop: '1.5rem', width: '100%',
          background: added ? '#2e7d32' : '#e65100',
          color: '#fff', border: 'none', padding: '0.9rem', borderRadius: 8,
          fontSize: '1rem', fontWeight: 600, minHeight: 44,
          cursor: product.inventory === 0 || added ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {added ? 'Added to basket!' : 'Add to Basket'}
      </button>
    </div>
  );
}
