import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ResetButton() {
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  async function handleReset() {
    if (!confirm('Reset all demo data? This will clear your session and generate fresh data.')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      // Clear all domain tokens and local state
      ['fin_token', 'hlt_token', 'shop_token', 'hlt_patient_id', 'cart'].forEach(k => localStorage.removeItem(k));
      navigate('/');
      window.location.reload();
    } catch {
      alert('Reset failed. Please try again.');
      setResetting(false);
    }
  }

  return (
    <button
      onClick={handleReset}
      disabled={resetting}
      title="Reset all demo data and generate fresh seed data"
      style={{
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.25)',
        color: 'rgba(255,255,255,0.6)',
        padding: '0.35rem 0.75rem',
        borderRadius: 6,
        cursor: resetting ? 'not-allowed' : 'pointer',
        fontSize: '0.78rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!resetting) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; }}
    >
      {resetting ? (
        <>
          <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Resetting…
        </>
      ) : (
        <>↺ Reset Demo</>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
