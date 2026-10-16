// Apollo.io: finds people matching the ICP, then reveals their contact details.
// Search is free; each person revealed through bulk_match costs 1 credit
// (no phone or waterfall enrichment requested), so we only reveal people we keep.

const SEARCH_URL = 'https://api.apollo.io/api/v1/mixed_people/api_search';
const MATCH_URL = 'https://api.apollo.io/api/v1/people/bulk_match';
const MATCH_BATCH = 10;

// The app's ICP labels → Apollo filter values. Apollo industry names must be its
// exact lowercase names; adjust these if your Apollo account lists them differently.
const INDUSTRIES = {
  SaaS: ['computer software', 'information technology & services', 'internet'],
  Fintech: ['financial services', 'banking'],
  'E-commerce': ['retail', 'consumer goods'],
  Healthcare: ['hospital & health care', 'medical devices', 'health, wellness & fitness'],
  Logistics: ['logistics & supply chain', 'transportation/trucking/railroad'],
  Manufacturing: ['machinery', 'industrial automation', 'electrical/electronic manufacturing'],
  'Professional Services': ['management consulting', 'accounting', 'legal services'],
  'Marketing Agencies': ['marketing & advertising'],
};

const REGIONS = {
  UK: ['United Kingdom'],
  Europe: ['Ireland', 'Netherlands', 'Germany', 'France', 'Sweden', 'Denmark', 'Belgium', 'Spain'],
  'North America': ['United States', 'Canada'],
  APAC: ['Australia', 'New Zealand', 'Singapore', 'Japan'],
};

const SENIORITIES = {
  'C-level': ['c_suite', 'founder', 'owner'],
  VP: ['vp'],
  Director: ['director', 'head'],
  Manager: ['manager'],
};

const reverse = (map) => {
  const out = {};
  for (const [label, values] of Object.entries(map)) for (const v of values) if (!out[v]) out[v] = label;
  return out;
};
const INDUSTRY_LABEL = reverse(INDUSTRIES);
const COUNTRY_REGION = reverse(REGIONS);
const SENIORITY_LABEL = { ...reverse(SENIORITIES), partner: 'C-level', senior: 'Manager' };

const apolloConfigured = () => Boolean(process.env.APOLLO_API_KEY);

function searchParams(icp, { page = 1, perPage = 50 } = {}) {
  const params = new URLSearchParams();
  const add = (key, values) => values.forEach((v) => params.append(`${key}[]`, v));
  add('person_seniorities', (icp.seniorities || []).flatMap((s) => SENIORITIES[s] || []));
  add('organization_locations', (icp.regions || []).flatMap((r) => REGIONS[r] || []));
  add('organization_industries', (icp.industries || []).flatMap((i) => INDUSTRIES[i] || []));
  if (icp.minEmployees || icp.maxEmployees) add('organization_num_employees_ranges', [`${icp.minEmployees || 1},${icp.maxEmployees || 1000000}`]);
  params.set('page', String(page));
  params.set('per_page', String(Math.min(100, perPage)));
  return params;
}

async function apolloRequest(url, { fetchImpl, body } = {}) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'x-api-key': process.env.APOLLO_API_KEY, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Apollo ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function searchPeople(icp, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const data = await apolloRequest(`${SEARCH_URL}?${searchParams(icp, opts)}`, { fetchImpl });
  return { total: data.total_entries || 0, people: data.people || [] };
}

async function revealPeople(ids, { fetchImpl = fetch } = {}) {
  const matches = [];
  for (let i = 0; i < ids.length; i += MATCH_BATCH) {
    const details = ids.slice(i, i + MATCH_BATCH).map((id) => ({ id }));
    const data = await apolloRequest(MATCH_URL, { fetchImpl, body: { details } });
    matches.push(...(data.matches || []).filter(Boolean));
  }
  return matches;
}

// Apollo match → the app's prospect shape (enrichment fields filled from real data).
function toProspect(m) {
  const org = m.organization || {};
  const domain = (org.primary_domain || (org.website_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '').toLowerCase();
  const emailStatus = m.email_status === 'verified' ? 'verified' : m.email ? 'unverified' : 'invalid';
  return {
    id: `ap_${m.id}`,
    apolloId: m.id,
    firstName: m.first_name || '',
    lastName: m.last_name || '',
    title: m.title || m.headline || '',
    seniority: SENIORITY_LABEL[m.seniority] || 'Manager',
    linkedin: m.linkedin_url || null,
    email: m.email || '',
    emailStatus,
    phone: null,
    company: {
      name: org.name || '',
      domain,
      industry: INDUSTRY_LABEL[(org.industry || '').toLowerCase()] || org.industry || 'Unknown',
      employees: org.estimated_num_employees || 0,
      region: COUNTRY_REGION[m.country] || m.country || '',
      city: m.city || '',
      foundedYear: org.founded_year || null,
      techStack: [],
      fundingStage: 'Unknown',
      revenueBand: '',
    },
    signals: [],
    status: 'enriched',
    source: 'apollo',
  };
}

module.exports = { searchPeople, revealPeople, toProspect, searchParams, apolloConfigured, INDUSTRIES, REGIONS, SENIORITIES };
