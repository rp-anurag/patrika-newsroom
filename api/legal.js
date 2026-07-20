const { query }      = require('./_lib/mysql');
const { requireRole } = require('./_lib/auth');
const { setCors, handleOptions } = require('./_lib/cors');

const VIEW_ROLES = ['Admin', 'State Head', 'Legal'];
const EDIT_ROLES = ['Admin', 'Legal'];

const MOCK = [
  { id:1, case_no:'CIV/2025/118', edition:'Jaipur',  court:'Rajasthan HC',   party:'State vs Patrika', hearing:'2026-05-28', status:'Active',       risk:'High',   advocate:'Adv. S. Mehta', notes:'' },
  { id:2, case_no:'DEF/2024/77',  edition:'Kota',    court:'District Court',  party:'XYZ Builders',     hearing:'2026-06-04', status:'Pending Docs', risk:'Medium', advocate:'Adv. R. Gupta', notes:'' },
  { id:3, case_no:'CIV/2026/04',  edition:'Indore',  court:'MP HC',           party:'ABC Trust',        hearing:'2026-05-22', status:'Active',       risk:'Low',    advocate:'Adv. N. Iyer',  notes:'' },
];

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  // ── GET /api/legal ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { authError } = requireRole(req, VIEW_ROLES);
    if (authError) return res.status(authError.status).json({ error: authError.message });

    const edition      = req.query?.edition || '';
    const filterState  = req.query?.state  && req.query.state  !== 'All' ? req.query.state  : '';
    const filterBranch = req.query?.branch && req.query.branch !== 'All' ? req.query.branch : '';
    try {
      const conds = [];
      const vals  = [];
      if (edition && edition !== 'All') { conds.push('edition = ?'); vals.push(edition); }
      if (filterState)  { conds.push('edition IN (SELECT DISTINCT Branch FROM `user` WHERE State = ?)'); vals.push(filterState); }
      if (filterBranch) { conds.push('edition = ?'); vals.push(filterBranch); }
      const sql = 'SELECT * FROM legal_cases' + (conds.length ? ' WHERE ' + conds.join(' AND ') : '') + ' ORDER BY hearing ASC';
      const rows = await query(sql, vals);
      return res.status(200).json(rows);
    } catch (err) {
      console.warn('[legal GET] DB error, using mock:', err.message);
      return res.status(200).json(MOCK);
    }
  }

  // ── POST /api/legal ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { authError } = requireRole(req, EDIT_ROLES);
    if (authError) return res.status(authError.status).json({ error: authError.message });

    const body = req.body || {};
    const required = ['case_no','court','party','advocate','hearing','status','risk'];
    for (const f of required) {
      if (!String(body[f] || '').trim())
        return res.status(422).json({ error: `Field '${f}' is required` });
    }

    const d = {
      case_no:   body.case_no.trim(),
      edition:   (body.edition  || '').trim(),
      court:     body.court.trim(),
      party:     body.party.trim(),
      advocate:  body.advocate.trim(),
      hearing:   body.hearing.trim(),
      status:    body.status.trim(),
      risk:      body.risk.trim(),
      state:     (body.state     || '').trim(),
      branch:    (body.branch    || '').trim(),
      documents: (body.documents || '').trim(),
      notes:     (body.notes     || '').trim(),
    };

    try {
      await query(`
        INSERT INTO legal_cases (case_no, edition, court, party, advocate, hearing, status, risk, state, branch, documents, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          edition=VALUES(edition), court=VALUES(court), party=VALUES(party),
          advocate=VALUES(advocate), hearing=VALUES(hearing), status=VALUES(status),
          risk=VALUES(risk), state=VALUES(state), branch=VALUES(branch),
          documents=VALUES(documents), notes=VALUES(notes)
      `, [d.case_no, d.edition, d.court, d.party, d.advocate, d.hearing, d.status, d.risk, d.state, d.branch, d.documents, d.notes]);
      return res.status(200).json({ ok: true, case: d });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Database error: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
