import React from 'react';
import { useStore } from '../store';
import { Empty, fmtDate } from './ui';

function icsFor(m) {
  const stamp = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MDT Analytics//Outbound//EN',
    'BEGIN:VEVENT',
    `UID:${m.id}@mdt-analytics`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(m.start)}`,
    `DTEND:${stamp(m.end)}`,
    `SUMMARY:${m.title}`,
    `DESCRIPTION:Join: ${m.link}`,
    `ATTENDEE;CN=${m.attendee}:mailto:${m.attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(m) {
  const url = URL.createObjectURL(new Blob([icsFor(m)], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${m.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Meetings() {
  const { state, dispatch } = useStore();
  const meetings = [...state.meetings].sort((a, b) => a.start.localeCompare(b.start));
  if (!meetings.length) return <Empty title="No meetings booked yet">The Booker agent books a slot from your availability as soon as a prospect replies positively.</Empty>;

  const set = (id, status) => dispatch({ type: 'updateMeeting', id, patch: { status } });

  return (
    <div>
      <div className="page-head">
        <h1>Meetings</h1>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Attendee</th>
              <th>Meeting</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.start)}</td>
                <td>
                  <strong>{m.attendee}</strong>
                  <div className="muted">{m.attendeeEmail}</div>
                </td>
                <td>{m.title}</td>
                <td>
                  <select value={m.status} onChange={(e) => set(m.id, e.target.value)}>
                    <option value="confirmed">Confirmed</option>
                    <option value="held">Held</option>
                    <option value="no_show">No-show</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td>
                  <button className="btn ghost" onClick={() => downloadIcs(m)}>.ics</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { icsFor };
