/**
 * GET /api/dashboard/qc-detail?days=7
 * Returns last N days of qc_review rows with photo_url for the dashboard modal.
 */
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError } = requireRole(req, ['Admin', 'State Head', 'Regional Editor', 'HR', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const toIST = ms => new Date(ms + 5.5 * 3600000).toISOString().slice(0, 10);
  const days  = Math.min(Number(req.query.days) || 7, 30);
  const from  = toIST(Date.now() - days * 864e5);
  const to    = toIST(Date.now() - 864e5);

  try {
    const rows = await query(`
      SELECT id, DATE_FORMAT(entrydate,'%Y-%m-%d') AS date,
             state, edition, pullout, category, severity,
             mistake, no_of_mistake, responsible_1, responsible_2,
             re_remark, photo_url
      FROM qc_review
      WHERE entrydate BETWEEN ? AND ?
      ORDER BY entrydate DESC, id DESC
      LIMIT 300
    `, [from, to]);

    const items = rows.map(r => ({
      id:            r.id,
      date:          r.date,
      state:         r.state         || '',
      edition:       r.edition       || '',
      pullout:       r.pullout       || '',
      category:      r.category      || '',
      severity:      (r.severity     || '').toLowerCase(),
      mistake:       r.mistake       || '',
      mistakes:      Number(r.no_of_mistake || 1),
      responsible_1: r.responsible_1 || '',
      responsible_2: r.responsible_2 || '',
      remark:        r.re_remark     || '',
      photo_url:     r.photo_url     || null,
    }));

    // Sort: high → medium → low, then by date desc within each severity
    items.sort((a, b) => {
      const so = (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
      if (so !== 0) return so;
      return b.date.localeCompare(a.date);
    });

    return res.json({ from, to, total: items.length, items });
  } catch (err) {
    console.error('[dashboard/qc-detail]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
