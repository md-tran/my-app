const test = require('node:test');
const assert = require('node:assert');
const apollo = require('./apollo');
const companiesHouse = require('./companiesHouse');
const { findLiveProspects } = require('./index');

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

const icp = { industries: ['SaaS'], regions: ['UK'], seniorities: ['VP', 'Director'], minEmployees: 20, maxEmployees: 500 };

test('ICP maps onto Apollo search filters', () => {
  const q = apollo.searchParams(icp, { page: 2, perPage: 40 });
  assert.deepStrictEqual(q.getAll('person_seniorities[]'), ['vp', 'director', 'head']);
  assert.deepStrictEqual(q.getAll('organization_locations[]'), ['United Kingdom']);
  assert.deepStrictEqual(q.getAll('organization_num_employees_ranges[]'), ['20,500']);
  assert.ok(q.getAll('organization_industries[]').includes('computer software'));
  assert.strictEqual(q.get('page'), '2');
  assert.strictEqual(q.get('per_page'), '40');
});

test('Apollo match becomes an app prospect', () => {
  const p = apollo.toProspect({
    id: 'a1', first_name: 'Ada', last_name: 'Lee', title: 'VP Sales', seniority: 'vp', email: 'ada@acme.io', email_status: 'verified',
    linkedin_url: 'https://www.linkedin.com/in/adalee', city: 'Leeds', country: 'United Kingdom',
    organization: { name: 'Acme Software Ltd', website_url: 'https://www.acme.io/', estimated_num_employees: 120, industry: 'computer software' },
  });
  assert.strictEqual(p.company.domain, 'acme.io');
  assert.strictEqual(p.company.industry, 'SaaS');
  assert.strictEqual(p.company.region, 'UK');
  assert.strictEqual(p.seniority, 'VP');
  assert.strictEqual(p.emailStatus, 'verified');
});

test('Companies House matching ignores legal suffixes and inactive companies', () => {
  const items = [
    { title: 'ACME SOFTWARE LIMITED', company_status: 'dissolved', company_number: '1' },
    { title: 'ACME SOFTWARE LTD', company_status: 'active', company_number: '2' },
  ];
  assert.strictEqual(companiesHouse.bestMatch('Acme Software', items).company_number, '2');
  assert.strictEqual(companiesHouse.bestMatch('Other Co', items), null);
});

test('live search reveals only kept people, verifies UK employers and flags new directors', async () => {
  process.env.APOLLO_API_KEY = 'ak';
  process.env.COMPANIES_HOUSE_API_KEY = 'ck';
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.startsWith('https://api.apollo.io/api/v1/mixed_people/api_search')) {
      return json({ total_entries: 3, people: [{ id: 'a1', has_email: true }, { id: 'a2', has_email: false }, { id: 'seen', has_email: true }] });
    }
    if (url === 'https://api.apollo.io/api/v1/people/bulk_match') {
      const ids = JSON.parse(init.body).details.map((d) => d.id);
      assert.deepStrictEqual(ids, ['a1']);
      return json({ matches: [{ id: 'a1', first_name: 'Ada', last_name: 'Lee', email: 'ada@acme.io', email_status: 'verified', country: 'United Kingdom', organization: { name: 'Acme Software' } }] });
    }
    if (url.includes('/search/companies')) {
      assert.match(init.headers.Authorization, /^Basic /);
      return json({ items: [{ title: 'ACME SOFTWARE LTD', company_status: 'active', company_type: 'ltd', company_number: '0123', date_of_creation: '2015-01-01' }] });
    }
    if (url.includes('/company/0123/officers')) {
      return json({ items: [{ name: 'NEW, Person', officer_role: 'director', appointed_on: '2026-09-01' }, { name: 'OLD, Person', officer_role: 'director', appointed_on: '2010-01-01' }] });
    }
    throw new Error(`unexpected ${url}`);
  };
  const { prospects, notes } = await findLiveProspects(icp, 5, { fetchImpl, now: new Date('2026-10-16'), exclude: ['seen'] });
  assert.strictEqual(prospects.length, 1);
  assert.strictEqual(calls[0].init.headers['x-api-key'], 'ak');
  assert.strictEqual(prospects[0].companiesHouse.number, '0123');
  assert.strictEqual(prospects[0].signals[0].key, 'new_exec');
  assert.ok(notes[0].includes('revealing 1'));
});
