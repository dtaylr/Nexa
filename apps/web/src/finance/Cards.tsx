import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Card {
  id: string;
  accountId: string;
  cardType: 'debit' | 'credit' | 'virtual';
  lastFour: string;
  cardholderName: string;
  expiresAt: string;
  status: 'active' | 'frozen' | 'cancelled';
  dailyLimit: number;
  spendToday: number;
  createdAt: string;
}

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  currency: string;
  type: string;
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
    outline: 'none',
  } as React.CSSProperties,
  label: {
    display: 'block', marginBottom: '0.4rem', fontWeight: 600,
    fontSize: '0.9rem', color: '#333',
  } as React.CSSProperties,
  field: { marginBottom: '1.1rem' } as React.CSSProperties,
  btn: (color: string, disabled?: boolean) => ({
    background: disabled ? '#bbb' : color, color: '#fff', border: 'none',
    padding: '0.6rem 1.2rem', borderRadius: 8, fontSize: '0.9rem',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties),
};

function statusBadge(status: string) {
  const styles: Record<string, React.CSSProperties> = {
    active:    { background: '#e8f5e9', color: '#1b5e20' },
    frozen:    { background: '#e3f2fd', color: '#0d47a1' },
    cancelled: { background: '#f5f5f5', color: '#757575' },
  };
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
      ...(styles[status] || styles.cancelled),
    }}>
      {status}
    </span>
  );
}

function cardTypeColor(cardType: string) {
  const map: Record<string, string> = { virtual: '#6a1b9a', debit: '#0d47a1', credit: '#bf360c' };
  return map[cardType] || '#333';
}

