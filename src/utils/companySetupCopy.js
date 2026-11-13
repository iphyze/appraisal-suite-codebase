/**
 * Batch 9B: display-side validation for a Super Admin company setup copy.
 * The PHP API validates and authorizes every ID, permission and target again.
 */
export const companyCodeValid = (code) => /^[A-Z0-9_]{2,20}$/.test(String(code || '').trim().toUpperCase());
export const copyReasonValid = (reason) => {
  const length = Array.from(String(reason || '').trim()).length;
  return length >= 5 && length <= 500;
};

const positiveId = (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0;

export const validateSetupSelection = ({ sourceCycleId, targetCompanyId, cycles, companies }) => {
  if (!positiveId(sourceCycleId)) return 'Select an active source appraisal cycle.';
  if (!positiveId(targetCompanyId)) return 'Select the new target company.';
  const source = (cycles || []).find((cycle) => String(cycle.id) === String(sourceCycleId));
  if (!source || Number(source.is_active) !== 1) return 'Select an active source appraisal cycle.';
  const target = (companies || []).find((company) => String(company.id) === String(targetCompanyId));
  if (!target || Number(target.is_active) !== 1) return 'Select an active target company.';
  if (String(source.company_id) === String(targetCompanyId)) return 'Source and target companies must be different.';
  return '';
};

export const previewMatchesSelection = (preview, sourceCycleId, targetCompanyId) =>
  !!preview && String(preview.source_cycle?.id) === String(sourceCycleId)
    && String(preview.target_company?.id) === String(targetCompanyId);

// A concise, complete preview of all configuration categories returned by the backend.
export const SETUP_COUNT_LABELS = [
  ['departments', 'Departments'],
  ['cycles', 'Appraisal cycles'],
  ['sections', 'Appraisal sections'],
  ['objective_section_settings', 'Objective section settings'],
  ['scoring_profiles', 'Scoring profiles'],
  ['profile_section_weights', 'Profile/section weights'],
  ['rating_bands', 'Rating bands'],
  ['rating_points', 'Rating points'],
  ['general_questions', 'General questions'],
  ['general_question_profiles', 'Question/profile links'],
  ['department_kpis', 'Company/department KPI questions'],
];

export const errorMessage = (error, fallback = 'Unable to load company setup.') =>
  error?.response?.data?.message || error?.message || fallback;
