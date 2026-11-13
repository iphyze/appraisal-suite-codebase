import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectableMemberWorkspace } from '../utils/memberWorkspaces.js';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const rows = [
  { user_id: 29, is_current: true, company_name: 'Lambert Electromec Ltd' },
  { user_id: 452, is_current: false, company_name: 'LEM CIV' },
];
test('only another offered membership can be selected', () => {
  assert.equal(selectableMemberWorkspace(rows, 29, 452), true);
  assert.equal(selectableMemberWorkspace(rows, 29, 29), false);
  assert.equal(selectableMemberWorkspace(rows, 29, 999), false);
  assert.equal(selectableMemberWorkspace(rows, 500, 452), false);
  assert.equal(selectableMemberWorkspace([{ user_id: 452, is_current: false }], 29, 452), false);
  assert.equal(selectableMemberWorkspace([], 29, 452), false);
});
test('workspace switching uses a fresh cookie/CSRF session, then reloads', () => {
  const auth = read('../stores/useAuthStore.js');
  const context = read('../stores/usePortalContextStore.js');
  const component = read('../components/MemberWorkspaceSwitcher.jsx');
  assert.match(auth, /api\.post\('\/auth\/switch-workspace'/);
  assert.match(auth, /get\(\)\.restoreSession\(data\)/);
  assert.match(auth, /resetForWorkspace\(userId\)/);
  assert.match(context, /resetForWorkspace: \(userId\) =>/);
  assert.match(context, /viewCompanyId: '', cycleId: ''/);
  assert.match(context, /accessibleCompanies: \[\], accessStatus: 'idle'/);
  assert.match(component, /window\.location\.assign\('\/dashboard'\)/);
  assert.doesNotMatch(auth.slice(auth.indexOf('switchWorkspace:'), auth.indexOf('changePassword:')), /clearAllAppraisalDrafts/);
});
test('membership UI remains separate from temporary View Context', () => {
  assert.match(read('../pages/Header.jsx'), /<MemberWorkspaceSwitcher\s*\/>/);
  assert.match(read('../components/PortalContextSwitcher.jsx'), /setViewCompanyId/);
  assert.match(read('../components/MemberWorkspaceSwitcher.jsx'), /workspaces\.length <= 1/);
  assert.match(read('../components/MemberWorkspaceSwitcher.jsx'), /user\?\.identity_id/);
});
test('locale files have identical keys and translate every new label', () => {
  const en = JSON.parse(read('../locales/en/nav.json'));
  const fr = JSON.parse(read('../locales/fr/nav.json'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
  for (const key of ['member_workspaces_title','member_workspaces_description','member_workspace_current',
    'member_workspace_load_failed','member_workspace_switch_failed']) {
    assert.ok(en[key] && fr[key], `missing ${key}`);
  }
});
