'use strict';
/**
 * GET /api/hr/grading-top?state=X&branch=Y
 *
 * Returns top-3 and worst-3 employees for the previous calendar month,
 * ranked by the same combined score shown in the HR Grading tab:
 *   - Manual grades (work + behaviour + discipline + interest, each 0-5, max 20)
 *   - Auto scores  (stories + visits + QC + attendance + delay, each 0-5, max 25)
 *   Combined %: (manualSum + autoTotal) / 45 × 100
 *   Manual-only: manualSum / 20 × 100
 *   Auto-only:   autoTotal / 25 × 100
 *
 * Only employees who have at least a manual grade OR have auto-score data are ranked.
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

const VIEW_ROLES = ['Admin', 'HR', 'Management', 'State Head', 'Regional Editor'];

// ── Auto-score helpers (mirror of grading-auto.js) ───────────────────────────
const scoreStories = n => n >= 60 ? 5 : n >= 45 ? 4 : n >= 30 ? 3 : n >= 15 ? 2 : n >= 1 ? 1 : 0;
const scoreVisits  = n => n >= 20 ? 5 : n >= 15 ? 4 : n >= 10 ? 3 : n >= 5  ? 2 : n >= 1 ? 1 : 0;
const scoreQC      = n => n === 0 ? 5 : n <= 2 ? 4 : n <= 5 ? 3 : n <= 9 ? 2 : n <= 14 ? 1 : 0;
const scoreAttend  = p => p === null ? 5 : p >= 95 ? 5 : p >= 90 ? 4 : p >= 85 ? 3 : p >= 75 ? 2 : p >= 60 ? 1 : 0;
const scoreDelay   = m => m === null ? 5 : m <= 5 ? 5 : m <= 15 ? 4 : m <= 30 ? 3 : m <= 60 ? 2 : m <= 90 ? 1 : 0;

const PRESENT_TYPES = ['P', 'MP', 'WFH', 'OD', 'T', 'TL', 'SU', 'ES', 'SPL', 'WOP', 'PH', 'WOHP'];
const ABSENT_TYPES  = ['A', 'LW'];

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
    LEFT(input_file, 8) AS ddmmyyyy,
    UPPER(SUBSTRING_INDEX(SUBSTRING_INDEX(input_file, '-', 2), '-', -1)) AS code,
    GROUP_CONCAT(DISTINCT date_time_pdf ORDER BY date_time_pdf DESC SEPARATOR '|') AS all_release_times
  FROM \`${tbl}\`
  WHERE input_file LIKE ? AND date_time_pdf IS NOT NULL AND input_file NOT LIKE '%\\_REV\\_%'
  GROUP BY ddmmyyyy, code
`;

async function fetchBranchDelay(month) {
  const [yyyy, mm] = month.split('-');
  const pattern = `__${mm}${yyyy}-%`;
  const [rajRows, mpcgRows, schedRows] = await Promise.all([
    query(GMG_SQL('gmg_raj'),  [pattern]).catch(() => []),
    query(GMG_SQL('gmg_mpcg'), [pattern]).catch(() => []),
    query(`SELECT UPPER(file_name) AS code, unit, schedule_time FROM page_schedule_time`).catch(() => []),
  ]);
  const schedMap = {};
  schedRows.forEach(s => { schedMap[s.code] = s; });
  const sums = {};
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
    const delay = Math.max(0, Math.min(Math.round((releaseMs - schedDate.getTime()) / 60000), 149));
    const key = sched.unit.toLowerCase();
    if (!sums[key]) sums[key] = { total: 0, count: 0 };
    sums[key].total += delay; sums[key].count++;
  });
  const avg = {};
  Object.entries(sums).forEach(([k, v]) => { avg[k] = Math.round(v.total / v.count); });
  return avg;
}

// ── Previous month helper ─────────────────────────────────────────────────────
function prevMonth() {
  const now = new Date(Date.now() + 5.5 * 36e5); // IST
  now.setDate(1);
  now.setMonth(now.getMonth() - 1);
  return now.toISOString().slice(0, 7); // YYYY-MM
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, VIEW_ROLES);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const month  = prevMonth();
  const state  = (req.query.state  || '').trim();
  const branch = (req.query.branch || '').trim();

  const start = `${month}-01`;
  const endD  = new Date(start); endD.setMonth(endD.getMonth() + 1);
  const end   = endD.toISOString().slice(0, 10);

  try {
    // Build employee filter for state/branch
    const empWhere  = [`pan_no IS NOT NULL AND pan_no != ''`,
                       `(is_emp_working = 1 OR Status IN ('Working','Active'))`];
    const empParams = [];
    if (state  && state  !== 'All') { empWhere.push('State = ?');  empParams.push(state);  }
    if (branch && branch !== 'All') { empWhere.push('Branch = ?'); empParams.push(branch); }

    // 1. Employees
    const emps = await query(
      `SELECT id, pan_no, EMPNAME, Branch, Story_Type, profile FROM \`user\` WHERE ${empWhere.join(' AND ')}`,
      empParams
    );

    // 2. Manual grades for previous month (scoped to same state/branch)
    const gradingWhere  = ['month = ?'];
    const gradingParams = [month];
    if (state  && state  !== 'All') { gradingWhere.push('state = ?');  gradingParams.push(state);  }
    if (branch && branch !== 'All') { gradingWhere.push('branch = ?'); gradingParams.push(branch); }
    const gradingRows = await query(
      `SELECT pan, work_grade, behaviour_grade, discipline_grade, interest_grade, pli_percent
       FROM hr_grading WHERE ${gradingWhere.join(' AND ')}`,
      gradingParams
    ).catch(() => []);

    const gradingMap = {};
    gradingRows.forEach(r => { gradingMap[(r.pan || '').toUpperCase()] = r; });

    // 3. Auto scores data
    const [ecms, visits, qc1, qc2, attend, branchDelay] = await Promise.all([
      query(`SELECT Pan_no AS pan, SUM(No_Story) AS stories FROM daily_achievment_count_ecms
             WHERE entrydate >= ? AND entrydate < ? GROUP BY Pan_no`, [start, end]).catch(() => []),
      query(`SELECT pan_no AS pan, COUNT(*) AS visits FROM visit_report
             WHERE visit_date >= ? AND visit_date < ? GROUP BY pan_no`, [start, end]).catch(() => []),
      query(`SELECT responsible_1 AS uid, SUM(no_of_mistake) AS mistakes FROM qc_review
             WHERE entrydate >= ? AND entrydate < ? AND responsible_1 > 0 GROUP BY responsible_1`, [start, end]).catch(() => []),
      query(`SELECT responsible_2 AS uid, SUM(no_of_mistake) AS mistakes FROM qc_review
             WHERE entrydate >= ? AND entrydate < ? AND responsible_2 > 0 GROUP BY responsible_2`, [start, end]).catch(() => []),
      query(`SELECT pan_no AS pan,
                    SUM(att_type IN (${PRESENT_TYPES.map(() => '?').join(',')})) AS present,
                    SUM(att_type IN (${ABSENT_TYPES.map(() => '?').join(',')})) AS absent
             FROM hrms_data WHERE att_date >= ? AND att_date < ? GROUP BY pan_no`,
            [...PRESENT_TYPES, ...ABSENT_TYPES, start, end]).catch(() => []),
      fetchBranchDelay(month).catch(() => ({})),
    ]);

    const ecmsMap   = {}; ecms.forEach(r   => { ecmsMap[(r.pan   || '').toUpperCase()] = Number(r.stories) || 0; });
    const visitMap  = {}; visits.forEach(r => { visitMap[(r.pan  || '').toUpperCase()] = Number(r.visits)  || 0; });
    const attendMap = {}; attend.forEach(r => { attendMap[(r.pan || '').toUpperCase()] = r; });
    const qcByUid   = {};
    [...qc1, ...qc2].forEach(r => { qcByUid[r.uid] = (qcByUid[r.uid] || 0) + (Number(r.mistakes) || 0); });

    // 4. Combine scores
    const ranked = emps.map(e => {
      const pan = (e.pan_no || '').toUpperCase();

      // Manual grades
      const g = gradingMap[pan];
      const hasManual = g && [g.work_grade, g.behaviour_grade, g.discipline_grade, g.interest_grade]
        .some(v => v !== null && v !== undefined && v !== '');
      const manualSum = hasManual
        ? [g.work_grade, g.behaviour_grade, g.discipline_grade, g.interest_grade]
            .map(v => (v !== null && v !== undefined && v !== '') ? Number(v) : 0)
            .reduce((a, b) => a + b, 0)
        : 0;

      // Auto scores
      const stories  = ecmsMap[pan]  || 0;
      const visitCnt = visitMap[pan] || 0;
      const mistakes = qcByUid[e.id] || 0;
      const att = attendMap[pan];
      let attendPct = null;
      if (att && (Number(att.present) + Number(att.absent)) > 0)
        attendPct = Math.round((Number(att.present) / (Number(att.present) + Number(att.absent))) * 100);
      const delayAvg = e.Branch ? (branchDelay[e.Branch.toLowerCase()] ?? null) : null;
      const autoTotal = scoreStories(stories) + scoreVisits(visitCnt) + scoreQC(mistakes)
                      + scoreAttend(attendPct) + scoreDelay(delayAvg);

      // Combined %
      let combinedPct;
      if (hasManual) {
        combinedPct = Math.round((manualSum + autoTotal) / 45 * 100);
      } else {
        combinedPct = Math.round(autoTotal / 25 * 100);
      }

      const storyType = e.Story_Type === 'NE' ? (e.profile || 'NE') : (e.Story_Type || '—');

      return {
        pan,
        name:         e.EMPNAME,
        branch:       e.Branch || '—',
        story_type:   storyType,
        pli_percent:  g ? (g.pli_percent ?? null) : null,
        manual_pct:   hasManual ? Math.round(manualSum / 20 * 100) : null,
        auto_pct:     Math.round(autoTotal / 25 * 100),
        combined_pct: combinedPct,
        has_manual:   hasManual,
      };
    }).filter(e => e.has_manual || e.auto_pct > 0); // only include if data exists

    ranked.sort((a, b) => b.combined_pct - a.combined_pct);

    return res.json({
      month,
      top3:   ranked.slice(0, 3),
      worst3: ranked.slice(-3).reverse(),
      total:  ranked.length,
    });
  } catch (err) {
    console.error('[grading-top]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
