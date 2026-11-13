// Development-only elongated/accented strings to expose layout bugs.
const substitutions = {
  a: 'à', b: 'ƀ', c: 'ç', d: 'ď', e: 'é', f: 'ƒ', g: 'ğ', h: 'ĥ',
  i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'ƥ',
  q: 'ɋ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ù', v: 'ṽ', w: 'ŵ', x: 'ẋ',
  y: 'ý', z: 'ž',
};

export function pseudoLocalize(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  // Leave i18next placeholders and lightweight HTML-like variables intact.
  const parts = text.split(/(\{\{[^}]+\}\}|<[^>]+>)/g);
  const transformed = parts.map((part) => {
    if (/^(\{\{|<)/.test(part)) return part;
    return [...part].map((ch) => {
      const replacement = substitutions[ch.toLowerCase()];
      if (!replacement) return ch;
      return ch === ch.toUpperCase() ? replacement.toUpperCase() : replacement;
    }).join('');
  }).join('');
  return `[${transformed} ${'~'.repeat(Math.max(3, Math.ceil(text.length * 0.30)))}]`;
}
