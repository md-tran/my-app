import { findProspects } from './prospector';
import { enrichProspect, scoreProspect } from './enricher';
import { templateMessage, personalise } from './personaliser';
import { buildSequence, simulateEngagement, addBusinessDays } from './sequencer';
import { proposeSlots, bookMeeting, slotForPreference } from './booker';
import { meetingFromRequest } from '../components/Inbound';
import { runResearch, runOutreach } from './orchestrator';
import { defaultIcp, defaultMessaging, defaultSettings, reducer, initialState } from '../store';
import { clientReport } from '../components/Clients';

const icp = { ...defaultIcp, ...defaultMessaging };
const campaign = { id: 'cmp_test', name: 'Test', clientId: 'c_mdt', targetCount: 20, minScore: 40, autoApprove: false, icp: defaultIcp, messaging: defaultMessaging };
const settings = { ...defaultSettings, useAI: false };
global.fetch = () => Promise.reject(new Error("no server in tests"));
const noop = () => {};

test('prospector is deterministic per seed and returns unique companies', () => {
  const a = findProspects(defaultIcp, { count: 15, seed: 'x' });
  const b = findProspects(defaultIcp, { count: 15, seed: 'x' });
  expect(a).toEqual(b);
  expect(a).toHaveLength(15);
  expect(new Set(a.map((p) => p.company.domain)).size).toBe(15);

  // More prospects than the name pool can cover must still terminate.
  const narrow = findProspects({ ...defaultIcp, industries: ['SaaS'], regions: ['UK'] }, { count: 200, seed: 'big' });
  expect(new Set(narrow.map((p) => p.company.domain)).size).toBe(200);
});

test('enricher adds email and scores ICP matches higher', () => {
  const [p] = findProspects(defaultIcp, { count: 1, seed: 's' });
  const e = enrichProspect(p, defaultIcp, 's');
  expect(e.email).toMatch(/@/);
  expect(e.score).toBeGreaterThanOrEqual(0);
  expect(e.score).toBeLessThanOrEqual(100);

  const base = { ...e, signals: [], emailStatus: 'verified', seniority: 'VP', company: { ...e.company, industry: 'SaaS', employees: 100 } };
  const offIcp = { ...base, seniority: 'Manager', company: { ...base.company, industry: 'Logistics', employees: 9000 } };
  expect(scoreProspect(base, defaultIcp).score).toBeGreaterThan(scoreProspect(offIcp, defaultIcp).score);
  expect(scoreProspect({ ...base, emailStatus: 'invalid' }, defaultIcp).score).toBeLessThan(scoreProspect(base, defaultIcp).score);
});

test('template message references a buying signal when present', () => {
  const [p] = findProspects(defaultIcp, { count: 1, seed: 't' });
  const e = { ...enrichProspect(p, defaultIcp, 't'), signals: [{ key: 'recent_funding', label: 'Raised funding', weight: 10 }] };
  const m = templateMessage(e, icp);
  expect(m.body).toContain(e.firstName);
  expect(m.body).toContain('raise');
  expect(m.followUps).toHaveLength(2);
  expect(m.source).toBe('template');
});

test('personaliser falls back to the template when the API fails', async () => {
  const [p] = findProspects(defaultIcp, { count: 1, seed: 'f' });
  const e = enrichProspect(p, defaultIcp, 'f');
  const m = await personalise(e, icp, { fetchImpl: () => Promise.resolve({ ok: false }) });
  expect(m.source).toBe('template');
  const ai = await personalise(e, icp, {
    fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ subject: 's', body: 'b', followUps: [], personalisationPoints: [] }) }),
  });
  expect(ai.source).toBe('claude');
});

test('sequence adds an opt-out line and skips weekends', () => {
  const friday = new Date('2026-10-16T09:00:00Z');
  expect(addBusinessDays(friday, 1).getDay()).toBe(1);
  const seq = buildSequence({ subject: 'Hi', body: 'Hello', followUps: [{ day: 3, body: 'Bump' }] }, friday);
  expect(seq).toHaveLength(3);
  expect(seq[0].body).toMatch(/unsubscribe/);
});

test('engagement stops the sequence after a reply', () => {
  const seq = buildSequence({ subject: 'Hi', body: 'Hello', followUps: [{ day: 3, body: 'a' }, { day: 7, body: 'b' }] });
  for (let i = 0; i < 50; i++) {
    const { sequence, reply } = simulateEngagement({ id: `p${i}`, score: 90, company: { name: 'X' } }, seq, i);
    if (reply) {
      expect(sequence.filter((s) => s.step > reply.step).every((s) => s.status === 'cancelled')).toBe(true);
      return;
    }
  }
  throw new Error('expected at least one reply across 50 high-fit prospects');
});

