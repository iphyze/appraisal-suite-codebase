import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Link, useParams } from 'react-router-dom';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import useThemeStore from '../../stores/useThemeStore';
import useCyclesStore from '../../stores/useCyclesStore';
import CycleForm from './CycleForm';
import './Cycles.css';
import AppIcon from '../../components/ui/AppIcon';

const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const EditCycle = () => {
  const { i18n: language } = useTranslation('cycles');
  useEffect(() => { document.title = cx('edit_document_title'); }, [language.language]);
  const [nav, setNav] = useState(false);
  const { id } = useParams();
  const { theme } = useThemeStore();
  const { singleCycle, fetchingSingle, singleCycleError, fetchSingleCycle, clearSingleCycle } = useCyclesStore();

  useEffect(() => {
    fetchSingleCycle(id);
    return () => clearSingleCycle();
  }, [id, fetchSingleCycle, clearSingleCycle]);

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`cyc-page theme-${theme}`}>
          <PageNav
            pageTitle={cx('edit_cycle')}
            links={[
              { label: cx('dashboard'), to: '/dashboard', active: true },
              { label: cx('cycles'), to: '/cycles/home', active: true },
              { label: cx('edit_cycle'), to: `/cycles/edit/${id}`, active: false },
            ]}
          />

          {fetchingSingle ? (
            <div className="cyc-form-card"><div className="cyc-skeleton-panel" /></div>
          ) : singleCycleError ? (
            <div className="cyc-empty-state">
              <div className="cyc-empty-icon"><AppIcon icon="TriangleAlert" /></div>
              <h3>{cx('unable_load')}</h3>
              <p>{singleCycleError}</p>
              <Link className="cyc-btn cyc-btn--primary" to="/cycles/home">{cx('back_to_cycles')}</Link>
            </div>
          ) : (
            <CycleForm mode="edit" initialCycle={singleCycle} />
          )}
        </main>
      </div>
    </div>
  );
};

export default EditCycle;
