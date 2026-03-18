import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Props { booking?: boolean; }

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
  errMsg: { color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' } as React.CSSProperties,
};

const DOCTORS = [
  { id: 'dr-chen-001',   name: 'Dr Chen',   specialty: 'Cardiology', avatar: '👨‍⚕️' },
  { id: 'dr-patel-002',  name: 'Dr Patel',  specialty: 'General Practice', avatar: '👩‍⚕️' },
  { id: 'dr-okonkwo-003',name: 'Dr Okonkwo',specialty: 'Neurology', avatar: '👨‍⚕️' },
  { id: 'dr-walsh-004',  name: 'Dr Walsh',  specialty: 'Dermatology', avatar: '👩‍⚕️' },
];

const APPOINTMENT_TYPES = [
  'Routine check-up',
  'Follow-up consultation',
  'Medication review',
  'Referral appointment',
  'Test results discussion',
  'Other',
];

const statusStyle = (s: string): React.CSSProperties => ({
  display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
  fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
  background: s === 'scheduled' ? '#e8f5e9' : s === 'completed' ? '#e3f2fd' : '#ffebee',
  color: s === 'scheduled' ? '#2e7d32' : s === 'completed' ? '#1565c0' : '#c62828',
});

export default function Appointments({ booking = false }: Props) {
  const navigate = useNavigate();
  const { show } = useToast();
  const token = localStorage.getItem('hlt_token') || '';
  const patientId = localStorage.getItem('hlt_patient_id') || '1';

  const [appointments, setAppointments] = useState<any[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showBook, setShowBook] = useState(booking);
  const [form, setForm] = useState({ doctorId: '', datetime: '', type: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);

  // Focus trap for cancel dialog
  const cancelModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cancelDialog && cancelModalRef.current) {
      const firstBtn = cancelModalRef.current.querySelector('button') as HTMLButtonElement;
      firstBtn?.focus();
    }
  }, [cancelDialog]);

  useEffect(() => {
    if (!token) { navigate('/HealthyU/dashboard'); return; }
    fetch(`/api/HealthyU/patients/${patientId}/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setAppointments(d.appointments || []))
      .catch(() => show('Could not load appointments', 'error'));
  }, [token, patientId]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.doctorId) e.doctorId = 'Please select a doctor';
    if (!form.type) e.type = 'Please select an appointment type';
    if (!form.datetime) e.datetime = 'Please select a date and time';
    else {
      const selected = new Date(form.datetime);
      if (selected <= new Date()) e.datetime = 'Appointment must be in the future';
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      show('Please fix the errors below', 'error');
      return false;
    }
    return true;
  }

  async function bookAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/HealthyU/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: parseInt(patientId, 10), ...form }),
      });
      if (res.ok) {
        const a = await res.json();
        setAppointments(prev => [a, ...prev]);
        setShowBook(false);
        setForm({ doctorId: '', datetime: '', type: '', notes: '' });
        setErrors({});
        show('Appointment booked successfully', 'success');
      } else {
        const err = await res.json();
        show(err.error || 'Booking failed. Please try again.', 'error');
      }
    } catch {
      show('Network error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelAppointment(id: string) {
    try {
      await fetch(`/api/HealthyU/appointments/${id}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
      setCancelDialog(null);
      show('Appointment cancelled', 'info');
    } catch {
      show('Could not cancel appointment', 'error');
    }
  }

  const now = new Date();
  const upcoming = appointments.filter(a => a.status === 'scheduled' && new Date(a.datetime) >= now);
  const past = appointments.filter(a => a.status !== 'scheduled' || new Date(a.datetime) < now);
  const displayed = tab === 'upcoming' ? upcoming : past;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', textDecoration: 'none', fontSize: '1.1rem' }}>←</Link>
          <h2 style={{ margin: 0 }}>Appointments</h2>
        </div>
        <button
          onClick={() => { setShowBook(true); setErrors({}); }}
          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          + Book appointment
        </button>
      </div>

      {/* Booking form */}
      {showBook && (
        <div style={{ ...S.card, border: '1px solid #c8e6c9', borderTop: '4px solid #2e7d32', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#1b5e20' }}>New appointment</h3>
          <form onSubmit={bookAppointment} noValidate>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                Doctor <span style={{ color: '#b71c1c' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                {DOCTORS.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, doctorId: d.id })); setErrors(e => ({ ...e, doctorId: '' })); }}
                    style={{
                      padding: '0.75rem', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: form.doctorId === d.id ? '2px solid #2e7d32' : '2px solid #d0d7de',
                      background: form.doctorId === d.id ? '#e8f5e9' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{d.avatar}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e' }}>{d.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#666' }}>{d.specialty}</div>
                  </button>
                ))}
              </div>
              {errors.doctorId && <span style={S.errMsg}>{errors.doctorId}</span>}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                Appointment type <span style={{ color: '#b71c1c' }}>*</span>
              </label>
              <select style={S.inp(!!errors.type)} value={form.type} onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setErrors(er => ({ ...er, type: '' })); }}>
                <option value="">Select type…</option>
                {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.type && <span style={S.errMsg}>{errors.type}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                  Date &amp; time <span style={{ color: '#b71c1c' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  style={S.inp(!!errors.datetime)}
                  min={new Date().toISOString().slice(0, 16)}
                  value={form.datetime}
                  onChange={e => { setForm(f => ({ ...f, datetime: e.target.value })); setErrors(er => ({ ...er, datetime: '' })); }}
                />
                {errors.datetime && <span style={S.errMsg}>{errors.datetime}</span>}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                Notes <span style={{ color: '#888', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                style={{ ...S.inp(), minHeight: 72, resize: 'vertical' as const }}
                placeholder="Any additional information for your doctor…"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setShowBook(false); setErrors({}); }}
                style={{ flex: 1, background: '#f0f2f5', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ flex: 2, background: submitting ? '#aaa' : '#2e7d32', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {submitting ? 'Booking…' : 'Confirm booking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1rem', background: '#f0f2f5', borderRadius: 10, padding: '0.25rem' }}>
        {(['upcoming', 'past'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#1a1a2e' : '#666',
              fontWeight: tab === t ? 700 : 500,
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {/* Appointment list */}
      {displayed.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          {tab === 'upcoming'
            ? 'No upcoming appointments. Click "Book appointment" to schedule one.'
            : 'No past appointments on record.'}
        </div>
      )}

      {displayed.map(a => {
        const doc = DOCTORS.find(d => d.id === a.doctorId);
        return (
          <div key={a.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                  {doc?.avatar || '👨‍⚕️'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{doc ? `${doc.name} — ${doc.specialty}` : a.doctorId}</div>
                  <div style={{ color: '#555', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    {new Date(a.datetime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}
                    {new Date(a.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {a.type && <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.2rem' }}>{a.type}</div>}
                  {a.notes && <div style={{ color: '#777', fontSize: '0.85rem', marginTop: '0.25rem', fontStyle: 'italic' }}>"{a.notes}"</div>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                <span style={statusStyle(a.status)}>{a.status}</span>
                {a.status === 'scheduled' && (
                  <button
                    onClick={() => setCancelDialog(a.id)}
                    style={{ background: 'none', border: '1px solid #ccc', padding: '0.3rem 0.8rem', borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer', color: '#666' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Cancel dialog — with focus trap (BUG CANCEL_DIALOG_FOCUS_TRAP: no focus trap in original) */}
      {cancelDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setCancelDialog(null); }}
        >
          {/* BUG CANCEL_DIALOG_FOCUS_TRAP preserved: no focus trap implementation — intentional for test detection */}
          <div ref={cancelModalRef} style={{ background: '#fff', borderRadius: 12, padding: '2rem', maxWidth: 380, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 id="cancel-dialog-title" style={{ marginTop: 0, marginBottom: '0.5rem' }}>Cancel this appointment?</h3>
            <p style={{ color: '#555', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
              This action cannot be undone. The appointment slot will be released.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setCancelDialog(null)}
                style={{ flex: 1, padding: '0.75rem', border: '1px solid #d0d7de', borderRadius: 8, cursor: 'pointer', background: '#f0f2f5', fontWeight: 600 }}
              >
                Keep appointment
              </button>
              <button
                onClick={() => cancelAppointment(cancelDialog)}
                style={{ flex: 1, background: '#c62828', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
