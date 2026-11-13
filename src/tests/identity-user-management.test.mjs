/** Batch 6 frontend integration contracts. Real browser/API verification remains Batch 7. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const get = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const locale = (language) => JSON.parse(get(`locales/${language}/users.json`));

test('English and French have zero missing user keys, including all identity notices', () => {
  const en = locale('en');
  const fr = locale('fr');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
  for (const key of ['identity_existing_notice','identity_link_edit_notice',
    'identity_confirm_link_title','identity_confirm_link_message','identity_also_in',
    'identity_status','identity_status_confirm_message','identity_reset_after_email']) {
    assert.ok(en[key]?.length);
    assert.ok(fr[key]?.length);
  }
});
test('existing login lookup removes the new password input and shows the company notice', () => {
  const page = get('pages/users/UserForm.jsx');
  assert.match(page, /api\.get\('\/users\/identity-lookup'/);
  assert.match(page, /identityLookup\.status === 'ready' && identityLookup\.exists/);
  assert.match(page, /identity_existing_notice/);
  assert.match(page, /!isEdit && text\(form\.email\)/);
  assert.match(page, /identityLookup\.manual_review/);
});
test('edit email requires explicit confirmation and sends a second confirm flag', () => {
  const page = get('pages/users/UserForm.jsx');
  const store = get('stores/useUsersStore.js');
  assert.match(page, /IDENTITY_LINK_CONFIRM_REQUIRED/);
  assert.match(page, /confirm_identity_link: true/);
  assert.match(page, /role="alertdialog"/);
  assert.match(page, /event\.key === 'Escape'/);
  assert.match(store, /code !== 'IDENTITY_LINK_CONFIRM_REQUIRED'/);
});
test('other company indicator and identity status appear only via server-supplied fields', () => {
  assert.match(get('pages/users/UsersOverview.jsx'), /user\.also_in_companies/);
  const profile = get('pages/users/ViewUser.jsx');
  assert.match(profile, /singleUser\.also_in_companies/);
  assert.match(profile, /currentUser\?\.role === 'super_admin'/);
  assert.match(profile, /api\.put\('\/users\/identity-status'/);
});
