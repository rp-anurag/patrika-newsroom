/**
 * GET /api/hr/leaves?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Person-wise leave register from hrms_data.
 * Returns every non-present record in the date range with employee info.
 *
 * Response: { rows: [{pan, name, branch, state, leaves: [{date, type}]}], types, summary }
 */
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

// Same as grading-auto.js — records with these types are "on duty"
const PRESENT_TYPES = ['P', 'MP', 'WFH', 'OD', 'T', 'TL', 'SU', 'ES', 'SPL', 'WOP', 'PH', 'WOHP', 'H', 'WO', 'A', 'CF'];

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor', 'HR', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const toIST = ms => new Date(ms + 5.5 * 3600000).toISOString().slice(0, 10);
  const todayStr = toIST(Date.now());

  // Default to last 7 days
  let start = req.query.start || toIST(Date.now() - 7 * 864e5);
  let end   = req.query.end   || toIST(Date.now() - 864e5);

  // Clamp to reasonable range (max 92 days)
  const startMs = new Date(start).getTime(), endMs = new Date(end).getTime();
  if (isNaN(startMs) || isNaN(endMs)) return res.status(400).json({ error: 'Invalid date range' });
  if (endMs - startMs > 92 * 864e5) start = toIST(endMs - 92 * 864e5);

  // Role scope
  let fState  = '';
  let fBranch = '';
  if (user.role === 'State Head' || user.role === 'Regional Editor') fState  = user.state  || '';
  if (user.role === 'Regional Editor')                               fBranch = user.branch || '';

  // Allow explicit override for Admin/HR/Management
  const qState  = req.query.state  && req.query.state  !== 'All' ? req.query.state  : '';
  const qBranch = req.query.branch && req.query.branch !== 'All' ? req.query.branch : '';
  if (!fState)  fState  = qState;
  if (!fBranch) fBranch = qBranch;

  const notInClause = PRESENT_TYPES.map(() => '?').join(',');

  // Build user filter
  const userWhere  = ['(u.is_emp_working = 1 OR u.Status IN (\'Working\',\'Active\'))'];
  const userParams = [];
  if (fState)  { userWhere.push('u.State = ?');  userParams.push(fState);  }
  if (fBranch) { userWhere.push('u.Branch = ?'); userParams.push(fBranch); }

  try {
    const rows = await query(`
      SELECT
        h.pan_no                                     AS pan,
        DATE_FORMAT(h.att_date, '%Y-%m-%d')          AS att_date,
        UPPER(TRIM(h.att_type))                      AS att_type,
        u.EMPNAME                                    AS name,
        u.Branch                                     AS branch,
        u.State                                      AS state,
        u.Story_Type                                 AS story_type,
        u.emp_designation                            AS designation
      FROM hrms_data h
      JOIN \`user\` u ON UPPER(TRIM(u.pan_no)) = UPPER(TRIM(h.pan_no))
      WHERE h.att_date BETWEEN ? AND ?
        AND UPPER(TRIM(h.att_type)) NOT IN (${notInClause})
        AND ${userWhere.join(' AND ')}
      ORDER BY h.att_date ASC, u.EMPNAME ASC
    `, [start, end, ...PRESENT_TYPES.map(t => t.toUpperCase()), ...userParams]);

    // Group by employee
    const empMap = {};
    const typeSet = new Set();

    rows.forEach(r => {
      const key = (r.pan || '').toUpperCase();
      if (!empMap[key]) {
        empMap[key] = {
          pan:         key,
          name:        r.name        || 'Unknown',
          branch:      r.branch      || '',
          state:       r.state       || '',
          story_type:  r.story_type  || '',
          designation: r.designation || '',
          leaves: [],
          byType: {},
        };
      }
      const type = r.att_type || 'UNKNOWN';
      typeSet.add(type);
      empMap[key].leaves.push({ date: r.att_date, type });
      empMap[key].byType[type] = (empMap[key].byType[type] || 0) + 1;
    });

    const employees = Object.values(empMap).sort((a, b) => b.leaves.length - a.leaves.length);
    const types = [...typeSet].sort();

    // Summary
    const totalDays = rows.length;
    const uniqueEmps = employees.length;
    const typeSummary = {};
    types.forEach(t => {
      typeSummary[t] = rows.filter(r => r.att_type === t).length;
    });

    return res.json({
      start, end,
      employees,
      types,
      summary: { totalDays, uniqueEmps, byType: typeSummary },
    });
  } catch (err) {
    console.error('[hr/leaves]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
