import { useState } from 'react';
import { Link } from 'react-router-dom';

type Step = 'details' | 'payment' | 'done';

const fieldStyle: React.CSSProperties = { marginBottom: '1rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' };
// BUG COM-005: no max-width constraint on inputs — causes horizontal scroll on 375px viewport
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' };

interface CartItem { productId: string; name: string; price: number; quantity: number; }

function requiredLabel(text: string) {
  return <>{text} <span style={{ color: '#c62828' }}>*</span></>;
}

export default function Checkout() {
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', address: '', postcode: '',
    cardNumber: '', expiry: '', cvv: '',
  });
  const [fieldError, setFieldError] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{ orderId: string; total: number; items: any[] } | null>(null);

  const cartItems: CartItem[] = JSON.parse(localStorage.getItem('cart') || '[]');
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const update = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setFieldError(''); };

  function toPayment() {
    if (!form.firstName.trim()) { setFieldError('First name is required'); return; }
    if (!form.lastName.trim()) { setFieldError('Last name is required'); return; }
    if (!form.email.trim()) { setFieldError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setFieldError('Please enter a valid email address'); return; }
    if (!form.address.trim()) { setFieldError('Delivery address is required'); return; }
    if (!form.postcode.trim()) { setFieldError('Postcode is required'); return; }
    if (cartItems.length === 0) { setFieldError('Your basket is empty'); return; }
    setFieldError('');
    setStep('payment');
  }

  async function placeOrder() {
    if (!form.cardNumber.trim()) { setFieldError('Card number is required'); return; }
    if (form.cardNumber.replace(/\s/g, '').length < 12) { setFieldError('Card number must be at least 12 digits'); return; }
    if (!form.expiry.trim()) { setFieldError('Expiry date is required'); return; }
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) { setFieldError('Expiry must be MM/YY'); return; }
    if (!form.cvv.trim() || form.cvv.length < 3) { setFieldError('CVV must be 3 or 4 digits'); return; }

    setSubmitting(true);
    setApiError('');
    setFieldError('');

    try {
      // 1. Authenticate as the demo shopper account
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'shopper@nexacore.dev', password: 'password123' }),
      });
      if (!loginRes.ok) throw new Error('Authentication failed. Please try again.');
      const { token } = await loginRes.json();
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // 2. Create a server-side cart
      const cartRes = await fetch('/api/commerce/cart', { method: 'POST', headers });
      if (!cartRes.ok) throw new Error('Failed to create cart. Please try again.');
      const { id: cartId } = await cartRes.json();

      // 3. Add each item from the local basket to the server cart
      for (const item of cartItems) {
        const addRes = await fetch(`/api/commerce/cart/${cartId}/items`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ productId: item.productId, quantity: item.quantity }),
        });
        if (!addRes.ok) {
          const err = await addRes.json();
          throw new Error(err.error === 'OUT_OF_STOCK' ? `${item.name} is out of stock` : `Failed to add ${item.name} to order`);
        }
      }

      // 4. Create the order
      const orderRes = await fetch('/api/commerce/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({ cartId }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || 'Failed to create order');
      }
      const order = await orderRes.json();

      // 5. Process payment
      const payRes = await fetch(`/api/commerce/orders/${order.orderId}/payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ method: 'card', amount: order.total, currency: 'GBP', cardToken: 'tok_demo' }),
      });
      if (!payRes.ok) throw new Error('Payment could not be processed. Please check your card details.');

      // 6. Confirm and clear basket
      localStorage.removeItem('cart');
      setConfirmedOrder({ orderId: order.orderId, total: order.total, items: order.items });
      setStep('done');
    } catch (e: any) {
      setApiError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Confirmation
  if (step === 'done' && confirmedOrder) {
    return (
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: '3rem 2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✓</div>
          <h2 data-testid="order-confirmation-heading" style={{ marginTop: 0 }}>Order confirmed!</h2>
          <p>Thank you, {form.firstName}. Your order is on its way.</p>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>
            Order: <strong data-testid="order-number">{confirmedOrder.orderId}</strong>
          </p>
          <p style={{ fontSize: '0.85rem', color: '#888' }}>Confirmation sent to {form.email}</p>
          <div style={{ margin: '1rem 0', textAlign: 'left', background: '#f9f9f9', borderRadius: 6, padding: '0.75rem 1rem' }}>
            {confirmedOrder.items.map((i: any) => (
              <div key={i.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', margin: '0.25rem 0' }}>
                <span>{i.name} × {i.quantity}</span>
                <span>£{(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total</span>
              <span>£{confirmedOrder.total.toFixed(2)}</span>
            </div>
          </div>
          <Link to="/products">
            <button style={{ marginTop: '1rem', background: '#e65100', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: 'pointer' }}>
              Continue shopping
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Payment step
  if (step === 'payment') {
    return (
      <div style={{ maxWidth: 480 }}>
        <h2>Payment</h2>
        <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1rem', border: '1px solid #eee' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Order summary</div>
          {cartItems.map(i => (
            <div key={i.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#555', marginBottom: '0.25rem' }}>
              <span>{i.name} × {i.quantity}</span>
              <span>£{(i.price * i.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total</span>
            <span>£{total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="card-number">{requiredLabel('Card number')}</label>
            <input id="card-number" style={inputStyle} placeholder="4242 4242 4242 4242" value={form.cardNumber} onChange={e => update('cardNumber', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle} htmlFor="expiry">{requiredLabel('Expiry')}</label>
              <input id="expiry" style={inputStyle} placeholder="MM/YY" value={form.expiry} maxLength={5} onChange={e => update('expiry', e.target.value)} />
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle} htmlFor="cvv">{requiredLabel('CVV')}</label>
              <input id="cvv" style={inputStyle} placeholder="123" value={form.cvv} maxLength={4} onChange={e => update('cvv', e.target.value)} />
            </div>
          </div>

          {(fieldError || apiError) && (
            <p role="alert" style={{ color: '#c62828', margin: '0 0 1rem', fontSize: '0.9rem' }}>{fieldError || apiError}</p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => { setStep('details'); setFieldError(''); setApiError(''); }}
              style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', padding: '0.75rem', borderRadius: 6, cursor: 'pointer' }}
            >Back</button>
            <button
              onClick={placeOrder}
              disabled={submitting}
              style={{ flex: 2, background: submitting ? '#aaa' : '#e65100', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: 8, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Processing…' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Details step
  return (
    <div style={{ maxWidth: 480 }}>
      <h2>Checkout</h2>

      {cartItems.length > 0 && (
        <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1rem', border: '1px solid #eee' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Your basket ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})
          </div>
          {cartItems.map(i => (
            <div key={i.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#555', marginBottom: '0.25rem' }}>
              <span>{i.name} × {i.quantity}</span>
              <span>£{(i.price * i.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.95rem' }}>
            <span>Total</span>
            <span>£{total.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>Your details</h3>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="email">{requiredLabel('Email')}</label>
          {/* BUG COM-005: no max-width constraint on inputs — causes horizontal scroll on 375px viewport */}
          <input id="email" style={inputStyle} type="email" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <label style={labelStyle} htmlFor="first-name">{requiredLabel('First name')}</label>
            <input id="first-name" style={inputStyle} value={form.firstName} onChange={e => update('firstName', e.target.value)} />
          </div>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <label style={labelStyle} htmlFor="last-name">{requiredLabel('Last name')}</label>
            <input id="last-name" style={inputStyle} value={form.lastName} onChange={e => update('lastName', e.target.value)} />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="address">{requiredLabel('Delivery address')}</label>
          <input id="address" style={inputStyle} placeholder="1 Example Street, London" value={form.address} onChange={e => update('address', e.target.value)} />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="postcode">{requiredLabel('Postcode')}</label>
          <input id="postcode" style={{ ...inputStyle, maxWidth: 160 }} placeholder="SW1A 1AA" value={form.postcode} onChange={e => update('postcode', e.target.value)} />
        </div>

        {fieldError && (
          <p role="alert" style={{ color: '#c62828', margin: '0 0 1rem', fontSize: '0.9rem' }}>{fieldError}</p>
        )}

        <button
          onClick={toPayment}
          style={{ width: '100%', background: '#e65100', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: 8, fontSize: '1rem', minHeight: 44, cursor: 'pointer' }}
        >
          Continue to payment
        </button>
      </div>
    </div>
  );
}
