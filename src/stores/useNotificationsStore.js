import { create } from 'zustand';
import api from '../services/api';
import useLocaleStore from './useLocaleStore';

// Ignore responses from a superseded language or a newer query.
let listRequestId = 0;
let previewRequestId = 0;

const DEFAULT_META = { total: 0, read: 0, unread: 0, page: 1, total_pages: 1 };

const useNotificationsStore = create((set, get) => ({
  items: [],
  previewItems: [],
  unread: 0,
  meta: DEFAULT_META,
  loading: true,
  previewLoading: false,
  lastListQuery: null,
  pulse: { latest_id: 0, unread: 0 },
  pulseRevision: 0,

  fetchNotifications: async ({ status = 'all', limit = 10, page = 1, silent = false } = {}) => {
    if (!silent) set({ loading: true });

    const query = { status, limit, page };
    const requestId = ++listRequestId;
    const requestLocale = useLocaleStore.getState().locale;

    try {
      const params = new URLSearchParams({ status, limit: String(limit), page: String(page) });
      const response = await api.get(`/notifications/list?${params.toString()}`);
      const nextMeta = response.data?.meta || {};
      if (requestId !== listRequestId || requestLocale !== useLocaleStore.getState().locale) {
        return { success: false, superseded: true };
      }

      set({
        items: response.data?.data || [],
        unread: Number(nextMeta.unread || 0),
        meta: nextMeta,
        loading: false,
        lastListQuery: query,
      });

      return { success: true, data: response.data };
    } catch (error) {
      if (!silent && requestId === listRequestId) set({ loading: false });
      return { success: false };
    }
  },

  fetchNotificationPreview: async () => {
    set({ previewLoading: true });
    const requestId = ++previewRequestId;
    const requestLocale = useLocaleStore.getState().locale;

    try {
      const response = await api.get('/notifications/list?status=all&limit=10&page=1');
      const nextMeta = response.data?.meta || {};
      const previewItems = response.data?.data || [];
      if (requestId !== previewRequestId || requestLocale !== useLocaleStore.getState().locale) {
        return { success: false, superseded: true, items: [] };
      }

      set({
        previewItems,
        unread: Number(nextMeta.unread || 0),
        previewLoading: false,
      });

      return { success: true, data: response.data, items: previewItems };
    } catch (error) {
      if (requestId === previewRequestId) set({ previewLoading: false });
      return { success: false, items: [] };
    }
  },

  checkNotificationPulse: async () => {
    try {
      const response = await api.get('/notifications/pulse');
      const nextPulse = {
        latest_id: Number(response.data?.data?.latest_id || 0),
        unread: Number(response.data?.data?.unread || 0),
      };
      const previousPulse = get().pulse;
      const changed = (
        Number(previousPulse.latest_id || 0) !== nextPulse.latest_id
        || Number(previousPulse.unread || 0) !== nextPulse.unread
      );

      set((state) => ({
        pulse: nextPulse,
        unread: nextPulse.unread,
        pulseRevision: changed ? state.pulseRevision + 1 : state.pulseRevision,
      }));

      return { success: true, data: nextPulse, changed, previous: previousPulse };
    } catch (error) {
      return { success: false, changed: false };
    }
  },

  markRead: async (id = null) => {
    try {
      await api.put('/notifications/read', id ? { id } : {});

      const listQuery = get().lastListQuery;
      const refreshes = [get().fetchNotificationPreview(), get().checkNotificationPulse()];
      if (listQuery) {
        refreshes.push(get().fetchNotifications({ ...listQuery, silent: true }));
      }
      await Promise.all(refreshes);

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },
}));

export default useNotificationsStore;
