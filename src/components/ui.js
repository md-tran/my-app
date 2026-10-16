import React, { useEffect, useState } from 'react';

export const STATUS_LABELS = {
  sourced: 'Sourced',
  enriched: 'Enriched',
  drafted: 'Needs review',
  approved: 'Approved',
  sequenced: 'In sequence',
  replied: 'Replied',
  meeting_booked: 'Meeting booked',
  disqualified: 'Disqualified',
};

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export function TierBadge({ tier, score }) {
  return (
    <span className={`tier tier-${tier}`} title={`Fit score ${score}/100`}>
      {tier} · {score}
    </span>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function MultiSelect({ options, value, onChange }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <div className="chips">
      {options.map((opt) => (
        <button type="button" key={opt} className={`chip ${value.includes(opt) ? 'chip-on' : ''}`} onClick={() => toggle(opt)}>
          {opt}
        </button>
      ))}
    </div>
  );
}

export const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
export const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`;
export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Click once to arm, again to confirm; disarms itself after a few seconds.
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn ghost danger' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className}${armed ? ' armed' : ''}`}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
