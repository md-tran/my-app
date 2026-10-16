import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { ConfirmButton } from './ui';

export default function Settings() {
  const { state, dispatch } = useStore();
  const [s, setS] = useState(state.settings);
  const [suppression, setSuppression] = useState(state.settings.suppression.join('\n'));
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const setAvail = (patch) => setS({ ...s, availability: { ...s.availability, ...patch } });
  const setSite = (patch) => setS({ ...s, website: { ...s.website, ...patch } });

  function save(e) {
    e.preventDefault();
    dispatch({
      type: 'saveSettings',
      settings: { ...s, suppression: suppression.split(/[\n,]/).map((x) => x.trim()).filter(Boolean) },
    });
  }

  return (
    <form className="form" onSubmit={save}>
      <h1>Settings</h1>

      <section className="card">
        <h2>AI personalisation</h2>
        <p className="muted">
          API server:{' '}
          {health ? (
            health.ai ? <span className="ok">connected, Claude ready ({health.model})</span> : <span className="warn">running, but ANTHROPIC_API_KEY is not set</span>
          ) : (
            <span className="warn">not reachable — start it with <code>npm run server</code></span>
          )}
        </p>
        <label className="check">
          <input type="checkbox" checked={s.useAI} onChange={(e) => setS({ ...s, useAI: e.target.checked })} />
          Use Claude to write outreach (falls back to templates if unavailable)
        </label>
      </section>

      <section className="card">
        <h2>Prospect data</h2>
        <p className="muted">
          Apollo: {health?.sources?.apollo ? <span className="ok">connected</span> : <span className="warn">not set (APOLLO_API_KEY)</span>}
          {' · '}
          Companies House: {health?.sources?.companiesHouse ? <span className="ok">connected</span> : <span className="warn">not set (COMPANIES_HOUSE_API_KEY)</span>}
        </p>
        <label className="check">
          <input id="live-data" type="checkbox" checked={s.liveData !== false} onChange={(e) => setS({ ...s, liveData: e.target.checked })} />
          Use live prospect data when connected (Apollo reveals cost about 1 credit per contact)
        </label>
        <p className="muted small">Without Apollo the agents use demo data, so you can try the full flow without spending credits.</p>
      </section>

      <section className="card">
        <h2>Website (Wix)</h2>
        <p className="muted">
          Booking sync:{' '}
          {health?.wix ? <span className="ok">connected</span> : <span className="warn">set WIX_API_KEY on the API server to sync booking requests</span>}
        </p>
        <label>
          Blog guide (linked in the first follow-up)
          <input value={s.website.guideUrl} onChange={(e) => setSite({ guideUrl: e.target.value })} />
        </label>
        <label>
          Booking page (linked in the last follow-up and used as the meeting link)
          <input
            value={s.website.bookingUrl}
            onChange={(e) => setS({ ...s, website: { ...s.website, bookingUrl: e.target.value }, availability: { ...s.availability, meetingLink: e.target.value } })}
          />
        </label>
      </section>

      <section className="card">
        <h2>Sending & compliance</h2>
        <label>
          Daily send cap
          <input type="number" min="1" value={s.dailySendCap} onChange={(e) => setS({ ...s, dailySendCap: Number(e.target.value) })} />
        </label>
        <label>
          Suppression list (emails or domains, one per line)
          <textarea rows="5" value={suppression} onChange={(e) => setSuppression(e.target.value)} />
        </label>
        <p className="muted small">Unsubscribes are added automatically. Every first email carries an opt-out line.</p>
      </section>

      <section className="card">
        <h2>Meeting booking</h2>
        <div className="row">
          <label>
            Meeting title
            <input value={s.availability.meetingTitle} onChange={(e) => setAvail({ meetingTitle: e.target.value })} />
          </label>
          <label>
            Duration (minutes)
            <input type="number" min="10" value={s.availability.durationMinutes} onChange={(e) => setAvail({ durationMinutes: Number(e.target.value) })} />
          </label>
        </div>
        <label>
          Bookable hours (24h, comma-separated)
          <input
            value={s.availability.hours.join(', ')}
            onChange={(e) => setAvail({ hours: e.target.value.split(',').map((h) => parseInt(h, 10)).filter((h) => h >= 0 && h < 24) })}
          />
        </label>
        <label>
          Meeting link
          <input value={s.availability.meetingLink} onChange={(e) => setAvail({ meetingLink: e.target.value })} />
        </label>
      </section>

      <div className="actions">
        <button className="btn primary" type="submit">Save settings</button>
        <ConfirmButton label="Reset workspace" confirmLabel="Delete all campaigns, prospects and meetings?" onConfirm={() => dispatch({ type: 'reset' })} />
      </div>
    </form>
  );
}
