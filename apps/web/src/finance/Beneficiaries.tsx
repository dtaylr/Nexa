import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Beneficiary {
  id: string;
  name: string;
  accountNumber: string;
  sortCode: string;
  reference: string | null;
  createdAt: string;
}

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1rem',
  } as React.CSSProperties,
  inp: {
    width: '100%', padding: '0.7rem 1rem', border: '1px solid #d0d7de',
    borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
  label: {
    display: 'block', marginBottom: '0.4rem', fontWeight: 600,
    fontSize: '0.9rem', color: '#333',
  } as React.CSSProperties,
  field: { marginBottom: '1.1rem' } as React.CSSProperties,
  btn: (color: string, disabled?: boolean) => ({
    background: disabled ? '#bbb' : color, color: '#fff', border: 'none',
    padding: '0.6rem 1.2rem', borderRadius: 8, fontSize: '0.9rem',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties),
};

function maskAccountNumber(num: string) {
  if (num.length <= 4) return num;
  return '****' + num.slice(-4);
}

function formatSortCode(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 6) return `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4,6)}`;
  return raw;
}

export default function Beneficiaries() {
  const { show } = useToast();
  const token = localStorage.getItem('fin_token') || '';
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', accountNumber: '', sortCode: '', reference: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!token) {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
        <div style={S.card}>
          <p style={{ color: '#555', margin: '0 0 1rem' }}>Please sign in via the Finance dashboard</p>
          <Link to="/BrightBank/dashboard" style={{ color: '#0066cc', fontWeight: 600 }}>Go to Finance Dashboard</Link>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetch('/api/BrightBank/beneficiaries', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setBeneficiaries(d.beneficiaries || []))
      .catch(() => show('Failed to load payees', 'error'))
      .finally(() => setLoading(false));
  }, []);

  function update(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.accountNumber.trim()) e.accountNumber = 'Account number is required';
    if (!form.sortCode.trim()) e.sortCode = 'Sort code is required';
    else if (!/^\d{6}$/.test(form.sortCode.replace(/-/g, ''))) {
      e.sortCode = 'Sort code must be 6 digits (e.g. 20-00-00)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function addPayee(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/BrightBank/beneficiaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          accountNumber: form.accountNumber.trim(),
          sortCode: form.sortCode.trim(),
          reference: form.reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { show(data.error || 'Failed to add payee', 'error'); return; }
      const refreshed = await fetch('/api/BrightBank/beneficiaries', { headers: { Authorization: `Bearer ${token}` } });
      const refreshedData = await refreshed.json();
      setBeneficiaries(refreshedData.beneficiaries || []);
      setForm({ name: '', accountNumber: '', sortCode: '', reference: '' });
      setShowForm(false);
      show(`${form.name} added as a payee`, 'success');
    } catch {
      show('Network error', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePayee(id: string, name: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/BrightBank/beneficiaries/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { show(data.error || 'Delete failed', 'error'); return; }
      setBeneficiaries(prev => prev.filter(b => b.id !== id));
      show(`${name} removed`, 'info');
    } catch {
      show('Network error', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1a1a2e' }}>Saved Payees</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            {beneficiaries.length} saved payee{beneficiaries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={S.btn('#0066cc')}>
          {showForm ? 'Cancel' : '+ Add Payee'}
        </button>
      </div>

      {showForm && (
        <div style={{ ...S.card, borderTop: '4px solid #0066cc', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#1a1a2e' }}>Add New Payee</h3>
          <form onSubmit={addPayee} noValidate>
            <div style={S.field}>
              <label style={S.label} htmlFor="payee-name">Name <span style={{ color: '#b71c1c' }}>*</span></label>
              <input
                id="payee-name"
                style={{ ...S.inp, border: errors.name ? '1px solid #ef5350' : '1px solid #d0d7de' }}
                placeholder="e.g. Bob Jones"
                value={form.name}
                onChange={e => update('name', e.target.value)}
              />
              {errors.name && <span style={{ color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' }}>{errors.name}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
              <div>
                <label style={S.label} htmlFor="account-number">Account Number <span style={{ color: '#b71c1c' }}>*</span></label>
                <input
                  id="account-number"
                  style={{ ...S.inp, border: errors.accountNumber ? '1px solid #ef5350' : '1px solid #d0d7de' }}
                  placeholder="e.g. 12345678"
                  value={form.accountNumber}
                  onChange={e => update('accountNumber', e.target.value)}
                />
                {errors.accountNumber && <span style={{ color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' }}>{errors.accountNumber}</span>}
              </div>
              <div>
                <label style={S.label} htmlFor="sort-code">Sort Code <span style={{ color: '#b71c1c' }}>*</span></label>
                <input
                  id="sort-code"
                  style={{ ...S.inp, border: errors.sortCode ? '1px solid #ef5350' : '1px solid #d0d7de' }}
                  placeholder="e.g. 20-00-00"
                  value={form.sortCode}
                  onChange={e => update('sortCode', e.target.value)}
                  maxLength={8}
                />
                {errors.sortCode && <span style={{ color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' }}>{errors.sortCode}</span>}
              </div>
            </div>
            <div style={S.field}>
              <label style={S.label} htmlFor="payee-reference">Reference <span style={{ color: '#888', fontWeight: 400 }}>(optional)</span></label>
              <input
                id="payee-reference"
                style={S.inp}
                placeholder="e.g. Rent, Utilities"
                value={form.reference}
                onChange={e => update('reference', e.target.value)}
                maxLength={50}
              />
            </div>
            <button type="submit" disabled={submitting} style={S.btn('#0066cc', submitting)}>
              {submitting ? 'Saving…' : 'Save Payee'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>Loading payees…</div>
      ) : beneficiaries.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👤</div>
          <p style={{ margin: 0, fontWeight: 600, color: '#555' }}>No saved payees yet.</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Add a payee to make transfers faster.</p>
        </div>
      ) : (
        <div>
          {beneficiaries.map(b => (
            <div key={b.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0d47a1, #0066cc)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                    }}>
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '1rem' }}>{b.name}</div>
                      {b.reference && (
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{b.reference}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#555', paddingLeft: '52px' }}>
                    <span>
                      <span style={{ color: '#999', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{maskAccountNumber(b.accountNumber)}</span>
                    </span>
                    <span>
                      <span style={{ color: '#999', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort code </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatSortCode(b.sortCode)}</span>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deletePayee(b.id, b.name)}
                  disabled={deletingId === b.id}
                  style={{
                    background: 'none', border: '1px solid #ef9a9a', color: '#b71c1c',
                    padding: '0.45rem 0.9rem', borderRadius: 8, fontSize: '0.85rem',
                    fontWeight: 600, cursor: deletingId === b.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0, opacity: deletingId === b.id ? 0.5 : 1,
                  }}
                >
                  {deletingId === b.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
