# MDT Outbound

B2B outbound and lead generation for **MDT Analytics**. A team of agents finds prospects, enriches them, writes personalised outreach and books meetings. You can run it for MDT's own pipeline, or sell it to clients as a managed service.

## The agent pipeline

| # | Agent | What it does | Code |
|---|-------|--------------|------|
| 1 | **Prospector** | Turns an ideal customer profile (industry, region, seniority, company size) into a contact list | `src/agents/prospector.js` |
| 2 | **Enricher** | Verifies emails and adds firmographics, tech stack, funding and buying signals. Scores fit 0–100 (tiers A–D) and gives the reasons | `src/agents/enricher.js` |
| 3 | **Personaliser** | Writes a first email plus two follow-ups for each qualified prospect, using Claude (or signal-aware templates when offline) | `src/agents/personaliser.js`, `server/personalise.js` |
| 4 | **Outreach** | Builds email + LinkedIn sequences, applies the daily send cap and opt-out line, stops on reply, and handles unsubscribes | `src/agents/sequencer.js` |
| 5 | **Booker** | Books a slot from your availability when a prospect replies positively, without double-booking | `src/agents/booker.js` |

`src/agents/orchestrator.js` runs the agents in two phases:

1. **Research**: source → enrich → qualify → draft. It stops for **human review** unless the campaign is set to auto-approve.
2. **Outreach**: sequence approved prospects → handle replies → book meetings.

Prospects are disqualified when they fall below the campaign's minimum fit score, fail email verification, or appear on the suppression list.

## Screens

- **Dashboard**: funnel, reply rate, meetings booked and upcoming calls, filterable by client
- **Campaigns**: ICP and messaging set-up, plus a button to run the agents
- **Prospects**: a scored, searchable list with the reasons behind each score and CSV export
- **Outreach**: review, edit, regenerate, approve or reject drafts, then launch and track sequences
- **Meetings**: booked calls, outcome tracking (held / no-show) and `.ics` export
- **Clients**: a client list for selling outbound as a service, with a retainer + per-meeting pricing model and a live invoice total
- **Agents**: what each agent does, plus a live activity log
- **Settings**: Claude status, send cap, suppression list and booking availability

## Running it

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # optional – enables Claude-written emails
npm run server                        # API on :3001
npm start                             # UI on :3000 (proxies /api to :3001)
```

Without an API key, everything still works: the Personaliser uses templates and the Settings page shows that Claude isn't connected.

For production, run `npm run build && npm run server`. The server then serves the built app and the API from one port (`PORT`, default 3001).

`npm test` runs the agent and pipeline tests.

### Claude configuration

`server/personalise.js` calls `claude-opus-5-5` (override it with `CLAUDE_MODEL`) and uses:
- **Structured outputs** (JSON schema), so every draft has a subject, body, follow-ups and the facts it relied on
- **`effort: "low"`**, which suits short-form copy and keeps cost and latency down
- **Server-side refusal fallback** (`fallbacks: "default"`)
- A system prompt that forbids inventing facts. The model only sees the enriched fields passed by `briefFor()`.

## Demo mode vs. live data

The Prospector, the Enricher's data and the engagement simulation in `sequencer.js` are **demo providers**. They generate realistic, deterministic data, so you can demo the whole flow to a prospective client today. To go live, replace these pieces (their interfaces stay the same):

| Replace | With |
|---------|------|
| `demoProvider` in `prospector.js` | Apollo / Clay / Companies House / a CRM export |
| Random fields in `enricher.js` | An email verifier (e.g. ZeroBounce), firmographic API and intent data |
| `simulateEngagement` in `sequencer.js` | A real sender (Gmail / Outlook API, Instantly, Smartlead) and reply webhooks |
| `bookMeeting` in `booker.js` | The Cal.com / Calendly / Google Calendar API |

Data is stored in the browser (`localStorage`). For multi-user or client-facing use, move the store to a database behind the API server.

## Compliance notes

Cold B2B email in the UK and EU falls under PECR and UK GDPR (legitimate interest). The app already includes an opt-out line on every first email, automatic suppression of unsubscribes, a domain and email suppression list, and a daily send cap. Before contacting real people, record your legitimate-interest assessment and only use data sources that are lawful for this purpose.
