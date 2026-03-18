import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface InsuranceRecord {
  id: string;
  provider: string;
  policyNumber: string;
  groupNumber: string;
  memberName: string;
  effectiveDate: string;
  expirationDate: string;
  copay: number;
  status: string;
}

interface InsuranceForm {
  provider: string;
  policyNumber: string;
  groupNumber: string;
  memberName: string;
  effectiveDate: string;
  expirationDate: string;
  copay: string;
}

const EMPTY_FORM: InsuranceForm = {
  provider: '', policyNumber: '', groupNumber: '', memberName: '',
  effectiveDate: '', expirationDate: '', copay: '',
};

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '0.875rem',
  } as React.CSSProperties,
  inp: (err?: boolean) => ({
    width: '100%', padding: '0.7rem 1rem', border: `1px solid ${err ? '#ef5350' : '#d0d7de'}`,
    borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const,
    background: err ? '#fff8f8' : '#fff',
  } as React.CSSProperties),
  label: {
    display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333',
  } as React.CSSProperties,
  errMsg: { color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' } as React.CSSProperties,
  badge: (status: string): React.CSSProperties => ({
    display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
    background: status === 'active' ? '#e8f5e9' : status === 'expired' ? '#ffebee' : '#f5f5f5',
    color: status === 'active' ? '#1b5e20' : status === 'expired' ? '#c62828' : '#757575',
  }),
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Insurance() {
  const { show } = useToast();
  const token = localStorage.getItem('hlt_token') || '';
  const patientId = localStorage.getItem('hlt_patient_id') || '';
  const [insurance, setInsurance] = useState<InsuranceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<InsuranceForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<InsuranceForm>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || !patientId) return;
    fetch(`/api/HealthyU/patients/${patientId}/insurance`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('fetch'); return r.json(); })
      .then(d => setInsurance(d.insurance || []))
      .catch(() => show('Could not load insurance information', 'error'))
      .finally(() => setLoading(false));
  }, [token, patientId]);

  function openEdit(record?: InsuranceRecord) {
    if (record) {
      setForm({
        provider: record.provider,
        policyNumber: record.policyNumber,
        groupNumber: record.groupNumber || '',
        memberName: record.memberName,
        effectiveDate: record.effectiveDate ? record.effectiveDate.slice(0, 10) : '',
        expirationDate: record.expirationDate ? record.expirationDate.slice(0, 10) : '',
        copay: String(record.copay ?? ''),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setEditing(true);
  }

  function validate(): boolean {
    const e: Partial<InsuranceForm> = {};
    if (!form.provider.trim()) e.provider = 'Provider is required';
    if (!form.policyNumber.trim()) e.policyNumber = 'Policy number is required';
    if (!form.memberName.trim()) e.memberName = 'Member name is required';
    if (!form.effectiveDate) e.effectiveDate = 'Effective date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { show('Please fix the errors below', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/HealthyU/patients/${patientId}/insurance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          copay: form.copay ? parseFloat(form.copay) : 0,
        }),
      });
      if (res.ok) {
        const refreshed = await fetch(`/api/HealthyU/patients/${patientId}/insurance`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json());
        setInsurance(refreshed.insurance || []);
        setEditing(false);
        show('Insurance information updated successfully', 'success');
      } else {
        const err = await res.json();
        show(err.error || 'Could not update insurance', 'error');
      }
    } catch {
      show('Network error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function field(name: keyof InsuranceForm, label: string, type = 'text', required = false) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={S.label}>{label}{required && <span style={{ color: '#b71c1c' }}> *</span>}</label>
        <input
          type={type}
          style={S.inp(!!errors[name])}
          value={form[name]}
          onChange={ev => { setForm(f => ({ ...f, [name]: ev.target.value })); setErrors(er => ({ ...er, [name]: '' })); }}
        />
        {errors[name] && <span style={S.errMsg}>{errors[name]}</span>}
      </div>
    );
  }

  if (!token || !patientId) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <div style={{ ...S.card, padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <p style={{ color: '#555', marginBottom: '1rem' }}>Please sign in via the Patient Portal to manage your insurance.</p>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', fontWeight: 600 }}>Go to Patient Portal</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', textDecoration: 'none', fontSize: '1.1rem' }}>←</Link>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Insurance</h2>
        </div>
        {!editing && (
          <button
            onClick={() => openEdit(insurance[0])}
            style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
          >
            {insurance.length === 0 ? '+ Add Insurance' : 'Update Insurance'}
          </button>
        )}
      </div>

      {editing && (
        <div style={{ ...S.card, border: '1px solid #c8e6c9', borderTop: '4px solid #2e7d32', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#1b5e20' }}>
            {insurance.length === 0 ? 'Add Insurance' : 'Update Insurance'}
          </h3>
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <div>{field('provider', 'Insurance Provider', 'text', true)}</div>
              <div>{field('policyNumber', 'Policy Number', 'text', true)}</div>
              <div>{field('groupNumber', 'Group Number')}</div>
              <div>{field('memberName', 'Member Name', 'text', true)}</div>
              <div>{field('effectiveDate', 'Effective Date', 'date', true)}</div>
              <div>{field('expirationDate', 'Expiration Date', 'date')}</div>
              <div>
                <label style={S.label}>Copay ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={S.inp()}
                  value={form.copay}
                  onChange={ev => setForm(f => ({ ...f, copay: ev.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setEditing(false); setErrors({}); }}
                style={{ flex: 1, background: '#f0f2f5', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ flex: 2, background: submitting ? '#aaa' : '#2e7d32', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {submitting ? 'Saving…' : 'Save Insurance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          Loading insurance information…
        </div>
      )}

      {!loading && insurance.length === 0 && !editing && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏥</div>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#555' }}>No insurance on file</div>
          <div style={{ fontSize: '0.9rem', color: '#888' }}>Click "Add Insurance" to add your insurance details.</div>
        </div>
      )}

      {insurance.map(ins => (
        <div key={ins.id} style={{ ...S.card, borderLeft: '4px solid #1565c0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1a1a2e', marginBottom: '0.25rem' }}>{ins.provider}</div>
              <div style={{ fontSize: '0.9rem', color: '#555' }}>{ins.memberName}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={S.badge(ins.status)}>{ins.status}</span>
              <button
                onClick={() => openEdit(ins)}
                style={{ background: 'none', border: '1px solid #d0d7de', padding: '0.3rem 0.8rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: '#555', fontWeight: 600 }}
              >
                Edit
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {[
              { label: 'Policy Number', value: ins.policyNumber },
              { label: 'Group Number', value: ins.groupNumber || '—' },
              { label: 'Effective Date', value: formatDate(ins.effectiveDate) },
              { label: 'Expiration Date', value: formatDate(ins.expirationDate) },
              { label: 'Copay', value: ins.copay != null ? `$${ins.copay.toFixed(2)}` : '—' },
            ].map(item => (
              <div key={item.label} style={{ background: '#f5f6fa', borderRadius: 8, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>{item.label}</div>
                <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: '0.9rem' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
