import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface Message {
  id: string;
  subject: string;
  body: string;
  isRead: boolean;
  sentAt: string;
  senderId: string;
}

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
  inp: {
    width: '100%', padding: '0.7rem 1rem', border: '1px solid #d0d7de',
    borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function Messages() {
  const { show } = useToast();
  const token = localStorage.getItem('hlt_token') || '';
  const patientId = localStorage.getItem('hlt_patient_id') || '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token || !patientId) return;
    fetch(`/api/HealthyU/patients/${patientId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('fetch'); return r.json(); })
      .then(d => setMessages(d.messages || []))
      .catch(() => show('Could not load messages', 'error'))
      .finally(() => setLoading(false));
  }, [token, patientId]);

  async function selectMessage(msg: Message) {
    setSelected(msg);
    if (!msg.isRead) {
      try {
        await fetch(`/api/HealthyU/messages/${msg.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
        setSelected({ ...msg, isRead: true });
      } catch {
        // non-critical, ignore
      }
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { show('Subject is required', 'error'); return; }
    if (!body.trim()) { show('Message body is required', 'error'); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/HealthyU/patients/${patientId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [{ ...newMsg, isRead: true }, ...prev]);
        setSubject('');
        setBody('');
        setComposing(false);
        show('Message sent successfully', 'success');
      } else {
        const err = await res.json();
        show(err.error || 'Failed to send message', 'error');
      }
    } catch {
      show('Network error. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  }

  if (!token || !patientId) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <div style={{ ...S.card, padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <p style={{ color: '#555', marginBottom: '1rem' }}>Please sign in via the Patient Portal to view your messages.</p>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', fontWeight: 600 }}>Go to Patient Portal</Link>
        </div>
      </div>
    );
  }

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/HealthyU/dashboard" style={{ color: '#2e7d32', textDecoration: 'none', fontSize: '1.1rem' }}>←</Link>
          <div>
            <h2 style={{ margin: 0, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Messages
              {unreadCount > 0 && (
                <span style={{ background: '#c62828', color: '#fff', borderRadius: 12, padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {unreadCount}
                </span>
              )}
            </h2>
          </div>
        </div>
        <button
          onClick={() => { setComposing(true); setSelected(null); }}
          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
        >
          + New Message
        </button>
      </div>

      {composing && (
        <div style={{ ...S.card, border: '1px solid #c8e6c9', borderTop: '4px solid #2e7d32', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#1b5e20' }}>New Message</h3>
          <form onSubmit={sendMessage} noValidate>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                Subject <span style={{ color: '#b71c1c' }}>*</span>
              </label>
              <input
                type="text"
                style={S.inp}
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Question about my medication"
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                Message <span style={{ color: '#b71c1c' }}>*</span>
              </label>
              <textarea
                style={{ ...S.inp, minHeight: 100, resize: 'vertical' as const }}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here…"
                rows={4}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setComposing(false); setSubject(''); setBody(''); }}
                style={{ flex: 1, background: '#f0f2f5', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={sending}
                style={{ flex: 2, background: sending ? '#aaa' : '#2e7d32', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {sending ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '1rem' }}>
        {/* Message list */}
        <div>
          {loading && (
            <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '2rem' }}>
              Loading messages…
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '2rem' }}>
              No messages yet.
            </div>
          )}
          {messages.map(m => (
            <div
              key={m.id}
              onClick={() => selectMessage(m)}
              style={{
                ...S.card,
                marginBottom: '0.5rem',
                cursor: 'pointer',
                borderLeft: `4px solid ${selected?.id === m.id ? '#2e7d32' : m.isRead ? '#e0e0e0' : '#1565c0'}`,
                background: selected?.id === m.id ? '#f1f8f1' : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ fontWeight: m.isRead ? 500 : 700, fontSize: '0.92rem', color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>
                  {!m.isRead && (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#1565c0', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                  )}
                  {m.subject}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#888', flexShrink: 0 }}>{formatDate(m.sentAt)}</div>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {m.body}
              </div>
            </div>
          ))}
        </div>

        {/* Message detail */}
        <div>
          {!selected ? (
            <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
              Select a message to read it
            </div>
          ) : (
            <div style={S.card}>
              <h3 style={{ margin: '0 0 0.5rem', color: '#1a1a2e', fontSize: '1.1rem' }}>{selected.subject}</h3>
              <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '1.25rem' }}>
                From: {selected.senderId} · {new Date(selected.sentAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
                {selected.body}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
