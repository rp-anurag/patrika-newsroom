/**
 * GET /api/correspondent
 * Query params:
 *   branch  — filter by branch (optional)
 *   month   — from_date value e.g. "2026-04-30" (optional, latest if omitted)
 */
const { query }       = require('./_lib/mysql');
const { requireRole } = require('./_lib/auth');
const { setCors, handleOptions } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const { branch, month, state } = req.query;

  // Respect role locks
  const effectiveState  = user.role === 'State Head' ? user.state :
    (user.role === 'Regional Editor' ? user.state : (state && state !== 'All' ? state : null));
  const effectiveBranch = user.role === 'Regional Editor' ? user.branch : (branch && branch !== 'All' ? branch : null);

  // ── Available months ───────────────────────────────────────────────────────
  const months = await query(
    `SELECT DISTINCT from_date FROM correspondent_word_photo ORDER BY from_date DESC LIMIT 24`
  ).catch(() => []);

  const monthList = months.map(r => {
    const d = new Date(r.from_date);
    return {
      value: r.from_date.toISOString ? r.from_date.toISOString().slice(0, 10) : String(r.from_date).slice(0, 10),
      label: d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    };
  });

  // Use requested month or latest available
  const selectedMonth = month || (monthList[0]?.value);

  // ── Correspondents (master) ────────────────────────────────────────────────
  const corrConds  = ['c.status = 1'];
  const corrParams = [];
  if (effectiveState)  { corrConds.push('c.branch IN (SELECT DISTINCT Branch FROM `user` WHERE State = ?)'); corrParams.push(effectiveState); }
  if (effectiveBranch) { corrConds.push('c.branch = ?'); corrParams.push(effectiveBranch); }

  const correspondents = await query(
    `SELECT c.id, c.pan_no, c.name, c.branch, c.district, c.location,
            c.emp_type, c.type, c.mobile, c.email_id, c.desk_name,
            c.dob, c.joining_date,
            COALESCE(wp.No_Story,  0) AS stories,
            COALESCE(wp.No_Words,  0) AS words,
            COALESCE(wp.No_Photo,  0) AS photos,
            COALESCE(wp.amount_paid, 0) AS amount_paid,
            wp.payment_on, wp.status AS payment_status
     FROM correspondent c
     LEFT JOIN correspondent_word_photo wp
       ON wp.Pan_no = c.pan_no
      AND DATE(wp.from_date) = ?
     WHERE ${corrConds.join(' AND ')}
     ORDER BY c.branch ASC, c.name ASC`,
    [selectedMonth || '1970-01-01', ...corrParams]
  ).catch(() => []);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalCorrespondents = correspondents.length;
  const withData = correspondents.filter(r => r.stories > 0 || r.words > 0 || r.photos > 0);
  const totalStories    = correspondents.reduce((s, r) => s + (r.stories || 0), 0);
  const totalWords      = correspondents.reduce((s, r) => s + (r.words   || 0), 0);
  const totalPhotos     = correspondents.reduce((s, r) => s + (r.photos  || 0), 0);
  const totalAmount     = correspondents.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);

  // ── Branch summary (for bar chart) ────────────────────────────────────────
  const branchMap = {};
  correspondents.forEach(r => {
    const b = r.branch || 'Unknown';
    if (!branchMap[b]) branchMap[b] = { branch: b, count: 0, stories: 0, words: 0, photos: 0, amount: 0 };
    branchMap[b].count++;
    branchMap[b].stories += r.stories || 0;
    branchMap[b].words   += r.words   || 0;
    branchMap[b].photos  += r.photos  || 0;
    branchMap[b].amount  += Number(r.amount_paid) || 0;
  });
  const branchSummary = Object.values(branchMap).sort((a, b) => b.words - a.words);

  return res.json({
    months: monthList,
    selectedMonth,
    summary: {
      total: totalCorrespondents,
      active: withData.length,
      stories: totalStories,
      words: totalWords,
      photos: totalPhotos,
      amount: totalAmount,
    },
    correspondents,
    branchSummary,
  });
};
