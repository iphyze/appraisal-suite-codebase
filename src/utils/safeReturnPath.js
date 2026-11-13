/** Where to go after signing in: only same-app paths, never the login page itself. */
export const safeReturnPath = (from, fallback = '/dashboard') => {
  if (typeof from !== 'string') return fallback;
  if (!from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return fallback;
  if (/^\/(login|change-password)(\/|\?|$)/.test(from)) return fallback;
  return from;
};
