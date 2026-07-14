/**
 * HR PLI & Grading — MySQL only
 * GET  /api/hr/grading?month=YYYY-MM  — list grading for a month (role-scoped)
 * POST /api/hr/grading                — upsert grading (unique: pan + month)
 *
 * Role scoping:
 *   Admin / HR / Management → see & edit all gradings
 *   State Head              → see all gradings in their state; can add/edit their employees
 *   Regional Editor         → see gradings in their state + branch (read-only)
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

const VIEW_ROLES = ['Admin', 'HR', 'Management', 'State Head', 'Regional Editor'];
const EDIT_ROLES = ['Admin', 'HR', 'State Head', 'Regional Editor'];

// Scores are numeric 0-5; overall = sum / 20 * 100 (%)
// Denominator is always 20 (4 criteria × 5 max each)
function calcOverall(w, b, d, i) {
  const vals = [w, b, d, i]
    .filter(v => v !== null && v !== undefined && v !== '')  // exclude empty BEFORE Number()
    .map(v => Number(v))
    .filter(v => !isNaN(v) && v >= 0 && v <= 5);
  if (!vals.length) return null;
  const sum = vals.reduce((a, v) => a + v, 0);
  return Math.round((sum / 20) * 100); // e.g. 4+4+4+4 = 16/20 = 80%
}

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, VIEW_ROLES);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const where  = ['month = ?'];
    const params = [month];

    // Role-based mandatory scope
    if (user.role === 'State Head' && user.state) {
      where.push('state = ?');
      params.push(user.state);
    } else if (user.role === 'Regional Editor') {
      if (user.state)  { where.push('state = ?');  params.push(user.state);  }
      if (user.branch) { where.push('branch = ?'); params.push(user.branch); }
    }

    try {
      const rows = await query(
        `SELECT * FROM hr_grading WHERE ${where.join(' AND ')} ORDER BY emp_name ASC`,
        params
      );
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — upsert grading ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!EDIT_ROLES.includes(user.role))
      return res.status(403).json({ error: 'Forbidden — only Admin, HR or State Head can grade' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!body.pan || !body.month)
      return res.status(422).json({ error: 'pan and month are required' });

    const {
      pan, emp_code, emp_name, month,
      work_grade, behaviour_grade, discipline_grade, interest_grade,
      pli_percent, remarks, state, branch,
      overall_grade: overall_grade_from_client,
    } = body;

    const overall_grade = calcOverall(work_grade, behaviour_grade, discipline_grade, interest_grade);
    // overall_pct = combined % sent by the frontend (manual+auto)/45*100 — more accurate than server-computed
    const overall_pct = overall_grade_from_client != null
      ? Math.min(100, Math.max(0, Math.round(Number(overall_grade_from_client))))
      : overall_grade;

    // Role-based scope enforcement: State Head → own state; Regional Editor → own state + branch
    if (user.role === 'State Head' && user.state && state && state !== user.state) {
      return res.status(403).json({ error: 'You can only grade employees in your assigned state' });
    }
    if (user.role === 'Regional Editor') {
      if (user.state  && state  && state  !== user.state)  return res.status(403).json({ error: 'You can only grade employees in your assigned state' });
      if (user.branch && branch && branch !== user.branch) return res.status(403).json({ error: 'You can only grade employees in your assigned branch' });
    }

    try {
      await query(
        `INSERT INTO hr_grading
           (pan, emp_code, emp_name, month, work_grade, behaviour_grade,
            discipline_grade, interest_grade, overall_grade, overall_pct,
            pli_percent, remarks, state, branch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           emp_code         = VALUES(emp_code),
           emp_name         = VALUES(emp_name),
           work_grade       = VALUES(work_grade),
           behaviour_grade  = VALUES(behaviour_grade),
           discipline_grade = VALUES(discipline_grade),
           interest_grade   = VALUES(interest_grade),
           overall_grade    = VALUES(overall_grade),
           overall_pct      = VALUES(overall_pct),
           pli_percent      = VALUES(pli_percent),
           remarks          = VALUES(remarks),
           state            = COALESCE(VALUES(state), state),
           branch           = COALESCE(VALUES(branch), branch),
           updated_at       = NOW()`,
        [
          pan, emp_code || null, emp_name || null, month,
          work_grade || null, behaviour_grade || null,
          discipline_grade || null, interest_grade || null,
          overall_grade, overall_pct,
          pli_percent || null, remarks || null,
          state || null, branch || null,
        ]
      );
      const [row] = await query(
        'SELECT * FROM hr_grading WHERE pan = ? AND month = ?',
        [pan, month]
      );
      return res.status(201).json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
