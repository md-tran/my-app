import React, { useState } from 'react';
import { useStore } from '../store';
import { useAgents } from '../useAgents';
import { personalise } from '../agents/personaliser';
import { OPT_OUT } from '../agents/sequencer';
import { StatusBadge, TierBadge, Empty, fmtDate } from './ui';

export default function Outreach() {
  const { state, dispatch } = useStore();
  const { busy, outreach } = useAgents();
  const [tab, setTab] = useState('review');
  const [openId, setOpenId] = useState(null);

  const drafts = state.prospects.filter((p) => p.status === 'drafted').sort((a, b) => b.score - a.score);
  const approved = state.prospects.filter((p) => p.status === 'approved');
  const live = state.prospects.filter((p) => p.sequence).sort((a, b) => (b.reply ? 1 : 0) - (a.reply ? 1 : 0));
  const list = tab === 'review' ? drafts : tab === 'approved' ? approved : live;

  return (
    <div>
      <div className="page-head">
        <h1>Outreach</h1>
        <div className="actions">
          {drafts.length > 0 && (
            <button className="btn" onClick={() => dispatch({ type: 'approveAll' })}>Approve all {drafts.length}</button>
          )}
          <button className="btn primary" disabled={!approved.length || !!busy} onClick={() => outreach()}>
            {busy ? 'Sending…' : `Launch sequences (${approved.length})`}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'review' ? 'tab-on' : ''} onClick={() => setTab('review')}>Needs review ({drafts.length})</button>
        <button className={tab === 'approved' ? 'tab-on' : ''} onClick={() => setTab('approved')}>Approved ({approved.length})</button>
        <button className={tab === 'live' ? 'tab-on' : ''} onClick={() => setTab('live')}>Live sequences ({live.length})</button>
      </div>

      {!list.length && (
        <Empty title={tab === 'live' ? 'No live sequences' : 'Nothing here'}>
          {tab === 'review' ? 'Run a campaign to generate drafts for review.' : tab === 'approved' ? 'Approve drafts to queue them for sending.' : 'Launch sequences to start contacting approved prospects.'}
        </Empty>
      )}

      {list.map((p) =>
        tab === 'live' ? (
          <SequenceCard key={p.id} p={p} open={openId === p.id} toggle={() => setOpenId(openId === p.id ? null : p.id)} />
        ) : (
          <DraftCard key={p.id} p={p} useAI={state.settings.useAI} website={state.settings.website} icp={state.campaigns.find((c) => c.id === p.campaignId)} dispatch={dispatch} />
        ),
      )}
    </div>
  );
}

function DraftCard({ p, icp, useAI, website, dispatch }) {
  const [subject, setSubject] = useState(p.message.subject);
  const [body, setBody] = useState(p.message.body);
  const [regenerating, setRegenerating] = useState(false);
  const dirty = subject !== p.message.subject || body !== p.message.body;
  const save = (patch = {}) => dispatch({ type: 'updateProspect', id: p.id, patch: { message: { ...p.message, subject, body }, ...patch } });

  async function regenerate() {
    if (!icp) return;
    setRegenerating(true);
    const message = await personalise(p, { ...icp.icp, ...icp.messaging, ...website }, { useAI });
    setSubject(message.subject);
    setBody(message.body);
    dispatch({ type: 'updateProspect', id: p.id, patch: { message } });
    setRegenerating(false);
  }

  return (
    <section className="card draft">
      <div className="card-head">
        <div>
          <strong>{p.firstName} {p.lastName}</strong> <span className="muted">· {p.title}, {p.company.name}</span>
        </div>
        <div className="actions">
          <TierBadge tier={p.tier} score={p.score} />
          <span className={`source source-${p.message.source}`}>{p.message.source === 'claude' ? 'Written by Claude' : 'Template'}</span>
        </div>
      </div>
      {p.message.personalisationPoints?.length > 0 && (
        <div className="chips static">
          {p.message.personalisationPoints.map((pt) => <span key={pt} className="chip">{pt}</span>)}
        </div>
      )}
      <label>
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label>
        Email
        <textarea rows="9" value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="muted small">Opt-out line added automatically: “{OPT_OUT.trim().split('\n')[1]}”</div>
      <details>
        <summary>Follow-ups ({p.message.followUps.length})</summary>
        {p.message.followUps.map((f) => (
          <p key={f.day} className="follow"><b>Day {f.day}:</b> {f.body}</p>
        ))}
      </details>
      <div className="actions">
        {p.status === 'drafted' ? (
          <>
            <button className="btn primary" onClick={() => save({ status: 'approved' })}>
              Approve
            </button>
            {dirty && <button className="btn" onClick={() => save()}>Save edits</button>}
            <button className="btn" disabled={regenerating} onClick={regenerate}>{regenerating ? 'Rewriting…' : 'Regenerate'}</button>
            <button className="btn ghost danger" onClick={() => save({ status: 'disqualified', disqualifiedReason: 'Rejected in review' })}>Reject</button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => save({ status: 'drafted' })}>Move back to review</button>
        )}
      </div>
    </section>
  );
}

function SequenceCard({ p, open, toggle }) {
  return (
    <section className="card">
      <div className="card-head clickable" onClick={toggle}>
        <div>
          <strong>{p.firstName} {p.lastName}</strong> <span className="muted">· {p.company.name}</span>
        </div>
        <StatusBadge status={p.status} />
      </div>
      {p.reply && <blockquote className={`reply reply-${p.reply.sentiment}`}>“{p.reply.text}”</blockquote>}
      {open && (
        <ol className="timeline">
          {p.sequence.map((s) => (
            <li key={s.step} className={`step-${s.status}`}>
              <b>Step {s.step} · {s.channel}</b> <span className="muted">{fmtDate(s.sendAt)} · {s.status}{s.opened ? ' · opened' : ''}</span>
              {s.subject && <div>{s.subject}</div>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
