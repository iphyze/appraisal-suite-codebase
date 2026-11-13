import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GRANT_FORM, editFormForGrant, grantReasonValid,
  hasGrantChanges, normalizedGrantSettings, validateNewGrant,
} from '../utils/companyGrantForm.js';

const admins = [{ id: 5, home_company_id: 1, name: 'Admin User' }];
const companies = [{ id: 1, is_active: 1 }, { id: 2, is_active: 1 }, { id: 3, is_active: 0 }];
const sample = { ...DEFAULT_GRANT_FORM, user_id: '5', company_id: '2' };

test('new grants default to view-only, All scope and notifications off', () => {
  assert.equal(DEFAULT_GRANT_FORM.access_level, 'view');
  assert.equal(DEFAULT_GRANT_FORM.staff_scope, 'All');
  assert.equal(DEFAULT_GRANT_FORM.receive_notifications, false);
});
test('reason requires 5–500 characters after trimming (Unicode codepoints)', () => {
  assert.equal(grantReasonValid('    '), false);
  assert.equal(grantReasonValid(' four '), false);
  assert.equal(grantReasonValid(' five! '), true);
  assert.equal(grantReasonValid('a'.repeat(500)), true);
  assert.equal(grantReasonValid('a'.repeat(501)), false);
  assert.equal(grantReasonValid('✅✅✅✅✅'), true);
});
test('create requires an active admin and active foreign company', () => {
  assert.equal(validateNewGrant(sample, admins, companies), '');
  assert.match(validateNewGrant({ ...sample, user_id: '' }, admins, companies), /administrator/);
  assert.match(validateNewGrant({ ...sample, company_id: '1' }, admins, companies), /home company/);
  assert.match(validateNewGrant({ ...sample, company_id: '3' }, admins, companies), /active company/);
  assert.match(validateNewGrant({ ...sample, access_level: 'full' }, admins, companies), /valid access level/);
  assert.match(validateNewGrant({ ...sample, staff_scope: 'LocalOnly' }, admins, companies), /valid access level/);
});
test('editing preserves grant settings and detects changes', () => {
  const grant = { id: 12, user_id: 5, company_id: 2, access_level: 'manage', staff_scope: 'Expatriate', receive_notifications: 1 };
  const form = editFormForGrant(grant);
  assert.deepEqual(form, { user_id: '5', company_id: '2', access_level: 'manage', staff_scope: 'Expatriate', receive_notifications: true });
  assert.equal(hasGrantChanges(grant, form), false);
  assert.equal(hasGrantChanges(grant, { ...form, staff_scope: 'Local' }), true);
  assert.equal(hasGrantChanges(grant, { ...form, receive_notifications: false }), true);
  assert.deepEqual(normalizedGrantSettings(form), { access_level: 'manage', staff_scope: 'Expatriate', receive_notifications: true });
});
