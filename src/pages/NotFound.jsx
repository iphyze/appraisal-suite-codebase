import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, House, MapPin } from 'lucide-react';
import Header from './Header';
import NavBar from './NavBar';
import useAuthStore from '../stores/useAuthStore';
import useThemeStore from '../stores/useThemeStore';
import './NotFound.css';

const NotFound = () => {
  const { t } = useTranslation('common');
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const authed = typeof isAuthenticated === 'function' ? isAuthenticated() : false;

  const content = (
    <motion.div
      className={`nf-card theme-${theme}`}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="nf-card__badge"><MapPin size={15} /> 404</span>
      <h1>{t('page_not_found')}</h1>
      <p>{t('not_found_detail')}</p>
      <div className="nf-card__actions">
        <Link to={authed ? '/dashboard' : '/login'} className="nf-card__primary">
          <House size={16} /> {authed ? t('back_to_dashboard') : t('back_to_login')}
        </Link>
        <button type="button" className="nf-card__secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> {t('go_back')}
        </button>
      </div>
    </motion.div>
  );

  if (!authed) {
    return <div className={`nf-public theme-${theme}`}>{content}</div>;
  }

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`nf-page theme-${theme}`}>{content}</div>
      </main>
    </div>
  );
};

export default NotFound;
