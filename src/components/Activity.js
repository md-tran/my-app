import React from 'react';
import { useStore } from '../store';
import { Empty } from './ui';

const AGENTS = [
  ['Prospector', 'Finds contacts that match your ideal customer profile.'],
  ['Enricher', 'Verifies emails, adds firmographics and buying signals, scores fit.'],
  ['Personaliser', 'Writes a tailored first email and follow-ups (Claude, or templates offline).'],
  ['Outreach', 'Runs multi-step email + LinkedIn sequences within your send cap.'],
  ['Booker', 'Books a meeting from your availability when a prospect says yes.'],
];

export default function Activity() {
  const { state, dispatch } = useStore();
  return (
    <div>
      <div className="page-head">
        <h1>Agents</h1>
        {state.logs.length > 0 && <button className="btn ghost" onClick={() => dispatch({ type: 'clearLogs' })}>Clear log</button>}
      </div>
      <div className="agents">
        {AGENTS.map(([name, desc], i) => (
          <div className="agent" key={name}>
            <div className="agent-step">{i + 1}</div>
            <div>
              <strong>{name}</strong>
              <div className="muted small">{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <section className="card">
        <h2>Activity log</h2>
        {!state.logs.length ? (
          <Empty title="Quiet so far">Agent activity appears here when you run a campaign.</Empty>
        ) : (
          <ul className="log">
            {state.logs.map((l) => (
              <li key={l.id} className={`log-${l.level}`}>
                <span className="muted small">{new Date(l.at).toLocaleTimeString()}</span>
                <span className="log-agent">{l.agent}</span>
                {l.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
