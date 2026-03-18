import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Symptom {
  name: string;
  severity: number;
  duration: string;
}

interface TriageResult {
  urgency: 'emergency' | 'urgent' | 'soon' | 'routine';
  riskScore: number;
  recommendations: string[];
  redFlagDetected: boolean;
  modelVersion: string;
  disclaimer: string;
  audit: {
    inputSymptomCount: number;
    maxSeverity: number;
    avgSeverity: number;
    escalationGuardrailActive: boolean;
  };
}

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1rem',
  } as React.CSSProperties,
  inp: {
    width: '100%', padding: '0.7rem 1rem', border: '1px solid #d0d7de',
    borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
};

const URGENCY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  emergency: { bg: '#ffebee', color: '#b71c1c', label: 'Emergency' },
  urgent:    { bg: '#fff3e0', color: '#e65100', label: 'Urgent' },
  soon:      { bg: '#fff8e1', color: '#f59e0b', label: 'See doctor soon' },
  routine:   { bg: '#e8f5e9', color: '#1b5e20', label: 'Routine' },
};

const CONDITIONS = ['heart disease', 'diabetes', 'asthma', 'hypertension'];

export default function SymptomChecker() {
  const { show } = useToast();
  const token = localStorage.getItem('hlt_token') || '';

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [symptomName, setSymptomName] = useState('');
  const [severity, setSeverity] = useState(5);
  const [duration, setDuration] = useState('');
  const [age, setAge] = useState('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  function addSymptom() {
    if (!symptomName.trim()) { show('Please enter a symptom name', 'error'); return; }
    setSymptoms(prev => [...prev, { name: symptomName.trim(), severity, duration: duration.trim() }]);
    setSymptomName('');
    setSeverity(5);
    setDuration('');
  }

  function removeSymptom(idx: number) {
    setSymptoms(prev => prev.filter((_, i) => i !== idx));
  }

  function toggleCondition(c: string) {
    setSelectedConditions(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  async function runTriage(e: React.FormEvent) {
    e.preventDefault();
    if (symptoms.length === 0) { show('Please add at least one symptom', 'error'); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/HealthyU/symptoms/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          symptoms,
          age: age ? parseInt(age, 10) : undefined,
          existingConditions: selectedConditions.length > 0 ? selectedConditions : undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Triage failed'); }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      show(err.message || 'Could not complete triage', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const urgencyCfg = result ? URGENCY_CONFIG[result.urgency] : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', textDecoration: 'none', fontSize: '1.1rem' }}>←</Link>
        <h2 style={{ margin: 0, color: '#1a1a2e' }}>Symptom Checker</h2>
      </div>

      {/* Disclaimer */}
      <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 10, padding: '0.875rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠</span>
        <span style={{ fontSize: '0.9rem', color: '#78350f' }}>
          <strong>This tool does not replace medical advice.</strong> If you are experiencing a medical emergency, call 999 immediately.
        </span>
      </div>

      {/* Symptom input */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 1rem', color: '#1b5e20' }}>Add symptoms</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
              Symptom name
            </label>
            <input
              style={S.inp}
              placeholder="e.g. headache, chest tightness"
              value={symptomName}
              onChange={e => setSymptomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSymptom(); } }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
              Duration
            </label>
            <input
              style={{ ...S.inp, width: 120 }}
              placeholder="e.g. 2 days"
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
            Severity: <span style={{ color: severity >= 8 ? '#b71c1c' : severity >= 5 ? '#e65100' : '#1b5e20', fontWeight: 800 }}>{severity}/10</span>
          </label>
          <input
            type="range"
            min={1} max={10}
            value={severity}
            onChange={e => setSeverity(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: severity >= 8 ? '#c62828' : severity >= 5 ? '#e65100' : '#2e7d32' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
            <span>Mild (1)</span>
            <span>Moderate (5)</span>
            <span>Severe (10)</span>
          </div>
        </div>
        <button
          type="button"
          onClick={addSymptom}
          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          + Add symptom
        </button>
      </div>

      {/* Symptom list */}
      {symptoms.length > 0 && (
        <div style={S.card}>
          <h4 style={{ margin: '0 0 0.75rem', color: '#333' }}>Added symptoms ({symptoms.length})</h4>
          {symptoms.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: '#f5f6fa', borderRadius: 8, marginBottom: '0.4rem' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{s.name}</span>
                {s.duration && <span style={{ color: '#888', fontSize: '0.85rem' }}> · {s.duration}</span>}
                <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: s.severity >= 8 ? '#b71c1c' : s.severity >= 5 ? '#e65100' : '#1b5e20', fontWeight: 700 }}>
                  Severity {s.severity}/10
                </span>
              </div>
              <button
                onClick={() => removeSymptom(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1rem', padding: '0.2rem 0.4rem' }}
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Optional info */}
      <div style={S.card}>
        <h4 style={{ margin: '0 0 1rem', color: '#333' }}>Optional details</h4>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>Age</label>
          <input
            type="number"
            min="0"
            max="120"
            style={{ ...S.inp, maxWidth: 120 }}
            placeholder="Your age"
            value={age}
            onChange={e => setAge(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>Existing conditions</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CONDITIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCondition(c)}
                style={{
                  padding: '0.4rem 0.9rem', borderRadius: 20, cursor: 'pointer',
                  border: selectedConditions.includes(c) ? '2px solid #2e7d32' : '2px solid #d0d7de',
                  background: selectedConditions.includes(c) ? '#e8f5e9' : '#fff',
                  color: selectedConditions.includes(c) ? '#1b5e20' : '#555',
                  fontWeight: selectedConditions.includes(c) ? 700 : 500,
                  fontSize: '0.85rem',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={runTriage}>
        <button
          type="submit"
          disabled={submitting || symptoms.length === 0}
          style={{
            width: '100%', background: submitting || symptoms.length === 0 ? '#aaa' : '#2e7d32',
            color: '#fff', border: 'none', padding: '0.875rem', borderRadius: 8,
            cursor: submitting || symptoms.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '1rem', marginBottom: '1.5rem',
          }}
        >
          {submitting ? 'Checking symptoms…' : 'Check my symptoms'}
        </button>
      </form>

      {/* Results */}
      {result && urgencyCfg && (
        <div>
          {result.redFlagDetected && (
            <div style={{ background: '#ffebee', border: '2px solid #ef9a9a', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🚨</span>
              <div>
                <div style={{ fontWeight: 800, color: '#b71c1c', marginBottom: '0.25rem' }}>Red flag symptom detected</div>
                <div style={{ color: '#b71c1c', fontSize: '0.9rem' }}>Seek immediate medical attention.</div>
              </div>
            </div>
          )}

          <div style={{ ...S.card, background: urgencyCfg.bg, border: `2px solid ${urgencyCfg.color}30` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: urgencyCfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Urgency Level</div>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: urgencyCfg.color }}>{urgencyCfg.label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Risk Score</div>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: urgencyCfg.color }}>
                  {(result.riskScore * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>Recommendations:</div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {result.recommendations.map((r, i) => (
                <li key={i} style={{ color: '#333', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{r}</li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setShowAudit(v => !v)}
            style={{ background: 'none', border: '1px solid #d0d7de', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: '0.85rem', marginBottom: '0.75rem' }}
          >
            {showAudit ? 'Hide' : 'Show'} audit details
          </button>

          {showAudit && (
            <div style={{ ...S.card, background: '#f5f6fa', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#555' }}>Audit Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                {[
                  { label: 'Symptom count', value: result.audit.inputSymptomCount },
                  { label: 'Max severity', value: result.audit.maxSeverity },
                  { label: 'Avg severity', value: result.audit.avgSeverity },
                  { label: 'Red flag guardrail', value: result.audit.escalationGuardrailActive ? 'Active' : 'Inactive' },
                  { label: 'Model version', value: result.modelVersion },
                ].map(item => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>{item.label}</div>
                    <div style={{ fontWeight: 600, color: '#333' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#fff', borderRadius: 8, color: '#888', fontSize: '0.82rem', fontStyle: 'italic' }}>
                {result.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