function CardVisual({ card }: { card: Card }) {
  const isCancelled = card.status === 'cancelled';
  return (
    <div style={{
      background: isCancelled
        ? 'linear-gradient(135deg, #616161, #9e9e9e)'
        : `linear-gradient(135deg, ${cardTypeColor(card.cardType)}, #1a1a2e)`,
      borderRadius: 14, padding: '1.5rem 1.75rem', color: '#fff',
      fontFamily: 'monospace', minWidth: 280, maxWidth: 340,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      opacity: isCancelled ? 0.7 : 1,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', opacity: 0.8, textTransform: 'uppercase', marginBottom: '1.5rem' }}>
        {card.cardType} card
      </div>
      <div style={{ fontSize: '1.05rem', letterSpacing: '0.2em', marginBottom: '1.5rem', fontWeight: 600 }}>
        **** **** **** {card.lastFour}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '0.65rem', opacity: 0.7, letterSpacing: '0.08em', marginBottom: '0.2rem' }}>CARDHOLDER</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {card.cardholderName}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', opacity: 0.7, letterSpacing: '0.08em', marginBottom: '0.2rem' }}>EXPIRES</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {card.expiresAt.slice(0, 7).replace('-', '/')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Cards() {
  const { show } = useToast();
  const token = localStorage.getItem('fin_token') || '';
  const [cards, setCards] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ accountId: '', cardholderName: '', cardType: 'virtual', dailyLimit: '500' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('/api/BrightBank/cards', { headers }).then(r => r.json()),
      fetch('/api/BrightBank/accounts', { headers }).then(r => r.json()),
    ])
      .then(([cardsData, accountsData]) => {
        setCards(cardsData.cards || []);
        setAccounts(accountsData.accounts || []);
        if (accountsData.accounts?.length) {
          setForm(f => ({ ...f, accountId: accountsData.accounts[0].id }));
        }
      })
      .catch(() => show('Failed to load cards', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFreeze(card: Card) {
    setActionLoading(card.id);
    try {
      const res = await fetch(`/api/BrightBank/cards/${card.id}/freeze`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { show(data.error || 'Action failed', 'error'); return; }
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: data.status } : c));
      show(data.status === 'frozen' ? 'Card frozen' : 'Card unfrozen', 'success');
    } catch {
      show('Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelCard(id: string) {
    setActionLoading(id);
    setConfirmCancel(null);
    try {
      const res = await fetch(`/api/BrightBank/cards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { show(data.error || 'Cancel failed', 'error'); return; }
      setCards(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelled' } : c));
      show('Card cancelled', 'info');
    } catch {
      show('Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function validateForm() {
    const e: Record<string, string> = {};
    if (!form.accountId) e.accountId = 'Please select an account';
    if (!form.cardholderName.trim()) e.cardholderName = 'Cardholder name is required';
    const limit = parseFloat(form.dailyLimit);
    if (isNaN(limit) || limit <= 0) e.dailyLimit = 'Daily limit must be a positive amount';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function issueCard(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/BrightBank/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accountId: form.accountId,
          cardholderName: form.cardholderName.trim(),
          cardType: form.cardType,
          dailyLimit: Math.round(parseFloat(form.dailyLimit) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) { show(data.error || 'Failed to issue card', 'error'); return; }
      // Refresh full card list
      const updated = await fetch('/api/BrightBank/cards', { headers: { Authorization: `Bearer ${token}` } });
      const updatedData = await updated.json();
      setCards(updatedData.cards || []);
      setShowForm(false);
      setForm(f => ({ ...f, cardholderName: '', cardType: 'virtual', dailyLimit: '500' }));
      show('Card issued successfully', 'success');
    } catch {
      show('Network error', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const activeCards = cards.filter(c => c.status !== 'cancelled');
  const cancelledCards = cards.filter(c => c.status === 'cancelled');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1a1a2e' }}>Your Cards</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            {activeCards.length} active card{activeCards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={S.btn('#0066cc')}>
          {showForm ? 'Cancel' : '+ Issue New Card'}
        </button>
      </div>

      {showForm && (
        <div style={{ ...S.card, borderTop: '4px solid #0066cc', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#1a1a2e' }}>Issue New Card</h3>
          <form onSubmit={issueCard} noValidate>
            <div style={S.field}>
              <label style={S.label} htmlFor="card-account">Account <span style={{ color: '#b71c1c' }}>*</span></label>
              <select
                id="card-account"
                style={{ ...S.inp, border: formErrors.accountId ? '1px solid #ef5350' : '1px solid #d0d7de' }}
                value={form.accountId}
                onChange={e => { setForm(f => ({ ...f, accountId: e.target.value })); setFormErrors(err => ({ ...err, accountId: '' })); }}
              >
                <option value="">Select account…</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.type.charAt(0).toUpperCase() + a.type.slice(1)} ····{a.accountNumber.slice(-4)} — ${a.balance.toFixed(2)}
                  </option>
                ))}
              </select>
              {formErrors.accountId && <span style={{ color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' }}>{formErrors.accountId}</span>}
            </div>
            <div style={S.field}>
              <label style={S.label} htmlFor="cardholder-name">Cardholder Name <span style={{ color: '#b71c1c' }}>*</span></label>
              <input
                id="cardholder-name"
                style={{ ...S.inp, border: formErrors.cardholderName ? '1px solid #ef5350' : '1px solid #d0d7de' }}
                placeholder="e.g. Alice Smith"
                value={form.cardholderName}
                onChange={e => { setForm(f => ({ ...f, cardholderName: e.target.value })); setFormErrors(err => ({ ...err, cardholderName: '' })); }}
              />
              {formErrors.cardholderName && <span style={{ color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' }}>{formErrors.cardholderName}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
              <div>
                <label style={S.label} htmlFor="card-type">Card Type</label>
                <select
                  id="card-type"
                  style={S.inp}
                  value={form.cardType}
                  onChange={e => setForm(f => ({ ...f, cardType: e.target.value }))}
                >
                  <option value="virtual">Virtual</option>
                  <option value="debit">Debit</option>
                </select>
              </div>
              <div>
                <label style={S.label} htmlFor="daily-limit">Daily Limit ($)</label>
                <input
                  id="daily-limit"
                  type="number"
                  min="1"
                  step="1"
                  style={{ ...S.inp, border: formErrors.dailyLimit ? '1px solid #ef5350' : '1px solid #d0d7de' }}
                  value={form.dailyLimit}
                  onChange={e => { setForm(f => ({ ...f, dailyLimit: e.target.value })); setFormErrors(err => ({ ...err, dailyLimit: '' })); }}
                />
                {formErrors.dailyLimit && <span style={{ color: '#b71c1c', fontSize: '0.82rem', marginTop: '0.3rem', display: 'block' }}>{formErrors.dailyLimit}</span>}
              </div>
            </div>
            <button type="submit" disabled={submitting} style={S.btn('#0066cc', submitting)}>
              {submitting ? 'Issuing…' : 'Issue Card'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>Loading cards…</div>
      ) : cards.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💳</div>
          <p style={{ margin: 0, fontWeight: 600 }}>No cards yet</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Issue a card to get started.</p>
        </div>
      ) : (
        <>
          {activeCards.length > 0 && (
            <div>
              {activeCards.map(card => (
                <div key={card.id} style={{ ...S.card, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <CardVisual card={card} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: '#1a1a2e', textTransform: 'capitalize' }}>{card.cardType} Card</span>
                      {statusBadge(card.status)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.8 }}>
                      <div><span style={{ color: '#888' }}>Daily limit:</span> ${(card.dailyLimit / 100).toFixed(2)}</div>
                      <div><span style={{ color: '#888' }}>Spent today:</span> ${(card.spendToday / 100).toFixed(2)}</div>
                      <div><span style={{ color: '#888' }}>Issued:</span> {new Date(card.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => toggleFreeze(card)}
                        disabled={actionLoading === card.id}
                        style={S.btn(card.status === 'frozen' ? '#0d47a1' : '#546e7a', actionLoading === card.id)}
                      >
                        {actionLoading === card.id ? '…' : card.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                      </button>
                      <button
                        onClick={() => setConfirmCancel(card.id)}
                        disabled={actionLoading === card.id}
                        style={{ ...S.btn('#b71c1c', actionLoading === card.id), background: 'none', color: '#b71c1c', border: '1px solid #ef9a9a' }}
                      >
                        Cancel card
                      </button>
                    </div>

                    {confirmCancel === card.id && (
                      <div style={{ marginTop: '0.75rem', background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, padding: '0.875rem 1rem' }}>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#b71c1c', fontWeight: 600 }}>
                          Are you sure? This cannot be undone. The card ending ····{card.lastFour} will be permanently cancelled.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => cancelCard(card.id)} style={S.btn('#b71c1c')}>Yes, cancel card</button>
                          <button onClick={() => setConfirmCancel(null)} style={{ background: 'none', border: '1px solid #ccc', padding: '0.55rem 1rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: '#444' }}>
                            Keep card
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {cancelledCards.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cancelled Cards
              </h3>
              {cancelledCards.map(card => (
                <div key={card.id} style={{ ...S.card, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start', opacity: 0.6 }}>
                  <CardVisual card={card} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#666', textTransform: 'capitalize' }}>{card.cardType} Card</span>
                      {statusBadge(card.status)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
                      Cancelled — ····{card.lastFour}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
