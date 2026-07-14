/**
 * POST /api/auth/sso-verify  — cross-app SSO check for editorialreview.patrika.com
 *
 * The newsroom sidebar opens the external app with the login token in the URL
 * hash (#pk_sso=<token>). That app posts the token here; if the signature and
 * expiry are valid it gets the user payload back and can start its own session
 * without a second login.
 *
 * Body: { token: "<jwt>" }
 * 200 → { valid: true, user: { username, role, state, branch, name, exp } }
 * 401 → { valid: false }
 */
const { verifyToken }            = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

module.exports = (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body  = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const user  = verifyToken(body.token);
  if (!user) return res.status(401).json({ valid: false });

  return res.json({ valid: true, user });
};
