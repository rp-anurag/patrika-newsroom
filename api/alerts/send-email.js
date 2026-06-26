/**
 * POST /api/alerts/send-email
 * Body: { to: [{name, email}], subject, body, html? }
 * Sends email via nodemailer using SMTP_* env vars.
 */
const nodemailer = require('nodemailer');
const { setCors, handleOptions } = require('../_lib/cors');
const { getUser }                = require('../_lib/auth');

function makeTransport() {
  const port   = parseInt(process.env.SMTP_PORT || '587', 10);
  // port 465 = SMTPS (secure from start); 587/25 = STARTTLS
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({
      error: 'SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env',
    });
  }

  const { to, subject, body } = req.body || {};

  if (!Array.isArray(to) || to.length === 0) {
    return res.status(422).json({ error: 'At least one recipient required' });
  }
  if (!subject?.trim()) {
    return res.status(422).json({ error: 'Subject is required' });
  }
  if (!body?.trim()) {
    return res.status(422).json({ error: 'Body is required' });
  }

  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transport = makeTransport();

  // Send to each recipient individually so names are shown correctly
  const results = [];
  for (const recipient of to) {
    if (!recipient.email) continue;
    try {
      await transport.sendMail({
        from:    `"Patrika Newsroom" <${fromAddr}>`,
        to:      recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email,
        subject: subject.trim(),
        text:    body.trim(),
        html:    body.trim().replace(/\n/g, '<br>'),
      });
      results.push({ email: recipient.email, ok: true });
    } catch (e) {
      results.push({ email: recipient.email, ok: false, error: e.message });
    }
  }

  const sent   = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return res.json({ ok: sent > 0, sent, failed, results });
};
