import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  unit: string;
  frequency: string;
  prescribedBy: string;
  prescribedAt: string;
  expiresAt: string;
  status: 'active' | 'pending_renewal' | 'expired' | 'cancelled';
  refillsRemaining: number;
  notes: string | null;
}

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '0.875rem',
  } as React.CSSProperties,
  badge: (status: 'active' | 'pending_renewal' | 'expired' | 'cancelled'): React.CSSProperties => ({
    display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
    background: status === 'active' ? '#e8f5e9' : status === 'pending_renewal' ? '#fff8e1' : status === 'expired' ? '#fff3e0' : '#f5f5f5',
    color: status === 'active' ? '#1b5e20' : status === 'pending_renewal' ? '#f59e0b' : status === 'expired' ? '#e65100' : '#757575',
  }),
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Prescriptions() {
  const { show } = useToast();
  const token = localStorage.getItem('hlt_token') || '';
  const patientId = localStorage.getItem('hlt_patient_id') || '';
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !patientId) return;
    fetch(`/api/HealthyU/patients/${patientId}/prescriptions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('fetch'); return r.json(); })
      .then(d => setPrescriptions(d.prescriptions || []))
      .catch(() => show('Could not load prescriptions', 'error'))
      .finally(() => setLoading(false));
  }, [token, patientId]);

  async function requestRenewal(id: string) {
    setRenewing(id);
    try {
      const res = await fetch(`/api/HealthyU/patients/${patientId}/prescriptions/${id}/renewal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPrescriptions(prev =>
          prev.map(p => p.id === id ? { ...p, status: 'pending_renewal' } : p)
        );
        show('Renewal request submitted successfully', 'success');
      } else {
        const err = await res.json();
        show(err.error || 'Renewal request failed', 'error');
      }
    } catch {
      show('Network error. Please try again.', 'error');
    } finally {
      setRenewing(null);
    }
  }

  if (!token || !patientId) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <div style={{ ...S.card, padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <p style={{ color: '#555', marginBottom: '1rem' }}>Please sign in via the Patient Portal to view your prescriptions.</p>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', fontWeight: 600 }}>Go to Patient Portal</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', textDecoration: 'none', fontSize: '1.1rem' }}>←</Link>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Prescriptions</h2>
          {!loading && (
            <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
              {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} on record
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          Loading prescriptions…
        </div>
      )}

      {!loading && prescriptions.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          No prescriptions on record.
        </div>
      )}

      {(['active', 'pending_renewal', 'expired', 'cancelled'] as const).map(statusGroup => {
        const group = prescriptions.filter(p => p.status === statusGroup);
        if (group.length === 0) return null;
        const sectionLabel = statusGroup === 'pending_renewal' ? 'Pending Renewal' : statusGroup.charAt(0).toUpperCase() + statusGroup.slice(1);
        const sectionColor = statusGroup === 'active' ? '#2e7d32' : statusGroup === 'pending_renewal' ? '#e65100' : '#888';
        return (
          <div key={statusGroup} style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, color: sectionColor, marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {sectionLabel} ({group.length})
            </div>
            {group.map(p => (
              <div key={p.id} style={{ ...S.card, borderLeft: `4px solid ${p.status === 'active' ? '#2e7d32' : p.status === 'pending_renewal' ? '#f59e0b' : p.status === 'expired' ? '#e65100' : '#ccc'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 36, height: 36, borderRadius: 10, background: '#e8f5e9', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                        💊
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1a1a2e' }}>{p.medicationName}</span>
                      <span style={S.badge(p.status)}>{p.status.replace('_', ' ')}</span>
                    </div>
                    <div style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      {p.dosage} {p.unit} · {p.frequency}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#888' }}>
                      Prescribed by {p.prescribedBy}
                      {p.expiresAt && ` · Expires ${formatDate(p.expiresAt)}`}
                    </div>
                    {p.notes && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                        {p.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Refills</div>
                      <div style={{ fontWeight: 800, fontSize: '1.25rem', color: p.refillsRemaining > 0 ? '#1a1a2e' : '#c62828' }}>
                        {p.refillsRemaining}
                      </div>
                    </div>
                    {p.status === 'active' && p.refillsRemaining > 0 && (
                      <button
                        onClick={() => requestRenewal(p.id)}
                        disabled={renewing === p.id}
                        style={{
                          background: renewing === p.id ? '#aaa' : '#2e7d32',
                          color: '#fff', border: 'none',
                          padding: '0.55rem 1rem', borderRadius: 8,
                          cursor: renewing === p.id ? 'not-allowed' : 'pointer',
                          fontWeight: 600, fontSize: '0.85rem',
                          minHeight: 44,
                        }}
                      >
                        {renewing === p.id ? 'Requesting…' : 'Request Renewal'}
                      </button>
                    )}
                    {p.status === 'active' && p.refillsRemaining === 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#c62828', fontWeight: 600, maxWidth: 120, textAlign: 'right' }}>
                        No refills — contact provider
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
