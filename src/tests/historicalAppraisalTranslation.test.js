import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeAppraisalProgress } from '../utils/appraisalDraft.js';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const form = source('pages/appraisals/AppraisalForm.jsx');
const view = source('pages/appraisals/AppraisalView.jsx');
const myList = source('pages/my-appraisals/MyAppraisals.jsx');
const list = source('pages/appraisals/Appraisals.jsx');

test('editable KPI questions initialise from the original English source, not the French display', () => {
  assert.match(form, /original_question_text:\s*question\.question_text_source\s*\?\?\s*question\.question_text/);
  assert.match(form, /question\.question_type === 'kpi'[\s\S]*?question\.question_text_source\s*\?\?\s*question\.question_text/);
  assert.match(form, /question_text:\s*\(question\.is_edited\s*\|\|\s*question\.is_custom\)[\s\S]*?question\.original_question_text\s*\?\?\s*question\.question_text/);
  assert.match(form, /question\.question_text_display\s*\|\|\s*question\.question_text/);
});

test('language switching fetches translated snapshots without resetting draft identity or form progress', () => {
  assert.match(form, /\[identity, isEdit, fetchFormData, i18n\.resolvedLanguage\]/);
  assert.match(form, /initializedForRef\.current === draftIdentity && progressRef\.current/);
  assert.match(form, /mergeAppraisalProgress\(state, progressRef\.current\)/);
  assert.match(form, /question\.is_edited\s*\?\s*\{ question_text:/);
});

test('mergeAppraisalProgress keeps entered fields but updates untouched French display questions', () => {
  const fresh = {
    sections: [{ id: 2, questions: [
      { local_id: '2-11', question_text: 'Texte français', rating_comment: '', actual_result: '', is_edited: false },
      { local_id: '2-12', question_text: 'Source English', rating_comment: '', actual_result: '', is_edited: false },
    ] }],
    ratings: { 2: { '2-11': '' } }, ratingModes: { 2: 'per_question' },
    sectionOverallRatings: {}, sectionOverallComments: {},
    questionWeightingModes: {}, questionWeights: {}, breach: {}, recommendations: {},
  };
  const saved = { sections: [{ id: 2, questions: [
    { local_id: '2-11', rating_comment: 'My own feedback', is_edited: false },
    { local_id: '2-12', question_text: 'Supervisor edited objective', is_edited: true },
  ] }], ratings: { 2: { '2-11': 4.5 } } };
  const result = mergeAppraisalProgress(fresh, saved);
  assert.equal(result.sections[0].questions[0].question_text, 'Texte français');
  assert.equal(result.sections[0].questions[0].rating_comment, 'My own feedback');
  assert.equal(result.sections[0].questions[1].question_text, 'Supervisor edited objective');
  assert.equal(result.sections[0].questions[1].is_edited, true);
  assert.equal(result.ratings[2]['2-11'], 4.5);
});

test('read-only view and both appraisal lists re-fetch on language changes', () => {
  assert.match(view, /\[id, fetchSingleAppraisal, i18n\.resolvedLanguage\]/);
  assert.match(myList, /fetchAppraisals, i18n\.resolvedLanguage\]/);
  assert.match(myList, /\[user\?\.role, i18n\.resolvedLanguage\]/);
  assert.match(list, /fetchCandidates, fetchAppraisals, i18n\.resolvedLanguage\]/);
  assert.match(list, /\}, \[i18n\.resolvedLanguage\]\);/);
  assert.match(view, /appraisal\?\.staff_department_display\s*\|\|\s*appraisal\?\.staff_department/);
});
