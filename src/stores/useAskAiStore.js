import { create } from 'zustand';

/**
 * Ask AI panel state, kept outside the page so a conversation survives page changes.
 * Cleared whenever the signed-in user, role or company context changes.
 */
const useAskAiStore = create((set, get) => ({
  open: false,
  scope: '',
  conversationId: null,
  messages: [],
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  ensureScope: (scope) => {
    if (get().scope !== scope) set({ scope, conversationId: null, messages: [] });
  },
  setConversationId: (conversationId) => set({ conversationId }),
  addMessage: (message) => set({ messages: [...get().messages, message] }),
  reset: () => set({ conversationId: null, messages: [] }),
}));

export default useAskAiStore;
