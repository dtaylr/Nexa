import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

export default function ProductPage() {
  const { id } = useParams();
  const { show } = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/commerce/products/${id}`)
      .then(r => r.json())
      .then(setProduct)
      .catch(() => show('Could not load product', 'error'));
  }, [id]);

  useEffect(() => {
    const token = localStorage.getItem('shop_token');
    if (!token || !id) return;
    fetch('/api/commerce/wishlist', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const items: any[] = data.items || [];
        setInWishlist(items.some((item: any) => item.productId === id));
      })
      .catch(() => {});
  }, [id]);

  async function toggleWishlist() {
    const token = localStorage.getItem('shop_token');
    if (!token) { navigate('/BuyItAll/wishlist'); return; }
    setWishlistLoading(true);
    try {
      if (inWishlist) {
        const res = await fetch(`/api/commerce/wishlist/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) { setInWishlist(false); show('Removed from wishlist', 'success'); }
      } else {
        const res = await fetch('/api/commerce/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ productId: id }),
        });
        if (res.ok) { setInWishlist(true); show('Saved to wishlist', 'success'); }
      }
    } catch {
      show('Could not update wishlist', 'error');
    } finally {
      setWishlistLoading(false);
    }
  }

  function addToBasket() {
    if (!product) return;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((i: any) => i.productId === product.id);
    if (existing) existing.quantity += quantity;
    else cart.push({ productId: product.id, name: product.name, price: product.price, quantity });
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdate'));
    setAdded(true);
    show(`${quantity > 1 ? `${quantity}× ` : ''}${product.name} added to basket`, 'success');
  }

  if (!product) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
        Loading product…
      </div>
    );
  }

  const inStock = product.inventory > 0;
  const price = typeof product.price === 'number' ? product.price : parseFloat(product.price);
  const totalPrice = (price * quantity).toFixed(2);

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: '1.25rem', fontSize: '0.88rem', color: '#888' }}>
        <Link to="/BuyItAll/products" style={{ color: '#e65100', textDecoration: 'none', fontWeight: 500 }}>Shop</Link>
        {' › '}
        <span style={{ color: '#444' }}>{product.name}</span>
      </nav>

      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        {/* Product image */}
        <div style={{ height: 300, background: '#f5f5f5', overflow: 'hidden' }}>
          <img
            src={product.imageUrl || `https://picsum.photos/seed/${product.id}/680/300`}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${product.id}/680/300`; }}
          />
        </div>

        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h1 data-testid="product-title" style={{ margin: 0, fontSize: '1.5rem', color: '#1a1a2e' }}>{product.name}</h1>
              {/* Mock star rating */}
              <div style={{ color: '#f59e0b', marginTop: '0.4rem', fontSize: '0.9rem' }}>
                ★★★★☆ <span style={{ color: '#888', fontSize: '0.85rem' }}>(142 reviews)</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {/* BUG PRICE_FLOAT_PRECISION preserved: price shown as raw float from API */}
              <div data-testid="product-price" style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>
                ${product.price}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.15rem' }}>inc. VAT</div>
            </div>
          </div>

          <p style={{ color: '#555', lineHeight: 1.6, marginBottom: '1.5rem' }}>{product.description}</p>

          {/* Stock status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: inStock ? '#4caf50' : '#ef5350', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: inStock ? '#1b5e20' : '#b71c1c' }}>
              {inStock ? (product.inventory <= 5 ? `Only ${product.inventory} left in stock` : 'In stock') : 'Out of stock'}
            </span>
            {inStock && <span style={{ color: '#888', fontSize: '0.82rem' }}>· Free delivery over $50</span>}
          </div>

          {/* Quantity + Add to basket */}
          {inStock && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #d0d7de', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  style={{ width: 40, height: 44, border: 'none', background: '#f0f2f5', cursor: quantity <= 1 ? 'not-allowed' : 'pointer', fontSize: '1.2rem', color: quantity <= 1 ? '#bbb' : '#444' }}
                >−</button>
                <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }}>{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(product.inventory, q + 1))}
                  disabled={quantity >= product.inventory}
                  style={{ width: 40, height: 44, border: 'none', background: '#f0f2f5', cursor: quantity >= product.inventory ? 'not-allowed' : 'pointer', fontSize: '1.2rem', color: quantity >= product.inventory ? '#bbb' : '#444' }}
                >+</button>
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>
                Total: <strong>${totalPrice}</strong>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={added ? () => navigate('/BuyItAll/checkout') : addToBasket}
              disabled={!inStock && !added}
              style={{
                flex: 2,
                background: added ? '#1b5e20' : !inStock ? '#ccc' : '#e65100',
                color: '#fff',
                border: 'none',
                padding: '0.9rem 1.5rem',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 700,
                minHeight: 48,
                cursor: !inStock && !added ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {added ? 'Proceed to Checkout' : !inStock ? 'Out of stock' : `Add ${quantity > 1 ? `${quantity}× ` : ''}to basket`}
            </button>
            <button
              onClick={toggleWishlist}
              disabled={wishlistLoading}
              style={{
                background: '#fff',
                border: '2px solid #ffccbc',
                color: '#e65100',
                padding: '0.9rem 1.25rem',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 700,
                minHeight: 48,
                cursor: wishlistLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {inWishlist ? '♥ Saved' : '♡ Save'}
            </button>
            <Link to="/BuyItAll/cart" style={{ textDecoration: 'none', flex: 1 }}>
              <button style={{ width: '100%', background: '#fff', border: '2px solid #e65100', color: '#e65100', padding: '0.9rem', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: 48 }}>
                View basket
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Product details */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', marginTop: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#333' }}>Product details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', fontSize: '0.88rem' }}>
          {[
            ['SKU', `#${product.id?.slice(0, 8).toUpperCase()}`],
            ['Category', product.category || 'General'],
            ['Delivery', '2–5 working days'],
            ['Returns', '30-day free returns'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #f0f2f5' }}>
              <span style={{ color: '#888', minWidth: 80 }}>{k}</span>
              <span style={{ fontWeight: 500, color: '#333' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
