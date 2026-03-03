import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem',
};

export default function HealthDashboard() {
  const [patient, setPatient] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [email, setEmail] = useState('patient.one@nexacore.dev');
  const [password, setPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('hlt_token') || '');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/health/patients/me', { headers })
      .then(r => { if (!r.ok) throw new Error('auth'); return r.json(); })
      .then(p => {
        setPatient(p);
        localStorage.setItem('hlt_patient_id', String(p.id));
        return fetch(`/api/health/patients/${p.id}/medications`, { headers });
      })
      .then(r => r.json())
      .then(d => setMedications(d.medications || []))
      .catch(err => {
        if (err.message === 'auth') {
          localStorage.removeItem('hlt_token');
          localStorage.removeItem('hlt_patient_id');
          setToken('');
        }
      });
  }, [token]);

  async function login() {
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Login failed'); return; }
      localStorage.setItem('hlt_token', data.token);
      setToken(data.token);
    } catch {
      setLoginError('Network error. Please try again.');
    }
  }

  function signOut() {
    localStorage.removeItem('hlt_token');
    localStorage.removeItem('hlt_patient_id');
    setToken('');
    setPatient(null);
    setMedications([]);
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 400 }}>
        <h2>Patient Portal</h2>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Sign in</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' as const }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.3rem' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' as const }}
            />
          </div>
          {loginError && <p style={{ color: '#c62828', margin: '0 0 1rem', fontSize: '0.9rem' }}>{loginError}</p>}
          <button
            onClick={login}
            style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 6, fontSize: '1rem', cursor: 'pointer' }}
          >
            Sign in
          </button>
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem', marginBottom: 0 }}>
            Demo: patient.one@nexacore.dev / password123
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Patient Portal</h2>
        <button onClick={signOut} style={{ background: 'none', border: '1px solid #ddd', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem' }}>Sign out</button>
      </div>

      {patient ? (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{patient.firstName} {patient.lastName}</h3>
          <p style={{ margin: 0, color: '#555' }}>NHS: {patient.nhsNumber} · DOB: {patient.dateOfBirth || 'N/A'}</p>
        </div>
      ) : (
        <p style={{ color: '#888' }}>Loading patient record…</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Active Medications</h3>
      </div>

      {medications.length === 0 && patient && (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>No active medications.</p>
      )}

      {medications.map((m: any) => (
        <div key={m.id} style={{ ...card, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{m.name}</div>
            <div style={{ color: '#555', fontSize: '0.9rem' }}>{m.dosage?.frequency || ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: '#2e7d32' }}>{m.dosage?.value} {m.dosage?.unit}</div>
            <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'capitalize' }}>{m.status}</div>
          </div>
        </div>
      ))}

      <Link to="/health/appointments">
        <button style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 6, marginTop: '1rem', cursor: 'pointer' }}>
          View Appointments
        </button>
      </Link>
    </div>
  );
}
