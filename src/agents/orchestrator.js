import { findProspects } from './prospector';
import { enrichProspect } from './enricher';
import { personalise, aiAvailable } from './personaliser';
import { buildSequence, simulateEngagement } from './sequencer';
import { proposeSlots, bookMeeting } from './booker';

// Coordinates the agents. Phase 1 (research) stops at drafted messages so a
// human can review before anything is sent, unless the campaign auto-approves.
// Phase 2 (outreach) sequences approved prospects and books meetings.

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runResearch(campaign, settings, emit, { delay = 120 } = {}) {
  const { icp } = campaign;
  const seed = `${campaign.id}:${campaign.runs || 0}`;
  const suppressed = new Set(settings.suppression.map((s) => s.trim().toLowerCase()).filter(Boolean));

  emit('Prospector', `Searching for ${campaign.targetCount} contacts matching the ICP…`);
  await pause(delay);
  const sourced = findProspects(icp, { count: campaign.targetCount, seed });
  emit('Prospector', `Found ${sourced.length} contacts across ${new Set(sourced.map((p) => p.company.domain)).size} companies.`, 'success');

  emit('Enricher', 'Enriching emails, firmographics and buying signals…');
  await pause(delay);
  const enriched = sourced.map((p) => ({ ...enrichProspect(p, icp, seed), campaignId: campaign.id, clientId: campaign.clientId }));
  const verified = enriched.filter((p) => p.emailStatus === 'verified').length;
  emit('Enricher', `Enriched ${enriched.length} contacts — ${verified} verified emails.`, 'success');

  const results = [];
  for (const p of enriched) {
    const domain = p.company.domain.toLowerCase();
    if (suppressed.has(p.email.toLowerCase()) || suppressed.has(domain)) {
      results.push({ ...p, status: 'disqualified', disqualifiedReason: 'On suppression list' });
    } else if (p.emailStatus === 'invalid') {
      results.push({ ...p, status: 'disqualified', disqualifiedReason: 'Invalid email' });
    } else if (p.score < campaign.minScore) {
      results.push({ ...p, status: 'disqualified', disqualifiedReason: `Score ${p.score} below threshold ${campaign.minScore}` });
    } else {
      results.push(p);
    }
  }
  const qualified = results.filter((p) => p.status !== 'disqualified');
  emit('Enricher', `${qualified.length} qualified, ${results.length - qualified.length} disqualified (score, invalid email or suppression).`);

  const useAI = settings.useAI && (await aiAvailable());
  if (settings.useAI && !useAI) {
    emit('Personaliser', 'Claude unavailable (start the API server with ANTHROPIC_API_KEY set) — using templates.', 'warn');
  }
  emit('Personaliser', `Writing personalised outreach for ${qualified.length} prospects${useAI ? ' with Claude' : ''}…`);
  let aiCount = 0;
  const todo = results.map((p, i) => i).filter((i) => results[i].status !== 'disqualified');
  // A few concurrent writers keeps Claude runs quick without hammering rate limits.
  const worker = async () => {
    while (todo.length) {
      const i = todo.shift();
      const message = await personalise(results[i], { ...icp, ...campaign.messaging }, { useAI });
      if (message.source === 'claude') aiCount++;
      results[i] = { ...results[i], message, status: campaign.autoApprove ? 'approved' : 'drafted' };
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (useAI && aiCount < qualified.length) {
    emit('Personaliser', `${qualified.length - aiCount} Claude requests failed — those prospects got template drafts.`, 'warn');
  }
  emit('Personaliser', `Drafted ${qualified.length} messages (${aiCount} by Claude, ${qualified.length - aiCount} from templates).`, 'success');
  if (!campaign.autoApprove) emit('Orchestrator', 'Waiting for human review in Outreach before anything is sent.');

  return results;
}

export async function runOutreach(prospects, settings, existingMeetings, emit, { seed = Date.now(), delay = 120 } = {}) {
  const ready = prospects.filter((p) => p.status === 'approved');
  const capped = ready.slice(0, settings.dailySendCap);
  if (ready.length > capped.length) {
    emit('Outreach', `Daily send cap is ${settings.dailySendCap}; ${ready.length - capped.length} prospects held for tomorrow.`, 'warn');
  }
  emit('Outreach', `Launching sequences for ${capped.length} prospects…`);
  await pause(delay);

  const meetings = [...existingMeetings];
  const updated = {};
  for (const p of capped) {
    const sequence = buildSequence(p.message);
    const { sequence: ran, reply } = simulateEngagement(p, sequence, seed);
    let next = { ...p, sequence: ran, reply, status: reply ? 'replied' : 'sequenced' };

    if (reply && reply.sentiment === 'positive') {
      const [slot] = proposeSlots(settings.availability, meetings);
      if (slot) {
        const meeting = bookMeeting(p, slot, settings.availability);
        meetings.push(meeting);
        next = { ...next, status: 'meeting_booked', meetingId: meeting.id };
        emit('Booker', `Booked ${meeting.attendee} (${p.company.name}) for ${new Date(slot).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.`, 'success');
      }
    } else if (reply && reply.sentiment === 'unsubscribe') {
      next = { ...next, status: 'disqualified', disqualifiedReason: 'Unsubscribed' };
      emit('Outreach', `${p.email} unsubscribed — added to suppression list.`, 'warn');
    }
    updated[p.id] = next;
  }

  const replies = Object.values(updated).filter((p) => p.reply).length;
  emit('Outreach', `Sequences running: ${capped.length} contacted, ${replies} replies so far.`, 'success');
  return { updated, meetings: meetings.slice(existingMeetings.length) };
}
