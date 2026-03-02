import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  currency: string;
  type: string;
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem',
};

const inp: React.CSSProperties = {
  width: '100%', padding: '0.6rem', border: '1px solid #ddd',
  borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box',
};

export default function FinanceDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [token, setToken] = useState(localStorage.getItem('fin_token') || '');
  const [email, setEmail] = useState('alice@nexacore.dev');
  const [password, setPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch('/api/finance/accounts', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setAccounts(data.accounts || []))
      .catch(() => {
        localStorage.removeItem('fin_token');
        setToken('');
      });
  }, [token]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) { setLoginError('Invalid credentials'); return; }
    const { token: t } = await res.json();
    localStorage.setItem('fin_token', t);
    setToken(t);
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '4rem auto' }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Finance Portal</h2>
          <form onSubmit={login}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>Email</label>
              <input style={inp} value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>Password</label>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {loginError && <p style={{ color: '#c62828', margin: '0 0 1rem' }}>{loginError}</p>}
            <button type="submit" style={{ width: '100%', background: '#0066cc', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 6, fontSize: '1rem' }}>
              Sign in
            </button>
          </form>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#888', marginBottom: 0 }}>
            Demo: alice@nexacore.dev / password123
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Accounts</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/finance/transfer">
            <button style={{ background: '#0066cc', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: 6 }}>
              New Transfer
            </button>
          </Link>
          <button
            onClick={() => { localStorage.removeItem('fin_token'); setToken(''); setAccounts([]); }}
            style={{ background: 'none', border: '1px solid #ddd', padding: '0.6rem 1rem', borderRadius: 6, color: '#555' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {accounts.map(acc => (
        <div key={acc.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#666', fontSize: '0.85rem', textTransform: 'capitalize' }}>{acc.type} Account</div>
              <div style={{ fontFamily: 'monospace', color: '#444' }}>****{acc.accountNumber.slice(-4)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{ fontSize: '1.5rem', fontWeight: 700 }}
                data-testid={`account-balance-${acc.accountNumber.slice(-4)}`}
              >
                £{acc.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>{acc.currency}</div>
            </div>
          </div>
        </div>
      ))}

      {accounts.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          No accounts found for this user.
        </div>
      )}
    </div>
  );
}
