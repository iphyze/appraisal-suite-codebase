import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';
import AppLoadingScreen from './AppLoadingScreen';
import LanguageChoiceModal from './onboarding/LanguageChoiceModal';
import useLocaleStore from '../stores/useLocaleStore';
import { needsLanguageChoice } from '../utils/localeRules';
import { useTranslation } from 'react-i18next';

const needsPasswordUpdate = (user) => {
  if (!['admin', 'supervisor', 'staff'].includes(user?.role)) return false;
  return Number(user?.must_change_password || 0) === 1 || user?.must_change_password === true;
};

const ProtectedRoute = ({ children }) => {
  const { user, authenticated, sessionChecked, checkingSession, init } = useAuthStore();
  const location = useLocation();
  const transferringLoginChoice = useLocaleStore((state) => state.transferringLoginChoice);
  const { t } = useTranslation('auth');

  useEffect(() => {
    if (!sessionChecked && !checkingSession) init();
  }, [sessionChecked, checkingSession, init]);

  if (!sessionChecked || checkingSession) {
    return <AppLoadingScreen label="Checking your secure session" />;
  }

  if (!authenticated) {
    // Keep the full address (e.g. the appraisal being filled in) to return to after signing in.
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (needsPasswordUpdate(user) && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  // Never interrupt a forced password change; the modal is shown afterwards
  // only if the user did not already choose on login or ChangePassword.
  if (location.pathname !== '/change-password' && needsLanguageChoice(user)) {
    if (transferringLoginChoice) {
      return <AppLoadingScreen label={t('saving_language')} />;
    }
    return <LanguageChoiceModal />;
  }

  return children;
};

export default ProtectedRoute;
