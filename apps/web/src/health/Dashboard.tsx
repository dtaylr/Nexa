import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1rem',
  } as React.CSSProperties,
  inp: {
    width: '100%', padding: '0.7rem 1rem', border: '1px solid #d0d7de',
    borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  badge: (status: string) => ({
    display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const,
    background: status === 'active' ? '#e8f5e9' : status === 'scheduled' ? '#e3f2fd' : '#f3e5f5',
    color: status === 'active' ? '#1b5e20' : status === 'scheduled' ? '#1565c0' : '#6a1b9a',
  }),
};

const VITALS = [
  { label: 'Blood pressure', value: '118/76', unit: 'mmHg', icon: '❤️', ok: true },
  { label: 'Heart rate', value: '72', unit: 'bpm', icon: '💓', ok: true },
  { label: 'Temperature', value: '36.6', unit: '°C', icon: '🌡️', ok: true },
  { label: 'O₂ saturation', value: '98', unit: '%', icon: '🫁', ok: true },
];

export default function HealthDashboard() {
  const { show } = useToast();
  const [patient, setPatient] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [email, setEmail] = useState('patient.one@1platform.dev');
  const [password, setPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('hlt_token') || '');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/HealthyU/patients/me', { headers })
      .then(r => { if (!r.ok) throw new Error('auth'); return r.json(); })
      .then(p => {
        setPatient(p);
        localStorage.setItem('hlt_patient_id', String(p.id));

        return Promise.all([
          fetch(`/api/HealthyU/patients/${p.id}/medications`, { headers }).then(r => r.json()),
          fetch(`/api/HealthyU/patients/${p.id}/appointments`, { headers }).then(r => r.json()),
        ]);
      })
      .then(([medData, apptData]) => {
        setMedications(medData.medications || []);
        setAppointments(apptData.appointments || []);
      })
      .catch(err => {
        if (err.message === 'auth') {
          localStorage.removeItem('hlt_token');
          localStorage.removeItem('hlt_patient_id');
          setToken('');
          show('Session expired. Please sign in again.', 'warning');
        }
      });
  }, [token]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setLoginError('Email is required'); return; }
    if (!password) { setLoginError('Password is required'); return; }
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Invalid email or password'); return; }
      localStorage.setItem('hlt_token', data.token);
      setToken(data.token);
      show('Signed in to Patient Portal', 'success');
    } catch {
      setLoginError('Cannot reach the API server. Run: npm run dev');
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem('hlt_token');
    localStorage.removeItem('hlt_patient_id');
    setToken('');
    setPatient(null);
    setMedications([]);
    setAppointments([]);
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: '3rem auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥</div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1a1a2e' }}>Patient Portal</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>Your health records, at your fingertips</p>
        </div>
        <div style={S.card}>
          <form onSubmit={login} noValidate>
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="hlt-email" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>Email address</label>
              <input id="hlt-email" type="email" style={S.inp} value={email} onChange={e => { setEmail(e.target.value); setLoginError(''); }} autoComplete="email" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="hlt-password" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>Password</label>
              <input id="hlt-password" type="password" style={S.inp} value={password} onChange={e => { setPassword(e.target.value); setLoginError(''); }} autoComplete="current-password" />
            </div>
            {loginError && (
              <div role="alert" style={{ background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b71c1c', fontSize: '0.9rem' }}>
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: loading ? '#aaa' : '#2e7d32', color: '#fff', border: 'none', padding: '0.85rem', borderRadius: 8, fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: '#f1f8f1', borderRadius: 8, fontSize: '0.85rem', color: '#555' }}>
            <strong>Demo:</strong> patient.one@1platform.dev · password123
          </div>
        </div>
      </div>
    );
  }

  const nextAppt = appointments.find(a => a.status === 'scheduled');
  const activeMeds = medications.filter(m => m.status === 'active');

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', borderRadius: 16, padding: '2rem', color: '#fff', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Welcome back</div>
            <h2 style={{ margin: '0.25rem 0 0.5rem', fontSize: '1.75rem', fontWeight: 800 }}>
              {patient ? `${patient.firstName} ${patient.lastName}` : '…'}
            </h2>
            {patient && (
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                NHS: {patient.nhsNumber || 'N/A'}
                {patient.dateOfBirth && ` · DOB: ${patient.dateOfBirth}`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/HealthyU/appointments" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.4)', color: '#fff', padding: '0.6rem 1.25rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                📅 Appointments
              </button>
            </Link>
            <Link to="/HealthyU/lab-results" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                🧪 Lab Results
              </button>
            </Link>
            <Link to="/HealthyU/prescriptions" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                💊 Prescriptions
              </button>
            </Link>
            <Link to="/HealthyU/messages" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                ✉️ Messages
              </button>
            </Link>
            <Link to="/HealthyU/billing" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                💳 Billing
              </button>
            </Link>
            <Link to="/HealthyU/symptom-checker" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                🩺 Symptom Check
              </button>
            </Link>
            <button
              onClick={signOut}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* Stat cards */}
        {[
          { label: 'Active medications', value: activeMeds.length, icon: '💊', color: '#1565c0' },
          { label: 'Upcoming appointments', value: appointments.filter(a => a.status === 'scheduled').length, icon: '📅', color: '#6a1b9a' },
          { label: 'Health status', value: 'Good', icon: '✅', color: '#1b5e20' },
        ].map(stat => (
          <div key={stat.label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: stat.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a2e' }}>{stat.value}</div>
              <div style={{ fontSize: '0.82rem', color: '#666' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Next appointment */}
      {nextAppt && (
        <div style={{ ...S.card, borderLeft: '4px solid #1565c0', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#1565c0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Next appointment</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{nextAppt.doctorId || 'Your GP'}</div>
              <div style={{ color: '#555', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                {new Date(nextAppt.datetime).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' at '}
                {new Date(nextAppt.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {nextAppt.notes && <div style={{ color: '#777', fontSize: '0.85rem', marginTop: '0.25rem' }}>{nextAppt.notes}</div>}
            </div>
            <span style={S.badge('scheduled')}>Scheduled</span>
          </div>
        </div>
      )}

      {/* Vitals */}
      <div style={{ ...S.card, marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#333' }}>Latest vitals <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 400 }}>— recorded today</span></h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {VITALS.map(v => (
            <div key={v.label} style={{ background: '#f5f6fa', borderRadius: 10, padding: '0.875rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{v.icon}</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a2e' }}>{v.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>{v.unit}</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>{v.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ ...S.card, marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#333' }}>Quick actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {[
            { to: '/HealthyU/lab-results', icon: '🧪', label: 'Lab Results', color: '#1565c0' },
            { to: '/HealthyU/prescriptions', icon: '💊', label: 'Prescriptions', color: '#6a1b9a' },
            { to: '/HealthyU/messages', icon: '✉️', label: 'Messages', color: '#1b5e20' },
            { to: '/HealthyU/billing', icon: '💳', label: 'Insurance & Billing', color: '#e65100' },
            { to: '/HealthyU/symptoms', icon: '🩺', label: 'Symptom Checker', color: '#c62828' },
          ].map(action => (
            <Link key={action.to} to={action.to} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#f5f6fa', borderRadius: 10, padding: '0.875rem', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{action.icon}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: action.color }}>{action.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Medications */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#333' }}>Active medications</h3>
        <Link to="/HealthyU/appointments" style={{ fontSize: '0.85rem', color: '#2e7d32', textDecoration: 'none', fontWeight: 600 }}>Book appointment →</Link>
      </div>

      {activeMeds.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '2rem' }}>
          No active medications on record.
        </div>
      )}

      {activeMeds.map((m: any) => (
        <div key={m.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>💊</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{m.name}</div>
              <div style={{ color: '#555', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                {m.dosage?.value} {m.dosage?.unit} · {m.dosage?.frequency || 'as directed'}
              </div>
              {m.prescribedBy && <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.15rem' }}>Prescribed by {m.prescribedBy}</div>}
            </div>
          </div>
          <span style={S.badge(m.status)}>{m.status}</span>
        </div>
      ))}
    </div>
  );
}
