/**
 * HR Sanctioned Posts — MySQL only
 * GET  /api/hr/sanctioned-posts        — list all sanctioned posts
 * POST /api/hr/sanctioned-posts        — upsert a sanctioned post (unique: profile)
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'HR', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      return res.json(await query('SELECT * FROM hr_sanctioned_posts ORDER BY profile ASC'));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — upsert sanctioned count ───────────────────────────────────────
  if (req.method === 'POST') {
    if (!['Admin', 'HR'].includes(user.role))
      return res.status(403).json({ error: 'Forbidden' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!body.profile) return res.status(422).json({ error: 'profile is required' });

    const { profile, department, sanctioned_count, min_salary, max_salary } = body;
    // Scope: '' = company-wide; unique key is (profile, state, branch)
    const state  = (body.state  && body.state  !== 'All') ? body.state  : '';
    const branch = (body.branch && body.branch !== 'All') ? body.branch : '';

    try {
      await query(
        `INSERT INTO hr_sanctioned_posts
           (profile, department, state, branch, sanctioned_count, min_salary, max_salary)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           department      = VALUES(department),
           sanctioned_count= VALUES(sanctioned_count),
           min_salary      = VALUES(min_salary),
           max_salary      = VALUES(max_salary)`,
        [profile, department || null, state, branch,
         sanctioned_count || 0, min_salary || null, max_salary || null]
      );
      const [row] = await query(
        'SELECT * FROM hr_sanctioned_posts WHERE profile = ? AND state = ? AND branch = ?',
        [profile, state, branch]
      );
      return res.status(201).json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
