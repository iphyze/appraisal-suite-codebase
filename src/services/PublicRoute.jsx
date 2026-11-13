import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { safeReturnPath } from '../utils/safeReturnPath';

const needsPasswordUpdate = (user) => {
  if (!['admin', 'supervisor', 'staff'].includes(user?.role)) return false;
  return Number(user?.must_change_password || 0) === 1 || user?.must_change_password === true;
};

const PublicRoute = ({ children }) => {
  const { user, authenticated, sessionChecked, checkingSession, init } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!sessionChecked && !checkingSession) init();
  }, [sessionChecked, checkingSession, init]);

  if (!sessionChecked || checkingSession) {
    return <AppLoadingScreen label="Checking your secure session" />;
  }

  if (authenticated) {
    return <Navigate to={needsPasswordUpdate(user) ? '/change-password' : safeReturnPath(location.state?.from)} replace />;
  }

  return children;
};

export default PublicRoute;
