import api from './api';

// The backend owns both Super Admin authorization and global approval auditing.
export async function getTranslationInventory(filters = {}, signal) {
  const response = await api.get('/translations/manage', {
    params: filters,
    signal,
    skipRetry: true,
  });
  return response.data;
}

export async function saveTranslationReview(payload) {
  const response = await api.put('/translations/manage', payload, { skipRetry: true });
  return response.data?.data;
}

// GET produces the verified XLSX workbook using the existing backend exporter.
export async function exportTranslationWorkbook(filters) {
  const response = await api.get('/translations/bulk', {
    params: filters, responseType: 'blob', skipRetry: true,
  });
  return response.data;
}

// Excel is decoded locally; the server previews and rechecks every row.
export async function previewBulkTranslations(rows) {
  const response = await api.post('/translations/bulk', { rows }, { skipRetry: true });
  return response.data?.data;
}

// CSRF, Super Admin role, source identity and optimistic revision are enforced
// on the server before a single row is committed.
export async function commitBulkTranslations(rows, action, reason) {
  const response = await api.put('/translations/bulk', { rows, action, reason }, { skipRetry: true });
  return response.data?.data;
}
