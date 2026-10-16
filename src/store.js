import React, { createContext, useContext, useEffect, useReducer } from 'react';

const STORAGE_KEY = 'mdt-outbound-v1';

export const defaultSettings = {
  workspaceName: 'MDT Analytics',
  useAI: true,
  dailySendCap: 50,
  suppression: [],
  availability: {
    hours: [10, 14, 16],
    durationMinutes: 30,
    meetingTitle: 'Intro call with MDT Analytics',
    meetingLink: 'https://cal.com/mdt-analytics/intro',
  },
};

export const defaultIcp = {
  industries: ['SaaS', 'E-commerce'],
  regions: ['UK'],
  seniorities: ['C-level', 'VP', 'Director'],
  minEmployees: 20,
  maxEmployees: 500,
};

export const defaultMessaging = {
  offer: 'Analytics dashboards and data engineering',
  valueProp:
    'MDT Analytics builds the dashboards and data pipelines that give leadership a single, trusted view of revenue, margin and pipeline — usually live within four weeks.',
  callToAction: 'Worth a 20-minute call next week to see if it would help?',
  senderName: 'MDT Analytics',
};

const initialState = {
  settings: defaultSettings,
  clients: [{ id: 'c_mdt', name: 'MDT Analytics (in-house)', retainer: 0, perMeeting: 0 }],
  campaigns: [],
  prospects: [],
  meetings: [],
  logs: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'log':
      return { ...state, logs: [{ id: `${Date.now()}${Math.random()}`, at: new Date().toISOString(), ...action.entry }, ...state.logs].slice(0, 300) };
    case 'clearLogs':
      return { ...state, logs: [] };
    case 'saveClient': {
      const exists = state.clients.some((c) => c.id === action.client.id);
      return { ...state, clients: exists ? state.clients.map((c) => (c.id === action.client.id ? action.client : c)) : [...state.clients, action.client] };
    }
    case 'saveCampaign': {
      const exists = state.campaigns.some((c) => c.id === action.campaign.id);
      return {
        ...state,
        campaigns: exists ? state.campaigns.map((c) => (c.id === action.campaign.id ? action.campaign : c)) : [action.campaign, ...state.campaigns],
      };
    }
    case 'deleteCampaign':
      return {
        ...state,
        campaigns: state.campaigns.filter((c) => c.id !== action.id),
        prospects: state.prospects.filter((p) => p.campaignId !== action.id),
        meetings: state.meetings.filter((m) => state.prospects.find((p) => p.id === m.prospectId)?.campaignId !== action.id),
      };
    case 'researchDone':
      return {
        ...state,
        prospects: [...state.prospects.filter((p) => p.campaignId !== action.campaignId), ...action.prospects],
        campaigns: state.campaigns.map((c) => (c.id === action.campaignId ? { ...c, runs: (c.runs || 0) + 1, lastRunAt: new Date().toISOString() } : c)),
      };
    case 'updateProspect':
      return { ...state, prospects: state.prospects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case 'approveAll':
      return {
        ...state,
        prospects: state.prospects.map((p) => (p.status === 'drafted' && (!action.campaignId || p.campaignId === action.campaignId) ? { ...p, status: 'approved' } : p)),
      };
    case 'outreachDone': {
      const unsubscribed = Object.values(action.updated)
        .filter((p) => p.reply?.sentiment === 'unsubscribe')
        .map((p) => p.email);
      return {
        ...state,
        prospects: state.prospects.map((p) => action.updated[p.id] || p),
        meetings: [...state.meetings, ...action.meetings],
        settings: { ...state.settings, suppression: Array.from(new Set([...state.settings.suppression, ...unsubscribed])) },
      };
    }
    case 'updateMeeting':
      return { ...state, meetings: state.meetings.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) };
    case 'saveSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    return { ...initialState, ...saved, settings: { ...defaultSettings, ...saved.settings } };
  } catch (e) {
    return initialState;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage full or blocked; the app still works for this session.
    }
  }, [state]);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}

export { reducer, initialState };
