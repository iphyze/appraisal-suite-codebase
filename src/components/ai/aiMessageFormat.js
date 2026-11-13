/**
 * Turns the assistant's light Markdown into safe render tokens.
 * Never renders HTML. Only same-app appraisal routes become links;
 * AppraisalView checks permissions again when a link is opened.
 */

const APPRAISAL_PATH = /^\/appraisals\/view\/\d+$/;

// Older answers (and any slip by the model) may contain raw record paths.
const RAW_PATH_NOISE = [
  /\s*\[(?:details|view|link|record)?\s*:?\s*\/appraisals\/view\/\d+\s*\]/gi,
  /(?<!\])\(\s*(?:details|view|link)?\s*:?\s*\/appraisals\/view\/\d+\s*\)/gi,
  /\s*(?:details|view|link)\s*:\s*\/appraisals\/view\/\d+/gi,
];

const INLINE = /\[([^\]\n]{1,120})\]\(\s*(\/appraisals\/view\/[0-9]+)\s*\)|\*\*([^*\n]+)\*\*|(\/appraisals\/view\/\d+)/g;

export function cleanAiText(input) {
  let text = String(input ?? '').replace(/\\\//g, '/').replace(/\r\n?/g, '\n');
  // Keep proper [label](path) links; strip only the noisy forms.
  RAW_PATH_NOISE.forEach((pattern) => { text = text.replace(pattern, ''); });
  return text.replace(/[ \t]+\n/g, '\n').trim();
}

export function tokenizeAiMessage(input) {
  const text = String(input ?? '');
  const result = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index;
    if (at > cursor) result.push({ type: 'text', value: text.slice(cursor, at) });
    if (match[2] && APPRAISAL_PATH.test(match[2])) {
      result.push({ type: 'link', label: match[1], to: match[2] });
    } else if (match[3]) {
      result.push({ type: 'bold', value: match[3] });
    } else if (match[4]) {
      result.push({ type: 'link', label: 'View appraisal', to: match[4] });
    } else {
      result.push({ type: 'text', value: match[0] });
    }
    cursor = at + match[0].length;
  }
  if (cursor < text.length) result.push({ type: 'text', value: text.slice(cursor) });
  return result;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

const splitRow = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

/** Block structure: paragraphs, bullet lists, numbered lists and simple tables. */
export function parseAiMessage(input) {
  const lines = cleanAiText(input).split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (TABLE_ROW.test(line)) {
      const rows = [];
      while (i < lines.length && (TABLE_ROW.test(lines[i]) || TABLE_RULE.test(lines[i]))) {
        if (!TABLE_RULE.test(lines[i])) rows.push(splitRow(lines[i]));
        i += 1;
      }
      if (rows.length) blocks.push({ type: 'table', head: rows[0], rows: rows.slice(1) });
      continue;
    }

    const listKind = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null;
    if (listKind) {
      const pattern = listKind === 'ul' ? BULLET : NUMBERED;
      const items = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(lines[i].match(pattern)[1]);
        i += 1;
      }
      blocks.push({ type: listKind, items });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) { blocks.push({ type: 'heading', text: heading[1] }); i += 1; continue; }

    const para = [];
    while (i < lines.length && lines[i].trim() && !TABLE_ROW.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i]) && !HEADING.test(lines[i])) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'p', text: para.join('\n') });
  }
  return blocks;
}

/** Plain text for copying an answer to the clipboard. */
export function aiMessageToPlainText(input) {
  return cleanAiText(input)
    .replace(/\[([^\]\n]{1,120})\]\(\s*\/appraisals\/view\/\d+\s*\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/^\s*\|?\s*:?-{2,}.*\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
