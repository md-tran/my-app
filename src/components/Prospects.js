import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { StatusBadge, TierBadge, Empty, STATUS_LABELS } from './ui';

export function toCsv(prospects) {
  const cols = ['firstName', 'lastName', 'title', 'email', 'emailStatus', 'company', 'domain', 'industry', 'employees', 'city', 'score', 'tier', 'status'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = prospects.map((p) =>
    [p.firstName, p.lastName, p.title, p.email, p.emailStatus, p.company.name, p.company.domain, p.company.industry, p.company.employees, p.company.city, p.score, p.tier, p.status]
      .map(esc)
      .join(','),
  );
  return [cols.join(','), ...rows].join('\n');
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Prospects() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [campaignId, setCampaignId] = useState('all');
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.prospects
      .filter((p) => status === 'all' || p.status === status)
      .filter((p) => campaignId === 'all' || p.campaignId === campaignId)
      .filter((p) => !needle || `${p.firstName} ${p.lastName} ${p.company.name} ${p.title}`.toLowerCase().includes(needle))
      .sort((a, b) => b.score - a.score);
  }, [state.prospects, q, status, campaignId]);

  if (!state.prospects.length) return <Empty title="No prospects yet">Run a campaign to have the Prospector and Enricher agents build your list.</Empty>;
  const current = selected && state.prospects.find((p) => p.id === selected);

  return (
    <div>
      <div className="page-head">
        <h1>Prospects</h1>
        <button className="btn" onClick={() => download('mdt-prospects.csv', toCsv(rows))}>Export CSV</button>
      </div>
      <div className="filters">
        <input placeholder="Search name, company, title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="all">All campaigns</option>
          {state.campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="muted">{rows.length} shown</span>
      </div>

      <div className="split">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fit</th>
                <th>Name</th>
                <th>Company</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={selected === p.id ? 'row-on' : ''} onClick={() => setSelected(p.id)}>
                  <td><TierBadge tier={p.tier} score={p.score} /></td>
                  <td>
                    <strong>{p.firstName} {p.lastName}</strong>
                    <div className="muted">{p.title}</div>
                    <div className={`small email-${p.emailStatus}`}>{p.email}</div>
                  </td>
                  <td>
                    {p.company.name}
                    <div className="muted">{p.company.industry} · {p.company.employees} staff</div>
                    {p.signals.length > 0 && <div className="small muted">{p.signals.length} buying signal{p.signals.length > 1 ? 's' : ''}</div>}
                  </td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {current && <ProspectDetail p={current} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function ProspectDetail({ p, onClose }) {
  return (
    <aside className="card detail">
      <div className="card-head">
        <h2>{p.firstName} {p.lastName}</h2>
        <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="muted">{p.title} at {p.company.name}</div>
      <dl>
        <dt>Email</dt><dd>{p.email} ({p.emailStatus})</dd>
        {p.phone && (<><dt>Phone</dt><dd>{p.phone}</dd></>)}
        <dt>LinkedIn</dt><dd><a href={p.linkedin} target="_blank" rel="noreferrer">Profile</a></dd>
        <dt>Company</dt><dd>{p.company.domain} · {p.company.city}</dd>
        <dt>Size / revenue</dt><dd>{p.company.employees} staff · {p.company.revenueBand}</dd>
        <dt>Funding</dt><dd>{p.company.fundingStage}</dd>
        <dt>Tech stack</dt><dd>{p.company.techStack.join(', ')}</dd>
      </dl>
      <h3>Why this score ({p.score})</h3>
      <ul className="reasons">
        {p.scoreReasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {p.disqualifiedReason && <p className="warn">Disqualified: {p.disqualifiedReason}</p>}
      {p.reply && (
        <>
          <h3>Reply ({p.reply.sentiment.replace('_', ' ')})</h3>
          <blockquote>{p.reply.text}</blockquote>
        </>
      )}
    </aside>
  );
}
