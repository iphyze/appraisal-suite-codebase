import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APPROVED_LAMBERT_CIV, findLambertCiv, lambertCivIdentityMatches } from '../utils/lambertCiv.js';

const page = readFileSync(new URL('../pages/companies/Companies.jsx', import.meta.url), 'utf8');

test('approved company identity exactly matches user authorization and schema restrictions', () => {
  assert.deepEqual(APPROVED_LAMBERT_CIV, { code: 'LAMBERT_CIV', name: 'Lambert CIV' });
  assert.match(APPROVED_LAMBERT_CIV.code, /^[A-Z0-9_]{2,20}$/);
  assert.equal(Object.isFrozen(APPROVED_LAMBERT_CIV), true);
});

test('existing company detection prevents duplicate setup suggestions', () => {
  assert.equal(findLambertCiv([]), null);
  assert.equal(findLambertCiv([{ code: 'LEM', name: 'LEM' }]), null);
  const existing = { id: 31, code: 'lambert_civ', name: 'Lambert CIV', is_active: 1 };
  assert.equal(findLambertCiv([{ code: 'LEM' }, existing]), existing);
  assert.equal(lambertCivIdentityMatches(existing), true);
  assert.equal(lambertCivIdentityMatches({ code: 'LAMBERT_CIV', name: 'Wrong company' }), false);
  assert.equal(lambertCivIdentityMatches(null), false);
});

test('company is created only by explicit Super Admin submission with no obsolete creation prompt', () => {
  assert.match(page, /api\.post\('\/companies\/create', form\)/);
  assert.match(page, /t\('co_create'\)/);
  assert.match(readFileSync(new URL('../locales/en/company.json', import.meta.url), 'utf8'), /Create Company/);
  assert.match(page, /user\?\.role !== 'super_admin'/);
  assert.doesNotMatch(page, /Creating Lambert CIV\?|Use approved Lambert CIV details/);
  assert.doesNotMatch(page, /selectApprovedLambertCiv|existingLambertCiv/);
});
