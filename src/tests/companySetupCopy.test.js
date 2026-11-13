import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  companyCodeValid, copyReasonValid, errorMessage, previewMatchesSelection,
  SETUP_COUNT_LABELS, validateSetupSelection,
} from '../utils/companySetupCopy.js';

const companies = [
  { id: 1, name: 'Lambert Electromec Ltd', is_active: 1 },
  { id: 2, name: 'LEM', is_active: 1 },
  { id: 3, name: 'Lambert CIV', is_active: 1 },
  { id: 4, name: 'Disabled Company', is_active: 0 },
];
const cycles = [
  { id: 101, company_id: 1, is_active: 1 },
  { id: 202, company_id: 2, is_active: 1 },
  { id: 303, company_id: 3, is_active: 0 },
];
const selection = { sourceCycleId: '101', targetCompanyId: '3', cycles, companies };
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('company creation needs an explicit, valid code', () => {
  assert.equal(companyCodeValid(''), false);
  assert.equal(companyCodeValid('L'), false);
  assert.equal(companyCodeValid('LCIV'), true);
  assert.equal(companyCodeValid('LAMBERT_CIV'), true);
  assert.equal(companyCodeValid(' l_civ '), true);
  assert.equal(companyCodeValid('a'.repeat(20)), true);
  assert.equal(companyCodeValid('a'.repeat(21)), false);
  assert.equal(companyCodeValid('L-CIV'), false);
  assert.equal(companyCodeValid('L CIV'), false);
});

test('reason is mandatory and limited to 5–500 Unicode characters', () => {
  for (const value of ['', '    ', 'four', 'a'.repeat(501)]) assert.equal(copyReasonValid(value), false);
  for (const value of ['five!', '  five!  ', 'a'.repeat(500), '✅✅✅✅✅']) assert.equal(copyReasonValid(value), true);
});

test('setup-copy selection must be an active cross-company source and target', () => {
  assert.equal(validateSetupSelection(selection), '');
  assert.match(validateSetupSelection({ ...selection, sourceCycleId: '' }), /source/);
  assert.match(validateSetupSelection({ ...selection, targetCompanyId: '' }), /target/);
  assert.match(validateSetupSelection({ ...selection, sourceCycleId: '303' }), /active source/);
  assert.match(validateSetupSelection({ ...selection, targetCompanyId: '4' }), /active target/);
  assert.match(validateSetupSelection({ ...selection, targetCompanyId: '1' }), /different/);
  assert.match(validateSetupSelection({ ...selection, targetCompanyId: '99' }), /active target/);
  assert.match(validateSetupSelection({ ...selection, sourceCycleId: '999' }), /active source/);
  assert.match(validateSetupSelection({ ...selection, sourceCycleId: 'not_a_number' }), /source/);
});

test('a stale or wrong-company preview is never approvable', () => {
  const preview = { source_cycle: { id: 101 }, target_company: { id: 3 } };
  assert.equal(previewMatchesSelection(preview, 101, 3), true);
  assert.equal(previewMatchesSelection(preview, 202, 3), false);
  assert.equal(previewMatchesSelection(preview, 101, 2), false);
  assert.equal(previewMatchesSelection(null, 101, 3), false);
});

test('preview exposes all copied configuration classes and excludes personal records', () => {
  const keys = SETUP_COUNT_LABELS.map(([key]) => key);
  for (const key of ['departments','cycles','sections','objective_section_settings', 'rating_bands', 'rating_points', 'general_questions', 'department_kpis']) {
    assert.ok(keys.includes(key), `Missing ${key}`);
  }
  for (const key of ['users','appraisals','individual_kpis', 'objective_plans']) {
    assert.ok(!keys.includes(key), `${key} must not be copied`);
  }
});

