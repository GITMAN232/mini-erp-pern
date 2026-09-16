/**
 * Safe document number generator
 * E.g., ENQ-2026-0001, QT-2026-0001, SO-2026-0001, DSP-2026-0001
 */
async function generateDocumentNumber(client, tableName, prefix, column = 'id') {
  const res = await client.query(`SELECT COUNT(*)::int as count FROM ${tableName}`);
  const nextNum = (res.rows[0].count + 1).toString().padStart(4, '0');
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${nextNum}`;
}

module.exports = {
  generateDocumentNumber
};
