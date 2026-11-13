/** API-driven submitted-objective permission and summary presentation. */
const reasonKeys = Object.freeze({
  'appraisal.noUpdates': 'noUpdates',
  'appraisal.notFound': 'notFound',
  'appraisal.companyDenied': 'companyDenied',
  'appraisal.scopeDenied': 'scopeDenied',
  'appraisal.supervisorOnly': 'supervisorOnly',
  'appraisal.assignmentChanged': 'assignmentChanged',
  'appraisal.onboardingEdit': 'onboardingEdit',
});

export const objectiveDenialKey = (apiReason) => `objectiveFlow.denial.${reasonKeys[apiReason] || 'notAllowed'}`;
export const canAdjustSubmittedObjectives = (record) => Number(record?.can_adjust_objectives) === 1;
export const updatesRemaining = (record) => record?.updates_left == null ? null : Math.max(0, Number(record.updates_left) || 0);
export const isObjectiveReratingPending = (record) => Number(record?.objectives_changed_since_submission) === 1;
export const objectiveChangeCounts = (summary) => ({
  added: Array.isArray(summary?.added) ? summary.added.length : 0,
  removed: Array.isArray(summary?.removed) ? summary.removed.length : 0,
  changed: Array.isArray(summary?.changed) ? summary.changed.length : 0,
});
