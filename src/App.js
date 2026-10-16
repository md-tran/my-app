import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import Dashboard from './components/Dashboard';
import Campaigns from './components/Campaigns';
import Prospects from './components/Prospects';
import Outreach from './components/Outreach';
import Meetings from './components/Meetings';
import Inbound from './components/Inbound';
import Clients from './components/Clients';
import Activity from './components/Activity';
import Settings from './components/Settings';

const PAGES = {
  dashboard: ['Dashboard', Dashboard],
  campaigns: ['Campaigns', Campaigns],
  prospects: ['Prospects', Prospects],
  outreach: ['Outreach', Outreach],
  inbound: ['Inbound', Inbound],
  meetings: ['Meetings', Meetings],
  clients: ['Clients', Clients],
  agents: ['Agents', Activity],
  settings: ['Settings', Settings],
};

const fromHash = () => {
  const key = window.location.hash.replace('#/', '');
  return PAGES[key] ? key : 'dashboard';
};

export default function App() {
  const { state } = useStore();
  const [page, setPage] = useState(fromHash);

  useEffect(() => {
    const onHash = () => setPage(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (key) => {
    window.location.hash = `#/${key}`;
    setPage(key);
  };

  const drafts = state.prospects.filter((p) => p.status === 'drafted').length;
  const newInbound = state.inbound.filter((r) => r.status === 'new').length;
  const Page = PAGES[page][1];

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">MDT</span>
          <div>
            <div className="brand-name">{state.settings.workspaceName}</div>
            <div className="brand-sub">Outbound agents</div>
          </div>
        </div>
        {Object.entries(PAGES).map(([key, [label]]) => (
          <button key={key} className={`nav ${page === key ? 'nav-on' : ''}`} onClick={() => go(key)}>
            {label}
            {key === 'outreach' && drafts > 0 && <span className="pill">{drafts}</span>}
            {key === 'inbound' && newInbound > 0 && <span className="pill">{newInbound}</span>}
          </button>
        ))}
      </nav>
      <main className="main">
        <Page go={go} />
      </main>
    </div>
  );
}
