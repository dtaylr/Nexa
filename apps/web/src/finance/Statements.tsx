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

interface StatementTransaction {
  id: string;
  direction: 'credit' | 'debit';
  amount: number;
  reference: string | null;
  createdAt: string;
}

interface Statement {
  account: { id: string; accountNumber: string; type: string; currency: string };
  period: { year: number; month: number; start: string; end: string };
  openingBalance: number;
  closingBalance: number;
  totalIn: number;
  totalOut: number;
  transactions: StatementTransaction[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1rem',
  } as React.CSSProperties,
  inp: {
    padding: '0.65rem 1rem', border: '1px solid #d0d7de',
    borderRadius: 8, fontSize: '0.95rem', outline: 'none',
    background: '#fff', cursor: 'pointer',
  } as React.CSSProperties,
  btn: (color: string, disabled?: boolean) => ({
    background: disabled ? '#bbb' : color, color: '#fff', border: 'none',
    padding: '0.6rem 1.2rem', borderRadius: 8, fontSize: '0.9rem',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  } as React.CSSProperties),
};

function centsToDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Statements() {
  const { show } = useToast();
  const token = localStorage.getItem('fin_token') || '';
  const now = new Date();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);

  if (!token) {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
        <div style={S.card}>
          <p style={{ color: '#555', margin: '0 0 1rem' }}>Please sign in via the Finance dashboard</p>
          <Link to="/BrightBank/dashboard" style={{ color: '#0066cc', fontWeight: 600 }}>Go to Finance Dashboard</Link>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetch('/api/BrightBank/accounts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const accs = d.accounts || [];
        setAccounts(accs);
        if (accs.length) setAccountId(accs[0].id);
      })
      .catch(() => show('Failed to load accounts', 'error'))
      .finally(() => setAccountsLoading(false));
  }, []);

  async function loadStatement() {
    if (!accountId) { show('Please select an account', 'warning'); return; }
    setLoading(true);
    setStatement(null);
    try {
      const res = await fetch(
        `/api/BrightBank/accounts/${accountId}/statement?year=${year}&month=${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) { show(data.error || 'Failed to load statement', 'error'); return; }
      setStatement(data);
    } catch {
      show('Network error', 'error');
    } finally {
      setLoading(false);
    }
  }

  function openCsv() {
    if (!accountId) return;
    window.open(
      `/api/BrightBank/accounts/${accountId}/statement/csv?year=${year}&month=${month}`,
      '_blank'
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1a1a2e' }}>Account Statements</h1>
        <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
          View and download your monthly transaction history
        </p>
      </div>

      {/* Controls */}
      <div style={{ ...S.card, borderTop: '4px solid #0066cc' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }} htmlFor="stmt-account">
              Account
            </label>
            <select
              id="stmt-account"
              style={{ ...S.inp, width: '100%' }}
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              disabled={accountsLoading}
            >
              {accountsLoading ? (
                <option>Loading accounts…</option>
              ) : accounts.length === 0 ? (
                <option>No accounts found</option>
              ) : (
                accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.type.charAt(0).toUpperCase() + a.type.slice(1)} ····{a.accountNumber.slice(-4)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }} htmlFor="stmt-month">
              Month
            </label>
            <select
              id="stmt-month"
              style={S.inp}
              value={month}
              onChange={e => setMonth(parseInt(e.target.value))}
            >
              {MONTHS.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }} htmlFor="stmt-year">
              Year
            </label>
            <select
              id="stmt-year"
              style={S.inp}
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button onClick={loadStatement} disabled={loading || accountsLoading} style={S.btn('#0066cc', loading || accountsLoading)}>
            {loading ? 'Loading…' : 'View Statement'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          Loading statement…
        </div>
      )}

      {statement && !loading && (
        <>
          {/* Period header */}
          <div style={{ background: 'linear-gradient(135deg, #0d47a1, #0066cc)', borderRadius: 12, padding: '1.5rem 2rem', color: '#fff', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Statement Period
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                  {MONTHS[statement.period.month - 1]} {statement.period.year}
                </div>
                <div style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '0.25rem' }}>
                  {statement.account.type.charAt(0).toUpperCase() + statement.account.type.slice(1)} account ····{statement.account.accountNumber.slice(-4)}
                </div>
              </div>
              <button
                onClick={openCsv}
                style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.4)', color: '#fff', padding: '0.6rem 1.25rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Download CSV
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ ...S.card, borderTop: '4px solid #888', marginBottom: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Opening Balance</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a2e' }}>
                ${centsToDollars(statement.openingBalance)}
              </div>
            </div>
            <div style={{ ...S.card, borderTop: '4px solid #4caf50', marginBottom: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Money In</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1b5e20' }}>
                +${centsToDollars(statement.totalIn)}
              </div>
            </div>
            <div style={{ ...S.card, borderTop: '4px solid #ef5350', marginBottom: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Money Out</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b71c1c' }}>
                -${centsToDollars(statement.totalOut)}
              </div>
            </div>
            <div style={{ ...S.card, borderTop: '4px solid #0066cc', marginBottom: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Closing Balance</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a2e' }}>
                ${centsToDollars(statement.closingBalance)}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div style={S.card}>
            <h3 style={{ margin: '0 0 1rem', color: '#1a1a2e', fontSize: '1rem' }}>
              Transactions ({statement.transactions.length})
            </h3>
            {statement.transactions.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
                No completed transactions for this period.
              </p>
            ) : (
              statement.transactions.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 20,
                        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                        background: t.direction === 'credit' ? '#e8f5e9' : '#fce4ec',
                        color: t.direction === 'credit' ? '#1b5e20' : '#b71c1c',
                      }}>
                        {t.direction}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1a1a2e' }}>
                        {t.reference || (t.direction === 'credit' ? 'Incoming transfer' : 'Outgoing transfer')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#999', paddingLeft: '0.5rem' }}>
                      {new Date(t.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 700, fontSize: '0.95rem',
                    color: t.direction === 'credit' ? '#1b5e20' : '#b71c1c',
                    marginLeft: '1rem',
                  }}>
                    {t.direction === 'credit' ? '+' : '−'}${centsToDollars(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!statement && !loading && (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
          <p style={{ margin: 0, fontWeight: 600, color: '#555' }}>Select an account and period</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>then click "View Statement" to load your transactions.</p>
        </div>
      )}
    </div>
  );
}
