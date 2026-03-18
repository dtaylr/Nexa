import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';

type Step = 'form' | 'review' | 'done';

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: 520,
  } as React.CSSProperties,
  field: { marginBottom: '1.25rem' } as React.CSSProperties,
  label: { display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' } as React.CSSProperties,
  input: (hasError?: boolean) => ({
    width: '100%', padding: '0.7rem 1rem', border: `1px solid ${hasError ? '#ef5350' : '#d0d7de'}`,
    borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const,
    outline: 'none', background: hasError ? '#fff8f8' : '#fff',
  } as React.CSSProperties),
  errMsg: { color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' } as React.CSSProperties,
  btn: (color: string, disabled?: boolean) => ({
    background: disabled ? '#bbb' : color, color: '#fff', border: 'none',
    padding: '0.85rem 1.5rem', borderRadius: 8, fontSize: '1rem',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s', width: '100%',
  } as React.CSSProperties),
};

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  currency: string;
  type: string;
}

interface LookupResult {
  id: string;
  accountNumber: string;
  type: string;
}

export default function TransferForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { show } = useToast();
  const token = localStorage.getItem('fin_token') || '';

  const [step, setStep] = useState<Step>('form');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    fromAccount: searchParams.get('from') || '',
    toMode: 'own' as 'own' | 'external',
    toAccount: '',
    recipientAccountNumber: '',
    amount: '',
    reference: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [resolvedRecipient, setResolvedRecipient] = useState<LookupResult | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!token) { navigate('/BrightBank/dashboard'); return; }
    fetch('/api/BrightBank/accounts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('auth'); return r.json(); })
      .then(d => {
        setAccounts(d.accounts || []);
        // pre-select from-account if passed via URL
        const fromParam = searchParams.get('from');
        if (fromParam) setForm(f => ({ ...f, fromAccount: fromParam }));
      })
      .catch(() => navigate('/BrightBank/dashboard'));
  }, [token]);

  const update = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  // Live account number lookup with debounce
  function onRecipientChange(val: string) {
    update('recipientAccountNumber', val);
    setResolvedRecipient(null);
    setLookupResults([]);
    clearTimeout(lookupTimer.current);
    if (val.trim().length < 3) return;
    setLookupLoading(true);
    lookupTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/BrightBank/accounts/lookup?q=${encodeURIComponent(val.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        setLookupResults(d.accounts || []);
      } catch {
        // ignore
      } finally {
        setLookupLoading(false);
      }
    }, 350);
  }

  function selectRecipient(acc: LookupResult) {
    setResolvedRecipient(acc);
    setForm(f => ({ ...f, toAccount: acc.id, recipientAccountNumber: acc.accountNumber }));
    setLookupResults([]);
    setErrors(e => ({ ...e, toAccount: '', recipientAccountNumber: '' }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.fromAccount) e.fromAccount = 'Please select a source account';
    if (form.toMode === 'own') {
      if (!form.toAccount) e.toAccount = 'Please select a destination account';
      if (form.toAccount === form.fromAccount) e.toAccount = 'Source and destination cannot be the same account';
    } else {
      if (!resolvedRecipient) e.recipientAccountNumber = 'Please search and select a valid account';
    }
    if (!form.amount || isNaN(Number(form.amount))) e.amount = 'Please enter a valid amount';
    else if (Number(form.amount) <= 0) e.amount = 'Amount must be greater than $0.00';
    else {
      const fromAcc = accounts.find(a => a.id === form.fromAccount);
      if (fromAcc && Number(form.amount) > fromAcc.balance) {
        e.amount = `Insufficient funds. Available: $${fromAcc.balance.toFixed(2)}`;
      }
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      show('Please fix the errors below before continuing', 'error');
      return false;
    }
    return true;
  }

  function toReview() {
    if (validate()) setStep('review');
  }

  async function submit() {
    setApiError('');
    setSubmitting(true);
    try {
      const toId = form.toMode === 'own' ? form.toAccount : resolvedRecipient!.id;
      const res = await fetch('/api/BrightBank/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fromAccountId: form.fromAccount,
          toAccountId: toId,
          amount: parseFloat(form.amount),
          currency: 'USD',
          reference: form.reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_FUNDS') {
          setApiError(`Insufficient funds. Available balance: $${data.availableBalance?.toFixed(2)}`);
        } else {
          setApiError(data.error || 'Transfer failed. Please try again.');
        }
        setStep('form');
        return;
      }
      setResult(data);
      setStep('done');
      show('Transfer submitted successfully', 'success');
    } catch {
      setApiError('Network error. Please try again.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  const fromAccount = accounts.find(a => a.id === form.fromAccount);
  const toAccountName = form.toMode === 'own'
    ? accounts.find(a => a.id === form.toAccount)
    : resolvedRecipient;

  //  Success screen 
  if (step === 'done') {
    return (
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem' }}>✓</div>
        <h2 data-testid="transfer-status" style={{ margin: '0 0 0.5rem', color: '#1b5e20' }}>Transfer submitted</h2>
        <p style={{ color: '#555', margin: '0 0 1.5rem' }}>
          <strong>${parseFloat(form.amount).toFixed(2)}</strong> is on its way.
          {form.reference && <> · <em>{form.reference}</em></>}
        </p>
        <div style={{ background: '#f5f6fa', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#666' }}>
            <span>Transfer ID</span>
            <code data-testid="audit-reference" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{result?.transferId}</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#666', marginTop: '0.5rem' }}>
            <span>Status</span>
            <span style={{ color: '#1b5e20', fontWeight: 600 }}>{result?.status}</span>
          </div>
        </div>
        <button onClick={() => navigate('/BrightBank/dashboard')} style={S.btn('#0066cc')}>
          Back to accounts
        </button>
      </div>
    );
  }

  //  Review screen 
  if (step === 'review') {
    return (
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <button onClick={() => setStep('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066cc', fontSize: '1.1rem', padding: 0 }}>←</button>
          <h2 style={{ margin: 0 }}>Confirm transfer</h2>
        </div>

        <div style={{ background: '#f5f6fa', borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' }}>
          {[
            ['From', fromAccount ? `${fromAccount.type.charAt(0).toUpperCase() + fromAccount.type.slice(1)} ····${fromAccount.accountNumber.slice(-4)}` : form.fromAccount],
            ['To', toAccountName ? `${(toAccountName as any).type?.charAt(0).toUpperCase() + (toAccountName as any).type?.slice(1)} ····${(toAccountName as any).accountNumber.slice(-4)}` : form.toAccount],
            ['Amount', `$${parseFloat(form.amount).toFixed(2)}`],
            ['Reference', form.reference || '—'],
          ].map(([label, value], i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: i < 3 ? '1px solid #eaeef2' : 'none', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>{label}</span>
              <span
                data-testid={label === 'Amount' ? 'transfer-amount' : label === 'Reference' ? 'transfer-reference' : undefined}
                style={{ fontWeight: label === 'Amount' ? 700 : 500, fontSize: label === 'Amount' ? '1.1rem' : '0.95rem', color: '#1a1a2e' }}
              >{value}</span>
            </div>
          ))}
        </div>

        {apiError && (
          <div role="alert" style={{ background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b71c1c', fontSize: '0.9rem' }}>
            {apiError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setStep('form')} style={{ flex: 1, background: '#f0f2f5', border: 'none', padding: '0.85rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Edit
          </button>
          <button onClick={submit} disabled={submitting} style={{ ...S.btn('#0066cc', submitting), flex: 2 }}>
            {submitting ? 'Sending…' : 'Confirm transfer'}
          </button>
        </div>
      </div>
    );
  }

  //  Form screen 
  const otherAccounts = accounts.filter(a => a.id !== form.fromAccount);

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/BrightBank/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066cc', fontSize: '1.1rem', padding: 0 }}>←</button>
        <h2 style={{ margin: 0 }}>New transfer</h2>
      </div>

      <div style={S.card}>
        {/* From account */}
        <div style={S.field}>
          <label style={S.label} htmlFor="from-account">From account <span style={{ color: '#b71c1c' }}>*</span></label>
          <select
            id="from-account"
            style={S.input(!!errors.fromAccount)}
            value={form.fromAccount}
            onChange={e => update('fromAccount', e.target.value)}
          >
            <option value="">Select an account…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.type.charAt(0).toUpperCase() + a.type.slice(1)} ····{a.accountNumber.slice(-4)} — ${a.balance.toFixed(2)}
              </option>
            ))}
          </select>
          {errors.fromAccount && <span style={S.errMsg}>{errors.fromAccount}</span>}
        </div>

        {/* To: own or external */}
        <div style={S.field}>
          <label style={S.label}>To <span style={{ color: '#b71c1c' }}>*</span></label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {(['own', 'external'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setForm(f => ({ ...f, toMode: mode, toAccount: '', recipientAccountNumber: '' }));
                  setResolvedRecipient(null);
                  setLookupResults([]);
                  setErrors(e => ({ ...e, toAccount: '', recipientAccountNumber: '' }));
                }}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  background: form.toMode === mode ? '#0066cc' : '#f0f2f5',
                  color: form.toMode === mode ? '#fff' : '#444',
                  border: form.toMode === mode ? '2px solid #0066cc' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {mode === 'own' ? 'My accounts' : 'Other account'}
              </button>
            ))}
          </div>

          {form.toMode === 'own' ? (
            <>
              <select
                id="to-account"
                style={S.input(!!errors.toAccount)}
                value={form.toAccount}
                onChange={e => update('toAccount', e.target.value)}
              >
                <option value="">Select destination account…</option>
                {otherAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.type.charAt(0).toUpperCase() + a.type.slice(1)} ····{a.accountNumber.slice(-4)} — ${a.balance.toFixed(2)}
                  </option>
                ))}
                {otherAccounts.length === 0 && <option disabled>No other accounts available</option>}
              </select>
              {errors.toAccount && <span style={S.errMsg}>{errors.toAccount}</span>}
            </>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                style={S.input(!!errors.recipientAccountNumber)}
                placeholder="Enter account number (e.g. ACC-00003)"
                value={form.recipientAccountNumber}
                onChange={e => onRecipientChange(e.target.value)}
                autoComplete="off"
              />
              {lookupLoading && (
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.85rem' }}>
                  Searching…
                </div>
              )}
              {lookupResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d0d7de', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden' }}>
                  {lookupResults.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectRecipient(r)}
                      style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f0f2f5', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem' }}
                    >
                      <span style={{ fontWeight: 600 }}>{r.accountNumber}</span>
                      <span style={{ color: '#666', marginLeft: '0.5rem', textTransform: 'capitalize' }}>({r.type})</span>
                    </button>
                  ))}
                </div>
              )}
              {resolvedRecipient && (
                <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.875rem', background: '#e8f5e9', borderRadius: 8, fontSize: '0.88rem', color: '#1b5e20', fontWeight: 600 }}>
                  ✓ {resolvedRecipient.accountNumber} ({resolvedRecipient.type})
                </div>
              )}
              {errors.recipientAccountNumber && <span style={S.errMsg}>{errors.recipientAccountNumber}</span>}
            </div>
          )}
        </div>

        {/* Amount */}
        <div style={S.field}>
          <label style={S.label} htmlFor="amount">Amount ($) <span style={{ color: '#b71c1c' }}>*</span></label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#888', fontWeight: 600 }}>$</span>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              style={{ ...S.input(!!errors.amount), paddingLeft: '2rem' }}
              placeholder="0.00"
              value={form.amount}
              onChange={e => update('amount', e.target.value)}
            />
          </div>
          {errors.amount && <span style={S.errMsg}>{errors.amount}</span>}
          {fromAccount && form.amount && !errors.amount && (
            <span style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.3rem', display: 'block' }}>
              Balance after transfer: ${Math.max(0, fromAccount.balance - parseFloat(form.amount || '0')).toFixed(2)}
            </span>
          )}
        </div>

        {/* Reference */}
        <div style={S.field}>
          <label style={S.label} htmlFor="reference">Reference <span style={{ color: '#888', fontWeight: 400 }}>(optional)</span></label>
          <input
            id="reference"
            style={S.input()}
            placeholder="e.g. Rent — October, Invoice #1042"
            value={form.reference}
            onChange={e => update('reference', e.target.value)}
            maxLength={100}
          />
        </div>

        {apiError && (
          <div role="alert" style={{ background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b71c1c', fontSize: '0.9rem' }}>
            {apiError}
          </div>
        )}

        <button onClick={toReview} style={S.btn('#0066cc')}>
          Review transfer
        </button>
      </div>
    </div>
  );
}
