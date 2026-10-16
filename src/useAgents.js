import { useState } from 'react';
import { useStore } from './store';
import { runResearch, runOutreach } from './agents/orchestrator';

export function useAgents() {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(null);

  const emit = (agent, message, level = 'info') => dispatch({ type: 'log', entry: { agent, message, level } });

  async function research(campaign) {
    setBusy(campaign.id);
    try {
      emit('Orchestrator', `Starting campaign “${campaign.name}”.`);
      const prospects = await runResearch(campaign, state.settings, emit, { existing: state.prospects });
      dispatch({ type: 'researchDone', campaignId: campaign.id, prospects });
    } catch (e) {
      emit('Orchestrator', `Run failed: ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function outreach(campaignId) {
    setBusy(campaignId || 'outreach');
    try {
      const pool = state.prospects.filter((p) => !campaignId || p.campaignId === campaignId);
      const { updated, meetings } = await runOutreach(pool, state.settings, state.meetings, emit);
      dispatch({ type: 'outreachDone', updated, meetings });
    } catch (e) {
      emit('Orchestrator', `Outreach failed: ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  }

  return { busy, research, outreach };
}
