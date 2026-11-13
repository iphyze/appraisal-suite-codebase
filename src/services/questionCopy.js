import api from './api';
import i18n from '../i18n';

export const listQuestionCopyCatalog = async () => {
  const [companies, cycles] = await Promise.all([
    api.get('/companies/list', { skipPortalContext: true }),
    api.get('/cycles/list', { params: { limit: 5000, page: 1, sortBy: 'year', sortOrder: 'DESC' }, skipPortalContext: true }),
  ]);
  if (Number(cycles.data?.meta?.total || 0) > 5000) {
    throw new Error(i18n.t('cyc_copy_catalog_too_large', { ns: 'cycles' }));
  }
  return { companies: companies.data?.data || [], cycles: cycles.data?.data || [] };
};

export const previewQuestionCopy = async (sourceCycleId, targetCycleId) => {
  const response = await api.get('/cycles/questions-copy', {
    params: { source_cycle_id: sourceCycleId, target_cycle_id: targetCycleId },
    skipPortalContext: true,
  });
  return response.data?.data;
};

export const applyQuestionCopy = async ({ sourceCycleId, targetCycleId, questionKeys, reason }) => {
  const response = await api.post('/cycles/questions-copy', {
    source_cycle_id: Number(sourceCycleId),
    target_cycle_id: Number(targetCycleId),
    question_keys: questionKeys,
    reason: reason.trim(),
  }, { skipPortalContext: true });
  return response.data?.data;
};
