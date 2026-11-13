import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('page is lazy-loaded and protected by existing auth shell', () => {
  const app = read('App.jsx');
  assert.match(app, /companyGrants: \(\) => import\('\.\/pages\/company-access\/CompanyAccessGrants'\)/);
  assert.match(app, /<Protected><CompanyAccessGrants \/><\/Protected>/);
  assert.match(app, /path === '\/users\/company-access'/);
  assert.match(read('pages/company-access/CompanyAccessGrants.jsx'), /user\?\.role !== 'super_admin'/);
});
test('the menu is Super Admin-only and lives under People', () => {
  const nav = read('pages/NavBar.jsx');
  assert.match(nav, /path: '\/users\/company-access'/);
  assert.match(nav, /label: 'Company Access'[\s\S]*?roles: \['super_admin'\]/);
  assert.match(nav, /activePaths: \['\/users\/home', '\/users\/create-user', '\/users\/edit', '\/users\/view'\]/);
});
test('service matches Batch 3 endpoint, verbs, and delete-body contract', () => {
  const svc = read('services/adminCompanyAccess.js');
  assert.match(svc, /api\.get\('\/users\/company-access'/);
  assert.match(svc, /api\.get\('\/users\/company-access\/eligible'/);
  assert.match(svc, /api\.post\('\/users\/company-access'/);
  assert.match(svc, /api\.patch\('\/users\/company-access'/);
  assert.match(svc, /api\.delete\('\/users\/company-access'/);
  assert.match(svc, /data: \{ grant_id: Number\(grantId\), reason \}/);
  assert.match(svc, /skipPortalContext: true/);
});
test('all operations require a reason in the Super Admin approval dialog', () => {
  const page = read('pages/company-access/CompanyAccessGrants.jsx');
  for (const action of ['create', 'edit', 'revoke']) assert.match(page, new RegExp(`action === '${action}'`));
  assert.match(page, /t\('access_admin_control'\)/);
  assert.match(read('locales/en/company.json'), /SUPER ADMIN CONTROL/);
  assert.match(page, /grantReasonValid\(reason\)/);
  assert.match(page, /createCompanyGrant\(pending\.data, reason\.trim\(\)\)/);
  assert.match(page, /updateCompanyGrant\(pending\.grant\.id, pending\.data, reason\.trim\(\)\)/);
  assert.match(page, /revokeCompanyGrant\(pending\.grant\.id, reason\.trim\(\)\)/);
});
test('history, pagination, empty/error states and responsive themes are covered', () => {
  const page = read('pages/company-access/CompanyAccessGrants.jsx');
  const css = read('pages/company-access/CompanyAccessGrants.css');
  assert.match(page, /status: 'revoked'/);
  assert.match(page, /revoke_reason/);
  assert.match(page, /ListPager/);
  assert.match(page, /role="alert"/);
  assert.match(page, /'access_no_active'/);
  assert.match(read('locales/en/company.json'), /No active company grants/);
  assert.match(css, /max-width:540px/);
  assert.match(page, /theme-\$\{theme\}/);
});
