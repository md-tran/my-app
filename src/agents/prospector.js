import { createRng } from './random';

// Prospector agent: turns an ICP into a list of matching contacts.
// The demo provider synthesises realistic records; swap `demoProvider`
// for a real data source (Apollo, Clay, a CRM export…) with the same shape.

export const INDUSTRIES = [
  'SaaS',
  'Fintech',
  'E-commerce',
  'Healthcare',
  'Logistics',
  'Manufacturing',
  'Professional Services',
  'Marketing Agencies',
];

export const REGIONS = {
  UK: ['London', 'Manchester', 'Bristol', 'Edinburgh', 'Leeds'],
  Europe: ['Amsterdam', 'Berlin', 'Dublin', 'Paris', 'Stockholm'],
  'North America': ['New York', 'Austin', 'Toronto', 'San Francisco', 'Chicago'],
  APAC: ['Sydney', 'Singapore', 'Melbourne', 'Auckland', 'Tokyo'],
};

export const SENIORITY_TITLES = {
  'C-level': ['CEO', 'COO', 'CFO', 'CTO', 'Chief Revenue Officer', 'Chief Marketing Officer'],
  VP: ['VP Sales', 'VP Marketing', 'VP Operations', 'VP Engineering', 'VP Growth'],
  Director: ['Head of Sales', 'Director of Marketing', 'Head of Operations', 'Head of Data', 'Director of RevOps'],
  Manager: ['Sales Manager', 'Marketing Manager', 'Operations Manager', 'Analytics Manager'],
};

const FIRST = ['Amelia', 'Oliver', 'Priya', 'Lucas', 'Sofia', 'Noah', 'Hannah', 'Mateo', 'Grace', 'Ethan', 'Aisha', 'Leo', 'Chloe', 'Daniel', 'Mia', 'Samuel', 'Zara', 'Jack', 'Isla', 'Ravi', 'Freya', 'Tom', 'Elena', 'Kofi'];
const LAST = ['Patel', 'Smith', 'Nguyen', 'Garcia', 'Johnson', 'Okafor', 'Müller', 'Rossi', 'Kim', 'Brown', 'Silva', 'Walsh', 'Cohen', 'Taylor', 'Andersen', 'Hughes', 'Khan', 'Martin', 'Dubois', 'Evans'];
const PREFIX = ['Nova', 'Blue', 'Bright', 'Apex', 'Kite', 'Lumen', 'Vertex', 'Harbor', 'Pioneer', 'Atlas', 'Cedar', 'Quill', 'Orbit', 'Summit', 'North', 'Ember'];
const SUFFIX = {
  SaaS: ['Cloud', 'Stack', 'Labs', 'Works', 'IO'],
  Fintech: ['Pay', 'Ledger', 'Capital', 'Finance', 'Money'],
  'E-commerce': ['Store', 'Goods', 'Market', 'Supply', 'Commerce'],
  Healthcare: ['Health', 'Care', 'Clinic', 'Med', 'Bio'],
  Logistics: ['Freight', 'Logistics', 'Fleet', 'Route', 'Cargo'],
  Manufacturing: ['Industries', 'Manufacturing', 'Fabrication', 'Systems', 'Components'],
  'Professional Services': ['Partners', 'Advisory', 'Consulting', 'Group', 'Associates'],
  'Marketing Agencies': ['Studio', 'Agency', 'Creative', 'Media', 'Collective'],
};

export function demoProvider(icp, count, seed) {
  const rng = createRng(seed);
  const industries = icp.industries.length ? icp.industries : INDUSTRIES;
  const regions = icp.regions.length ? icp.regions : Object.keys(REGIONS);
  const seniorities = icp.seniorities.length ? icp.seniorities : Object.keys(SENIORITY_TITLES);
  const usedDomains = new Set();
  const prospects = [];

  // Oversample, then let ~20% fall outside the ICP so the enricher's scoring
  // has something to discriminate — real data sources are never perfectly clean.
  while (prospects.length < count) {
    const offIcp = rng.chance(0.2);
    const industry = offIcp ? rng.pick(INDUSTRIES) : rng.pick(industries);
    const region = rng.pick(regions);
    const seniority = offIcp ? rng.pick(Object.keys(SENIORITY_TITLES)) : rng.pick(seniorities);
    let name = `${rng.pick(PREFIX)}${rng.pick(SUFFIX[industry])}`;
    const tld = region === 'UK' ? 'co.uk' : 'com';
    // The name pool is finite, so disambiguate collisions instead of retrying forever.
    for (let n = 2; usedDomains.has(`${name.toLowerCase()}.${tld}`); n++) name = `${name.replace(/\d+$/, '')}${n}`;
    const domain = `${name.toLowerCase()}.${tld}`;
    usedDomains.add(domain);

    const span = Math.max(1, icp.maxEmployees - icp.minEmployees);
    const employees = offIcp
      ? rng.int(5, 5000)
      : rng.int(icp.minEmployees, icp.minEmployees + span);
    const firstName = rng.pick(FIRST);
    const lastName = rng.pick(LAST);

    prospects.push({
      id: `p_${domain.replace(/\W/g, '')}_${prospects.length}`,
      firstName,
      lastName,
      title: rng.pick(SENIORITY_TITLES[seniority]),
      seniority,
      linkedin: `https://www.linkedin.com/in/${firstName}-${lastName}-${rng.int(100, 999)}`.toLowerCase(),
      company: {
        name,
        domain,
        industry,
        employees,
        region,
        city: rng.pick(REGIONS[region]),
      },
      status: 'sourced',
      source: 'demo',
    });
  }
  return prospects;
}

export function findProspects(icp, { count = 25, seed = Date.now(), provider = demoProvider } = {}) {
  return provider(icp, count, seed);
}
