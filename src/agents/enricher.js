import { createRng } from './random';

// Enrichment agent: adds contact data, firmographics and buying signals,
// then scores fit against the ICP so outreach effort goes to the best leads.

const TECH = ['HubSpot', 'Salesforce', 'Snowflake', 'Google Analytics', 'Looker', 'Power BI', 'Shopify', 'Stripe', 'Segment', 'BigQuery', 'Tableau', 'Excel-heavy reporting', 'Pipedrive', 'Zendesk'];
const FUNDING = ['Bootstrapped', 'Seed', 'Series A', 'Series B', 'Series C+', 'PE-backed', 'Public'];

const SIGNALS = [
  { key: 'hiring_data', label: 'Hiring for data / analytics roles', weight: 12 },
  { key: 'recent_funding', label: 'Raised funding in the last 6 months', weight: 10 },
  { key: 'new_exec', label: 'New executive joined in the last 90 days', weight: 9 },
  { key: 'site_visit', label: 'Visited your pricing page', weight: 14 },
  { key: 'tool_migration', label: 'Migrating BI / CRM tooling', weight: 8 },
  { key: 'expansion', label: 'Expanding into a new market', weight: 6 },
];

export function enrichProspect(prospect, icp, seed) {
  const rng = createRng(`${seed}:${prospect.id}`);
  const local = `${prospect.firstName}.${prospect.lastName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z.]/g, '');
  const emailRoll = rng.next();
  const emailStatus = emailRoll < 0.72 ? 'verified' : emailRoll < 0.92 ? 'catch-all' : 'invalid';
  const signals = SIGNALS.filter(() => rng.chance(0.2));
  const techStack = rng.sample(TECH, rng.int(2, 5));
  const fundingStage = rng.pick(FUNDING);

  const enriched = {
    ...prospect,
    email: `${local}@${prospect.company.domain}`,
    emailStatus,
    phone: rng.chance(0.55) ? `+44 7${rng.int(100, 999)} ${rng.int(100000, 999999)}` : null,
    company: {
      ...prospect.company,
      techStack,
      fundingStage,
      revenueBand: revenueBand(prospect.company.employees),
    },
    signals,
    status: 'enriched',
  };
  return { ...enriched, ...scoreProspect(enriched, icp) };
}

export function scoreProspect(p, icp) {
  const reasons = [];
  let score = 0;

  if (!icp.industries.length || icp.industries.includes(p.company.industry)) {
    score += 20;
    reasons.push(`Industry match (${p.company.industry})`);
  }
  if (p.company.employees >= icp.minEmployees && p.company.employees <= icp.maxEmployees) {
    score += 15;
    reasons.push(`Company size in range (${p.company.employees} staff)`);
  }
  if (!icp.seniorities.length || icp.seniorities.includes(p.seniority)) {
    score += 15;
    reasons.push(`Target seniority (${p.seniority})`);
  }
  for (const s of p.signals || []) {
    score += s.weight;
    reasons.push(s.label);
  }
  if (p.emailStatus === 'verified') score += 5;
  if (p.emailStatus === 'invalid') {
    score -= 30;
    reasons.push('Email failed verification');
  }

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 80 ? 'A' : score >= 62 ? 'B' : score >= 45 ? 'C' : 'D';
  return { score, tier, scoreReasons: reasons };
}

function revenueBand(employees) {
  if (employees < 20) return '< £2m';
  if (employees < 100) return '£2m–£10m';
  if (employees < 500) return '£10m–£50m';
  if (employees < 2000) return '£50m–£250m';
  return '£250m+';
}
