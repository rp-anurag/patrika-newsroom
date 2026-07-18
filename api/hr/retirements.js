/**
 * HR Retirements — MySQL only
 * GET /api/hr/retirements  — employees aged 58+
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

const TABLE = process.env.MYSQL_TABLE_EMPLOYEES || 'user';

function calcAge(dob) {
  if (!dob) return null;
  const parts = String(dob).split('-');
  let d;
  if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
  else                        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function retirementDate(dob) {
  if (!dob) return null;
  const parts = String(dob).split('-');
  let d;
  if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
  else                        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  if (isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 58);
  return d;
}

function retireWindow(retDate) {
  const diff = Math.ceil((retDate - new Date()) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return 'Overdue';
  if (diff <= 30) return 'This month';
  if (diff <= 60) return 'Next month';
  return `In ${Math.ceil(diff / 30)} months`;
}

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError, user } = requireRole(req, ['Admin', 'Management', 'HR', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // Role-based mandatory scope
  const where  = ['is_emp_working = 1'];
  const params = [];
  if (user.role === 'State Head' && user.state) {
    where.push('State = ?');
    params.push(user.state);
  } else if (user.role === 'Regional Editor') {
    if (user.state)  { where.push('State = ?');  params.push(user.state);  }
    if (user.branch) { where.push('Branch = ?'); params.push(user.branch); }
  }

  try {
    const rows = await query(
      `SELECT EMP_CODE, EMPNAME, DOB, emp_deptt, Branch, Location, State, is_emp_working
       FROM \`${TABLE}\` WHERE ${where.join(' AND ')}`,
      params
    );

    const near = rows
      .map(emp => {
        const age     = calcAge(emp.DOB);
        const retDate = retirementDate(emp.DOB);
        if (!age || age < 58 || !retDate) return null;
        return { ...emp, age, retireOn: retDate.toISOString().split('T')[0], window: retireWindow(retDate) };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.retireOn) - new Date(b.retireOn));

    return res.json(near);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
