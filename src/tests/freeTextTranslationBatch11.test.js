import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const view = load('pages/appraisals/AppraisalView.jsx');
const controls = load('components/ai/FreeTextTranslation.jsx');
const api = load('services/aiAssistant.js');

test('on-demand comments remain server-authorized and opt-in', () => {
  assert.match(api, /appraisal_id: Number\(appraisalId\), field, record_id: Number\(recordId\)/);
  assert.match(api, /request_id: makeRequestId\(\)/);
  assert.doesNotMatch(api.slice(api.indexOf('export const translateAppraisalFreeText')), /sourceText|originalText|comment:|feedback:/);
  assert.match(view, /enabled=\{freeTextEnabled\}/);
  assert.match(view, /getAiFreeTextTranslationStatus\(\)/);
});

test('people’s original written notes are displayed unchanged until requested', () => {
  assert.match(controls, /showTranslation \? translation : text/);
  assert.match(controls, /setShowTranslation\(\(previous\) => !previous\)/);
  assert.match(controls, /'view\.translation\.machine'/);
  assert.doesNotMatch(controls, /dangerouslySetInnerHTML|saveAppraisal|submitFeedback/);
  assert.match(view, /<textarea value=\{feedback\}/);
});

test('approved response IDs and field contexts cover staff, supervisors and management', () => {
  for (const name of ['feedback', 'management_note', 'management_response', 'section_comment',
    'breach_review_note', 'breach_verification_note', 'supervisor_development', 'breach_reason']) {
    assert.ok(view.includes(`'${name}'`), name);
  }
  assert.match(view, /response\.response_id/);
  assert.match(view, /`\$\{response\.response_table\}_comment`/);
});

test('language switching invalidates old translation responses', () => {
  assert.match(controls, /generation\.current \+= 1/);
  assert.match(controls, /generation\.current !== mine/);
  assert.match(controls, /\[text, appraisalId, field, recordId, locale\]/);
  assert.match(controls, /result\.target_locale !== locale/);
});

test('English and French catalogs have the same translation controls', () => {
  const en = JSON.parse(load('locales/en/appraisals.json')).view.translation;
  const fr = JSON.parse(load('locales/fr/appraisals.json')).view.translation;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
  const enAi = JSON.parse(load('locales/en/ai.json'));
  const frAi = JSON.parse(load('locales/fr/ai.json'));
  assert.ok(enAi.feature_content_translation_label && frAi.feature_content_translation_label);
});
