// Reads "Book a discovery call" submissions from the MDT Analytics Wix site.
// Auth is a Wix API key (account owner generates it with the Wix Forms scope)
// plus the target site's ID, sent as `wix-site-id`.

const WIX_SITE_ID = process.env.WIX_SITE_ID || 'fef07b19-d0a4-4b40-8266-4e03c92e5e6e';
const WIX_BOOKING_FORM_ID = process.env.WIX_BOOKING_FORM_ID || '333b46de-343f-48e4-a049-c2f79a6f7739';
const QUERY_URL = 'https://www.wixapis.com/forms/v4/submissions/namespace/query';

// Field targets on the booking form, set when the form was created.
const FIELDS = {
  firstName: 'first_name_d6f0',
  lastName: 'last_name_bd3a',
  email: 'work_email_cf97',
  company: 'company_c744',
  title: 'job_title_d225',
  companySize: 'company_size_8f2b',
  goal: 'main_goal_b652',
  notes: 'challenge_c376',
  preferredTime: 'preferred_time_8bb0',
};

const wixConfigured = () => Boolean(process.env.WIX_API_KEY);

function toBookingRequest(sub) {
  const values = sub.submissions || {};
  const out = { id: sub.id, createdDate: sub.createdDate, contactId: sub.contactId || null };
  for (const [key, target] of Object.entries(FIELDS)) out[key] = values[target] ?? '';
  return out;
}

async function fetchBookingRequests({ fetchImpl = fetch, limit = 100 } = {}) {
  const body = {
    query: {
      filter: { formId: WIX_BOOKING_FORM_ID, namespace: 'wix.form_app.form' },
      sort: [{ fieldName: 'createdDate', order: 'DESC' }],
      cursorPaging: { limit },
    },
  };
  const res = await fetchImpl(QUERY_URL, {
    method: 'POST',
    headers: {
      Authorization: process.env.WIX_API_KEY,
      'wix-site-id': WIX_SITE_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Wix API ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.submissions || []).map(toBookingRequest);
}

module.exports = { fetchBookingRequests, toBookingRequest, wixConfigured, WIX_SITE_ID, WIX_BOOKING_FORM_ID, FIELDS };
