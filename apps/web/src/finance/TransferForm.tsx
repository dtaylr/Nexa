import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type Step = 'form' | 'review' | 'done';

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' };
const label: React.CSSProperties = { fontWeight: 500, fontSize: '0.9rem' };
const input: React.CSSProperties = { padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem' };

export default function TransferForm() {
  const navigate = useNavigate();
  const token = localStorage.getItem('fin_token') || '';
  const [step, setStep] = useState<Step>('form');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ fromAccount: '', toAccount: '', amount: '', reference: '' });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { navigate('/finance/dashboard'); return; }
    fetch('/api/finance/accounts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('auth'); return r.json(); })
      .then(d => setAccounts(d.accounts || []))
      .catch(err => {
        if (err.message === 'auth') navigate('/finance/dashboard');
        else setError('Could not load accounts.');
      });
  }, [token]);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fromAccountId: form.fromAccount,
          toAccountId: form.toAccount,
          amount: parseFloat(form.amount),
          currency: 'GBP',
          reference: form.reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Transfer failed'); return; }
      setResult(data);
      setStep('done');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedAccount = accounts.find(a => a.id === form.fromAccount);

  if (step === 'form') {
    return (
      <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', maxWidth: 480, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0 }}>New Transfer</h2>
        <div style={field}>
          <label style={label} htmlFor="from-account">From account</label>
          <select id="from-account" style={input} value={form.fromAccount} onChange={e => update('fromAccount', e.target.value)}>
            <option value="">Select account…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.type.charAt(0).toUpperCase() + a.type.slice(1)} — ****{a.accountNumber.slice(-4)} (£{Number(a.balance).toFixed(2)})
              </option>
            ))}
          </select>
        </div>
        <div style={field}>
          <label style={label} htmlFor="to-account">To account ID</label>
          <input id="to-account" style={input} placeholder="Recipient account ID" value={form.toAccount} onChange={e => update('toAccount', e.target.value)} />
        </div>
        <div style={field}>
          <label style={label} htmlFor="amount">Amount (£)</label>
          <input id="amount" type="number" step="0.01" min="0.01" style={input} placeholder="0.00" value={form.amount} onChange={e => update('amount', e.target.value)} />
        </div>
        <div style={field}>
          <label style={label} htmlFor="reference">Reference</label>
          <input id="reference" style={input} placeholder="e.g. Rent — October" value={form.reference} onChange={e => update('reference', e.target.value)} />
        </div>
        {error && <p style={{ color: '#c62828', margin: '0 0 1rem' }}>{error}</p>}
        <button
          onClick={() => setStep('review')}
          disabled={!form.fromAccount || !form.toAccount || !form.amount}
          style={{ width: '100%', background: '#0066cc', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 6, fontSize: '1rem', cursor: 'pointer' }}
        >
          Review Transfer
        </button>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', maxWidth: 480, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0 }}>Confirm Transfer</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
          <tbody>
            <tr><td style={{ padding: '0.5rem 0', color: '#666' }}>From</td><td style={{ textAlign: 'right' }}>{selectedAccount ? `${selectedAccount.type} ****${selectedAccount.accountNumber.slice(-4)}` : form.fromAccount}</td></tr>
            <tr><td style={{ padding: '0.5rem 0', color: '#666' }}>Amount</td><td data-testid="transfer-amount" style={{ textAlign: 'right', fontWeight: 700 }}>£{parseFloat(form.amount).toFixed(2)}</td></tr>
            <tr><td style={{ padding: '0.5rem 0', color: '#666' }}>Reference</td><td data-testid="transfer-reference" style={{ textAlign: 'right' }}>{form.reference || '—'}</td></tr>
            <tr><td style={{ padding: '0.5rem 0', color: '#666' }}>To</td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{form.toAccount}</td></tr>
          </tbody>
        </table>
        {error && <p style={{ color: '#c62828', margin: '0 0 1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => { setStep('form'); setError(''); }} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', padding: '0.75rem', borderRadius: 6, cursor: 'pointer' }}>Back</button>
          <button onClick={submit} disabled={submitting} style={{ flex: 2, background: submitting ? '#aaa' : '#0066cc', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 6, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Sending…' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', maxWidth: 480, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✓</div>
      <h2 data-testid="transfer-status" style={{ marginTop: 0 }}>Transfer Submitted</h2>
      <p style={{ color: '#444' }}>£{parseFloat(form.amount).toFixed(2)} transferred successfully</p>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        Audit reference: <code data-testid="audit-reference">{result?.auditId}</code>
      </p>
      <button onClick={() => navigate('/finance/dashboard')} style={{ background: '#0066cc', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 6, cursor: 'pointer' }}>
        Back to accounts
      </button>
    </div>
  );
}
