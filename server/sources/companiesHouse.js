// Companies House: confirms a UK prospect's employer is a live registered
// company (a "corporate subscriber" under PECR) and spots new directors.
// Free API key, sent as the Basic-auth username; 600 requests per 5 minutes.

const BASE = 'https://api.company-information.service.gov.uk';
const NEW_DIRECTOR_DAYS = 90;
const DIRECTOR_ROLES = new Set(['director', 'llp-designated-member', 'llp-member', 'corporate-director']);
// Partnerships aren't bodies corporate, so their staff count as individuals under PECR.
const INDIVIDUAL_TYPES = new Set(['limited-partnership']);

const companiesHouseConfigured = () => Boolean(process.env.COMPANIES_HOUSE_API_KEY);

async function chGet(path, fetchImpl) {
  const auth = Buffer.from(`${process.env.COMPANIES_HOUSE_API_KEY}:`).toString('base64');
  const res = await fetchImpl(`${BASE}${path}`, { headers: { Authorization: `Basic ${auth}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`Companies House ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const normalise = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(ltd|limited|plc|llp|uk)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function bestMatch(name, items) {
  const target = normalise(name);
  if (!target) return null;
  const active = items.filter((i) => i.company_status === 'active');
  return active.find((i) => normalise(i.title) === target) || active.find((i) => normalise(i.title).startsWith(`${target} `)) || null;
}

async function lookupCompany(name, { fetchImpl = fetch, now = new Date() } = {}) {
  const search = await chGet(`/search/companies?q=${encodeURIComponent(name)}&items_per_page=10`, fetchImpl);
  const match = bestMatch(name, (search && search.items) || []);
  if (!match) return { found: false };

  const officers = await chGet(`/company/${encodeURIComponent(match.company_number)}/officers?items_per_page=50&order_by=appointed_on`, fetchImpl);
  const cutoff = new Date(now.getTime() - NEW_DIRECTOR_DAYS * 86400000);
  const newDirectors = ((officers && officers.items) || []).filter(
    (o) => DIRECTOR_ROLES.has(o.officer_role) && !o.resigned_on && o.appointed_on && new Date(o.appointed_on) >= cutoff,
  );

  return {
    found: true,
    number: match.company_number,
    name: match.title,
    status: match.company_status,
    type: match.company_type,
    incorporated: match.date_of_creation || null,
    address: match.address_snippet || '',
    individualSubscriber: INDIVIDUAL_TYPES.has(match.company_type),
    newDirectors: newDirectors.map((o) => ({ name: o.name, appointedOn: o.appointed_on })),
  };
}

module.exports = { lookupCompany, bestMatch, normalise, companiesHouseConfigured };
