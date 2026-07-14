/**
 * GET /api/digital/chartbeat?period=today|week|month
 *
 * Chartbeat recurring queries each have a configured `date_range` ("day" or "week").
 * We filter queries by that field to match the requested period:
 *   today  → fetch only date_range:"day" queries  (actual today's data)
 *   week   → fetch only date_range:"week" queries (actual 7-day data)
 *   month  → aggregate last 30 daily DB snapshots (built up over time)
 *
 * Every time "today" is fetched, the result is also saved to DB so month accumulates.
 */
const https   = require('https');
const { query }   = require('../_lib/mysql');
const { getUser } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

const API_KEY = 'ab404291a5510d9fc3666b0871c8fc39';
const HOST    = 'patrika.com';
const CB_BASE = `https://api.chartbeat.com/query/v2/recurring`;

const CACHE_MS = 5 * 60 * 1000;
const _cache   = {};
const _cacheAt = {};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      const chunks = [];
      r.on('data', d => chunks.push(d));
      r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

function parseCsv(text) {
  const rows = [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return rows;
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = []; let field = '', inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (inQ) {
        if (c === '"') { if (line[j+1]==='"') { field+='"'; j++; } else inQ=false; }
        else field += c;
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { cells.push(field.trim()); field = ''; }
      else field += c;
    }
    cells.push(field.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

function todayIST() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

// ── Fetch from Chartbeat, filtering queries by their configured date_range ────
async function fetchFromChartbeat(dateRange) {
  const listRes = await get(`${CB_BASE}/list/?apikey=${API_KEY}&host=${HOST}`);
  let allQueries = [];
  try {
    allQueries = JSON.parse(listRes.body).queries || [];
  } catch (_) {
    allQueries = [{ query_id: 'a0dc4f20-4467-4a5e-a29e-c3bd77beb360', date_range: 'day' }];
  }

  // Use queries whose configured date_range matches what we want
  let queryIds = allQueries
    .filter(q => q.date_range === dateRange)
    .map(q => q.query_id)
    .filter(Boolean);

  // Fallback to all queries if none match
  if (!queryIds.length) {
    queryIds = allQueries.map(q => q.query_id).filter(Boolean);
  }

  const authorMap = {};
  await Promise.all(queryIds.map(async (qid) => {
    try {
      const { body } = await get(`${CB_BASE}/fetch/?apikey=${API_KEY}&host=${HOST}&query_id=${qid}`);
      let rows = [];
      if (body.trim().startsWith('{')) {
        rows = JSON.parse(body).articles || [];
      } else {
        rows = parseCsv(body);
      }
      rows.forEach(r => {
        const author = (r.author || '').trim();
        if (!author || author.toLowerCase() === 'undefined') return;
        const key  = author.toLowerCase();
        const uv   = parseInt(r.page_uniques || 0, 10) || 0;
        const title = (r.title || '').trim();
        if (!authorMap[key]) authorMap[key] = { author, page_uniques: 0, title: '', stories: 0, _topUV: 0 };
        authorMap[key].page_uniques += uv;
        authorMap[key].stories++;
        if (uv > authorMap[key]._topUV) { authorMap[key]._topUV = uv; authorMap[key].title = title; }
      });
    } catch (_) {}
  }));

  return Object.values(authorMap).map(a => ({
    author: a.author, title: a.title, page_uniques: a.page_uniques, stories: a.stories,
  }));
}

// ── Persist today's snapshot to DB ────────────────────────────────────────────
async function saveToDB(articles, date) {
  if (!articles.length) return;
  try {
    await query('DELETE FROM chartbeat_author_daily WHERE stat_date = ?', [date]);
    const ph   = articles.map(() => '(?,?,?,?,?)').join(',');
    const vals = articles.flatMap(a => [date, a.author, a.stories, a.page_uniques, a.title || null]);
    await query(
      `INSERT INTO chartbeat_author_daily (stat_date,author,stories,page_uniques,top_title) VALUES ${ph}`,
      vals
    );
  } catch (e) {
    console.error('[chartbeat] DB save failed:', e.message);
  }
}

// ── Aggregate from DB (month uses 30 daily snapshots) ─────────────────────────
async function fetchFromDB(days) {
  const rows = await query(`
    SELECT author,
           SUM(stories)      AS stories,
           SUM(page_uniques) AS page_uniques,
           MAX(top_title)    AS title
    FROM chartbeat_author_daily
    WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND stat_date <= CURDATE()
    GROUP BY author
    ORDER BY page_uniques DESC
  `, [days - 1]);
  return rows.map(r => ({
    author:       r.author,
    title:        r.title || '',
    page_uniques: Number(r.page_uniques) || 0,
    stories:      Number(r.stories) || 0,
  }));
}

// ── Aggregate from DB for a custom date range ─────────────────────────────────
async function fetchFromDBRange(from, to) {
  const rows = await query(`
    SELECT author,
           SUM(stories)      AS stories,
           SUM(page_uniques) AS page_uniques,
           MAX(top_title)    AS title
    FROM chartbeat_author_daily
    WHERE stat_date BETWEEN ? AND ?
    GROUP BY author
    ORDER BY page_uniques DESC
  `, [from, to]);
  return rows.map(r => ({
    author:       r.author,
    title:        r.title || '',
    page_uniques: Number(r.page_uniques) || 0,
    stories:      Number(r.stories) || 0,
  }));
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required' });

  const { from, to } = req.query;
  const today = todayIST();

  // Custom date range mode: query DB directly
  if (from && to) {
    const cacheKey = `range:${from}:${to}`;
    const now = Date.now();
    if (_cache[cacheKey] && (now - (_cacheAt[cacheKey] || 0)) < CACHE_MS) {
      return res.json({ ..._cache[cacheKey], cached: true });
    }
    try {
      let articles = await fetchFromDBRange(from, to);
      // If range includes today and DB has nothing for today, also fetch live
      if (to === today && !articles.length) {
        articles = await fetchFromChartbeat('day');
        saveToDB(articles, today);
      }
      const payload = { articles, fetched_at: new Date().toISOString(), from, to };
      _cache[cacheKey] = payload; _cacheAt[cacheKey] = now;
      return res.json({ ...payload, cached: false });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // Period mode
  const period = ['today', 'week', 'month'].includes(req.query.period)
    ? req.query.period : 'today';

  const now = Date.now();
  if (_cache[period] && (now - (_cacheAt[period] || 0)) < CACHE_MS) {
    return res.json({ ..._cache[period], period, cached: true, age_s: Math.round((now - _cacheAt[period]) / 1000) });
  }

  try {
    let articles;

    if (period === 'today') {
      articles = await fetchFromChartbeat('day');
      saveToDB(articles, today);
    } else if (period === 'week') {
      articles = await fetchFromChartbeat('week');
    } else {
      articles = await fetchFromDB(30);
      if (!articles.length) articles = await fetchFromChartbeat('day');
    }

    const payload = { articles, fetched_at: new Date().toISOString() };
    _cache[period]   = payload;
    _cacheAt[period] = now;
    return res.json({ ...payload, period, cached: false, age_s: 0 });
  } catch (err) {
    if (_cache[period]) {
      return res.json({ ..._cache[period], period, cached: true, stale: true });
    }
    return res.status(502).json({ error: 'Chartbeat unavailable: ' + err.message });
  }
};
