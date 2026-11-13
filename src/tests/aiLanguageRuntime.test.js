import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const analytics = load('../pages/ai/AiAnalytics.jsx');
const insights = load('../pages/ai/AiManagementInsights.jsx');
const explanation = load('../components/ai/ExplainAppraisalCard.jsx');
const search = load('../components/GlobalSearch.jsx');

// The API client already sends X-App-Locale, so these screens must invalidate old data.
test('AI analytics summaries reload when the selected language changes', () => {
  assert.match(analytics, /\[view, cycleId, groupBy, progressDepartment, viewCompanyId, role, languageContext\.language\]/);
  assert.match(analytics, /setData\(null\)/);
  assert.match(analytics, /mine === epoch\.current/);
});
test('management insights preserve the selected cycle and discard stale narratives on locale switching', () => {
  assert.match(insights, /const requestedCycle = sameScope \? cycleId : 0/);
  assert.match(insights, /getAiManagementInsights\(requestedCycle\)/);
  assert.match(insights, /\[contextKey, roleAllowed, languageContext\.language\]/);
  assert.match(insights, /setNarrative\(null\)/);
});
test('appraisal explanations cannot show an outdated-language generated response', () => {
  assert.match(explanation, /\[appraisalId, languageContext\.language\]/);
  assert.match(explanation, /mine === epoch\.current\) setState/);
});
test('French search suggestions re-fetch on language changes and do not display a stale result', () => {
  assert.match(search, /\[searchText, canInterpret, languageContext\.language\]/);
  assert.match(search, /setSmartState\(\{ query: '', result: null \}\)/);
  assert.match(search, /t\('suggested_action'\)/);
});
test('AI modal language changes invalidate in-flight results without clearing edited inputs', () => {
  for (const file of ['AiWritingModal.jsx', 'AiDevelopmentModal.jsx', 'AiSetupGuide.jsx']) {
    const source = load(`../components/ai/${file}`);
    assert.match(source, /\[languageContext\.language\]/, file);
    assert.doesNotMatch(source.split('}, [languageContext.language]')[0].split('useEffect(() =>').at(-1), /setDraft\(''\)|setThoughts\(''\)|setObservations\(''\)|setIntent\(''\)/, file);
  }
  assert.match(load('../components/ai/FairnessCheckModal.jsx'), /request === aiEpoch\.current/);
});
test('AI assistant and panel do not append results generated for a previous locale', () => {
  assert.match(load('../pages/ai/AiAssistant.jsx'), /requestedLanguage !== i18n\.language/);
  assert.match(load('../components/ai/AskAiPanel.jsx'), /requestedLanguage !== i18n\.language/);
});
test('both language catalogues include the translated smart-search group name', () => {
  const en = JSON.parse(load('../locales/en/nav.json'));
  const fr = JSON.parse(load('../locales/fr/nav.json'));
  assert.equal(en.suggested_action, 'Suggested action');
  assert.equal(fr.suggested_action, 'Action suggérée');
});
