/** Batch 4 frontend contract checks; no browser or node_modules required. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');
const locale = (lang, ns) => JSON.parse(read(`locales/${lang}/${ns}.json`));

test('English and French auth/user locale keys have identical coverage', () => {
  for (const ns of ['auth', 'users']) {
    const en = locale('en', ns);
    const fr = locale('fr', ns);
    assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), `${ns} missing keys`);
    for (const key of ['shared_password_companies']) {
      assert.ok(en[key]?.includes('{{companies}}'));
      assert.ok(fr[key]?.includes('{{companies}}'));
    }
  }
});
test('password change describes the signed-in identity companies', () => {
  const page = read('pages/auth/ChangePassword.jsx');
  assert.match(page, /api\.get\('\/users\/password-workspaces'/);
  assert.match(page, /passwordCompanies\.length > 1/);
  assert.match(page, /shared_password_companies/);
});
test('admin reset requires successful preflight and handles denial', () => {
  const page = read('pages/users/UsersOverview.jsx');
  assert.match(page, /await api\.get\('\/users\/password-workspaces'/);
  assert.match(page, /setResetTarget\(\{/);
  assert.match(page, /reset_denied_company/);
  assert.match(page, /shared_password_companies/);
  assert.match(page, /resetSubmitting/);
});
test('frontend keeps every reset error translation in sync', () => {
  for (const key of ['reset_access_denied','reset_loading_companies','reset_company_fetch_error','reset_denied_company','reset_admin_protected','reset_yourself']) {
    assert.ok(locale('en','users')[key]);
    assert.ok(locale('fr','users')[key]);
  }
});
