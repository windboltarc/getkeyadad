// app.js
const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

const PORT = process.env.PORT || 26570;

// In-memory store (demo)
const storedKeys = {};

// HTML template (kept similar to your Flask one)
const HTML_TEMPLATE = (key) => `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>QuackExecutor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; }
        .container { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37); backdrop-filter: blur(4px); width: 100%; max-width: 500px; text-align: center; animation: fadeIn 0.5s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        h1 { color: #2c3e50; margin-bottom: 1.5rem; font-size: 2.2rem; text-transform: uppercase; letter-spacing: 2px; }
        .key-label { color: #34495e; font-size: 1.1rem; margin-bottom: 0.5rem; }
        .textbox { width: 100%; padding: 0.8rem; font-size: 1rem; border: 2px solid #3498db; border-radius: 8px; margin-bottom: 1rem; background: #f8f9fa; color: #2c3e50; transition: all 0.3s ease; }
        .textbox:focus { outline: none; border-color: #2980b9; box-shadow: 0 0 8px rgba(52, 152, 219, 0.3); }
        .btn { padding: 0.8rem 2rem; font-size: 1rem; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; font-weight: bold; }
        .btn:hover { background: #2980b9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
        .message { margin-top: 1.5rem; color: #e74c3c; font-size: 1.1rem; font-weight: 500; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        .noodle-emoji { font-size: 1.5rem; margin-left: 0.5rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>QuackExecutor</h1>
        <p class="key-label">Your Key:</p>
        <input type="text" class="textbox" value="${key || ''}" readonly>
        <button class="btn" onclick="navigator.clipboard.writeText('${key || ''}').then(() => alert('Key copied to clipboard!'))">Copy</button>
        <p class="message">Thank you for getting your key, added 9/50 bowl of noodles! <span class="noodle-emoji">🍜💖</span></p>
    </div>
</body>
</html>`;

// Utility: generate random key like Quack_16digits
function generateRandomKey() {
  const digits = Array.from({length:16}, () => Math.floor(Math.random()*10)).join('');
  const key = `Quack_${digits}`;
  console.info('Generated key:', key);
  return key;
}

// Optional helper: shortener via link4m (you can replace api/token). Returns shortened url or throws.
async function shortenWithLink4m(targetUrl) {
  // Replace API key with yours (or set process.env.LINK4M_API)
  const apiKey = process.env.LINK4M_API || '68ae872a8e209608f24257f7';
  const endpoint = 'https://link4m.co/api-shorten/v2';
  try {
    const resp = await axios.get(endpoint, { params: { api: apiKey, url: targetUrl }, timeout: 10000 });
    if (resp && resp.data) {
      // try multiple possible fields
      if (resp.data.shortenedUrl) return resp.data.shortenedUrl;
      if (resp.data.shortUrl) return resp.data.shortUrl;
      if (resp.data.data && resp.data.data.shortenedUrl) return resp.data.data.shortenedUrl;
      // fallback: return raw response URL (not ideal)
      throw new Error('Unexpected response from link4m: ' + JSON.stringify(resp.data));
    }
    throw new Error('Empty response from link4m');
  } catch (err) {
    console.error('link4m shorten error:', err.message || err);
    throw err;
  }
}

// GET /key -> render HTML with key param
app.get('/key', (req, res) => {
  const key = req.query.key || '';
  console.info(`/key requested - key=${key} from ${req.ip}`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML_TEMPLATE(key));
});

// POST /createkey -> generate key, create shortened link, store in memory, return JSON {status, key, link}
app.post('/createkey', async (req, res) => {
  console.info('/createkey called from', req.ip);
  const newKey = generateRandomKey();

  // generate target URL that will display the key (your Vercel/host domain replace below)
  // In Flask example you used https://key.ducknovis.site/key?key=...
  const hostBase = process.env.HOST_BASE || `https://getkeylunar.vercel.app/key?key={random_key}`; // change in production
  const targetUrl = `${hostBase}/key?key=${encodeURIComponent(newKey)}`;

  try {
    // attempt to shorten using link4m
    let short = null;
    try {
      short = await shortenWithLink4m(targetUrl);
    } catch (e) {
      console.warn('Shortener failed, falling back to direct URL:', e.message || e);
      short = targetUrl;
    }

    // store key in memory (valid until server restart)
    storedKeys[newKey] = true;
    console.info('Stored key', newKey);

    return res.json({ status: 'success', key: newKey, link: short });
  } catch (err) {
    console.error('/createkey error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to create key', detail: err.message || String(err) });
  }
});

// POST /submitkey -> body JSON { key: "Quack_xxx" } -> validate and remove
app.post('/submitkey', (req, res) => {
  console.info('/submitkey called from', req.ip, 'payload=', req.body);
  const key = (req.body && req.body.key) ? String(req.body.key) : null;
  if (!key) {
    return res.status(400).json({ status: 'error', message: 'No key provided' });
  }

  // format validation
  if (!/^Quack_\d{16}$/.test(key)) {
    console.warn('Invalid key format', key);
    return res.json({ status: 'success', isValid: false });
  }

  if (storedKeys[key]) {
    // consume key (one-time)
    delete storedKeys[key];
    console.info('Key valid and consumed:', key);
    return res.json({ status: 'success', isValid: true });
  } else {
    console.info('Key not found/invalid:', key);
    return res.json({ status: 'success', isValid: false });
  }
});

// Basic homepage for convenience
app.get('/', (req, res) => {
  res.send(`<html><body style="font-family:Arial;padding:20px">
    <h2>KeyGen Express Demo</h2>
    <p>POST /createkey to generate. GET /key?key=... to view. POST /submitkey to verify.</p>
    <p>Host base: <strong>${process.env.HOST_BASE || `http://localhost:${PORT}`}</strong></p>
  </body></html>`);
});

// Start server
app.listen(PORT, () => {
  console.info(`KeyGen server running on port ${PORT}`);
});
