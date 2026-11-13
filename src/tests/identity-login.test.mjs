import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preferredLoginWorkspaceId } from '../utils/loginWorkspaces.js';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('last workspace is preselected only when offered by authenticated API', () => {
  const own = [{ id: 1, name: 'Lambert' }, { id: 3, name: 'LEM CIV' }];
  assert.equal(preferredLoginWorkspaceId(own, 3), 3);
  assert.equal(preferredLoginWorkspaceId(own, '1'), 1);
  assert.equal(preferredLoginWorkspaceId(own, 99), null);
  assert.equal(preferredLoginWorkspaceId(own, 0), null);
  assert.equal(preferredLoginWorkspaceId([], 3), null);
  assert.equal(preferredLoginWorkspaceId(own, 'not-a-number'), null);
});

test('login choice still resubmits credentials for server verification', () => {
  const login = read('../pages/auth/Login.jsx');
  const store = read('../stores/useAuthStore.js');
  assert.match(login, /runLogin\(selectedWorkspaceId\)/);
  assert.match(login, /preferredLoginWorkspaceId\(/);
  assert.match(store, /payload\.company_id = Number\(companyId\)/);
  assert.match(store, /preferredCompanyId: Number\(/);
});
