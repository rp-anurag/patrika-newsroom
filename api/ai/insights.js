/**
 * GET /api/ai/insights?state=&branch=&refresh=1
 * Returns: morning briefing, reporter trends, content gaps, QC hotspots.
 * Results cached 15 min per state+branch key. Pass refresh=1 to bust.
 */
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

const CACHE     = new Map();
const CACHE_TTL = 15 * 60 * 1000;

const toIST = ms => new Date(ms + 5.5 * 3600000).toISOString().slice(0, 10);

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor', 'Legal']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // Resolve effective state/branch
  let state  = req.query.state  || '';
  let branch = req.query.branch || '';
  if (user.role === 'State Head'       && user.state)  { state = user.state; branch = ''; }
  if (user.role === 'Regional Editor') {
    if (user.state)  state  = user.state;
    if (user.branch) branch = user.branch;
  }
  const filterState  = state  && state  !== 'All' ? state  : '';
  const filterBranch = branch && branch !== 'All' ? branch : '';
  const refresh      = req.query.refresh === '1';

  const cacheKey = `${filterState}|${filterBranch}`;
  if (!refresh) {
    const hit = CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL) return res.json(hit.data);
  }

  try {
    const ydayStr  = toIST(Date.now() - 864e5);
    const day3Str  = toIST(Date.now() - 3  * 864e5);
    const day7Str  = toIST(Date.now() - 7  * 864e5);
    const day30Str = toIST(Date.now() - 30 * 864e5);

    // Build per-table WHERE helpers
    const sF = filterState, bF = filterBranch;
    const ecmsExtra = [
      sF ? 'Pan_no IN (SELECT pan_no FROM `user` WHERE State = ?)' : '',
      bF ? 'Pan_no IN (SELECT pan_no FROM `user` WHERE Branch = ?)' : '',
    ].filter(Boolean).map(c => ' AND ' + c).join('');
    const ecmsParams = [...(sF ? [sF] : []), ...(bF ? [bF] : [])];

    const qcExtra  = sF ? ' AND state = ?' : '';
    const qcParams = sF ? [sF] : [];

    const [
      ydayStats,
      trendRows,
      gapRows,
      qcHotRows,
      topYday,
      zeroRow,
    ] = await Promise.all([

      // 1. Yesterday totals
      query(`SELECT SUM(No_Story) AS stories, SUM(No_Photo) AS photos,
                    COUNT(DISTINCT Pan_no) AS reporters, SUM(No_Words) AS words
             FROM daily_achievment_count_ecms
             WHERE DATE_FORMAT(entrydate,'%Y-%m-%d') = ?${ecmsExtra}`,
            [ydayStr, ...ecmsParams]).catch(() => [{}]),

      // 2. Reporter performance: 7d stories vs 30d base
      query(`SELECT e.Pan_no,
                    u.Name, u.Branch, u.State,
                    SUM(CASE WHEN DATE_FORMAT(e.entrydate,'%Y-%m-%d') >= ? THEN e.No_Story ELSE 0 END) AS s7d,
                    SUM(e.No_Story) AS s30d,
                    COUNT(DISTINCT CASE WHEN DATE_FORMAT(e.entrydate,'%Y-%m-%d') >= ? AND e.No_Story > 0
                          THEN DATE_FORMAT(e.entrydate,'%Y-%m-%d') END) AS active7d
             FROM daily_achievment_count_ecms e
             JOIN \`user\` u ON e.Pan_no = u.pan_no
             WHERE DATE_FORMAT(e.entrydate,'%Y-%m-%d') BETWEEN ? AND ?
               ${sF ? 'AND u.State = ?'  : ''}
               ${bF ? 'AND u.Branch = ?' : ''}
             GROUP BY e.Pan_no, u.Name, u.Branch, u.State
             ORDER BY s7d DESC
             LIMIT 100`,
            [day7Str, day7Str, day30Str, ydayStr,
             ...(sF ? [sF] : []), ...(bF ? [bF] : [])]).catch(() => []),

      // 3. Coverage gaps: beats (Story_Type) with zero/low stories in 3 days
      query(`SELECT u.Story_Type AS beat,
                    COUNT(DISTINCT u.pan_no) AS reporters,
                    COALESCE(SUM(e.No_Story), 0) AS stories3d,
                    MAX(DATE_FORMAT(e.entrydate,'%Y-%m-%d')) AS lastStory
             FROM \`user\` u
             LEFT JOIN daily_achievment_count_ecms e
               ON e.Pan_no = u.pan_no
               AND DATE_FORMAT(e.entrydate,'%Y-%m-%d') >= ?
             WHERE (u.is_emp_working = 1 OR u.Status = 'Working' OR u.Status = 'Active')
               AND u.Story_Type IS NOT NULL AND u.Story_Type != ''
               ${sF ? 'AND u.State = ?'  : ''}
               ${bF ? 'AND u.Branch = ?' : ''}
             GROUP BY u.Story_Type
             ORDER BY stories3d ASC, reporters DESC
             LIMIT 20`,
            [day3Str, ...(sF ? [sF] : []), ...(bF ? [bF] : [])]).catch(() => []),

      // 4. QC hotspots by state — last 7 days
      query(`SELECT state,
                    SUM(no_of_mistake) AS mistakes7d,
                    COUNT(*) AS checks,
                    ROUND(AVG(no_of_mistake), 1) AS avgPerCheck
             FROM qc_review
             WHERE DATE_FORMAT(entrydate,'%Y-%m-%d') BETWEEN ? AND ?${qcExtra}
             GROUP BY state
             ORDER BY mistakes7d DESC
             LIMIT 8`,
            [day7Str, ydayStr, ...qcParams]).catch(() => []),

      // 5. Top 3 reporters yesterday (for briefing text)
      query(`SELECT u.Name, u.Branch, SUM(e.No_Story) AS stories
             FROM daily_achievment_count_ecms e
             JOIN \`user\` u ON e.Pan_no = u.pan_no
             WHERE DATE_FORMAT(e.entrydate,'%Y-%m-%d') = ?
               ${sF ? 'AND u.State = ?'  : ''}
               ${bF ? 'AND u.Branch = ?' : ''}
             GROUP BY e.Pan_no, u.Name, u.Branch
             ORDER BY stories DESC
             LIMIT 3`,
            [ydayStr, ...(sF ? [sF] : []), ...(bF ? [bF] : [])]).catch(() => []),

      // 6. Count reporters with zero stories yesterday
      query(`SELECT COUNT(DISTINCT u.pan_no) AS cnt
             FROM \`user\` u
             WHERE (u.is_emp_working = 1 OR u.Status = 'Working' OR u.Status = 'Active')
               AND u.Story_Type IS NOT NULL AND u.Story_Type != ''
               ${sF ? 'AND u.State = ?'  : ''}
               ${bF ? 'AND u.Branch = ?' : ''}
               AND u.pan_no NOT IN (
                 SELECT Pan_no FROM daily_achievment_count_ecms
                 WHERE DATE_FORMAT(entrydate,'%Y-%m-%d') = ? AND No_Story > 0
               )`,
            [...(sF ? [sF] : []), ...(bF ? [bF] : []), ydayStr]).catch(() => [{ cnt: 0 }]),
    ]);

    // ── Shape reporter trends ─────────────────────────────────────────────────
    const reporterTrends = trendRows.map(r => {
      const s7d  = Number(r.s7d  || 0);
      const s30d = Number(r.s30d || 0);
      const avg7 = Math.round((s30d / 30) * 7 * 10) / 10;
      let trend = 'flat';
      if (avg7 > 0) {
        if      (s7d >= avg7 * 1.2) trend = 'up';
        else if (s7d <= avg7 * 0.8) trend = 'down';
      } else if (s7d > 0) {
        trend = 'up';
      }
      return {
        name:      r.Name   || '—',
        branch:    r.Branch || '—',
        state:     r.State  || '—',
        stories7d: s7d,
        avg7d:     avg7,
        active7d:  Number(r.active7d || 0),
        trend,
      };
    });

    // ── Shape content gaps ───────────────────────────────────────────────────
    const contentGaps = gapRows
      .filter(r => r.beat && r.beat.trim())
      .map(r => {
        const n = Number(r.stories3d || 0);
        return {
          beat:      r.beat.trim(),
          reporters: Number(r.reporters || 0),
          stories3d: n,
          lastStory: r.lastStory ? String(r.lastStory).slice(0, 10) : null,
          severity:  n === 0 ? 'critical' : n < 3 ? 'warn' : 'ok',
        };
      });

    // ── Build briefing stats ─────────────────────────────────────────────────
    const briefingStats = {
      date:          ydayStr,
      stories:       Number(ydayStats[0]?.stories    || 0),
      photos:        Number(ydayStats[0]?.photos     || 0),
      reporters:     Number(ydayStats[0]?.reporters  || 0),
      words:         Number(ydayStats[0]?.words      || 0),
      zeroReporters: Number(zeroRow[0]?.cnt          || 0),
      topReporters:  topYday.map(r => `${r.Name} (${r.Branch || r.State}, ${r.stories} stories)`),
      criticalGaps:  contentGaps.filter(g => g.severity === 'critical').map(g => g.beat).slice(0, 4),
      qcHotspot:     qcHotRows[0]
        ? `${qcHotRows[0].state} (${qcHotRows[0].mistakes7d} mistakes)`
        : null,
    };

    // ── Generate AI briefing (optional — needs OPENAI_API_KEY) ───────────────
    let briefing = null;
    if (process.env.OPENAI_API_KEY && briefingStats.stories > 0) {
      try {
        const fetch  = require('node-fetch');
        const prompt = [
          'You are an editorial assistant for Patrika, a Hindi newspaper.',
          'Write a concise morning briefing in 4–5 sentences mixing Hindi and English.',
          `Data from ${briefingStats.date}:`,
          `- Stories filed: ${briefingStats.stories} by ${briefingStats.reporters} reporters`,
          `- Photos: ${briefingStats.photos}, Words: ${Math.round(briefingStats.words / 1000)}K`,
          `- Reporters with 0 stories: ${briefingStats.zeroReporters}`,
          briefingStats.topReporters.length ? `- Top reporters: ${briefingStats.topReporters.join('; ')}` : '',
          briefingStats.criticalGaps.length ? `- Beats with no coverage in 3 days: ${briefingStats.criticalGaps.join(', ')}` : '',
          briefingStats.qcHotspot ? `- QC concern: ${briefingStats.qcHotspot}` : '',
          '',
          'Keep it professional, factual, and actionable for editors. Avoid bullet points.',
        ].filter(Boolean).join('\n');

        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method:  'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 280 }),
        });
        if (r.ok) {
          const d = await r.json();
          briefing = d.choices?.[0]?.message?.content?.trim() || null;
        }
      } catch (e) {
        console.error('[ai/insights] briefing:', e.message);
      }
    }

    const data = {
      briefing,
      briefingStats,
      reporterTrends,
      contentGaps,
      qcHotspots: qcHotRows.map(r => ({
        state:       r.state || '—',
        mistakes7d:  Number(r.mistakes7d  || 0),
        checks:      Number(r.checks      || 0),
        avgPerCheck: Number(r.avgPerCheck || 0),
      })),
      generatedAt: new Date().toISOString(),
    };

    CACHE.set(cacheKey, { ts: Date.now(), data });
    return res.json(data);

  } catch (err) {
    console.error('[ai/insights]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
