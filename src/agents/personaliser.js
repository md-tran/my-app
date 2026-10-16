// Personalisation agent: writes a first-touch email plus follow-ups for each
// prospect. Uses Claude via the local API server when it is configured, and
// falls back to a signal-aware template so the pipeline always completes.

// One cheap check per run, so a missing API key doesn't cost a failed request per prospect.
export async function aiAvailable(fetchImpl = fetch) {
  try {
    const res = await fetchImpl('/api/health');
    return res.ok && Boolean((await res.json()).ai);
  } catch (e) {
    return false;
  }
}

export async function personalise(prospect, icp, { useAI = true, fetchImpl = fetch } = {}) {
  if (useAI) {
    try {
      const res = await fetchImpl('/api/personalise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect: briefFor(prospect), icp }),
      });
      if (res.ok) {
        const data = await res.json();
        return { ...data, source: 'claude' };
      }
    } catch (e) {
      // Server not running or no API key — fall through to the template.
    }
  }
  return templateMessage(prospect, icp);
}

// Only the facts the writer may use; keeps the model from inventing details.
export function briefFor(p) {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    title: p.title,
    company: p.company.name,
    industry: p.company.industry,
    employees: p.company.employees,
    city: p.company.city,
    fundingStage: p.company.fundingStage,
    techStack: p.company.techStack,
    signals: (p.signals || []).map((s) => s.label),
  };
}

const HOOKS = {
  hiring_data: (p) => `I noticed ${p.company.name} is hiring for data roles — usually a sign reporting demand is outpacing the team.`,
  recent_funding: (p) => `Congrats on the recent raise at ${p.company.name}. Post-funding is often when board reporting gets a lot more scrutiny.`,
  new_exec: (p) => `Saw there's been a leadership change at ${p.company.name} — new leaders tend to want a clear view of the numbers fast.`,
  site_visit: () => `Looks like someone on your team was checking out our pricing recently, so I thought I'd reach out directly.`,
  tool_migration: (p) => `Heard ${p.company.name} is reworking its BI / CRM setup — a good moment to get the data model right.`,
  expansion: (p) => `Expanding into a new market is exciting, and it usually means ${p.company.name} needs reporting that scales with it.`,
};

export function templateMessage(p, icp) {
  const signal = (p.signals || [])[0];
  const stack = (p.company.techStack || []).slice(0, 2).join(' and ');
  const opener = signal
    ? HOOKS[signal.key](p)
    : `I work with ${p.company.industry} teams around ${p.company.employees} people, and ${p.title}s often tell me reporting is still more manual than it should be.`;
  const sender = icp.senderName || 'The MDT Analytics team';
  const body = [
    `Hi ${p.firstName},`,
    '',
    opener,
    '',
    `${icp.valueProp}${stack ? ` We plug straight into tools like ${stack}.` : ''}`,
    '',
    `${icp.callToAction}`,
    '',
    `Best,`,
    sender,
  ].join('\n');

  return {
    subject: signal ? `${p.company.name} x ${icp.senderName || 'MDT Analytics'}` : `Quick question, ${p.firstName}`,
    body,
    followUps: [
      {
        day: 3,
        body: icp.guideUrl
          ? `Hi ${p.firstName}, in case it's useful, we wrote up how we approach this for ${p.company.industry} teams: ${icp.guideUrl}`
          : `Hi ${p.firstName}, just bumping this up in case it got buried. Happy to share a 2-minute example of what we built for a similar ${p.company.industry} business.`,
      },
      {
        day: 7,
        body: `Hi ${p.firstName}, last note from me — if this isn't a priority at ${p.company.name} right now, no worries at all. If it is, you can pick a time here: ${icp.bookingUrl || 'just reply and I will send some times'}`,
      },
    ],
    personalisationPoints: [signal ? signal.label : `Industry: ${p.company.industry}`, stack ? `Tech stack: ${stack}` : null].filter(Boolean),
    source: 'template',
  };
}
