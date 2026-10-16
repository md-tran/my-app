// Talks to the API server's live data sources (Apollo + Companies House).

export async function getHealth(fetchImpl = fetch) {
  try {
    const res = await fetchImpl('/api/health');
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

export async function fetchLiveProspects(icp, { count, page = 1, exclude = [] }, fetchImpl = fetch) {
  const res = await fetchImpl('/api/prospects/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ icp, count, page, exclude }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Prospect search failed (HTTP ${res.status})`);
  return data;
}