test('API route usage reuses the Batch 9A endpoint with no inherited View Context', () => {
  const service = source('services/companySetupCopy.js');
  assert.match(service, /api\.get\('\/companies\/setup-copy'/);
  assert.match(service, /api\.post\('\/companies\/setup-copy'/);
  assert.match(service, /skipPortalContext: true/g);
  assert.match(service, /source_cycle_id/);
  assert.match(service, /target_company_id/);
  assert.match(service, /reason\.trim\(\)/);
  assert.match(service, /page, limit: pageSize/);
});

test('UI uses existing company creation and only selects a target after successful API creation', () => {
  const companyPage = source('pages/companies/Companies.jsx');
  assert.match(companyPage, /api\.post\('\/companies\/create', form\)/);
  assert.match(companyPage, /setCreatedCompanyId\(String\(response\.data\?\.data\?\.id/);
  assert.match(companyPage, /<CompanySetupCopy/);
  assert.doesNotMatch(companyPage, /Creating Lambert CIV\?|Use approved Lambert CIV details/);
  assert.match(companyPage, /companyCodeValid\(form\.code\)/);
  assert.match(companyPage, /user\?\.role !== 'super_admin'/);
  assert.match(companyPage, /className="companies-form-card"|companies-form-card/);
});

test('approval uses an immutable preview, required reason, and no auto-retry for writes', () => {
  const page = source('pages/companies/CompanySetupCopy.jsx');
  assert.match(page, /previewMatchesSelection\(preview, sourceCycleId, targetId\)/);
  assert.match(page, /setApproval\(currentPreview\)/);
  assert.match(page, /sourceCycleId: approval\.source_cycle\.id/);
  assert.match(page, /targetCompanyId: approval\.target_company\.id/);
  assert.match(page, /t\('setup_super_approval'\)/);
  assert.match(source('locales/en/company.json'), /SUPER ADMIN APPROVAL/);
  assert.match(page, /!copyReasonValid\(reason\)/);
  assert.match(page, /if \(!error\?\.response\)/);
  assert.match(page, /requestVersion\.current/);
  assert.match(page, /reloadCycles\?\.\(\)/);
});

test('frontend has a safe, concise API error fallback', () => {
  assert.equal(errorMessage({ response: { data: { message: 'Target not empty' } } }), 'Target not empty');
  assert.equal(errorMessage({}, 'Retry'), 'Retry');
});

test('Companies page hides obsolete setup hint and scopes compact buttons and form padding', () => {
  const companyPage = source('pages/companies/Companies.jsx');
  const styles = source('pages/companies/Companies.css');
  const setupPage = source('pages/companies/CompanySetupCopy.jsx');
  assert.match(companyPage, /<ModuleShell className="companies-page">/);
  assert.match(companyPage, /import '\.\/Companies\.css'/);
  assert.doesNotMatch(companyPage, /Creating Lambert CIV\?|Use approved Lambert CIV details/);
  assert.match(styles, /\.companies-page button\s*\{\s*font-size:\s*12\.5px/);
  assert.match(styles, /\.companies-form-card \.mod-form\s*\{\s*padding-bottom:\s*32px/);
  assert.match(setupPage, /t\('setup_description'\)/);
  assert.match(source('locales/en/company.json'), /Select an empty target company and an active source appraisal cycle/);
});


test('setup-copy approval covers the entire viewport and keeps both themes', () => {
  const page = source('pages/companies/CompanySetupCopy.jsx');
  const styles = source('pages/companies/CompanySetupCopy.css');
  assert.match(page, /import \{ createPortal \} from 'react-dom'/);
  assert.match(page, /createPortal\(<div className=\{`csc__overlay theme-\$\{theme\}`\}/);
  assert.match(page, /<\/div>, document\.body\)\}/);
  assert.match(page, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(styles, /\.csc__overlay \{ position: fixed; inset: 0; z-index: 6000;/);
  assert.match(styles, /\.csc__overlay\.theme-light \{/);
  assert.match(styles, /\.csc__overlay\.theme-dark \{/);
});
