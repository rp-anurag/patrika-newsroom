/**
 * POST /api/production/delay-report
 *   Body: { date?: 'YYYY-MM-DD' }   (defaults to yesterday)
 *
 * Manually triggers the page-delay Telegram report.
 * Only Admin and State Head can trigger this.
 *
 * GET /api/production/delay-report?branch=Jaipur
 *   Returns list of configured Telegram recipients for a branch.
 */
const { requireRole }    = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');
const { query }          = require('../_lib/mysql');
const { runDelayReport } = require('../cron/delay-report');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'State Head']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — preview recipients for a branch ────────────────────────────────
  if (req.method === 'GET') {
    const branch = req.query.branch;
    if (!branch) {
      // Return all configured recipients across all branches
      try {
        const rows = await query(
          `SELECT EMPNAME, Story_Type, emp_designation, Branch, State, telegram_chat_id
           FROM \`user\`
           WHERE telegram_chat_id IS NOT NULL AND telegram_chat_id != ''
             AND (is_emp_working = 1 OR Status IN ('Working','Active'))
             AND (
               Story_Type REGEXP '[[:<:]]RE[[:>:]]'
               OR LOWER(Story_Type)      LIKE '%desk%'
               OR LOWER(emp_designation) LIKE '%desk head%'
               OR LOWER(emp_designation) LIKE '%regional editor%'
             )
           ORDER BY Branch, EMPNAME`
        );
        return res.json({ recipients: rows, total: rows.length });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    try {
      const rows = await query(
        `SELECT EMPNAME, Story_Type, emp_designation, Branch, State,
                telegram_chat_id,
                CASE WHEN telegram_chat_id IS NOT NULL AND telegram_chat_id != ''
                     THEN 1 ELSE 0 END AS tg_configured
         FROM \`user\`
         WHERE Branch = ?
           AND (is_emp_working = 1 OR Status IN ('Working','Active'))
           AND (
             Story_Type REGEXP '[[:<:]]RE[[:>:]]'
             OR LOWER(Story_Type)      LIKE '%desk%'
             OR LOWER(emp_designation) LIKE '%desk head%'
             OR LOWER(emp_designation) LIKE '%regional editor%'
           )
         ORDER BY EMPNAME`,
        [branch]
      );
      return res.json({ branch, recipients: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — trigger the report ─────────────────────────────────────────────
  if (req.method === 'POST') {
    const date = req.body?.date || null;
    try {
      const result = await runDelayReport(date);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── PATCH — save telegram_chat_id for a user (by pan_no) ─────────────────
  if (req.method === 'PATCH') {
    const { pan_no, telegram_chat_id } = req.body || {};
    if (!pan_no) return res.status(400).json({ error: 'pan_no required' });
    try {
      await query(
        'UPDATE `user` SET telegram_chat_id = ? WHERE pan_no = ?',
        [telegram_chat_id || null, pan_no]
      );
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
