import { useTranslation } from 'react-i18next';
import appraisalSuiteMark from '../assets/images/appraisalsuite/logo/appraisalsuite-mark-128px.png';

const AppLoadingScreen = ({ label }) => {
  const { t } = useTranslation('common');
  const displayLabel = label === 'Loading your workspace' ? t('loading_your_workspace') : label === 'Checking your secure session' ? t('checking_secure_session') : label === 'Verifying company access' ? t('verifying_company_access') : label || t('preparing_appraisalsuite');
  return (
  <div className="ap-boot-loader" role="status" aria-live="polite" aria-label={displayLabel}>
    <div className="ap-boot-loader__mark" aria-hidden="true">
      <img src={appraisalSuiteMark} alt="" />
    </div>
    <div className="ap-boot-loader__copy">
      <strong>AppraisalSuite</strong>
      <span>{displayLabel}</span>
    </div>
    <div className="ap-boot-loader__bar" aria-hidden="true"><span /></div>
  </div>
);
};

export default AppLoadingScreen;
