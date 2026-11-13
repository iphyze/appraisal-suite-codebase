import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const updateBodyClass = (theme) => {
  if (typeof window !== 'undefined') {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
  }
};

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light',

      setTheme: (theme) => {
        set({ theme });
        updateBodyClass(theme);
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
        updateBodyClass(newTheme);
      },

      init: () => {
        updateBodyClass(get().theme);
      },
    }),
    {
      name: 'appraisal-theme',
    }
  )
);

export default useThemeStore;