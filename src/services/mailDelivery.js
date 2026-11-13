import api from './api';

// Super Admin only. The server never returns credentials, only whether each method is set up.
export const getMailDelivery = async () => {
  const response = await api.get('/mail/delivery-settings', { skipRetry: true });
  return response.data?.data;
};

export const updateMailDelivery = async (provider, fallbackEnabled, reason) => {
  const response = await api.put('/mail/delivery-settings', {
    provider, fallback_enabled: fallbackEnabled, reason,
  }, { skipRetry: true });
  return response.data?.data;
};

export const sendMailDeliveryTest = async (provider, to = '') => {
  const response = await api.post('/mail/delivery-settings/test', { provider, ...(to ? { to } : {}) }, { skipRetry: true });
  return response.data?.data;
};
