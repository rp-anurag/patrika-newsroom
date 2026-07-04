/**
 * GET  /api/pages/home-office-alert        — fetch alert logs (Admin only)
 * POST /api/pages/home-office-alert        — manually trigger alert (Admin only)
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');
const { run }                    = require('./home-office-visit-alert');

const ENSURE = `
  CREATE TABLE IF NOT EXISTS home_office_visit_alert_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    re_name      VARCHAR(200) DEFAULT NULL,
    branch       VARCHAR(200) DEFAULT NULL,
    state        VARCHAR(100) DEFAULT NULL,
    chat_id      VARCHAR(100) DEFAULT NULL,
    visit_date   DATE         DEFAULT NULL,
    reporter_list TEXT        DEFAULT NULL,
    home_cnt     INT          DEFAULT 0,
    office_cnt   INT          DEFAULT 0,
    status       ENUM('sent','failed') DEFAULT 'failed',
    error_msg    TEXT         DEFAULT NULL,
    triggered_by VARCHAR(20)  DEFAULT 'cron',
    sent_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, ['Admin', 'State Head', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — return logs ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    await query(ENSURE).catch(() => {});
    try {
      const logs = await query(`
        SELECT id, re_name, branch, state, visit_date, reporter_list,
               home_cnt, office_cnt, status, error_msg, triggered_by,
               DATE_FORMAT(CONVERT_TZ(sent_at, '+00:00', '+05:30'), '%d-%b-%Y %H:%i') AS sent_at
        FROM home_office_visit_alert_logs
        ORDER BY sent_at DESC
        LIMIT 300
      `);
      return res.json({ logs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — manually trigger (Admin only) ─────────────────────────────────────
  if (req.method === 'POST') {
    const { authError: adminErr } = requireRole(req, ['Admin']);
    if (adminErr) return res.status(403).json({ error: 'Only Admin can trigger alerts' });
    const { date } = req.body || {};
    try {
      const result = await run('manual', date || null);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
