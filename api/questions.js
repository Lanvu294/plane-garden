/* ============================================================================
   /api/questions — submitted questions, as a Vercel serverless function.

   GET     → { pending: [{ id, q, at }] }   newest first, hidden ones left out
   POST    { q, website, t } → 201 { item, redacted }
             q        the question
             website  a honeypot: real people never see it, bots fill it in
             t        ms the form was open; a person takes longer than 1.5 s
   DELETE  ?id=…  with header x-admin-token: $ADMIN_TOKEN → hides one

   Storage is Upstash Redis over its REST API (add the "Upstash for Redis"
   integration to the Vercel project; it sets KV_REST_API_URL and
   KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL / _TOKEN). Without it the
   function answers 503 and the page says submissions are closed.

   Everything stored is public, so before saving: emails, links, phone
   numbers and @handles are blanked out, and length is capped. The same
   rules run in serve.py for local development — keep them in step.
   ========================================================================== */

const MIN = 8, MAX = 280, LIST_MAX = 200, RATE = 5, RATE_WINDOW_S = 600;
const KEY = 'garden:pending', HIDDEN = 'garden:hidden';

function redact(text) {
  let changed = false;
  const sub = (re, rep) => { text = text.replace(re, (...m) => { changed = true; return typeof rep === 'function' ? rep(...m) : rep; }); };
  sub(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]');
  sub(/\b(?:https?:\/\/|www\.)\S+/gi, '[link removed]');
  sub(/[+(]?(?:\d[\s().-]*){7,}\d/g, '[number removed]');
  sub(/(^|\s)@[A-Za-z0-9_.]{2,}/g, (m, pre) => pre + '[handle removed]');
  return { text, changed };
}

function clean(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')   // shown as text, never as HTML
    .replace(/\s+/g, ' ')
    .trim();
}

function store() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async function pipeline(cmds) {
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds)
    });
    if (!r.ok) throw new Error('storage ' + r.status);
    return (await r.json()).map((x) => x.result);
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const redis = store();
  if (!redis) return res.status(503).json({ error: 'not-configured' });

  try {
    if (req.method === 'GET') {
      const [rows, hidden] = await redis([['LRANGE', KEY, '0', String(LIST_MAX - 1)], ['SMEMBERS', HIDDEN]]);
      const hide = new Set(hidden || []);
      const pending = (rows || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } })
        .filter((x) => x && !hide.has(x.id));
      return res.status(200).json({ pending });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (body.website) return res.status(201).json({ item: null });          // a bot: say thanks, keep nothing
      if (typeof body.t === 'number' && body.t < 1500) return res.status(400).json({ error: 'too-fast' });
      const { text, changed } = redact(clean(body.q));
      if (text.length < MIN) return res.status(400).json({ error: 'too-short' });
      if (text.length > MAX) return res.status(400).json({ error: 'too-long' });

      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon').split(',')[0].trim();
      const rk = 'garden:rate:' + ip;
      const [count] = await redis([['INCR', rk], ['EXPIRE', rk, String(RATE_WINDOW_S), 'NX']]);
      if (count > RATE) return res.status(429).json({ error: 'slow-down' });

      const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), q: text, at: Date.now() };
      await redis([['LPUSH', KEY, JSON.stringify(item)], ['LTRIM', KEY, '0', String(LIST_MAX * 5 - 1)]]);
      return res.status(201).json({ item, redacted: changed });
    }

    if (req.method === 'DELETE') {
      const admin = process.env.ADMIN_TOKEN;
      if (!admin || req.headers['x-admin-token'] !== admin) return res.status(403).json({ error: 'forbidden' });
      const id = String((req.query && req.query.id) || '');
      if (!id) return res.status(400).json({ error: 'no-id' });
      await redis([['SADD', HIDDEN, id]]);
      return res.status(200).json({ hidden: id });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'storage' });
  }
};

module.exports.redact = redact;
module.exports.clean = clean;
