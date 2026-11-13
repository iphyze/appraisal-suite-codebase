import React, { createContext, useContext } from 'react';
import useAuthStore from '../stores/useAuthStore';

// Backwards-compatible context wrapper. Authentication state is sourced from
// the secure cookie-session Zustand store; no JWT is stored in localStorage.
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const auth = useAuthStore();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
