import { createRng } from './random';

export const OPT_OUT = '\n\n—\nNot relevant? Reply “unsubscribe” and I won’t contact you again.';

// Outreach agent: turns an approved message into a multi-touch sequence and,
// in demo mode, simulates how the prospect engages with it.

export function buildSequence(message, startDate = new Date()) {
  const at = (days) => addBusinessDays(startDate, days).toISOString();
  return [
    { step: 1, channel: 'email', day: 0, sendAt: at(0), subject: message.subject, body: withOptOut(message.body), status: 'scheduled' },
    { step: 2, channel: 'linkedin', day: 1, sendAt: at(1), body: 'Manual task: send a LinkedIn connection request with a short note referencing the email.', manual: true, status: 'scheduled' },
    ...message.followUps.map((f, i) => ({
      step: i + 3,
      channel: 'email',
      day: f.day,
      sendAt: at(f.day),
      subject: `Re: ${message.subject}`,
      body: f.body,
      status: 'scheduled',
    })),
  ];
}

function withOptOut(body) {
  return /unsubscribe/i.test(body) ? body : body + OPT_OUT;
}

// Probability of a reply scales with fit score; strong signals reply sooner.
export function simulateEngagement(prospect, sequence, seed) {
  const rng = createRng(`${seed}:engage:${prospect.id}`);
  const replyChance = 0.04 + (prospect.score / 100) * 0.32;
  const steps = sequence.map((s) => ({ ...s }));

  for (const step of steps) {
    step.status = 'sent';
    if (step.channel === 'email') step.opened = rng.chance(0.45 + prospect.score / 300);
    if (rng.chance(replyChance / steps.length * 1.6)) {
      const positive = rng.chance(0.35 + prospect.score / 250);
      const sentiment = positive ? 'positive' : rng.chance(0.5) ? 'not_now' : 'unsubscribe';
      // Stop the sequence once the prospect replies.
      steps.forEach((s) => {
        if (s.step > step.step) s.status = 'cancelled';
      });
      return { sequence: steps, reply: { step: step.step, sentiment, text: replyText(sentiment, prospect) } };
    }
  }
  return { sequence: steps, reply: null };
}

function replyText(sentiment, p) {
  if (sentiment === 'positive') return `Thanks for reaching out — timing is good actually. Happy to chat, what does next week look like?`;
  if (sentiment === 'not_now') return `Not a priority for ${p.company.name} this quarter. Feel free to check back in the new year.`;
  return 'Please remove me from your list.';
}

export function addBusinessDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}
