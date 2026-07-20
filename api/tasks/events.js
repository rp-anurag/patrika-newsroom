/**
 * Major Event Planning & Implementation — print-media newsroom
 *
 * Regional Editor submits an event plan → State Head / Admin review and approve.
 * RE tracks implementation via checklist during/after the event.
 *
 * GET  /api/tasks/events              — list events (role-scoped)
 * POST /api/tasks/events              — RE: create / update own event plan
 *   Body: { id?, event_name, event_type, event_start, event_end, location,
 *           planning_notes, staffing_plan, resources, checklist: [{title, due, assignee, done}] }
 * POST /api/tasks/events  (review)    — SH/Admin: approve / reject + remarks
 *   Body: { id, review: true, review_comment, status: 'approved'|'rejected' }
 * POST /api/tasks/events  (progress)  — RE: update checklist item
 *   Body: { id, progress: true, checklist: [...] }
 */
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

let tableReady = false;
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS major_event_plans (
      id                INT          AUTO_INCREMENT PRIMARY KEY,
      event_name        VARCHAR(255) NOT NULL DEFAULT '',
      event_type        VARCHAR(100) NOT NULL DEFAULT '',
      event_start       DATE         DEFAULT NULL,
      event_end         DATE         DEFAULT NULL,
      location          VARCHAR(255) DEFAULT '',
      state             VARCHAR(100) NOT NULL DEFAULT '',
      branch            VARCHAR(100) NOT NULL DEFAULT '',
      submitted_by      VARCHAR(100) NOT NULL DEFAULT '',
      submitted_by_name VARCHAR(255) NOT NULL DEFAULT '',
      submitted_role    VARCHAR(50)  NOT NULL DEFAULT '',
      planning_notes    TEXT,
      staffing_plan     TEXT,
      resources         TEXT,
      checklist         MEDIUMTEXT,
      status            VARCHAR(30)  NOT NULL DEFAULT 'submitted',
      review_comment    TEXT,
      reviewed_by       VARCHAR(100) DEFAULT NULL,
      reviewed_by_name  VARCHAR(255) DEFAULT NULL,
      reviewed_at       DATETIME     DEFAULT NULL,
      created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tableReady = true;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor', 'HR', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  if (!tableReady) await ensureTable();

  // ── Role scope ────────────────────────────────────────────────────────────
  const isRE    = user.role === 'Regional Editor';
  const isSH    = user.role === 'State Head';
  const isAdmin = user.role === 'Admin' || user.role === 'Management';

  const fState  = isSH || isRE ? (user.state  || '') : '';
  const fBranch = isRE          ? (user.branch || '') : '';

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const where = ['1=1'];
    const params = [];
    if (fState)  { where.push('state = ?');  params.push(fState); }
    if (fBranch) { where.push('branch = ?'); params.push(fBranch); }
    // Admin/Management: apply global selector from query params
    if (isAdmin) {
      if (req.query.state  && req.query.state  !== 'All') { where.push('state = ?');  params.push(req.query.state); }
      if (req.query.branch && req.query.branch !== 'All') { where.push('branch = ?'); params.push(req.query.branch); }
    }

    const rows = await query(
      `SELECT * FROM major_event_plans WHERE ${where.join(' AND ')} ORDER BY event_start DESC, created_at DESC`,
      params
    ).catch(e => { console.error('[events GET]', e.message); return []; });

    return res.json({ events: rows.map(parseRow) });
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = {};
  try {
    const raw = await new Promise((resolve, reject) => {
      let d = '';
      req.on('data', c => { d += c; });
      req.on('end', () => resolve(d));
      req.on('error', reject);
    });
    body = JSON.parse(raw || '{}');
  } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  // ── Review (Admin/SH only) ────────────────────────────────────────────────
  if (body.review) {
    if (!isAdmin && !isSH) return res.status(403).json({ error: 'Only Admin or State Head can review events' });
    if (!body.id) return res.status(400).json({ error: 'id required' });
    const newStatus = ['approved','rejected','in_progress','completed'].includes(body.status) ? body.status : 'approved';
    await query(
      `UPDATE major_event_plans
       SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [newStatus, body.review_comment || '', user.pan_no || user.username || '', user.name || '', body.id]
    );
    return res.json({ ok: true });
  }

  // ── Checklist progress update (RE updates their own) ─────────────────────
  if (body.progress) {
    if (!body.id) return res.status(400).json({ error: 'id required' });
    const [existing] = await query('SELECT submitted_by, branch FROM major_event_plans WHERE id = ?', [body.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (isRE && existing.branch !== fBranch) return res.status(403).json({ error: 'Not your event' });
    await query(
      'UPDATE major_event_plans SET checklist = ? WHERE id = ?',
      [JSON.stringify(body.checklist || []), body.id]
    );
    return res.json({ ok: true });
  }

  // ── Create / Update plan (RE) ────────────────────────────────────────────
  const {
    id, event_name, event_type, event_start, event_end,
    location, planning_notes, staffing_plan, resources, checklist,
  } = body;

  if (!event_name) return res.status(400).json({ error: 'event_name required' });

  const pan  = user.pan_no || user.username || '';
  const name = user.name || '';
  const role = user.role || '';
  const st   = isRE ? fState : (body.state || fState);
  const br   = isRE ? fBranch : (body.branch || fBranch);
  const checklistJson = JSON.stringify(checklist || []);

  if (id) {
    const [existing] = await query('SELECT submitted_by, branch FROM major_event_plans WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (isRE && existing.branch !== fBranch) return res.status(403).json({ error: 'Not your event' });
    await query(
      `UPDATE major_event_plans
       SET event_name=?, event_type=?, event_start=?, event_end=?, location=?,
           planning_notes=?, staffing_plan=?, resources=?, checklist=?, status='submitted'
       WHERE id = ?`,
      [event_name, event_type||'', event_start||null, event_end||null, location||'',
       planning_notes||'', staffing_plan||'', resources||'', checklistJson, id]
    );
    return res.json({ ok: true, id });
  }

  const result = await query(
    `INSERT INTO major_event_plans
     (event_name, event_type, event_start, event_end, location, state, branch,
      submitted_by, submitted_by_name, submitted_role,
      planning_notes, staffing_plan, resources, checklist, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted')`,
    [event_name, event_type||'', event_start||null, event_end||null, location||'',
     st, br, pan, name, role,
     planning_notes||'', staffing_plan||'', resources||'', checklistJson]
  );
  return res.json({ ok: true, id: result.insertId });
};

function parseRow(r) {
  let checklist = [];
  try { checklist = JSON.parse(r.checklist || '[]'); } catch {}
  return { ...r, checklist };
}
