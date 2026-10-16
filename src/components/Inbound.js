import React, { useState } from 'react';
import { useStore } from '../store';
import { slotForPreference } from '../agents/booker';
import { Empty, fmtDate } from './ui';

// Booking requests from the "Book a discovery call" form on mdtanalytics.com.
// The blog guide links to the booking page; outreach follow-ups link to both.

export function meetingFromRequest(request, slot, availability) {
  const start = new Date(slot);
  return {
    id: `m_web_${request.id}`,
    prospectId: null,
    inboundId: request.id,
    title: `${availability.meetingTitle} — ${request.company || 'Website lead'}`,
    attendee: `${request.firstName} ${request.lastName}`.trim(),
    attendeeEmail: request.email,
    start: start.toISOString(),
    end: new Date(start.getTime() + availability.durationMinutes * 60000).toISOString(),
    link: availability.meetingLink,
    status: 'confirmed',
    source: 'website',
  };
}

export default function Inbound() {
  const { state, dispatch } = useStore();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const { website, availability } = state.settings;
  const open = state.inbound.filter((r) => r.status === 'new');
  const done = state.inbound.filter((r) => r.status !== 'new');
  const outboundEmails = new Set(state.prospects.map((p) => p.email && p.email.toLowerCase()));

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/wix/booking-requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      dispatch({ type: 'inboundSynced', requests: data.requests });
      dispatch({ type: 'log', entry: { agent: 'Booker', message: `Synced ${data.requests.length} booking requests from mdtanalytics.com.`, level: 'success' } });
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  function confirm(request) {
    const slot = slotForPreference(availability, state.meetings, request.preferredTime);
    if (!slot) return setError('No free slots in the next four weeks — add more bookable hours in Settings.');
    const meeting = meetingFromRequest(request, slot, availability);
    dispatch({ type: 'confirmInbound', request, meeting });
    dispatch({ type: 'log', entry: { agent: 'Booker', message: `Confirmed ${meeting.attendee} (${request.company}) from the website for ${fmtDate(slot)}.`, level: 'success' } });
  }

  return (
    <div>
      <div className="page-head">
        <h1>Inbound</h1>
        <button className="btn primary" disabled={syncing} onClick={sync}>{syncing ? 'Syncing…' : 'Sync from Wix'}</button>
      </div>
      <p className="muted">
        Requests from the <a href={website.bookingUrl} target="_blank" rel="noreferrer">booking page</a> on your Wix site. Readers reach it from the{' '}
        <a href={website.guideUrl} target="_blank" rel="noreferrer">blog guide</a>, which every outreach sequence links to.
      </p>
      {error && <p className="warn">Couldn't sync: {error}</p>}

      {!state.inbound.length && <Empty title="No booking requests yet">Click “Sync from Wix” to pull submissions from the “Book a discovery call” form.</Empty>}

      {open.map((r) => (
        <section className="card" key={r.id}>
          <div className="card-head">
            <div>
              <strong>{r.firstName} {r.lastName}</strong> <span className="muted">· {r.title || 'Role not given'}, {r.company}</span>
              <div className="muted small">{r.email} · requested {fmtDate(r.createdDate)}</div>
            </div>
            {outboundEmails.has(r.email.toLowerCase()) && <span className="badge badge-meeting_booked">From outreach</span>}
          </div>
          <dl>
            <dt>Wants help with</dt><dd>{r.goal || '—'}</dd>
            <dt>Company size</dt><dd>{r.companySize || '—'}</dd>
            <dt>Preferred time</dt><dd>{r.preferredTime || 'Any'}</dd>
            {r.notes && (<><dt>Notes</dt><dd>{r.notes}</dd></>)}
          </dl>
          <div className="actions">
            <button className="btn primary" onClick={() => confirm(r)}>Confirm next {r.preferredTime && !/either/i.test(r.preferredTime) ? r.preferredTime.split(' ')[0].toLowerCase() : 'free'} slot</button>
            <button className="btn ghost danger" onClick={() => dispatch({ type: 'dismissInbound', id: r.id })}>Dismiss</button>
          </div>
        </section>
      ))}

      {done.length > 0 && (
        <section className="card">
          <h2>Handled</h2>
          <ul className="list">
            {done.map((r) => (
              <li key={r.id}>
                <strong>{r.firstName} {r.lastName}</strong> <span className="muted">· {r.company} · {r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
