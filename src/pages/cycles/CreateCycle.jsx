import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import useThemeStore from '../../stores/useThemeStore';
import CycleForm from './CycleForm';
import './Cycles.css';

const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const CreateCycle = () => {
  const { i18n: language } = useTranslation('cycles');
  useEffect(() => { document.title = cx('create_document_title'); }, [language.language]);
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`cyc-page theme-${theme}`}>
          <PageNav
            pageTitle={cx('create_cycle')}
            links={[
              { label: cx('dashboard'), to: '/dashboard', active: true },
              { label: cx('cycles'), to: '/cycles/home', active: true },
              { label: cx('create_cycle'), to: '/cycles/create', active: false },
            ]}
          />
          <CycleForm mode="create" />
        </main>
      </div>
    </div>
  );
};

export default CreateCycle;
