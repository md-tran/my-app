import React, { useState } from 'react';
import { useStore } from '../store';
import { uid } from '../agents/random';
import { money } from './ui';
import { funnel } from './Dashboard';

// Run outbound as a service: each client gets its own campaigns, and their
// report shows meetings delivered and what you can bill for them.

export function clientReport(client, prospects, meetings) {
  const mine = prospects.filter((p) => p.clientId === client.id);
  const ids = new Set(mine.map((p) => p.id));
  const delivered = meetings.filter((m) => ids.has(m.prospectId) && m.status !== 'cancelled');
  const held = delivered.filter((m) => m.status === 'held').length;
  const f = funnel(mine);
  return {
    ...f,
    delivered: delivered.length,
    held,
    invoice: client.retainer + client.perMeeting * delivered.length,
  };
}

export default function Clients() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState({ name: '', retainer: 1500, perMeeting: 250 });

  function add(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    dispatch({ type: 'saveClient', client: { id: uid('c'), ...draft, name: draft.name.trim() } });
    setDraft({ name: '', retainer: 1500, perMeeting: 250 });
  }

  const totals = state.clients.reduce((sum, c) => sum + clientReport(c, state.prospects, state.meetings).invoice, 0);

  return (
    <div>
      <div className="page-head">
        <h1>Clients</h1>
        <div className="muted">Billable this period: <b>{money(totals)}</b></div>
      </div>
      <p className="muted">
        Selling outbound as a service? Add each client, run campaigns on their behalf, and share their report. Pricing defaults to a monthly retainer plus a fee per meeting delivered.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Contacted</th>
              <th>Replies</th>
              <th>Meetings</th>
              <th>Retainer</th>
              <th>Per meeting</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {state.clients.map((c) => {
              const r = clientReport(c, state.prospects, state.meetings);
              const update = (patch) => dispatch({ type: 'saveClient', client: { ...c, ...patch } });
              return (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{r.contacted}</td>
                  <td>{r.replied}</td>
                  <td>{r.delivered} <span className="muted">({r.held} held)</span></td>
                  <td><input className="num" type="number" value={c.retainer} onChange={(e) => update({ retainer: Number(e.target.value) })} /></td>
                  <td><input className="num" type="number" value={c.perMeeting} onChange={(e) => update({ perMeeting: Number(e.target.value) })} /></td>
                  <td><b>{money(r.invoice)}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form className="card row" onSubmit={add}>
        <label>
          New client
          <input placeholder="Company name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label>
          Monthly retainer (£)
          <input type="number" value={draft.retainer} onChange={(e) => setDraft({ ...draft, retainer: Number(e.target.value) })} />
        </label>
        <label>
          Fee per meeting (£)
          <input type="number" value={draft.perMeeting} onChange={(e) => setDraft({ ...draft, perMeeting: Number(e.target.value) })} />
        </label>
        <button className="btn primary" type="submit">Add client</button>
      </form>
    </div>
  );
}
