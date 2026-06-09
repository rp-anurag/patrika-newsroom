/**
 * GET  /api/production/delay-report
 *   Returns all Desk Heads & REs for Telegram config (ALL — even without chat ID set yet).
 *   Admin sees all states. State Head sees their state only.
 *
 * POST /api/production/delay-report
 *   Body: { date?: 'YYYY-MM-DD' }   (defaults to yesterday)
 *   Manually triggers the page-delay Telegram report.
 *
 * PATCH /api/production/delay-report
 *   Body: { pan_no, telegram_chat_id }
 *   Save/update telegram_chat_id for one employee.
 */
const { requireRole }    = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');
const { query }          = require('../_lib/mysql');
const { runDelayReport } = require('../cron/delay-report');

// Story_Type values that qualify as Desk Head or RE
const ROLE_FILTER = `(
  Story_Type IN ('RE', 'Desk Head', 'Desk', 'Nics Desk', 'Feature Desk', 'Desk Metro Ho', 'R&D Desk')
  OR LOWER(Story_Type)      LIKE '%desk%'
  OR Story_Type             REGEXP '[[:<:]]RE[[:>:]]'
  OR LOWER(emp_designation) LIKE '%desk head%'
  OR LOWER(emp_designation) LIKE '%regional editor%'
  OR LOWER(emp_designation) LIKE '%news editor%'
)`;

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'State Head']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — list Desk Heads & REs for config modal ──────────────────────────
  // Shows ALL matching employees (no telegram_chat_id filter) so admin can enter IDs.
  if (req.method === 'GET') {
    const whereClauses = [
      `(is_emp_working = 1 OR Status IN ('Working','Active'))`,
      ROLE_FILTER,
    ];
    const params = [];

    // State Head: restrict to own state
    if (user.role === 'State Head' && user.state) {
      whereClauses.push('State = ?');
      params.push(user.state);
    }

    // Optional branch filter from query param
    if (req.query.branch) {
      whereClauses.push('Branch = ?');
      params.push(req.query.branch);
    }

    try {
      const rows = await query(
        `SELECT pan_no, EMPNAME, Story_Type, emp_designation, Branch, State,
                COALESCE(telegram_chat_id, '') AS telegram_chat_id
         FROM \`user\`
         WHERE ${whereClauses.join(' AND ')}
         ORDER BY State, Branch, Story_Type, EMPNAME`,
        params
      );
      return res.json({ recipients: rows, total: rows.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — manually trigger delay report ──────────────────────────────────
  if (req.method === 'POST') {
    const date = req.body?.date || null;
    try {
      const result = await runDelayReport(date);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── PATCH — save telegram_chat_id for one employee ────────────────────────
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
