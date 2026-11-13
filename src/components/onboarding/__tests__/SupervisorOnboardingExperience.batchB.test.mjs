import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { formatNumber } from '../../../utils/format.js';

const base = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const guide = readFileSync(resolve(base, 'components/onboarding/SupervisorOnboardingExperience.jsx'), 'utf8');
const css = readFileSync(resolve(base, 'components/onboarding/SupervisorOnboardingExperience.css'), 'utf8');
const ratingField = readFileSync(resolve(base, 'pages/appraisals/RatingField.jsx'), 'utf8');
const en = JSON.parse(readFileSync(resolve(base, 'locales/en/appraisals.json'), 'utf8'));
const fr = JSON.parse(readFileSync(resolve(base, 'locales/fr/appraisals.json'), 'utf8'));

test('configured rating values show natural decimals, localized without 1.00', () => {
  const display = (value, locale) => formatNumber(value, { maximumFractionDigits: 3 }, locale);
  for (const n of [1, 2, 3, 4, 5]) {
    assert.equal(display(`${n}.00`, 'en'), `${n}`);
    assert.equal(display(`${n}.00`, 'fr'), `${n}`);
  }
  assert.equal(display('2.50', 'en'), '2.5');
  assert.equal(display('2.50', 'fr'), '2,5');
  assert.equal(display('2.125', 'fr'), '2,125');
  assert.match(guide, /formatNumber\(score, \{ maximumFractionDigits: 3 \}, locale\)/);
  assert.match(ratingField, /label: formatNumber\(value, \{ maximumFractionDigits: 3 \}, locale\)/);
  assert.match(ratingField, /minimumFractionDigits: points.length \? 0 : precision/);
});

test('evidenceRequirement is not inserted into the evidence examples', () => {
  assert.match(guide, /evidence: base\?\.evidence \|\| \[t\('onboarding.evidenceFallback'\)\]/);
  assert.match(guide, /\.\.\.\(hasEvidenceRequirement \? \[evidenceRequirement\] : \[\]\)/);
  assert.match(guide, /point\.requires_comment/);
  assert.match(guide, /activeSlide\.requirements\?\.length > 0/);
  assert.match(guide, /requirements\.join\(' · '\)/);
  assert.doesNotMatch(guide, /evidence:\s*evidenceRequirement\s*\?/);
  assert.match(guide, /not required\|none/);
});

test('required-line translations exist; French colon uses a non-breaking space', () => {
  // Neutral wording: some ratings only recommend evidence (e.g. "Recommended").
  assert.equal(en.onboarding.requiredWhenRating, 'Evidence expected for this rating:');
  assert.equal(fr.onboarding.requiredWhenRating, 'Justification attendue pour cette note\u00a0:');
});

test('rating bullets are neutral dots, never approval check marks', () => {
  assert.match(css, /\.sup-onboarding__explanation-grid li::before/);
  assert.match(css, /border-radius: 50%/);
  assert.doesNotMatch(guide, /activeSlide\.(?:useWhen|evidence)\.map\([^\n]+AppIcon icon=\{Check\}/);
});

test('slide header has one number badge and no second icon tile or all-caps labels', () => {
  assert.match(guide, /className="sup-onboarding__score"/);
  assert.doesNotMatch(guide, /sup-onboarding__slide-icon/);
  for (const key of ['whatRatingMeans', 'decisionGuide', 'evidenceGuide', 'fairReminder']) {
    assert.doesNotMatch(guide, new RegExp(`t\\('onboarding\\.${key}'\\)`));
  }
  assert.match(css, /background: var\(--sup-surface\);/);
  assert.doesNotMatch(css, /radial-gradient\(circle at 100% 0%, var\(--slide-soft\)/);
});

test('active rating tab has accessible label and current marker; boundary buttons are hidden', () => {
  assert.match(guide, /aria-current=\{index === activeIndex \? 'step' : undefined\}/);
  assert.match(guide, /title=\{`\$\{displayRating\(item.score\)\} · \$\{item.title\}`\}/);
  assert.match(guide, /activeIndex > 0 &&/);
  assert.match(guide, /activeIndex < ratingSlides.length - 1 &&/);
  assert.match(guide, /if \(event.key === 'ArrowRight'\)/);
  assert.match(guide, /if \(event.key === 'ArrowLeft'\)/);
});

test('layout and accessibility handle 340 px phones and reduced motion', () => {
  assert.match(css, /@container \(min-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(guide, /useReducedMotion\(\)/);
  assert.match(css, /:focus-visible/);
});
