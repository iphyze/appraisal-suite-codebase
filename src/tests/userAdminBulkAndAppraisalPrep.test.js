import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('pending subordinate action routes to secure preparation list, not premature form', () => {
  const dashboard = code('pages/home/Dashboard.jsx');
  const appraisals = code('pages/appraisals/Appraisals.jsx');
  assert.match(dashboard, /\/appraisals\?staff_user_id=/);
  assert.doesNotMatch(dashboard, /to=\{`\/appraisals\/create\/\$\{staff\.id\}/);
  assert.match(appraisals, /staff_user_id: focusedStaffId \|\| undefined/);
  const catalogue = JSON.parse(code('locales/en/appraisals.json'));
  assert.match(appraisals, /list\.preparationTitle/);
  assert.match(appraisals, /list\.preparationDetail/);
  assert.equal(catalogue.list.preparationTitle, 'Employee appraisal preparation');
  assert.match(catalogue.list.preparationDetail, /<bold>Set Level<\/bold>/);
  assert.match(catalogue.list.preparationDetail, /<bold>Set Objectives<\/bold>/);
});

test('Users screen filters status, department and export consistently', () => {
  const store = code('stores/useUsersStore.js');
  const page = code('pages/users/UsersOverview.jsx');
  assert.match(store, /statusFilter: ''/);
  assert.match(store, /params\.append\('is_active', statusFilter\)/);
  assert.match(store, /params\.append\('department', departmentFilter\)/);
  assert.match(page, /STATUS_FILTER_OPTIONS/);
  assert.match(page, /setStatusFilter/);
  assert.match(page, /setDepartmentFilter/);
  assert.match(page, /params\.set\('is_active', statusFilter\)/);
  assert.match(page, /params\.set\('department', departmentFilter\)/);
});

test('bulk updates are checked in the server, never client-only', () => {
  const store = code('stores/useUsersStore.js');
  const ui = code('pages/users/UsersOverview.jsx');
  assert.match(store, /api\.put\('\/users\/bulk-update', payload\)/);
  assert.match(ui, /ux\('bulk_headline'\)/);
  assert.equal(JSON.parse(code('locales/en/users.json')).bulk_headline, 'Bulk update selected staff');
  assert.match(ui, /selectedItems\.map\(Number\)/);
  assert.match(ui, /!bulkDepartment && bulkStatus === ''/);
  assert.match(ui, /createPortal\(/);
  assert.match(ui, /theme-\$\{theme\}/);
});

test('quick add department is available on create and edit with server-side permissions', () => {
  const form = code('pages/users/UserForm.jsx');
  assert.match(form, /api\.post\('\/departments\/create'/);
  assert.match(form, /settingsLocked/);
  assert.match(form, /isSuperAdmin \? \{ company_id: Number\(departmentCompanyId\) \}/);
  assert.match(form, /updateField\('department', createdName\)/);
  assert.match(form, /'create_select'/);
  assert.equal(JSON.parse(code('locales/en/users.json')).create_select, 'Create & Select');
  assert.match(form, /createPortal\(/);
});

test('bulk update portal renders outside AnimatePresence and is interactive', () => {
  const page = code('pages/users/UsersOverview.jsx');
  const portal = page.indexOf("{bulkOpen && typeof document !== 'undefined' && createPortal(");
  const animation = page.indexOf('<AnimatePresence>', portal);
  assert.ok(portal >= 0, 'bulk modal should mount when the bulk update button is clicked');
  assert.ok(animation > portal, 'portals must not be nested inside AnimatePresence, which filters portal children');
  assert.match(page, /onClick=\{\(\) => setBulkOpen\(true\)\}/);
  assert.match(page, /aria-modal="true" aria-labelledby="usr-bulk-title"/);
  assert.match(page.slice(portal, animation), /document\.body/);
  assert.match(page, /onClick=\{runBulkUpdate\}/);
});

test('Users filters occupy two rows and bulk edit has a centered card on a translucent viewport backdrop', () => {
  const css = code('pages/users/Users.css');
  assert.match(css, /\.usr-toolbar \{ grid-template-columns: minmax\(0, 1fr\); align-items: stretch;/);
  assert.match(css, /\.usr-filter-grid \{ grid-template-columns: repeat\(5, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /\.usr-bulk-backdrop \{[\s\S]*?position: fixed;[\s\S]*?inset: 0;[\s\S]*?height: 100dvh;/);
  assert.match(css, /\.usr-bulk-backdrop \{[\s\S]*?background: rgba\(15, 23, 42, 0\.55\);/);
  assert.match(css, /\.usr-bulk-modal \{[\s\S]*?width: min\(600px, 100%\);[\s\S]*?height: auto;/);
  assert.match(css, /\.usr-bulk-modal \{[\s\S]*?border-radius: 24px;/);
  assert.doesNotMatch(css, /\.usr-bulk-modal \{\s*width: 100%;\s*height: 100%;/);
  assert.match(css, /z-index: 10050; \/\* Above app shell/);
  assert.match(css, /@media \(max-width: 800px\)[\s\S]*?\.usr-filter-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});
