import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

const CATEGORIES = ['All', 'Electronics', 'Books', 'Clothing', 'Home', 'Sports'];

export default function ProductList() {
  const { show } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<'default' | 'price-asc' | 'price-desc' | 'name'>('default');
  const [wishlistAdding, setWishlistAdding] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/commerce/products')
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => show('Could not load products', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const cartCount = JSON.parse(localStorage.getItem('cart') || '[]').reduce((s: number, i: any) => s + i.quantity, 0);

  async function addToWishlist(p: any) {
    const token = localStorage.getItem('shop_token');
    if (!token) { navigate('/BuyItAll/wishlist'); return; }
    setWishlistAdding(prev => ({ ...prev, [p.id]: true }));
    try {
      const res = await fetch('/api/commerce/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: p.id }),
      });
      if (res.ok) show('Saved to wishlist', 'success');
    } catch {
      show('Could not update wishlist', 'error');
    } finally {
      setWishlistAdding(prev => ({ ...prev, [p.id]: false }));
    }
  }

  function addToCart(p: any) {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((i: any) => i.productId === p.id);
    if (existing) existing.quantity += 1;
    else cart.push({ productId: p.id, name: p.name, price: p.price, quantity: 1 });
    localStorage.setItem('cart', JSON.stringify(cart));
    show(`${p.name} added to basket`, 'success');
    // Force re-render for cart badge
    window.dispatchEvent(new Event('cartUpdate'));
  }

  const filtered = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (category !== 'All') {
      list = list.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
    }
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, search, category, sort]);

  return (
    <div>
      {/* Shop header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Shop</h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {loading ? 'Loading…' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/BuyItAll/wishlist" style={{ textDecoration: 'none' }}>
            <button style={{ background: '#fff', border: '1px solid #d0d7de', color: '#444', padding: '0.65rem 1rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
              ♡ Wishlist
            </button>
          </Link>
          <Link to="/BuyItAll/orders" style={{ textDecoration: 'none' }}>
            <button style={{ background: '#fff', border: '1px solid #d0d7de', color: '#444', padding: '0.65rem 1rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
              📦 Orders
            </button>
          </Link>
          <Link to="/BuyItAll/loyalty" style={{ textDecoration: 'none' }}>
            <button style={{ background: '#fff3e0', border: '1px solid #ffcc80', color: '#e65100', padding: '0.65rem 1rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
              ⭐ Rewards
            </button>
          </Link>
          <Link to="/BuyItAll/cart" style={{ textDecoration: 'none' }}>
            <button style={{ background: '#e65100', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🛒 Basket
              {cartCount > 0 && (
                <span style={{ background: '#fff', color: '#e65100', borderRadius: 20, padding: '0.1rem 0.5rem', fontSize: '0.8rem', fontWeight: 800 }}>
                  {cartCount}
                </span>
              )}
            </button>
          </Link>
        </div>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#999', fontSize: '1rem' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.5rem', border: '1px solid #d0d7de', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          style={{ padding: '0.7rem 1rem', border: '1px solid #d0d7de', borderRadius: 8, fontSize: '0.9rem', background: '#fff', cursor: 'pointer' }}
        >
          <option value="default">Sort: Default</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '0.45rem 1rem', minHeight: 44, borderRadius: 20, border: 'none', cursor: 'pointer',
              background: category === cat ? '#e65100' : '#f0f2f5',
              color: category === cat ? '#fff' : '#555',
              fontWeight: category === cat ? 700 : 500,
              fontSize: '0.88rem',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading products…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
          No products match your search.
          <br />
          <button onClick={() => { setSearch(''); setCategory('All'); }} style={{ marginTop: '1rem', background: 'none', border: '1px solid #ccc', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', color: '#444' }}>
            Clear filters
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {filtered.map(p => (
          <div
            key={p.id}
            style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; }}
          >
            <div style={{ height: 180, background: '#f5f5f5', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
              <img
                src={p.imageUrl || `https://picsum.photos/seed/${p.id}/400/180`}
                alt={p.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/fallback-${p.id}/400/180`; }}
              />
              {p.inventory === 0 && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,0.5)', padding: '0.3rem 0.75rem', borderRadius: 6, fontSize: '0.85rem' }}>Out of stock</span>
                </div>
              )}
              {p.inventory > 0 && p.inventory <= 5 && (
                <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: '#e65100', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 6 }}>
                  Only {p.inventory} left
                </div>
              )}
              <button
                onClick={e => { e.preventDefault(); addToWishlist(p); }}
                disabled={wishlistAdding[p.id]}
                title="Save to wishlist"
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  left: '0.5rem',
                  width: 32,
                  height: 32,
                  border: '2px solid #ffccbc',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.92)',
                  color: '#e65100',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: wishlistAdding[p.id] ? 'not-allowed' : 'pointer',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ♡
              </button>
            </div>

            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: '#1a1a2e', fontSize: '0.95rem', lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ color: '#666', fontSize: '0.82rem', flex: 1, marginBottom: '0.75rem', lineHeight: 1.4 }}>
                {p.description?.slice(0, 80)}{p.description?.length > 80 ? '…' : ''}
              </div>

              {/* Star rating (mock) */}
              <div style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                ★★★★{Math.random() > 0.5 ? '★' : '☆'}
                <span style={{ color: '#888', marginLeft: '0.3rem' }}>({Math.floor(Math.random() * 200 + 10)})</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                {/* BUG PRICE_FLOAT_PRECISION preserved: price not rounded */}
                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1a1a2e' }}>${p.price}</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={() => p.inventory > 0 && addToCart(p)}
                    disabled={p.inventory === 0}
                    title={p.inventory === 0 ? 'Out of stock' : 'Add to basket'}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: 8, border: 'none', background: p.inventory === 0 ? '#f0f2f5' : '#fff3e0', color: p.inventory === 0 ? '#bbb' : '#e65100', cursor: p.inventory === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', transition: 'all 0.15s' }}
                  >
                    +🛒
                  </button>
                  <Link to={`/BuyItAll/products/${p.id}`}>
                    <button style={{ padding: '0.45rem 0.875rem', borderRadius: 8, border: '1px solid #d0d7de', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#444', transition: 'all 0.15s' }}>
                      View
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
