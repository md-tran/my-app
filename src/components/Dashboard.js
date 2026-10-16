import React, { useState } from 'react';
import { useStore } from '../store';
import { Stat, Empty, pct, fmtDate } from './ui';

const CONTACTED = ['sequenced', 'replied', 'meeting_booked'];

export function funnel(prospects) {
  const contacted = prospects.filter((p) => CONTACTED.includes(p.status) || p.sequence);
  return {
    sourced: prospects.length,
    qualified: prospects.filter((p) => p.message).length,
    contacted: contacted.length,
    replied: prospects.filter((p) => p.reply).length,
    positive: prospects.filter((p) => p.reply?.sentiment === 'positive').length,
    meetings: prospects.filter((p) => p.status === 'meeting_booked').length,
  };
}

export default function Dashboard({ go }) {
  const { state } = useStore();
  const [clientId, setClientId] = useState('all');
  const prospects = state.prospects.filter((p) => clientId === 'all' || p.clientId === clientId);
  const f = funnel(prospects);
  const upcoming = state.meetings
    .filter((m) => m.status === 'confirmed' && new Date(m.start) > new Date())
    .filter((m) => clientId === 'all' || prospects.some((p) => p.id === m.prospectId))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);

  if (!state.campaigns.length) {
    return (
      <Empty title="Welcome to MDT Outbound">
        Define who you sell to, and the agents will find prospects, enrich them, write personalised outreach and book meetings.{' '}
        <button className="link" onClick={() => go('campaigns')}>
          Create your first campaign →
        </button>
      </Empty>
    );
  }

  const steps = [
    ['Sourced', f.sourced],
    ['Qualified & drafted', f.qualified],
    ['Contacted', f.contacted],
    ['Replied', f.replied],
    ['Positive', f.positive],
    ['Meetings', f.meetings],
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Pipeline overview</h1>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="all">All clients</option>
          {state.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="stats">
        <Stat label="Prospects sourced" value={f.sourced} />
        <Stat label="Contacted" value={f.contacted} hint={`${pct(f.contacted, f.sourced)} of sourced`} />
        <Stat label="Reply rate" value={pct(f.replied, f.contacted)} hint={`${f.replied} replies`} />
        <Stat label="Meetings booked" value={f.meetings} hint={`${pct(f.meetings, f.contacted)} of contacted`} />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Funnel</h2>
          {steps.map(([label, n]) => (
            <div className="funnel-row" key={label}>
              <span className="funnel-label">{label}</span>
              <div className="funnel-track">
                <div className="funnel-bar" style={{ width: `${f.sourced ? (n / f.sourced) * 100 : 0}%` }} />
              </div>
              <span className="funnel-num">{n}</span>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>Upcoming meetings</h2>
          {upcoming.length ? (
            <ul className="list">
              {upcoming.map((m) => (
                <li key={m.id}>
                  <strong>{m.attendee}</strong>
                  <span className="muted"> · {m.title.split('— ')[1]}</span>
                  <div className="muted">{fmtDate(m.start)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No meetings yet. Approve drafts and launch sequences from Outreach.</p>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Recent agent activity</h2>
        <ul className="log compact">
          {state.logs.slice(0, 8).map((l) => (
            <li key={l.id} className={`log-${l.level}`}>
              <span className="log-agent">{l.agent}</span> {l.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
