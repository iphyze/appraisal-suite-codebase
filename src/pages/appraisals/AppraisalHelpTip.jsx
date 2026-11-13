import React from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';

const AppraisalHelpTip = ({ text, label }) => {
  const { t } = useTranslation('appraisals');
  return (
  <span
    className="apr-help-tip"
    tabIndex={0}
    role="note"
    aria-label={t('form.helpAria', { label: label || t('form.help'), text })}
    data-tooltip={text}
  >
    <AppIcon icon={CircleHelp} size={14} />
  </span>
  );
};

export default AppraisalHelpTip;
