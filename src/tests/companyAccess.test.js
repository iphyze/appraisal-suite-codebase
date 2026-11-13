import test from 'node:test';
import assert from 'node:assert/strict';
import { companyAccessCompanyId, selectedCompanyAccess, isGrantRevocationError } from '../services/companyAccess.js';

const rows = [
  { company_id: 1, name: 'Lambert Nigeria', is_home: true, access_level: 'full', staff_scope: 'All' },
  { company_id: 3, name: 'Lambert CIV', is_home: false, access_level: 'view', staff_scope: 'Expatriate', grant_id: 10 },
  { company_id: 4, name: 'Lambert Ghana', is_home: false, access_level: 'manage', staff_scope: 'Local', grant_id: 11 },
];

test('home company is full and not a grant', () => {
  for (const selection of ['', null, 1, '1']) {
    const access = selectedCompanyAccess('admin', 1, selection, rows);
    assert.equal(access.isGranted, false);
    assert.equal(access.isViewOnly, false);
    assert.equal(access.canManage, true);
  }
});

test('granted view access does not permit management', () => {
  const access = selectedCompanyAccess('admin', 1, 3, rows);
  assert.equal(access.isGranted, true);
  assert.equal(access.isViewOnly, true);
  assert.equal(access.canManage, false);
  assert.equal(access.company.name, 'Lambert CIV');
  assert.equal(access.company.staff_scope, 'Expatriate');
});

test('granted manage access permits management within server-enforced scope', () => {
  const access = selectedCompanyAccess('admin', 1, 4, rows);
  assert.equal(access.isGranted, true);
  assert.equal(access.canManage, true);
  assert.equal(access.company.staff_scope, 'Local');
});

test('unknown or revoked company fails closed in the interface', () => {
  const revoked = rows.filter((row) => row.company_id !== 3);
  const access = selectedCompanyAccess('admin', 1, '3', revoked);
  assert.equal(access.isViewOnly, true);
  assert.equal(access.canManage, false);
  assert.equal(access.company, null);
});

test('permissions follow the current grant, not an old snapshot', () => {
  const downgraded = rows.map((row) => row.company_id === 4 ? { ...row, access_level: 'view' } : row);
  assert.equal(selectedCompanyAccess('admin', 1, 4, downgraded).isViewOnly, true);
  assert.equal(selectedCompanyAccess('admin', 1, 4, rows).canManage, true);
});

test('Super Admin behavior is unchanged and staff/supervisors do not become grantees', () => {
  for (const role of ['super_admin', 'staff', 'supervisor']) {
    const access = selectedCompanyAccess(role, 1, 3, rows);
    assert.equal(access.isGranted, false);
  }
});

test('company-ID mapping covers both admin endpoint and company listing', () => {
  assert.equal(companyAccessCompanyId({ company_id: 7 }), '7');
  assert.equal(companyAccessCompanyId({ id: 8 }), '8');
});

test('only a matching 403 grant denial initiates recovery', () => {
  assert.equal(isGrantRevocationError({ response: { status: 403, data: { message: 'You do not have access to that company.' } } }), true);
  assert.equal(isGrantRevocationError({ response: { status: 403, data: { message: 'You have view-only access to Lambert CIV.' } } }), false);
  assert.equal(isGrantRevocationError({ response: { status: 401, data: { message: 'You do not have access to that company.' } } }), false);
});

test('company-wide settings need Manage access for all staff under a grant', () => {
  const grants = [
    { company_id: 3, access_level: 'manage', staff_scope: 'All' },
    { company_id: 4, access_level: 'manage', staff_scope: 'Expatriate' },
    { company_id: 5, access_level: 'view', staff_scope: 'All' },
  ];
  assert.equal(selectedCompanyAccess('admin', 1, 3, grants).canEditCompanySettings, true);
  assert.equal(selectedCompanyAccess('admin', 1, 4, grants).canEditCompanySettings, false);
  assert.equal(selectedCompanyAccess('admin', 1, 4, grants).canManage, true, 'staff-specific work still allowed');
  assert.equal(selectedCompanyAccess('admin', 1, 5, grants).canEditCompanySettings, false);
  assert.equal(selectedCompanyAccess('admin', 1, 1, grants).canEditCompanySettings, true, 'home company unchanged');
  assert.equal(selectedCompanyAccess('super_admin', 1, 4, grants).canEditCompanySettings, true, 'Super Admin unchanged');
  assert.equal(selectedCompanyAccess('admin', 1, 9, grants).canEditCompanySettings, false, 'unknown grant stays locked');
});
