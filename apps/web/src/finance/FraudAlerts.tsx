import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface FraudEvent {
  id: string;
  accountId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolved: number;
  createdAt: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#fce4ec', color: '#b71c1c', label: 'Critical' },
  high:     { bg: '#fff3e0', color: '#e65100', label: 'High' },
  medium:   { bg: '#fff8e1', color: '#f57f17', label: 'Medium' },
  low:      { bg: '#e3f2fd', color: '#0d47a1', label: 'Low' },
};

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1rem',
  } as React.CSSProperties,
  btn: (color: string, disabled?: boolean) => ({
    background: disabled ? '#bbb' : color, color: '#fff', border: 'none',
    padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties),
};

function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
      background: style.bg, color: style.color,
    }}>
      {style.label}
    </span>
  );
}

export default function FraudAlerts() {
  const { show } = useToast();
  const token = localStorage.getItem('fin_token') || '';
  const [events, setEvents] = useState<FraudEvent[]>([]);
  const [unresolved, setUnresolved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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
    fetch('/api/BrightBank/fraud-events', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setEvents(d.events || []);
        setUnresolved(d.unresolved || 0);
      })
      .catch(() => show('Failed to load security alerts', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function resolveEvent(id: string) {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/BrightBank/fraud-events/${id}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { show(data.error || 'Failed to resolve alert', 'error'); return; }
      setEvents(prev => prev.map(e => e.id === id ? { ...e, resolved: 1 } : e));
      setUnresolved(prev => Math.max(0, prev - 1));
      show('Alert marked as resolved', 'success');
    } catch {
      show('Network error', 'error');
    } finally {
      setResolvingId(null);
    }
  }

  const allResolved = events.length > 0 && unresolved === 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1a1a2e' }}>Security Alerts</h1>
          {unresolved > 0 && (
            <span style={{
              background: '#b71c1c', color: '#fff', borderRadius: 20,
              padding: '0.15rem 0.65rem', fontSize: '0.8rem', fontWeight: 700,
            }}>
              {unresolved} unresolved
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888' }}>
          {events.length} alert{events.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {loading ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#888', padding: '3rem' }}>
          Loading security alerts…
        </div>
      ) : events.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem', color: '#4caf50' }}>✓</div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1b5e20' }}>No security alerts</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#888' }}>
            Your accounts are secure. We'll notify you if anything looks suspicious.
          </p>
        </div>
      ) : allResolved ? (
        <>
          <div style={{ ...S.card, textAlign: 'center', padding: '1.5rem', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, marginBottom: '1rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#4caf50' }}>✓</div>
            <p style={{ margin: 0, fontWeight: 700, color: '#1b5e20' }}>All alerts resolved</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#388e3c' }}>
              Your accounts are secure.
            </p>
          </div>
          {renderEvents(events, resolvingId, resolveEvent)}
        </>
      ) : (
        renderEvents(events, resolvingId, resolveEvent)
      )}
    </div>
  );
}

function renderEvents(
  events: FraudEvent[],
  resolvingId: string | null,
  resolveEvent: (id: string) => void
) {
  const unresolved = events.filter(e => !e.resolved);
  const resolved = events.filter(e => e.resolved);

  return (
    <>
      {unresolved.length > 0 && (
        <div>
          {unresolved.map(event => (
            <EventCard key={event.id} event={event} resolvingId={resolvingId} onResolve={resolveEvent} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ marginTop: unresolved.length > 0 ? '1.5rem' : 0 }}>
          {unresolved.length > 0 && (
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Resolved Alerts
            </h3>
          )}
          {resolved.map(event => (
            <EventCard key={event.id} event={event} resolvingId={resolvingId} onResolve={resolveEvent} />
          ))}
        </div>
      )}
    </>
  );
}

function EventCard({
  event,
  resolvingId,
  onResolve,
}: {
  event: FraudEvent;
  resolvingId: string | null;
  onResolve: (id: string) => void;
}) {
  const isResolved = Boolean(event.resolved);
  const S_card: React.CSSProperties = {
    background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '0.75rem',
    borderLeft: isResolved ? '4px solid #c8e6c9' : `4px solid ${severityBorderColor(event.severity)}`,
    opacity: isResolved ? 0.65 : 1,
  };

  return (
    <div style={S_card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <SeverityBadge severity={event.severity} />
            <span style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '0.95rem' }}>{event.type}</span>
            {isResolved && (
              <span style={{
                display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 20,
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                background: '#e8f5e9', color: '#1b5e20',
              }}>
                Resolved
              </span>
            )}
          </div>
          <p style={{ margin: '0 0 0.5rem', color: '#444', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {event.description}
          </p>
          <div style={{ fontSize: '0.78rem', color: '#999' }}>
            {new Date(event.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>
        {!isResolved && (
          <button
            onClick={() => onResolve(event.id)}
            disabled={resolvingId === event.id}
            style={{
              background: 'none', border: '1px solid #4caf50', color: '#1b5e20',
              padding: '0.45rem 0.9rem', borderRadius: 8, fontSize: '0.85rem',
              fontWeight: 600, cursor: resolvingId === event.id ? 'not-allowed' : 'pointer',
              flexShrink: 0, opacity: resolvingId === event.id ? 0.5 : 1,
            }}
          >
            {resolvingId === event.id ? 'Resolving…' : 'Mark Resolved'}
          </button>
        )}
      </div>
    </div>
  );
}

function severityBorderColor(severity: string) {
  const map: Record<string, string> = {
    critical: '#ef5350',
    high: '#ff9800',
    medium: '#ffc107',
    low: '#42a5f5',
  };
  return map[severity] || '#90a4ae';
}
