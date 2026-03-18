import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Bill {
  id: string;
  description: string;
  amount: number;
  status: 'pending' | 'paid' | 'denied' | 'disputed';
  serviceDate: string;
  dueDate: string;
  paidAt: string | null;
  insuranceCovered: number;
  patientResponsibility: number;
}

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '0.875rem',
  } as React.CSSProperties,
  badge: (status: 'pending' | 'paid' | 'denied' | 'disputed'): React.CSSProperties => ({
    display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
    background: status === 'paid' ? '#e8f5e9' : status === 'pending' ? '#fff8e1' : status === 'denied' ? '#ffebee' : '#f3e5f5',
    color: status === 'paid' ? '#1b5e20' : status === 'pending' ? '#f59e0b' : status === 'denied' ? '#c62828' : '#6a1b9a',
  }),
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function Billing() {
  const { show } = useToast();
  const token = localStorage.getItem('hlt_token') || '';
  const patientId = localStorage.getItem('hlt_patient_id') || '';
  const [bills, setBills] = useState<Bill[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'card' | 'bank_transfer'>('card');
  const [submittingPay, setSubmittingPay] = useState(false);

  useEffect(() => {
    if (!token || !patientId) return;
    fetch(`/api/HealthyU/patients/${patientId}/billing`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('fetch'); return r.json(); })
      .then(d => {
        setBills(d.bills || []);
        setOutstanding(typeof d.outstanding === 'number' ? d.outstanding : 0);
      })
      .catch(() => show('Could not load billing information', 'error'))
      .finally(() => setLoading(false));
  }, [token, patientId]);

  async function payBill(bill: Bill) {
    setSubmittingPay(true);
    try {
      const res = await fetch(`/api/HealthyU/patients/${patientId}/billing/${bill.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: bill.patientResponsibility, method: payMethod }),
      });
      if (res.ok) {
        setBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'paid', paidAt: new Date().toISOString() } : b));
        setOutstanding(prev => Math.max(0, prev - bill.patientResponsibility));
        setPayingId(null);
        show('Payment processed successfully', 'success');
      } else {
        const err = await res.json();
        show(err.error || 'Payment failed. Please try again.', 'error');
      }
    } catch {
      show('Network error. Please try again.', 'error');
    } finally {
      setSubmittingPay(false);
    }
  }

  if (!token || !patientId) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <div style={{ ...S.card, padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <p style={{ color: '#555', marginBottom: '1rem' }}>Please sign in via the Patient Portal to view your billing.</p>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', fontWeight: 600 }}>Go to Patient Portal</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', textDecoration: 'none', fontSize: '1.1rem' }}>←</Link>
        <h2 style={{ margin: 0, color: '#1a1a2e' }}>Billing &amp; Payments</h2>
      </div>

      {/* Outstanding balance banner */}
      {!loading && outstanding > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.5rem' }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: '1rem' }}>Outstanding Balance</div>
            <div style={{ color: '#78350f', fontSize: '0.9rem' }}>You have an unpaid balance. Please review and pay the bills below.</div>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.5rem', color: '#92400e' }}>{formatMoney(outstanding)}</div>
        </div>
      )}

      {!loading && outstanding === 0 && bills.length > 0 && (
        <div style={{ background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '1.5rem' }}>✅</div>
          <div style={{ fontWeight: 600, color: '#1b5e20' }}>All paid up! No outstanding balance.</div>
        </div>
      )}

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          Loading billing information…
        </div>
      )}

      {!loading && bills.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          No billing records on file.
        </div>
      )}

      {bills.map(bill => (
        <div key={bill.id} style={{ ...S.card, borderLeft: `4px solid ${bill.status === 'paid' ? '#2e7d32' : bill.status === 'pending' ? '#f59e0b' : bill.status === 'denied' ? '#c62828' : '#6a1b9a'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e' }}>{bill.description}</span>
                <span style={S.badge(bill.status)}>{bill.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Service Date</div>
                  <div style={{ fontSize: '0.9rem', color: '#555' }}>{formatDate(bill.serviceDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Due Date</div>
                  <div style={{ fontSize: '0.9rem', color: '#555' }}>{formatDate(bill.dueDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Total Amount</div>
                  <div style={{ fontSize: '0.9rem', color: '#555' }}>{formatMoney(bill.amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Insurance Covered</div>
                  <div style={{ fontSize: '0.9rem', color: '#1b5e20' }}>{formatMoney(bill.insuranceCovered)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Your Responsibility</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: bill.status === 'paid' ? '#1b5e20' : '#c62828' }}>{formatMoney(bill.patientResponsibility)}</div>
                </div>
                {bill.paidAt && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Paid On</div>
                    <div style={{ fontSize: '0.9rem', color: '#555' }}>{formatDate(bill.paidAt)}</div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {bill.status === 'pending' && payingId !== bill.id && (
                <button
                  onClick={() => { setPayingId(bill.id); setPayMethod('card'); }}
                  style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
                >
                  Pay Now
                </button>
              )}
            </div>
          </div>

          {/* Inline payment panel */}
          {bill.status === 'pending' && payingId === bill.id && (
            <div style={{ marginTop: '1rem', background: '#f5f6fa', borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#333' }}>
                Select payment method for {formatMoney(bill.patientResponsibility)}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {(['card', 'bank_transfer'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    style={{
                      padding: '0.6rem 1.1rem', borderRadius: 8, cursor: 'pointer',
                      border: payMethod === m ? '2px solid #2e7d32' : '2px solid #d0d7de',
                      background: payMethod === m ? '#e8f5e9' : '#fff',
                      color: payMethod === m ? '#1b5e20' : '#555',
                      fontWeight: payMethod === m ? 700 : 500,
                    }}
                  >
                    {m === 'card' ? '💳 Card' : '🏦 Bank Transfer'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setPayingId(null)}
                  style={{ flex: 1, background: '#f0f2f5', border: 'none', padding: '0.7rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => payBill(bill)}
                  disabled={submittingPay}
                  style={{ flex: 2, background: submittingPay ? '#aaa' : '#2e7d32', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: 8, cursor: submittingPay ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                >
                  {submittingPay ? 'Processing…' : `Confirm Payment of ${formatMoney(bill.patientResponsibility)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
