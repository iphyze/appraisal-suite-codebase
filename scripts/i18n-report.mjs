import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const namespaces = fs.readdirSync(path.join(root, 'src/locales/en'))
  .filter((name) => name.endsWith('.json')).map((name) => name.replace(/\.json$/, ''));
const flatten = (record, prefix = '') => Object.entries(record).flatMap(([key, value]) => {
  const full = prefix ? `${prefix}.${key}` : key;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? flatten(value, full) : [full];
});
const files = [];
function gather(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) gather(full);
    else if (/\.[cm]?[jt]sx?$/.test(item.name)) files.push(full);
  }
}
gather(path.join(root, 'src'));
const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
let differences = 0;
let unused = 0;
for (const namespace of namespaces) {
  const en = new Set(flatten(JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en', `${namespace}.json`)))));
  const fr = new Set(flatten(JSON.parse(fs.readFileSync(path.join(root, 'src/locales/fr', `${namespace}.json`)))));
  const missing = [...en].filter((key) => !fr.has(key));
  const extra = [...fr].filter((key) => !en.has(key));
  const inactive = [...en].filter((key) => {
    // Server message keys are dispatched dynamically by the PHP API.
    if (namespace === 'api') return false;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:['\"\x60])(?:${namespace}:)?${escaped}(?:['\"\x60])`);
    if (regex.test(source)) return false;
    // i18next chooses plural variants (_one, _other, etc.) at runtime.
    // Treat a referenced base key as using its plural variants too.
    const pluralBase = key.replace(/_(?:zero|one|two|few|many|other)$/, '');
    if (pluralBase !== key) {
      const escapedBase = pluralBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const baseRegex = new RegExp(`(?:['"\x60])(?:${namespace}:)?${escapedBase}(?:['"\x60])`);
      if (baseRegex.test(source)) return false;
    }
    // Mail screens generate keys from stable audience IDs and role/scope enums.
    // These are not unused simply because the complete key is assembled at runtime.
    if (namespace === 'mail') {
      if (key.startsWith('manual_mode_') && source.includes('manual_mode_${')) return false;
      if (key.startsWith('manual_scope_') && source.includes('manual_scope_${')) return false;
      if (key.startsWith('manual_category_') && source.includes('manual_category_${')) return false;
      if (['delivery_graph_description', 'delivery_smtp_description'].includes(key)
          && source.includes('delivery_${key}_description')) return false;
    }
    // Company setup copy translates a fixed set of server-provided category IDs.
    // Key patterns are dynamic but the source strings still live in this catalogue.
    if (namespace === 'company') {
      if (key.startsWith('counts_') && source.includes('`counts_${key}`')) return false;
      if (key.startsWith('excluded_') && source.includes('`excluded_${item}`')) return false;
    }
    // Cycle screens use cx('key') with a shared cyc_ namespace prefix.
    // Detect these literal references (including option arrays and plural keys)
    // without counting all newly localised cycle labels as unused.
    if (namespace === 'cycles' && key.startsWith('cyc_')) {
      const shortKey = key.slice(4).replace(/_(?:zero|one|other)$/, '');
      const escapedShort = shortKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const shortRegex = new RegExp(`(?:['"\x60])${escapedShort}(?:['"\x60])`);
      return !shortRegex.test(source);
    }
    return true;
  });
  differences += missing.length + extra.length;
  unused += inactive.length;
  console.log(`${namespace}: EN=${en.size} FR=${fr.size} missing=${missing.length} extra=${extra.length} possibly-unused=${inactive.length}`);
  if (missing.length) console.log('  Missing FR:', missing.join(', '));
  if (extra.length) console.log('  Missing EN:', extra.join(', '));
  if (inactive.length) console.log('  Possibly unused:', inactive.join(', '));
}
console.log(`Locale audit: ${differences} missing/extra keys; ${unused} possibly unused (static scan only).`);
if (differences) process.exitCode = 1;
