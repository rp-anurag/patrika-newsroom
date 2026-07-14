/**
 * HR Auto Grading — automatic marks out of 25 per employee for a month
 * GET /api/hr/grading-auto?month=YYYY-MM
 *
 * One combined score: 5 internal criteria × 5 marks each = 25 total
 * Overall % = total / 25 × 100
 *
 *   1. Stories     — daily_achievment_count_ecms (SUM No_Story in month, by Pan_no)
 *   2. Field Visits— visit_report (COUNT visits in month, by pan_no)
 *   3. QC Quality  — qc_review (SUM no_of_mistake where responsible_1/2 = user.id)
 *   4. Attendance  — hrms_data (present % of marked days, by pan_no)
 *   5. Page Delay  — gmg_raj/gmg_mpcg + page_schedule_time (avg branch delay, by user.Branch = unit)
 *
 * Scoring rules:
 *   Stories   : ≥60→5  ≥45→4  ≥30→3  ≥15→2  ≥1→1  0→0
 *   Visits    : ≥20→5  ≥15→4  ≥10→3  ≥5→2   ≥1→1  0→0
 *   QC        : 0→5   ≤2→4   ≤5→3   ≤9→2   ≤14→1  ≥15→0   (mistakes — fewer is better)
 *   Attendance: ≥95%→5 ≥90→4  ≥85→3  ≥75→2  ≥60→1  <60→0   (no HRMS data → 5, not penalized)
 *   Page Delay: ≤5m→5  ≤15→4  ≤30→3  ≤60→2  ≤90→1  >90→0   (branch avg; no editions → 5)
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

const VIEW_ROLES = ['Admin', 'HR', 'Management', 'State Head', 'Regional Editor'];

// ── Score rules ───────────────────────────────────────────────────────────────
const scoreStories = n => n >= 60 ? 5 : n >= 45 ? 4 : n >= 30 ? 3 : n >= 15 ? 2 : n >= 1 ? 1 : 0;
const scoreVisits  = n => n >= 20 ? 5 : n >= 15 ? 4 : n >= 10 ? 3 : n >= 5  ? 2 : n >= 1 ? 1 : 0;
const scoreQC      = n => n === 0 ? 5 : n <= 2 ? 4 : n <= 5 ? 3 : n <= 9 ? 2 : n <= 14 ? 1 : 0;
const scoreAttend  = p => p === null ? 5 : p >= 95 ? 5 : p >= 90 ? 4 : p >= 85 ? 3 : p >= 75 ? 2 : p >= 60 ? 1 : 0;
const scoreDelay   = m => m === null ? 5 : m <= 5 ? 5 : m <= 15 ? 4 : m <= 30 ? 3 : m <= 60 ? 2 : m <= 90 ? 1 : 0;

// Attendance types counted as "present" (P + misc-present + work-from-home/tour)
const PRESENT_TYPES = ['P', 'MP', 'WFH', 'OD', 'T', 'TL', 'SU', 'ES', 'SPL', 'WOP', 'PH', 'WOHP'];
const ABSENT_TYPES  = ['A', 'LW'];

// ── Page-delay helpers (same logic as production/delay-report) ────────────────
function isBeforePubDate230(t, pubDate) {
  if (!t || !pubDate) return false;
  const tMs   = new Date(String(t).replace('T', ' ').slice(0, 19)).getTime();
  const capMs = new Date(`${pubDate} 02:30:00`).getTime();
  return tMs < capMs;
}
function pickLatestBefore230(allTimesStr, pubDate) {
  if (!allTimesStr) return null;
  const parts = String(allTimesStr).split('|').map(s => s.trim()).filter(Boolean);
  const valid = parts.find(t => !isNaN(new Date(t).getTime()) && isBeforePubDate230(t, pubDate));
  if (valid) return new Date(valid.replace('T', ' ').slice(0, 19)).getTime();
  return new Date(`${pubDate} 02:30:00`).getTime();
}

const GMG_SQL = tbl => `
  SELECT
    LEFT(input_file, 8)                                                     AS ddmmyyyy,
    UPPER(SUBSTRING_INDEX(SUBSTRING_INDEX(input_file, '-', 2), '-', -1))    AS code,
    GROUP_CONCAT(DISTINCT date_time_pdf ORDER BY date_time_pdf DESC SEPARATOR '|')
                                                                            AS all_release_times
  FROM \`${tbl}\`
  WHERE input_file LIKE ?
    AND date_time_pdf IS NOT NULL
    AND input_file NOT LIKE '%\\_REV\\_%'
  GROUP BY ddmmyyyy, code
`;

/** Avg delay minutes per unit/branch for the month. Returns { UNIT_LOWER: avgMinutes } */
async function fetchBranchDelay(month) {
  const [yyyy, mm] = month.split('-');
  const pattern = `__${mm}${yyyy}-%`;   // input_file starts ddmmyyyy

  const [rajRows, mpcgRows, schedRows] = await Promise.all([
    query(GMG_SQL('gmg_raj'),  [pattern]).catch(() => []),
    query(GMG_SQL('gmg_mpcg'), [pattern]).catch(() => []),
    query(`SELECT UPPER(file_name) AS code, unit, schedule_time FROM page_schedule_time`).catch(() => []),
  ]);

  const schedMap = {};
  schedRows.forEach(s => { schedMap[s.code] = s; });

  const sums = {};   // unitLower -> { total, count }
  [...rajRows, ...mpcgRows].forEach(r => {
    const sched = schedMap[r.code];
    if (!sched || !sched.unit) return;

    const dd = r.ddmmyyyy.slice(0, 2), mo = r.ddmmyyyy.slice(2, 4), yr = r.ddmmyyyy.slice(4, 8);
    const pubDate = `${yr}-${mo}-${dd}`;
    if (isNaN(new Date(pubDate).getTime())) return;

    const [sh, sm]  = (sched.schedule_time || '00:00:00').split(':').map(Number);
    const schedDate = new Date(pubDate);
    if (sh >= 12) schedDate.setDate(schedDate.getDate() - 1);
    schedDate.setHours(sh, sm, 0, 0);

    const releaseMs = pickLatestBefore230(r.all_release_times, pubDate);
    const delay     = Math.max(0, Math.min(Math.round((releaseMs - schedDate.getTime()) / 60000), 149));

    const key = sched.unit.toLowerCase();
    if (!sums[key]) sums[key] = { total: 0, count: 0 };
    sums[key].total += delay;
    sums[key].count++;
  });

  const avg = {};
  Object.entries(sums).forEach(([k, v]) => { avg[k] = Math.round(v.total / v.count); });
  return avg;
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, VIEW_ROLES);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const month = req.query.month || new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(422).json({ error: 'month must be YYYY-MM' });

  const start = `${month}-01`;
  const endD  = new Date(start); endD.setMonth(endD.getMonth() + 1);
  const end   = endD.toISOString().slice(0, 10);

  try {
    const [emps, ecms, visits, qc1, qc2, attend, branchDelay] = await Promise.all([
      query(`SELECT id, pan_no, EMPNAME, Branch FROM \`user\`
             WHERE pan_no IS NOT NULL AND pan_no != ''
               AND (is_emp_working = 1 OR Status IN ('Working','Active'))`),
      query(`SELECT Pan_no AS pan, SUM(No_Story) AS stories
             FROM daily_achievment_count_ecms
             WHERE entrydate >= ? AND entrydate < ? GROUP BY Pan_no`, [start, end]).catch(() => []),
      query(`SELECT pan_no AS pan, COUNT(*) AS visits
             FROM visit_report
             WHERE visit_date >= ? AND visit_date < ? GROUP BY pan_no`, [start, end]).catch(() => []),
      query(`SELECT responsible_1 AS uid, SUM(no_of_mistake) AS mistakes
             FROM qc_review
             WHERE entrydate >= ? AND entrydate < ? AND responsible_1 > 0
             GROUP BY responsible_1`, [start, end]).catch(() => []),
      query(`SELECT responsible_2 AS uid, SUM(no_of_mistake) AS mistakes
             FROM qc_review
             WHERE entrydate >= ? AND entrydate < ? AND responsible_2 > 0
             GROUP BY responsible_2`, [start, end]).catch(() => []),
      query(`SELECT pan_no AS pan,
                    SUM(att_type IN (${PRESENT_TYPES.map(() => '?').join(',')})) AS present,
                    SUM(att_type IN (${ABSENT_TYPES.map(() => '?').join(',')}))  AS absent
             FROM hrms_data
             WHERE att_date >= ? AND att_date < ?
             GROUP BY pan_no`, [...PRESENT_TYPES, ...ABSENT_TYPES, start, end]).catch(() => []),
      fetchBranchDelay(month).catch(() => ({})),
    ]);

    const ecmsMap   = {}; ecms.forEach(r   => { ecmsMap[(r.pan || '').toUpperCase()]  = Number(r.stories) || 0; });
    const visitMap  = {}; visits.forEach(r => { visitMap[(r.pan || '').toUpperCase()] = Number(r.visits)  || 0; });
    const attendMap = {}; attend.forEach(r => { attendMap[(r.pan || '').toUpperCase()] = r; });

    const qcByUid = {};
    [...qc1, ...qc2].forEach(r => { qcByUid[r.uid] = (qcByUid[r.uid] || 0) + (Number(r.mistakes) || 0); });

    const scores = {};
    emps.forEach(e => {
      const pan = (e.pan_no || '').toUpperCase();

      const stories  = ecmsMap[pan]  || 0;
      const visitCnt = visitMap[pan] || 0;
      const mistakes = qcByUid[e.id] || 0;

      const att = attendMap[pan];
      let attendPct = null;
      if (att && (Number(att.present) + Number(att.absent)) > 0) {
        attendPct = Math.round((Number(att.present) / (Number(att.present) + Number(att.absent))) * 100);
      }

      const delayAvg = e.Branch ? (branchDelay[e.Branch.toLowerCase()] ?? null) : null;

      const s1 = scoreStories(stories);
      const s2 = scoreVisits(visitCnt);
      const s3 = scoreQC(mistakes);
      const s4 = scoreAttend(attendPct);
      const s5 = scoreDelay(delayAvg);
      const total = s1 + s2 + s3 + s4 + s5;

      scores[pan] = {
        stories, visits: visitCnt, mistakes,
        attend_pct: attendPct, delay_avg: delayAvg,
        s_stories: s1, s_visits: s2, s_qc: s3, s_attend: s4, s_delay: s5,
        total, overall_pct: Math.round((total / 25) * 100),
      };
    });

    return res.json({ month, scores });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
