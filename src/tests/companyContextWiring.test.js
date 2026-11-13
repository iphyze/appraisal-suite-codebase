import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('uses existing View Context selection for admin and Super Admin requests', () => {
  const src = read('services/api.js');
  assert.match(src, /\['super_admin', 'admin'\]\.includes\(authState\.user\?\.role\)/);
  assert.match(src, /view_company_id: viewCompanyId/);
  assert.match(src, /ensureOwner\(authState\.user\.id, authState\.user\.role\)/);
  assert.match(src, /skipPortalContext/);
});

test('grant choices come from the live accessible-company endpoint', () => {
  const src = read('components/PortalContextSwitcher.jsx');
  assert.match(read('components/CompanyAccessBootstrap.jsx'), /\/users\/my-accessible-companies/);
  assert.match(src, /accessibleCompanies\.some/);
  assert.match(src, /company\.is_home \? ''/);
  assert.match(src, /window\.location\.reload\(\)/);
});

test('an unauthorized company is rechecked before a 403 causes a reset', () => {
  const src = read('services/api.js');
  assert.match(src, /isGrantRevocationError/);
  assert.match(src, /companyRevalidationPromise/);
  assert.match(src, /stillAllowed/);
  assert.match(src, /window\.location\.assign\('\/dashboard'\)/);
});

test('grant metadata is not persisted alongside navigation preference', () => {
  const src = read('stores/usePortalContextStore.js');
  assert.match(src, /partialize: \(\{ viewCompanyId, cycleId, ownerUserId \}\)/);
  assert.doesNotMatch(src, /partialize:[^\n]*accessibleCompanies/);
});

test('view-only guards block administrative forms and never block personal appraisal forms', () => {
  assert.match(read('App.jsx'), /<CompanyAccessBootstrap \/>/);
  assert.match(read('components/CompanyManageRoute.jsx'), /status/);
  const src = read('App.jsx');
  for (const form of ['CreateUser', 'EditUser', 'CreateCycle', 'EditCycle', 'ManualEmail', 'SupervisorAssignments']) {
    // `companyWide` marks pages that edit company-wide settings (still guarded).
    assert.match(src, new RegExp(`<CompanyManageRoute(?: companyWide)?><${form} \\/><\\/CompanyManageRoute>`));
  }
  assert.match(src, /<AppraisalForm mode="create" \/>/);
  assert.doesNotMatch(src, /<CompanyManageRoute(?: companyWide)?><AppraisalForm/);
});

test('view-only access preserves export actions', () => {
  const userSrc = read('pages/users/UsersOverview.jsx');
  const supervisorSrc = read('pages/supervisors/SupervisorsOverview.jsx');
  assert.match(userSrc, /downloadUsersExcel/);
  assert.match(supervisorSrc, /downloadSupervisorsExcel/);
  assert.match(read('pages/home/Dashboard.jsx'), /onExport=\{downloadManagementReport\}/);
});

test('read-only administration still displays management oversight', () => {
  const src = read('pages/appraisals/AppraisalView.jsx');
  assert.match(src, /const canManageManagementReview = !isViewOnly/);
  assert.match(src, /const canSeeManagementOversight = managementReviewEnabled/);
  assert.match(src, /\['super_admin', 'admin'\]\.includes\(user\?\.role\)/);
});

test('banner handles light/dark layout and mobile width', () => {
  const banner = read('components/CompanyContextBanner.jsx');
  const css = read('components/CompanyContextBanner.css');
  assert.match(banner, /t\('banner_back', \{ company: homeCompany \}\)/);
  assert.match(read('locales/en/company.json'), /"banner_back": "Back to \{\{company\}\}"/);
  assert.match(banner, /staff_scope/);
  assert.match(css, /ap-header--dark/);
  assert.match(css, /max-width: 540px/);
});
