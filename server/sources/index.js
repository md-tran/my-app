const apollo = require('./apollo');
const companiesHouse = require('./companiesHouse');

// Live prospecting: Apollo finds and reveals contacts, then Companies House
// verifies each UK employer and adds new-director signals.

const sourcesStatus = () => ({ apollo: apollo.apolloConfigured(), companiesHouse: companiesHouse.companiesHouseConfigured() });

async function findLiveProspects(icp, count, { fetchImpl = fetch, now = new Date(), exclude = [], page = 1 } = {}) {
  const skip = new Set(exclude.map((x) => String(x).toLowerCase()));
  const notes = [];

  // Search a little wider than needed (free), keep people Apollo holds an email for.
  const { total, people } = await apollo.searchPeople(icp, { perPage: Math.min(100, count * 2), page, fetchImpl });
  const candidates = people.filter((p) => p.has_email && !skip.has(String(p.id).toLowerCase())).slice(0, count);
  notes.push(`Apollo found ${total} matching people; revealing ${candidates.length} (about ${candidates.length} credits).`);

  const matches = await apollo.revealPeople(candidates.map((p) => p.id), { fetchImpl });
  const prospects = matches.map(apollo.toProspect).filter((p) => p.email && !skip.has(p.email.toLowerCase()));

  if (companiesHouse.companiesHouseConfigured()) {
    const cache = new Map();
    let checked = 0;
    for (const p of prospects) {
      if (p.company.region !== 'UK' || !p.company.name) continue;
      const key = p.company.name.toLowerCase();
      if (!cache.has(key)) {
        try {
          cache.set(key, await companiesHouse.lookupCompany(p.company.name, { fetchImpl, now }));
          checked++;
        } catch (e) {
          cache.set(key, { found: false, error: e.message });
        }
      }
      const ch = cache.get(key);
      p.companiesHouse = ch;
      if (ch.found && ch.newDirectors.length) {
        const d = ch.newDirectors[0];
        p.signals.push({ key: 'new_exec', label: `New director appointed ${d.appointedOn} (Companies House)`, weight: 9 });
      }
    }
    notes.push(`Checked ${checked} UK employers on Companies House.`);
  } else {
    notes.push('Companies House not configured — UK employers were not verified.');
  }

  return { prospects, notes };
}

module.exports = { findLiveProspects, sourcesStatus };
