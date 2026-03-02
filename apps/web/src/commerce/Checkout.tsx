import { useState } from 'react';

type Step = 'details' | 'payment' | 'done';

const field: React.CSSProperties = { marginBottom: '1rem' };
const label: React.CSSProperties = { display: 'block', fontWeight: 500, marginBottom: '0.3rem', fontSize: '0.9rem' };
const input: React.CSSProperties = { width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' };

export default function Checkout() {
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', address: '', postcode: '', cardNumber: '', expiry: '', cvv: '' });
  const [orderId] = useState(`ORD-${Date.now().toString(36).toUpperCase()}`);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (step === 'details') {
    return (
      <div style={{ maxWidth: 480 }}>
        <h2>Checkout</h2>
        <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>Your details</h3>

          {/* BUG COM-005: no max-width constraint on inputs — causes horizontal scroll on 375px viewport */}
          <div style={field}><label style={label} htmlFor="email">Email</label><input id="email" style={input} type="email" placeholder="you@example.com" onChange={e => update('email', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ ...field, flex: 1 }}><label style={label} htmlFor="first-name">First name</label><input id="first-name" style={input} onChange={e => update('firstName', e.target.value)} /></div>
            <div style={{ ...field, flex: 1 }}><label style={label} htmlFor="last-name">Last name</label><input id="last-name" style={input} onChange={e => update('lastName', e.target.value)} /></div>
          </div>
          <div style={field}><label style={label} htmlFor="address">Address line 1</label><input id="address" style={input} onChange={e => update('address', e.target.value)} /></div>
          <div style={field}><label style={label} htmlFor="postcode">Postcode</label><input id="postcode" style={{ ...input, maxWidth: 160 }} onChange={e => update('postcode', e.target.value)} /></div>

          <button
            onClick={() => setStep('payment')}
            style={{ width: '100%', background: '#e65100', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: 8, fontSize: '1rem', minHeight: 44 }}
          >
            Continue to payment
          </button>
        </div>
      </div>
    );
  }

  if (step === 'payment') {
    return (
      <div style={{ maxWidth: 480 }}>
        <h2>Payment</h2>
        <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={field}><label style={label} htmlFor="card-number">Card number</label><input id="card-number" style={input} placeholder="4242 4242 4242 4242" onChange={e => update('cardNumber', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ ...field, flex: 1 }}><label style={label} htmlFor="expiry">Expiry</label><input id="expiry" style={input} placeholder="MM/YY" onChange={e => update('expiry', e.target.value)} /></div>
            <div style={{ ...field, flex: 1 }}><label style={label} htmlFor="cvv">CVV</label><input id="cvv" style={input} placeholder="123" onChange={e => update('cvv', e.target.value)} /></div>
          </div>
          <button
            onClick={() => setStep('done')}
            style={{ width: '100%', background: '#e65100', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: 8, fontSize: '1rem', minHeight: 44 }}
          >
            Place Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, textAlign: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: '3rem 2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✓</div>
        <h2 data-testid="order-confirmation-heading" style={{ marginTop: 0 }}>Order confirmed!</h2>
        <p>Thank you, {form.firstName}. Your order is on its way.</p>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          Order number: <strong data-testid="order-number">{orderId}</strong>
        </p>
        <p style={{ fontSize: '0.85rem', color: '#888' }}>A confirmation email has been sent to {form.email}</p>
      </div>
    </div>
  );
}
