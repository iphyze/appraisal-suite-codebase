/**
 * Audit presentation only. The server's immutable action, target and description
 * are never rewritten, and unknown identifiers are displayed verbatim.
 * English retains the existing raw-code presentation.
 */
export const AUDIT_ACTION_KEYS = Object.freeze({
  login: 'audit_action_login',
  force_change_password: 'audit_action_force_change_password',
  reset_password: 'audit_action_reset_password',
  create_user: 'audit_action_create_user',
  update_user: 'audit_action_update_user',
  delete_user: 'audit_action_delete_user',
  update_profile: 'audit_action_update_profile',
  assign_subordinates: 'audit_action_assign_subordinates',
  unassign_subordinates: 'audit_action_unassign_subordinates',
  supervisor_onboard: 'audit_action_supervisor_onboard',
  supervisor_onboarding_reset: 'audit_action_supervisor_onboarding_reset',
  create_appraisal: 'audit_action_create_appraisal',
  update_appraisal: 'audit_action_update_appraisal',
  submit_feedback: 'audit_action_submit_feedback',
  create_cycle: 'audit_action_create_cycle',
  update_cycle: 'audit_action_update_cycle',
  delete_cycle: 'audit_action_delete_cycle',
  copy_cycle: 'audit_action_copy_cycle',
  update_cycle_scoring: 'audit_action_update_cycle_scoring',
  assign_staff_scoring_profile: 'audit_action_assign_staff_scoring_profile',
  bulk_assign_staff_scoring_profile: 'audit_action_bulk_assign_staff_scoring_profile',
  create_company: 'audit_action_create_company',
  update_company: 'audit_action_update_company',
  delete_company: 'audit_action_delete_company',
  copy_company_setup: 'audit_action_copy_company_setup',
  copy_cycle_questions: 'audit_action_copy_cycle_questions',
  create_department: 'audit_action_create_department',
  update_department: 'audit_action_update_department',
  delete_department: 'audit_action_delete_department',
  create_section: 'audit_action_create_section',
  update_section: 'audit_action_update_section',
  delete_section: 'audit_action_delete_section',
  create_kpi_question: 'audit_action_create_kpi_question',
  update_kpi_question: 'audit_action_update_kpi_question',
  delete_kpi_question: 'audit_action_delete_kpi_question',
  bulk_create_kpi_questions: 'audit_action_bulk_create_kpi_questions',
  bulk_update_kpi_questions: 'audit_action_bulk_update_kpi_questions',
  create_general_question: 'audit_action_create_general_question',
  update_general_question: 'audit_action_update_general_question',
  delete_general_question: 'audit_action_delete_general_question',
  bulk_create_general_questions: 'audit_action_bulk_create_general_questions',
  bulk_update_general_questions: 'audit_action_bulk_update_general_questions',
  set_kpi_assignments: 'audit_action_set_kpi_assignments',
  update_admin_appraisal_visibility: 'audit_action_update_admin_appraisal_visibility',
  email_delivery_changed: 'audit_action_email_delivery_changed',
  send_manual_email: 'audit_action_send_manual_email',
  system_revoke_company_access: 'audit_action_system_revoke_company_access',
  approve_content_translation: 'audit_action_approve_content_translation',
  save_content_translation_draft: 'audit_action_save_content_translation_draft',
  import_content_translation_draft: 'audit_action_import_content_translation_draft',
  approve_imported_content_translation: 'audit_action_approve_imported_content_translation',
});

export const AUDIT_TARGET_KEYS = Object.freeze({
  users: 'audit_target_users',
  companies: 'audit_target_companies',
  appraisal_cycles: 'audit_target_appraisal_cycles',
  appraisals: 'audit_target_appraisals',
  departments: 'audit_target_departments',
  sections: 'audit_target_sections',
  appraisal_sections: 'audit_target_appraisal_sections',
  kpi_questions: 'audit_target_kpi_questions',
  general_questions: 'audit_target_general_questions',
  supervisor_assignments: 'audit_target_supervisor_assignments',
  supervisor_onboarding: 'audit_target_supervisor_onboarding',
  admin_appraisal_visibility_policies: 'audit_target_admin_appraisal_visibility_policies',
  admin_company_access_grants: 'audit_target_admin_company_access_grants',
  company_setup_copy: 'audit_target_company_setup_copy',
  content_translations: 'audit_target_content_translations',
});

/** Only structured, known identifiers receive a French-facing label. */
export function displayAuditIdentifier(value, catalog, t, locale = 'en') {
  const original = value == null ? '' : String(value);
  if (locale !== 'fr' && locale !== 'en-XA') return original;
  const key = Object.hasOwn(catalog, original) ? catalog[original] : null;
  return key ? t(key) : original;
}
