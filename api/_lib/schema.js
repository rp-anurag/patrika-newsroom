/**
 * Lightweight schema-migration helpers.
 *
 * Usage:
 *   const { ensureColumn } = require('./_lib/schema');
 *   const ok = await ensureColumn('users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
 *
 * Behaviour:
 *  1. Checks information_schema first — no ALTER needed if column already exists.
 *  2. If missing, tries ALTER TABLE ADD COLUMN.
 *  3. Results are cached for the process lifetime (one DB round-trip max).
 *  4. Returns true when the column is ready, false when it could not be added.
 */

const { query } = require('./mysql');

// Cache: "<table>.<column>" → true | false
const _ready = {};

/**
 * Ensure a column exists in the given table.
 *
 * @param {string} table   - Table name (unquoted)
 * @param {string} column  - Column name
 * @param {string} colDef  - Column definition  e.g. "TINYINT(1) NOT NULL DEFAULT 1"
 * @returns {Promise<boolean>}  true = column is usable, false = could not add it
 */
async function ensureColumn(table, column, colDef) {
  const key = `${table}.${column}`;
  if (key in _ready) return _ready[key];

  try {
    // Check information_schema — works on all MySQL/RDS accounts without ALTER privilege
    const rows = await query(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = ?
         AND COLUMN_NAME  = ?
       LIMIT 1`,
      [table, column]
    );

    if (rows.length) {
      // Column already exists — no migration needed
      _ready[key] = true;
      return true;
    }

    // Column is missing — try to add it
    await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${colDef}`);
    console.log(`[schema] Added column ${table}.${column}`);
    _ready[key] = true;
    return true;
  } catch (e) {
    // Catch concurrent-add race: both callers saw "missing", one succeeded
    if (e.message.includes('1060') || e.message.includes('Duplicate column')) {
      _ready[key] = true;
      return true;
    }
    console.warn(`[schema] Cannot add ${table}.${column}: ${e.message}`);
    _ready[key] = false;
    return false;
  }
}

module.exports = { ensureColumn };
