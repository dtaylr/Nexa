import { useState, useEffect } from 'react';

interface Props {
  booking?: boolean;
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem',
};

export default function Appointments({ booking = false }: Props) {
  const token = localStorage.getItem('hlt_token') || '';
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showBook, setShowBook] = useState(booking);
  const [form, setForm] = useState({ doctorId: '', datetime: '', notes: '' });
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/health/patients/1/appointments', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAppointments(d.appointments || []))
      .catch(console.error);
  }, [token]);

  async function bookAppointment() {
    const res = await fetch('/api/health/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientId: 1, ...form }),
    });
    if (res.ok) {
      const a = await res.json();
      setAppointments(prev => [...prev, a]);
      setShowBook(false);
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
          onClick={() => setShowBook(true)}
          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: 6 }}
        >
          Book appointment
        </button>
      </div>

      {showBook && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>New Appointment</h3>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Doctor</label>
          <select style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}>
            <option value="">Select a doctor…</option>
            <option value="dr-chen-001">Dr Chen (Cardiology)</option>
            <option value="dr-patel-002">Dr Patel (General Practice)</option>
          </select>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Date &amp; Time</label>
          <input type="datetime-local" style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} onChange={e => setForm(f => ({ ...f, datetime: e.target.value }))} />
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Notes (optional)</label>
          <textarea style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} rows={3} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button onClick={bookAppointment} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: 6 }}>Confirm booking</button>
        </div>
      )}

      {appointments.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.doctorId}</div>
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
                  style={{ background: 'none', border: '1px solid #ccc', padding: '0.3rem 0.8rem', borderRadius: 4, fontSize: '0.85rem' }}
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
              <button onClick={() => setCancelDialog(null)} style={{ flex: 1, padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6 }}>Keep appointment</button>
              <button onClick={() => cancelAppointment(cancelDialog)} style={{ flex: 1, background: '#c62828', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: 6 }}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
