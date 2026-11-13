import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const page = get('../pages/cycles/CopyQuestions.jsx');
const service = get('../services/questionCopy.js');
const router = get('../App.jsx');
const overview = get('../pages/cycles/CyclesOverview.jsx');
const detail = get('../pages/cycles/ViewCycle.jsx');

test('question-only copy uses an independent Super Admin route', () => {
  assert.match(router, /path="\/cycles\/copy-questions"/);
  assert.match(page, /user\?\.role !== 'super_admin'/);
  assert.match(overview, /role === 'super_admin'[\s\S]*cx\('copy_questions'\)/);
  assert.equal(JSON.parse(get('../locales/en/cycles.json')).cyc_copy_questions, 'Copy Questions');
  assert.match(detail, /to=\{`\/cycles\/copy-questions\?target_cycle_id=\$\{id\}`\}/);
});

test('question preview is scoped by both cycle ids and independent of View Context', () => {
  assert.match(service, /api\.get\('\/cycles\/questions-copy'/);
  assert.match(service, /api\.post\('\/cycles\/questions-copy'/);
  assert.match(service, /skipPortalContext: true/g);
  assert.match(page, /sourceCompanyId/);
  assert.match(page, /targetCompanyId/);
});

test('selection is explicit, duplicates and blocked entries are disabled, approval requires reason', () => {
  assert.match(page, /q\.status === 'ready'/);
  assert.match(page, /disabled=\{q\.status !== 'ready'\}/);
  assert.match(page, /validReason\(reason\)/);
  assert.match(page, /questionKeys: eligibleSelection\.map/);
});

test('approval portal covers full viewport and restores scroll after dismissal', () => {
  assert.match(page, /createPortal\(/);
  assert.match(page, /document\.body/);
  assert.match(page, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(get('../pages/cycles/CopyQuestions.css'), /\.cqc-overlay\s*\{[^}]*position:fixed; inset:0;/);
});

test('KPI and General Questions pages link to source-prefilled question copy', () => {
  const list = get('../pages/questions/QuestionsOverview.jsx');
  assert.match(list, /role === 'super_admin'[\s\S]*qt\('copy_questions'\)/);
  assert.equal(JSON.parse(get('../locales/en/questions.json')).copy_questions, 'Copy Questions');
  assert.match(list, /source_cycle_id=\$\{cycleId\}/);
  assert.match(page, /params\.get\('source_cycle_id'\)/);
});
