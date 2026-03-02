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

export default function FinanceDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [token] = useState(localStorage.getItem('fin_token') || '');

  useEffect(() => {
    if (!token) return;
    fetch('/api/finance/accounts/acc-alice-current', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAccounts([data]))
      .catch(console.error);
  }, [token]);

  if (!token) {
    return (
      <div style={card}>
        <h2>Finance Dashboard</h2>
        <p>Please log in. Demo token can be obtained via POST /api/auth/login</p>
        <input
          placeholder="Paste JWT token"
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
          onBlur={e => localStorage.setItem('fin_token', e.target.value)}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Accounts</h2>
        <Link to="/finance/transfer">
          <button
            style={{ background: '#0066cc', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: 6 }}
          >
            New Transfer
          </button>
        </Link>
      </div>

      {accounts.map(acc => (
        <div key={acc.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#666', fontSize: '0.85rem', textTransform: 'capitalize' }}>{acc.type} Account</div>
              <div style={{ fontFamily: 'monospace', color: '#444' }}>****{acc.accountNumber.slice(-4)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }} data-testid={`account-balance-${acc.accountNumber.slice(-4)}`}>
                £{acc.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>{acc.currency}</div>
            </div>
          </div>
        </div>
      ))}

      {accounts.length === 0 && <p style={{ color: '#888' }}>No accounts found.</p>}
    </div>
  );
}
