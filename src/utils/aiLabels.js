/** User-facing labels for server-owned feature keys. Keep the server's keys and metadata intact. */
export const AI_FEATURE_KEYS = Object.freeze({
  master: ['feature_master_label', 'feature_master_description'],
  assistant: ['feature_assistant_label', 'feature_assistant_description'],
  ask_panel: ['feature_ask_panel_label', 'feature_ask_panel_description'],
  management_insights: ['feature_management_insights_label', 'feature_management_insights_description'],
  writing_assistant: ['feature_writing_assistant_label', 'feature_writing_assistant_description'],
  content_translation: ['feature_content_translation_label', 'feature_content_translation_description'],
  development_plan: ['feature_development_plan_label', 'feature_development_plan_description'],
  setup_assistant: ['feature_setup_assistant_label', 'feature_setup_assistant_description'],
  rankings: ['feature_rankings_label', 'feature_rankings_description'],
  calibration: ['feature_calibration_label', 'feature_calibration_description'],
  alerts: ['feature_alerts_label', 'feature_alerts_description'],
  progress: ['feature_progress_label', 'feature_progress_description'],
  smart_search: ['feature_smart_search_label', 'feature_smart_search_description'],
  fairness_check: ['feature_fairness_check_label', 'feature_fairness_check_description'],
  cycle_briefing: ['feature_cycle_briefing_label', 'feature_cycle_briefing_description'],
  feedback_summary: ['feature_feedback_summary_label', 'feature_feedback_summary_description'],
  explain_appraisal: ['feature_explain_appraisal_label', 'feature_explain_appraisal_description'],
  reminder_drafts: ['feature_reminder_drafts_label', 'feature_reminder_drafts_description'],
  kpi_suggestions: ['feature_kpi_suggestions_label', 'feature_kpi_suggestions_description'],
});
export function featureName(t, feature) {
  const keys = AI_FEATURE_KEYS[feature?.key];
  return keys ? t(keys[0]) : (feature?.label || feature?.key || '');
}
export function featureDescription(t, feature) {
  const keys = AI_FEATURE_KEYS[feature?.key];
  return keys ? t(keys[1]) : (feature?.description || '');
}
