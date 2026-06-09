/**
 * Shared Telegram helper — wraps Telegram Bot API calls.
 * Used by: cron jobs, manual trigger endpoints, alert system.
 */
const https = require('https');

/**
 * POST to Telegram Bot API.
 * @param {string} token  Bot token from TELEGRAM_BOT_TOKEN env
 * @param {string} method Telegram method e.g. 'sendMessage'
 * @param {object} body   Request body
 */
function tgPost(token, method, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path:     `/bot${token}/${method}`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (r) => {
      let data = '';
      r.on('data', d => (data += d));
      r.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from Telegram')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send a plain HTML message to a single chat_id.
 * Returns Telegram API response.
 */
async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token)  throw new Error('TELEGRAM_BOT_TOKEN not configured in .env');
  if (!chatId) throw new Error('chatId is required');
  return tgPost(token, 'sendMessage', {
    chat_id:    String(chatId).trim(),
    text,
    parse_mode: 'HTML',
  });
}

module.exports = { tgPost, sendMessage };