test('booker never double-books a slot', () => {
  const avail = defaultSettings.availability;
  const from = new Date('2026-10-19T08:00:00');
  const first = proposeSlots(avail, [], from, 1)[0];
  const m = bookMeeting({ id: 'p1', firstName: 'A', lastName: 'B', email: 'a@b.com', company: { name: 'Co' } }, first, avail);
  const next = proposeSlots(avail, [m], from, 3);
  expect(next).not.toContain(first);
  expect(new Date(m.end) - new Date(m.start)).toBe(avail.durationMinutes * 60000);
});

test('full pipeline: research drafts, outreach books meetings and honours suppression', async () => {
  const suppressedSettings = { ...settings, suppression: [] };
  const researched = await runResearch(campaign, suppressedSettings, noop, { delay: 0 });
  expect(researched).toHaveLength(20);
  const drafted = researched.filter((p) => p.status === 'drafted');
  expect(drafted.length).toBeGreaterThan(0);
  expect(researched.filter((p) => p.status === 'disqualified').every((p) => p.disqualifiedReason)).toBe(true);

  // Suppress one domain and re-run with the same seed: it must be disqualified.
  const target = drafted[0];
  const again = await runResearch(campaign, { ...settings, suppression: [target.company.domain] }, noop, { delay: 0 });
  expect(again.find((p) => p.id === target.id).disqualifiedReason).toBe('On suppression list');

  const approved = researched.map((p) => (p.status === 'drafted' ? { ...p, status: 'approved' } : p));
  const { updated, meetings } = await runOutreach(approved, settings, [], noop, { seed: 1, delay: 0 });
  expect(Object.keys(updated).length).toBe(drafted.length);
  expect(new Set(meetings.map((m) => m.start)).size).toBe(meetings.length);
});

test('reducer adds unsubscribes to suppression and client report bills meetings', () => {
  const p = { id: 'p1', clientId: 'c1', email: 'x@y.com', status: 'approved', message: {}, company: {} };
  let s = { ...initialState, prospects: [p], clients: [{ id: 'c1', name: 'Acme', retainer: 1000, perMeeting: 200 }] };
  s = reducer(s, { type: 'outreachDone', updated: { p1: { ...p, sequence: [], reply: { sentiment: 'unsubscribe' }, status: 'disqualified' } }, meetings: [] });
  expect(s.settings.suppression).toContain('x@y.com');

  const meeting = { id: 'm1', prospectId: 'p1', status: 'confirmed' };
  expect(clientReport(s.clients[0], s.prospects, [meeting]).invoice).toBe(1200);
  expect(clientReport(s.clients[0], s.prospects, [{ ...meeting, status: 'cancelled' }]).invoice).toBe(1000);
});

test('outreach links the blog guide and booking page from the Wix site', () => {
  const [p] = findProspects(defaultIcp, { count: 1, seed: 'w' });
  const e = enrichProspect(p, defaultIcp, 'w');
  const m = templateMessage(e, { ...icp, ...defaultSettings.website });
  expect(m.followUps[0].body).toContain(defaultSettings.website.guideUrl);
  expect(m.followUps[1].body).toContain(defaultSettings.website.bookingUrl);
  expect(defaultSettings.availability.meetingLink).toBe(defaultSettings.website.bookingUrl);
});

test('website booking requests become meetings and credit matching outbound prospects', () => {
  const from = new Date('2026-10-19T08:00:00');
  const morning = slotForPreference(defaultSettings.availability, [], 'Morning (9am–12pm)', from);
  const afternoon = slotForPreference(defaultSettings.availability, [], 'Afternoon (12pm–5pm)', from);
  expect(new Date(morning).getHours()).toBeLessThan(12);
  expect(new Date(afternoon).getHours()).toBeGreaterThanOrEqual(12);

  const request = { id: 's1', firstName: 'Ada', lastName: 'Lee', email: 'Ada@Acme.com', company: 'Acme', preferredTime: 'Morning (9am–12pm)', createdDate: '2026-10-16T10:00:00Z' };
  const prospect = { id: 'p1', email: 'ada@acme.com', status: 'sequenced', company: {} };
  let s = { ...initialState, prospects: [prospect] };
  s = reducer(s, { type: 'inboundSynced', requests: [request] });
  s = reducer(s, { type: 'inboundSynced', requests: [request] });
  expect(s.inbound).toHaveLength(1);
  expect(s.inbound[0].status).toBe('new');

  const meeting = meetingFromRequest(request, morning, defaultSettings.availability);
  s = reducer(s, { type: 'confirmInbound', request, meeting });
  expect(s.meetings).toHaveLength(1);
  expect(s.inbound[0].status).toBe('confirmed');
  expect(s.prospects[0]).toMatchObject({ status: 'meeting_booked', bookedVia: 'website' });

  // A later sync must not reset a handled request.
  s = reducer(s, { type: 'inboundSynced', requests: [request] });
  expect(s.inbound[0].status).toBe('confirmed');
});
