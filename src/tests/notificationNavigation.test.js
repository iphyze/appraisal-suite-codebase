import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notificationCompanyDecision, safeNotificationPath } from '../utils/notificationNavigation.js';

const home = { id: 61, role: 'admin', company_id: 1 };
const grants = [
  { company_id: 1, is_home: true, access_level: 'full' },
  { company_id: 3, is_home: false, access_level: 'view', staff_scope: 'Local' },
  { company_id: 4, is_home: false, access_level: 'manage', staff_scope: 'Expatriate' },
];

test('safe internal links and links without destination', () => {
  assert.equal(safeNotificationPath('/appraisals/view/203'), '/appraisals/view/203');
  assert.equal(safeNotificationPath('/supervisors/assignments?supervisor_id=4'), '/supervisors/assignments?supervisor_id=4');
  assert.equal(safeNotificationPath(null), '/notifications');
});

test('external, protocol-relative, backslash and encoded redirect attempts are blocked', () => {
  for (const input of ['https://outside.test', '//evil.test', '/\\evil.test', '/%2F%2Fevil.test', '/%5Cevil', '/\nexample', '/%0dexample']) {
    assert.equal(safeNotificationPath(input), '/notifications');
  }
});

test('admin home-company notifications return to home context', () => {
  assert.deepEqual(notificationCompanyDecision({ company_id: 1 }, home, grants), { allowed: true, selection: '' });
});

test('view and manage grants can open authorized notification targets', () => {
  assert.deepEqual(notificationCompanyDecision({ company_id: 3 }, home, grants), { allowed: true, selection: '3' });
  assert.deepEqual(notificationCompanyDecision({ company_id: 4 }, home, grants), { allowed: true, selection: '4' });
});

test('revocation and unknown companies refuse selection', () => {
  assert.equal(notificationCompanyDecision({ company_id: 3 }, home, grants.filter((r) => r.company_id !== 3)).allowed, false);
  assert.equal(notificationCompanyDecision({ company_id: 99 }, home, grants).allowed, false);
});

test('Super Admin retains company-switching; supervisor/staff cannot switch', () => {
  assert.equal(notificationCompanyDecision({ company_id: 3 }, { role: 'super_admin', company_id: 1 }, []).selection, '3');
  for (const role of ['supervisor','staff']) {
    assert.equal(notificationCompanyDecision({ company_id: 3 }, { role, company_id: 1 }, []).allowed, false);
    assert.equal(notificationCompanyDecision({ company_id: 1 }, { role, company_id: 1 }, []).allowed, true);
  }
});

test('personal company-less notifications do not switch company', () => {
  assert.deepEqual(notificationCompanyDecision({ company_id: null }, home, grants), { allowed: true, selection: null });
});

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('both inbox and header use the same verified navigation service', () => {
  for (const page of ['pages/Header.jsx','pages/notifications/Notifications.jsx']) {
    const code = source(page);
    assert.match(code, /openVerifiedNotification/);
    assert.match(code, /company_name/);
  }
});

test('navigation rechecks notification ownership, live grants, personal read and company cache reset', () => {
  const service = source('services/notificationNavigation.js');
  assert.match(service, /api\.get\('\/notifications\/open'/);
  assert.match(service, /api\.get\('\/users\/my-accessible-companies'/);
  assert.match(service, /skipPortalContext: true/);
  assert.match(service, /setAccessibleCompanies\(companies, actor\)/);
  assert.match(service, /markRead\(verified.id\)/);
  assert.match(service, /window\.location\.assign\(path\)/);
  assert.match(service, /showToast\('Your access to the company/);
});
