import React, { useState } from 'react';
import { useStore, defaultIcp, defaultMessaging } from '../store';
import { useAgents } from '../useAgents';
import { INDUSTRIES, REGIONS, SENIORITY_TITLES } from '../agents/prospector';
import { MultiSelect, Empty, ConfirmButton } from './ui';
import { uid } from '../agents/random';
import { funnel } from './Dashboard';

function newCampaign(clientId) {
  return {
    id: uid('cmp'),
    name: 'UK SaaS & E-commerce leaders',
    clientId,
    targetCount: 30,
    minScore: 60,
    autoApprove: false,
    icp: { ...defaultIcp },
    messaging: { ...defaultMessaging },
    runs: 0,
    createdAt: new Date().toISOString(),
  };
}

export default function Campaigns({ go }) {
  const { state, dispatch } = useStore();
  const { busy, research } = useAgents();
  const [editing, setEditing] = useState(null);

  if (editing) {
    return (
      <CampaignForm
        campaign={editing}
        clients={state.clients}
        onCancel={() => setEditing(null)}
        onSave={(c, run) => {
          dispatch({ type: 'saveCampaign', campaign: c });
          setEditing(null);
          if (run) research(c);
        }}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Campaigns</h1>
        <button className="btn primary" onClick={() => setEditing(newCampaign(state.clients[0].id))}>
          + New campaign
        </button>
      </div>
      {!state.campaigns.length && (
        <Empty title="No campaigns yet">A campaign is an ideal customer profile plus a message. Create one and the agents do the rest.</Empty>
      )}
      <div className="cards">
        {state.campaigns.map((c) => {
          const f = funnel(state.prospects.filter((p) => p.campaignId === c.id));
          const client = state.clients.find((cl) => cl.id === c.clientId);
          const drafts = state.prospects.filter((p) => p.campaignId === c.id && p.status === 'drafted').length;
          return (
            <section className="card" key={c.id}>
              <div className="card-head">
                <div>
                  <h2>{c.name}</h2>
                  <div className="muted">
                    {client?.name} · {c.icp.industries.join(', ') || 'Any industry'} · {c.icp.regions.join(', ') || 'Any region'} · {c.icp.minEmployees}–{c.icp.maxEmployees} staff
                  </div>
                </div>
              </div>
              <div className="mini-stats">
                <span><b>{f.sourced}</b> sourced</span>
                <span><b>{f.qualified}</b> qualified</span>
                <span><b>{f.contacted}</b> contacted</span>
                <span><b>{f.meetings}</b> meetings</span>
              </div>
              <div className="actions">
                <button className="btn primary" disabled={!!busy} onClick={() => research(c)}>
                  {busy === c.id ? 'Agents working…' : c.runs ? 'Find more prospects' : 'Run agents'}
                </button>
                {drafts > 0 && (
                  <button className="btn" onClick={() => go('outreach')}>
                    Review {drafts} drafts
                  </button>
                )}
                <button className="btn ghost" onClick={() => setEditing(c)}>Edit</button>
                <ConfirmButton label="Delete" confirmLabel="Delete campaign and its prospects?" onConfirm={() => dispatch({ type: 'deleteCampaign', id: c.id })} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CampaignForm({ campaign, clients, onSave, onCancel }) {
  const [c, setC] = useState(campaign);
  const set = (patch) => setC({ ...c, ...patch });
  const setIcp = (patch) => set({ icp: { ...c.icp, ...patch } });
  const setMsg = (patch) => set({ messaging: { ...c.messaging, ...patch } });

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(c, true);
      }}
    >
      <h1>{campaign.runs ? 'Edit campaign' : 'New campaign'}</h1>

      <section className="card">
        <h2>Basics</h2>
        <label>
          Campaign name
          <input value={c.name} onChange={(e) => set({ name: e.target.value })} required />
        </label>
        <div className="row">
          <label>
            Client
            <select value={c.clientId} onChange={(e) => set({ clientId: e.target.value })}>
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>{cl.name}</option>
              ))}
            </select>
          </label>
          <label>
            Prospects per run
            <input type="number" min="5" max="200" value={c.targetCount} onChange={(e) => set({ targetCount: Number(e.target.value) })} />
          </label>
          <label>
            Minimum fit score
            <input type="number" min="0" max="100" value={c.minScore} onChange={(e) => set({ minScore: Number(e.target.value) })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={c.autoApprove} onChange={(e) => set({ autoApprove: e.target.checked })} />
          Auto-approve drafts (skip human review)
        </label>
      </section>

      <section className="card">
        <h2>Ideal customer profile</h2>
        <div className="field-label">Industries</div>
        <MultiSelect options={INDUSTRIES} value={c.icp.industries} onChange={(industries) => setIcp({ industries })} />
        <div className="field-label">Regions</div>
        <MultiSelect options={Object.keys(REGIONS)} value={c.icp.regions} onChange={(regions) => setIcp({ regions })} />
        <div className="field-label">Seniority</div>
        <MultiSelect options={Object.keys(SENIORITY_TITLES)} value={c.icp.seniorities} onChange={(seniorities) => setIcp({ seniorities })} />
        <div className="row">
          <label>
            Min employees
            <input type="number" min="1" value={c.icp.minEmployees} onChange={(e) => setIcp({ minEmployees: Number(e.target.value) })} />
          </label>
          <label>
            Max employees
            <input type="number" min="1" value={c.icp.maxEmployees} onChange={(e) => setIcp({ maxEmployees: Number(e.target.value) })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Messaging</h2>
        <label>
          What you sell
          <input value={c.messaging.offer} onChange={(e) => setMsg({ offer: e.target.value })} />
        </label>
        <label>
          Value proposition
          <textarea rows="3" value={c.messaging.valueProp} onChange={(e) => setMsg({ valueProp: e.target.value })} />
        </label>
        <label>
          Call to action
          <input value={c.messaging.callToAction} onChange={(e) => setMsg({ callToAction: e.target.value })} />
        </label>
        <label>
          Sender name / sign-off
          <input value={c.messaging.senderName} onChange={(e) => setMsg({ senderName: e.target.value })} />
        </label>
      </section>

      <div className="actions">
        <button className="btn primary" type="submit">Save & run agents</button>
        <button className="btn" type="button" onClick={() => onSave(c, false)}>Save only</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
