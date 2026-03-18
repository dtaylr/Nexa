import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface LabResult {
  id: string;
  testName: string;
  value: number;
  unit: string;
  referenceMin: number | null;
  referenceMax: number | null;
  status: 'normal' | 'abnormal' | 'critical' | 'pending';
  orderedBy: string;
  collectedAt: string;
  reportedAt: string;
  notes: string | null;
}

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '0.875rem',
  } as React.CSSProperties,
  badge: (status: 'normal' | 'abnormal' | 'critical'): React.CSSProperties => ({
    display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
    background: status === 'normal' ? '#e8f5e9' : status === 'abnormal' ? '#fff8e1' : '#ffebee',
    color: status === 'normal' ? '#1b5e20' : status === 'abnormal' ? '#f59e0b' : '#c62828',
  }),
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LabResults() {
  const { show } = useToast();
  const token = localStorage.getItem('hlt_token') || '';
  const patientId = localStorage.getItem('hlt_patient_id') || '';
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderTestName, setOrderTestName] = useState('');
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    if (!token || !patientId) return;
    fetch(`/api/HealthyU/patients/${patientId}/lab-results`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('fetch'); return r.json(); })
      .then(d => setResults(d.labResults || []))
      .catch(() => show('Could not load lab results', 'error'))
      .finally(() => setLoading(false));
  }, [token, patientId]);

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderTestName.trim()) { show('Test name is required', 'error'); return; }
    setOrdering(true);
    try {
      const res = await fetch(`/api/HealthyU/patients/${patientId}/lab-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testName: orderTestName.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Order failed'); }
      show('Lab order submitted successfully', 'success');
      setOrderTestName('');
      setShowOrderForm(false);
    } catch (err: any) {
      show(err.message || 'Could not create lab order', 'error');
    } finally {
      setOrdering(false);
    }
  }

  if (!token || !patientId) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <div style={{ ...S.card, padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <p style={{ color: '#555', marginBottom: '1rem' }}>Please sign in via the Patient Portal to view your lab results.</p>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', fontWeight: 600 }}>Go to Patient Portal</Link>
        </div>
      </div>
    );
  }

  const critical = results.filter(r => r.status === 'critical');
  const abnormal = results.filter(r => r.status === 'abnormal');
  const normal = results.filter(r => r.status === 'normal');
  const pending = results.filter(r => r.status === 'pending');

  function ResultCard({ r }: { r: LabResult }) {
    const hasRef = r.referenceMin !== null && r.referenceMax !== null;
    const borderColor = r.status === 'normal' ? '#2e7d32' : r.status === 'abnormal' ? '#f59e0b' : r.status === 'critical' ? '#c62828' : '#aaa';
    return (
      <div style={{ ...S.card, borderLeft: `4px solid ${borderColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e' }}>{r.testName}</span>
              <span style={S.badge(r.status as any)}>{r.status}</span>
            </div>
            {r.status !== 'pending' && (
              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1a1a2e', marginBottom: '0.2rem' }}>
                {r.value} <span style={{ fontWeight: 400, fontSize: '0.9rem', color: '#555' }}>{r.unit}</span>
              </div>
            )}
            {hasRef && r.status !== 'pending' && (
              <div style={{ fontSize: '0.82rem', color: '#888' }}>
                Ref: {r.referenceMin}–{r.referenceMax} {r.unit}
              </div>
            )}
            {r.notes && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                {r.notes}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#888', flexShrink: 0 }}>
            {r.orderedBy && <div>Ordered by {r.orderedBy}</div>}
            {r.reportedAt && <div style={{ marginTop: '0.25rem' }}>Reported {formatDate(r.reportedAt)}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', textDecoration: 'none', fontSize: '1.1rem' }}>←</Link>
          <div>
            <h2 style={{ margin: 0, color: '#1a1a2e' }}>Lab Results</h2>
            {!loading && (
              <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
                {results.length} result{results.length !== 1 ? 's' : ''} on record
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowOrderForm(v => !v)}
          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          + Order new test
        </button>
      </div>

      {showOrderForm && (
        <div style={{ ...S.card, border: '1px solid #c8e6c9', borderTop: '4px solid #2e7d32', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#1b5e20' }}>Order a lab test</h3>
          <form onSubmit={submitOrder} noValidate>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                Test name <span style={{ color: '#b71c1c' }}>*</span>
              </label>
              <input
                style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #d0d7de', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const }}
                placeholder="e.g. Complete Blood Count"
                value={orderTestName}
                onChange={e => setOrderTestName(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setShowOrderForm(false); setOrderTestName(''); }}
                style={{ flex: 1, background: '#f0f2f5', border: 'none', padding: '0.7rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={ordering}
                style={{ flex: 2, background: ordering ? '#aaa' : '#2e7d32', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: 8, cursor: ordering ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {ordering ? 'Submitting…' : 'Submit order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          Loading lab results…
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          No lab results on record.
        </div>
      )}

      {critical.length > 0 && (
        <div style={{ background: '#ffebee', border: '2px solid #ef9a9a', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 800, color: '#b71c1c', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Critical — Contact your care team urgently
            </span>
          </div>
          {critical.map(r => <ResultCard key={r.id} r={r} />)}
        </div>
      )}

      {abnormal.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, color: '#e65100', marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Abnormal ({abnormal.length})
          </div>
          {abnormal.map(r => <ResultCard key={r.id} r={r} />)}
        </div>
      )}

      {normal.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Normal ({normal.length})
          </div>
          {normal.map(r => <ResultCard key={r.id} r={r} />)}
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, color: '#888', marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending ({pending.length})
          </div>
          {pending.map(r => <ResultCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
