/**
 * AppraisalSuite translation workbook contract. The backend creates the XLSX.
 * Only column D may be edited; A/B/C/E/F are concurrency/source guards.
 * Spreadsheet contents are never interpreted as HTML or JS.
 */
export const TRANSLATION_HEADERS = Object.freeze([
  'Source hash', 'Context', 'English source', 'French translation',
  'Expected status', 'Expected French', 'Company IDs',
]);
export const TRANSLATION_IMPORT_LIMIT = 1000;

const cellText = (cell) => cell == null ? '' : String(cell);

export function parseTranslationMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
    throw new Error('invalid_header');
  }
  const headers = matrix[0].map((item) => cellText(item).trim());
  if (TRANSLATION_HEADERS.some((title, index) => headers[index] !== title)) {
    throw new Error('invalid_header');
  }
  const rows = [];
  let blank = 0;
  for (let index = 1; index < matrix.length; index += 1) {
    const values = Array.isArray(matrix[index]) ? matrix[index] : [];
    if (values.every((cell) => cellText(cell).trim() === '')) continue;
    const french = cellText(values[3]).trim();
    if (!french) { blank += 1; continue; }
    rows.push({
      row_number: index + 1,
      source_hash: cellText(values[0]).trim(),
      context: cellText(values[1]).trim(),
      source_text: cellText(values[2]),
      translated_text: french,
      expected_status: cellText(values[4]).trim(),
      expected_text: cellText(values[5]),
    });
    if (rows.length > TRANSLATION_IMPORT_LIMIT) throw new Error('too_many_rows');
  }
  return { rows, blank };
}

/** Do not allow calculated spreadsheet cells in a translation import. */
export function containsWorkbookFormulas(sheet) {
  if (Array.isArray(sheet)) {
    return sheet.some((row) => Array.isArray(row) && row.some((cell) => Boolean(cell?.f)));
  }
  return Object.entries(sheet || {}).some(([address, cell]) => !address.startsWith('!') && Boolean(cell?.f));
}
