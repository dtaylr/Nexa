import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  currency: string;
  type: string;
}

interface Transaction {
  id: string;
  type: 'debit' | 'credit';
  amount: number;
  currency: string;
  reference: string;
  status: string;
  createdAt: string;
}

interface MonthlySummary {
  month: string;
  totalIn: number;
  totalOut: number;
  net: number;
  transactionCount: number;
}

const S = {
  page: { minHeight: '100vh', background: '#f0f2f5' } as React.CSSProperties,
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1rem',
  } as React.CSSProperties,
  inp: {
    width: '100%', padding: '0.7rem 1rem', border: '1px solid #d0d7de',
    borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const,
    outline: 'none', transition: 'border-color 0.15s',
  } as React.CSSProperties,
  btn: (color: string) => ({
    background: color, color: '#fff', border: 'none',
    padding: '0.7rem 1.4rem', borderRadius: 8, fontSize: '0.95rem',
    fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
  } as React.CSSProperties),
  badge: (type: string) => ({
    display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const,
    background: type === 'credit' ? '#e8f5e9' : '#fce4ec',
    color: type === 'credit' ? '#1b5e20' : '#b71c1c',
  }),
};

function AccountCard({ acc, token }: { acc: Account; token: string }) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadTxs() {
    if (txs.length || loading) { setOpen(o => !o); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/BrightBank/accounts/${acc.id}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setTxs(d.transactions || []);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  const typeColors: Record<string, string> = {
    current: '#1565c0', savings: '#2e7d32', isa: '#6a1b9a',
  };

  return (
    <div style={{ ...S.card, borderTop: `4px solid ${typeColors[acc.type] || '#0066cc'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
            {acc.type} Account
          </div>
          <div style={{ fontFamily: 'monospace', color: '#444', fontSize: '0.95rem' }}>
            {acc.accountNumber.slice(0, -4).replace(/./g, '·')}{acc.accountNumber.slice(-4)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-testid={`account-balance-${acc.accountNumber.slice(-4)}`}
            style={{ fontSize: '1.75rem', fontWeight: 800, color: acc.balance >= 0 ? '#1a1a2e' : '#b71c1c' }}
          >
            ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ color: '#888', fontSize: '0.8rem' }}>{acc.currency} · Available balance</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
        <Link to={`/BrightBank/transfer?from=${acc.id}`} style={{ textDecoration: 'none' }}>
          <button style={{ ...S.btn('#0066cc'), padding: '0.5rem 1rem', fontSize: '0.85rem', minHeight: 44 }}>
            Transfer
          </button>
        </Link>
        <button
          onClick={loadTxs}
          style={{ background: 'none', border: '1px solid #d0d7de', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', color: '#444', minHeight: 44 }}
        >
          {loading ? 'Loading…' : open ? 'Hide transactions' : 'Recent transactions'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #f0f2f5', paddingTop: '1rem' }}>
          {txs.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>No transactions yet.</p>
          ) : (
            txs.slice(0, 8).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1a1a2e' }}>
                    {t.reference || (t.type === 'credit' ? 'Incoming transfer' : 'Outgoing transfer')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    {new Date(t.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    <span style={S.badge(t.type)}>{t.type}</span>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: t.type === 'credit' ? '#1b5e20' : '#b71c1c', marginLeft: '1rem' }}>
                  {t.type === 'credit' ? '+' : '−'}${t.amount.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function FinanceDashboard() {
  const { show } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [token, setToken] = useState(localStorage.getItem('fin_token') || '');
  const [email, setEmail] = useState('alice@1platform.dev');
  const [password, setPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/BrightBank/accounts', { headers }).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/BrightBank/reports/monthly-summary', { headers }).then(r => r.ok ? r.json() : null),
    ])
      .then(([accountsData, summaryData]) => {
        setAccounts(accountsData.accounts || []);
        if (summaryData) setSummary(summaryData);
      })
      .catch(() => {
        localStorage.removeItem('fin_token');
        setToken('');
        show('Session expired. Please sign in again.', 'warning');
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
      localStorage.setItem('fin_token', data.token);
      setToken(data.token);
      show('Signed in successfully', 'success');
    } catch {
      setLoginError('Cannot reach the API server. Run: npm run dev');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 560, margin: '4rem auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏦</div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1a1a2e' }}>Finance Portal</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>Secure online banking</p>
        </div>
        <div style={S.card}>
          <form onSubmit={login} noValidate>
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="fin-email" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                Email address
              </label>
              <input
                id="fin-email"
                style={S.inp}
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setLoginError(''); }}
                placeholder="you@example.com"
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label htmlFor="fin-password" style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>Password</label>
              </div>
              <input
                id="fin-password"
                style={S.inp}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError(''); }}
              />
            </div>
            {loginError && (
              <div role="alert" style={{ background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b71c1c', fontSize: '0.9rem' }}>
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ ...S.btn('#0066cc'), width: '100%', padding: '0.85rem', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: '#f0f4ff', borderRadius: 8, fontSize: '0.85rem', color: '#555' }}>
            <strong>Demo account:</strong> alice@1platform.dev · password123
          </div>
        </div>
      </div>
    );
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      {/* Portfolio header */}
      <div style={{ background: 'linear-gradient(135deg, #0d47a1, #0066cc)', borderRadius: 16, padding: '2rem', color: '#fff', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', opacity: 0.85, marginBottom: '0.5rem' }}>Total portfolio value</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '0.35rem' }}>
              Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/BrightBank/transfer" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.4)', color: '#fff', padding: '0.6rem 1.25rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: '0.9rem', minHeight: 44 }}>
                + Transfer
              </button>
            </Link>
            <Link to="/BrightBank/cards" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                💳 Cards
              </button>
            </Link>
            <Link to="/BrightBank/beneficiaries" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                👥 Payees
              </button>
            </Link>
            <Link to="/BrightBank/statements" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                📄 Statements
              </button>
            </Link>
            <Link to="/BrightBank/fraud-alerts" style={{ textDecoration: 'none' }}>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                🛡 Security
              </button>
            </Link>
            <button
              onClick={() => { localStorage.removeItem('fin_token'); setToken(''); setAccounts([]); setSummary(null); }}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Monthly summary */}
        {summary && (
          <>
            <div style={{ ...S.card, borderTop: '4px solid #4caf50' }}>
              <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Money in — {summary.month}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1b5e20' }}>
                +${summary.totalIn.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                {summary.transactionCount} transaction{summary.transactionCount !== 1 ? 's' : ''} this month
              </div>
            </div>
            <div style={{ ...S.card, borderTop: '4px solid #ef5350' }}>
              <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Money out — {summary.month}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b71c1c' }}>
                −${summary.totalOut.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', fontWeight: 600, color: summary.net >= 0 ? '#1b5e20' : '#b71c1c' }}>
                Net: {summary.net >= 0 ? '+' : ''}${summary.net.toFixed(2)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Account cards */}
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#444', fontWeight: 600 }}>Your accounts</h2>
      {accounts.map(acc => (
        <AccountCard key={acc.id} acc={acc} token={token} />
      ))}
      {accounts.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          No accounts found for this user.
        </div>
      )}
    </div>
  );
}
