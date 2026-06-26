/**
 * GET /api/alerts/email-config
 * Returns SMTP configuration status (no secrets leaked).
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');

module.exports = function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError } = requireRole(req, ['Admin', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const host = process.env.SMTP_HOST || '';
  const user_ = process.env.SMTP_USER || '';
  const from  = process.env.SMTP_FROM || user_ || '';

  return res.json({
    configured: !!(host && user_),
    host:  host  ? host          : '',
    user:  user_ ? user_         : '',
    from:  from,
    port:  process.env.SMTP_PORT || '587',
  });
};
