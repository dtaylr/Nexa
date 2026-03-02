import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem',
};

export default function HealthDashboard() {
  const [patient, setPatient] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const token = localStorage.getItem('hlt_token') || '';

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/health/patients/1', { headers })
      .then(r => r.json())
      .then(setPatient)
      .catch(console.error);

    fetch('/api/health/patients/1/medications', { headers })
      .then(r => r.json())
      .then(d => setMedications(d.medications || []))
      .catch(console.error);
  }, [token]);

  if (!token) {
    return (
      <div style={card}>
        <h2>Patient Portal</h2>
        <p>Paste your session token to continue.</p>
        <input
          placeholder="Paste JWT token"
          style={{ width: '100%', padding: '0.5rem' }}
          onBlur={e => { localStorage.setItem('hlt_token', e.target.value); window.location.reload(); }}
        />
      </div>
    );
  }

  return (
    <div>
      <h2>Patient Portal</h2>

      {patient && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{patient.firstName} {patient.lastName}</h3>
          <p style={{ margin: 0, color: '#555' }}>NHS: {patient.nhsNumber} · DOB: {patient.dateOfBirth}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Active Medications</h3>
      </div>

      {medications.map((m: any) => (
        <div key={m.id} style={{ ...card, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{m.name}</div>
            <div style={{ color: '#555', fontSize: '0.9rem' }}>{m.dosage.frequency}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: '#2e7d32' }}>{m.dosage.value} {m.dosage.unit}</div>
            <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'capitalize' }}>{m.status}</div>
          </div>
        </div>
      ))}

      <Link to="/health/appointments">
        <button style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 6, marginTop: '1rem' }}>
          View Appointments
        </button>
      </Link>
    </div>
  );
}
