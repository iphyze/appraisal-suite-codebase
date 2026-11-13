import { useTranslation } from 'react-i18next';
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, House } from 'lucide-react';
import useThemeStore from '../stores/useThemeStore';
import AppIcon from './ui/AppIcon';
import './PageNav.css';

const PageNav = ({
  pageTitle,
  subtitle,
  links = [],
  actions,
  eyebrow,
}) => {
  const { t } = useTranslation('nav');
  const { theme } = useThemeStore();

  return (
    <motion.div
      className={`pn-root ${theme === 'dark' ? 'pn-root--dark' : 'pn-root--light'}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="pn-left">
        {eyebrow && <span className="pn-eyebrow">{eyebrow}</span>}
        <h1 className="pn-title">{pageTitle}</h1>
        {subtitle && <p className="pn-subtitle">{subtitle}</p>}
      </div>

      <div className="pn-right">
        <nav className="pn-breadcrumb" aria-label={t('breadcrumb')}>
          <Link to="/dashboard" className="pn-home" aria-label={t('dashboard')}>
            <AppIcon icon={House} size={14} />
          </Link>
          {links.map((link, index) => {
            const isLast = index === links.length - 1;
            return (
              <React.Fragment key={`${link.label}-${index}`}>
                <AppIcon icon={ChevronRight} size={13} className="pn-sep" />
                {link.to && !isLast ? (
                  <Link to={link.to} className="pn-crumb pn-crumb--link">{link.label}</Link>
                ) : (
                  <span className={`pn-crumb ${isLast ? 'pn-crumb--active' : 'pn-crumb--plain'}`}>{link.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
        {actions && <div className="pn-actions">{actions}</div>}
      </div>
    </motion.div>
  );
};

export default PageNav;
