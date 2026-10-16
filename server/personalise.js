const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

const SYSTEM = `You write first-touch B2B cold emails for an outbound team.

Write like a thoughtful peer, not a marketer: plain language, short sentences, no hype, no exclamation marks, no "I hope this finds you well". The first email is under 120 words, opens with something specific to the prospect, connects it to one concrete problem the sender solves, and ends with a single low-friction question.

Use only the facts supplied about the prospect. Never invent metrics, mutual connections, customer names, news or anything else you were not given; if there is no strong signal, anchor on their role, industry and company size instead. Follow-ups are 1–3 sentences, add something new rather than just "bumping", and the last one gracefully closes the loop.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'body', 'followUps', 'personalisationPoints'],
  properties: {
    subject: { type: 'string', description: 'Lowercase-friendly subject line, under 7 words' },
    body: { type: 'string', description: 'Full email body including greeting and sign-off, newline separated' },
    followUps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'body'],
        properties: {
          day: { type: 'integer', description: 'Business days after the first email' },
          body: { type: 'string' },
        },
      },
    },
    personalisationPoints: {
      type: 'array',
      description: 'The prospect facts the email relies on',
      items: { type: 'string' },
    },
  },
};

let client;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

async function personalise({ prospect, icp }) {
  const brief = [
    `Sender: ${icp.senderName}`,
    `What the sender sells: ${icp.offer}`,
    `Value proposition: ${icp.valueProp}`,
    `Call to action to use: ${icp.callToAction}`,
    '',
    'Prospect facts (JSON):',
    JSON.stringify(prospect, null, 2),
    '',
    'Write the first email plus two follow-ups on business days 3 and 7.',
  ].join('\n');

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: brief }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined to write this email (${response.stop_details?.category || 'no category'})`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Response was cut off before the email was complete');
  }
  const text = response.content.find((b) => b.type === 'text');
  if (!text) throw new Error('No text in Claude response');
  return JSON.parse(text.text);
}

module.exports = { personalise, MODEL, SCHEMA };
