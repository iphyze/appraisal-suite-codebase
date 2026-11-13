import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import PageNav from '../components/PageNav';
import useThemeStore from '../stores/useThemeStore';
import Header from './Header';
import NavBar from './NavBar';
import './ComingSoon.css';

const ComingSoon = ({
  title,
  subtitle,
}) => {
  const { t } = useTranslation('common');
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();
  const displayTitle = title === 'Sections' ? t('placeholder_sections') : title;
  const displaySubtitle = subtitle || t('placeholder_default_subtitle');
  useEffect(() => { document.title = t('placeholder_document_title', { title: displayTitle }); }, [displayTitle, t]);

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`ap-route-placeholder theme-${theme}`}>
          <PageNav
            eyebrow={t('placeholder_module')}
            pageTitle={displayTitle}
            subtitle={displaySubtitle}
            links={[{ label: displayTitle }]}
          />
          <div className="ap-route-placeholder__card">
            <span><Wrench size={22} /></span>
            <h2>{t('placeholder_heading', { title: displayTitle })}</h2>
            <p>{t('placeholder_description')}</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComingSoon;
