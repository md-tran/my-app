const path = require('path');
const fs = require('fs');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { personalise, MODEL } = require('./personalise');

const app = express();
app.use(express.json({ limit: '100kb' }));

const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ai: aiConfigured(), model: MODEL });
});

app.post('/api/personalise', async (req, res) => {
  const { prospect, icp } = req.body || {};
  if (!prospect || !icp) return res.status(400).json({ error: 'prospect and icp are required' });
  if (!aiConfigured()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set' });

  try {
    res.json(await personalise({ prospect, icp }));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited by Claude API, retry shortly' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ error: 'Invalid Anthropic API key' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Claude API error ${err.status}:`, err.message);
      return res.status(502).json({ error: 'Claude API error' });
    }
    console.error('Personalisation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// In production, serve the built React app from the same origin.
const build = path.join(__dirname, '..', 'build');
if (fs.existsSync(build)) {
  app.use(express.static(build));
  app.get('*', (req, res) => res.sendFile(path.join(build, 'index.html')));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`MDT Outbound API on http://localhost:${port} (Claude ${aiConfigured() ? 'enabled' : 'disabled — set ANTHROPIC_API_KEY'})`);
});
