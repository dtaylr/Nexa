import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  booking?: boolean;
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem',
};

const doctorNames: Record<string, string> = {
  'dr-chen-001': 'Dr Chen (Cardiology)',
  'dr-patel-002': 'Dr Patel (General Practice)',
};

export default function Appointments({ booking = false }: Props) {
  const navigate = useNavigate();
  const token = localStorage.getItem('hlt_token') || '';
  const patientId = localStorage.getItem('hlt_patient_id') || '1';
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showBook, setShowBook] = useState(booking);
  const [form, setForm] = useState({ doctorId: '', datetime: '', notes: '' });
  const [bookError, setBookError] = useState('');
  const [booking2, setBooking2] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { navigate('/health/dashboard'); return; }
    fetch(`/api/health/patients/${patientId}/appointments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAppointments(d.appointments || []))
      .catch(console.error);
  }, [token, patientId]);

  async function bookAppointment() {
    if (!form.doctorId) { setBookError('Please select a doctor'); return; }
    if (!form.datetime) { setBookError('Please select a date and time'); return; }
    setBookError('');
    setBooking2(true);
    try {
      const res = await fetch('/api/health/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: parseInt(patientId, 10), ...form }),
      });
      if (res.ok) {
        const a = await res.json();
        setAppointments(prev => [...prev, a]);
        setShowBook(false);
        setForm({ doctorId: '', datetime: '', notes: '' });
      } else {
        const err = await res.json();
        setBookError(err.error || 'Booking failed. Please try again.');
      }
    } catch {
      setBookError('Network error. Please try again.');
    } finally {
      setBooking2(false);
    }
  }

  async function cancelAppointment(id: string) {
    await fetch(`/api/health/appointments/${id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
    setCancelDialog(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Appointments</h2>
        <button
          onClick={() => { setShowBook(true); setBookError(''); }}
          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: 6, cursor: 'pointer' }}
        >
          Book appointment
        </button>
      </div>

      {showBook && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>New Appointment</h3>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Doctor <span style={{ color: '#c62828' }}>*</span></label>
          <select
            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ddd', borderRadius: 6 }}
            value={form.doctorId}
            onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}
          >
            <option value="">Select a doctor…</option>
            <option value="dr-chen-001">Dr Chen (Cardiology)</option>
            <option value="dr-patel-002">Dr Patel (General Practice)</option>
          </select>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Date &amp; Time <span style={{ color: '#c62828' }}>*</span></label>
          <input
            type="datetime-local"
            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' as const }}
            value={form.datetime}
            onChange={e => setForm(f => ({ ...f, datetime: e.target.value }))}
          />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Notes (optional)</label>
          <textarea
            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' as const }}
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          {bookError && <p style={{ color: '#c62828', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>{bookError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => { setShowBook(false); setBookError(''); }} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', padding: '0.6rem', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={bookAppointment}
              disabled={booking2}
              style={{ flex: 2, background: booking2 ? '#aaa' : '#2e7d32', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: 6, cursor: booking2 ? 'not-allowed' : 'pointer' }}
            >
              {booking2 ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </div>
      )}

      {appointments.length === 0 && !showBook && (
        <p style={{ color: '#888' }}>No appointments scheduled.</p>
      )}

      {appointments.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{doctorNames[a.doctorId] || a.doctorId}</div>
              <div style={{ color: '#555', fontSize: '0.9rem' }}>{new Date(a.datetime).toLocaleString('en-GB')}</div>
              {a.notes && <div style={{ color: '#777', fontSize: '0.85rem', marginTop: '0.3rem' }}>{a.notes}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
              <span style={{
                padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                background: a.status === 'scheduled' ? '#e8f5e9' : a.status === 'completed' ? '#e3f2fd' : '#ffebee',
                color: a.status === 'scheduled' ? '#2e7d32' : a.status === 'completed' ? '#1565c0' : '#c62828',
              }}>{a.status}</span>

              {/* BUG HLT-004: this button has no keyboard navigation / focus management in the dialog */}
              {a.status === 'scheduled' && (
                <button
                  onClick={() => setCancelDialog(a.id)}
                  style={{ background: 'none', border: '1px solid #ccc', padding: '0.3rem 0.8rem', borderRadius: 4, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel appointment
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {cancelDialog && (
        <div
          role="dialog"
          aria-label="Confirm cancellation"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ marginTop: 0 }}>Cancel this appointment?</h3>
            <p>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {/* BUG HLT-004: no autofocus, no focus trap — keyboard users can't reach these */}
              <button onClick={() => setCancelDialog(null)} style={{ flex: 1, padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Keep appointment</button>
              <button onClick={() => cancelAppointment(cancelDialog)} style={{ flex: 1, background: '#c62828', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: 6, cursor: 'pointer' }}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
