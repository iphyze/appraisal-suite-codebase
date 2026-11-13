import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate, formatNumber, formatPercentage } from '../../utils/format';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useAuthStore from '../../stores/useAuthStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useThemeStore from '../../stores/useThemeStore';
import useCyclesStore from '../../stores/useCyclesStore';
import useSectionsStore from '../../stores/useSectionsStore';
import SectionModal from './SectionModal';
import ScoringConfigModal from './ScoringConfigModal';
import './Cycles.css';
import AppIcon from '../../components/ui/AppIcon';

const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const fmtDate = (value, locale) => formatDate(value, {}, locale);
const fmtWeight = (value, locale) => formatPercentage(Number(value || 0) / 100, 2, locale);
const fmtRating = (value, fallback, locale) => formatNumber(value ?? fallback, { maximumFractionDigits: 2 }, locale);

const ViewCycle = () => {
  const { i18n: language } = useTranslation('cycles');
  const locale = language.language;
  const [nav, setNav] = useState(false);
  const [sectionModal, setSectionModal] = useState(null);
  const [deleteSection, setDeleteSection] = useState(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [scoringModalOpen, setScoringModalOpen] = useState(false);
  const loadedLocale = useRef(locale);
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const {
    singleCycle,
    fetchingSingle,
    singleCycleError,
    data: cycleList,
    fetchSingleCycle,
    fetchCycles,
    clearSingleCycle,
    copyCycle,
    scoringConfig,
    fetchScoringConfig,
  } = useCyclesStore();
  const { data: sections, loading: sectionsLoading, error: sectionsError, fetchSections, deleteSections } = useSectionsStore();

  const { settingsLocked } = useCompanyWritePermission();
  const canManage = ['super_admin', 'admin'].includes(currentUser?.role) && !settingsLocked;

  const refreshSections = () => fetchSections({ cycleId: id, limit: 100, sortBy: 'sort_order', sortOrder: 'ASC' });

  useEffect(() => {
    fetchSingleCycle(id);
    refreshSections();
    fetchCycles();
    if (canManage) fetchScoringConfig(id);
    return () => clearSingleCycle();
  }, [id, fetchSingleCycle, fetchSections, fetchCycles, fetchScoringConfig, clearSingleCycle, canManage]);

  // Do not unmount an open editor when switching languages: that would
  // discard unsaved section/scoring changes. Refresh translated records after
  // the editor closes, with the same section and cycle selections.
  useEffect(() => {
    if (loadedLocale.current === locale || sectionModal || scoringModalOpen || copyModalOpen || deleteSection) return;
    loadedLocale.current = locale;
    fetchSingleCycle(id);
    refreshSections();
    fetchCycles();
    if (canManage) fetchScoringConfig(id);
  }, [locale, sectionModal, scoringModalOpen, copyModalOpen, deleteSection, id, fetchSingleCycle, fetchSections, fetchCycles, fetchScoringConfig, canManage]);

  useEffect(() => { document.title = cx('view_document_title'); }, [locale]);

  const activeSections = useMemo(() => sections.filter((section) => Number(section.is_active) === 1), [sections]);
  const totalWeight = useMemo(() => activeSections.reduce((sum, section) => sum + Number(section.weight || 0), 0), [activeSections]);
  const remainingWeight = Math.max(0, 100 - totalWeight);
  const kpiCount = sections.filter((section) => section.type === 'kpi').length;
  const generalCount = sections.filter((section) => section.type === 'general').length;

  const handleSectionSaved = async () => {
    setSectionModal(null);
    await refreshSections();
  };

  const runDeleteSection = async () => {
    const result = await deleteSections([deleteSection.id], { cycleId: id, limit: 100, sortBy: 'sort_order', sortOrder: 'ASC' });
    if (result.success) setDeleteSection(null);
  };

  if (fetchingSingle) {
    return (
      <CycleShell nav={nav} setNav={setNav} theme={theme}>
        <PageNav pageTitle={cx('view_cycle')} links={[{ label: cx('dashboard'), to: '/dashboard', active: true }, { label: cx('cycles'), to: '/cycles/home', active: true }, { label: cx('view_cycle') }]} />
        <div className="cyc-form-card"><div className="cyc-skeleton-panel" /></div>
      </CycleShell>
    );
  }

  if (singleCycleError || !singleCycle) {
    return (
      <CycleShell nav={nav} setNav={setNav} theme={theme}>
        <PageNav pageTitle={cx('view_cycle')} links={[{ label: cx('dashboard'), to: '/dashboard', active: true }, { label: cx('cycles'), to: '/cycles/home', active: true }, { label: cx('view_cycle') }]} />
        <div className="cyc-empty-state">
          <div className="cyc-empty-icon"><AppIcon icon="TriangleAlert" /></div>
          <h3>{cx('view_unable')}</h3>
          <p>{singleCycleError || cx('view_missing')}</p>
          <Link className="cyc-btn cyc-btn--primary" to="/cycles/home">{cx('back_to_cycles')}</Link>
        </div>
      </CycleShell>
    );
  }

  return (
    <CycleShell nav={nav} setNav={setNav} theme={theme}>
      <PageNav
        pageTitle={cx('cycle_details')}
        links={[
          { label: cx('dashboard'), to: '/dashboard', active: true },
          { label: cx('cycles'), to: '/cycles/home', active: true },
          { label: singleCycle.title || cx('view_cycle'), to: `/cycles/view/${id}`, active: false },
        ]}
      />

      <section className="cyc-view-hero">
        <div>
          <p className="cyc-eyebrow">{singleCycle.company_code} • {singleCycle.year}</p>
          <h2>{singleCycle.title}</h2>
          <p>{fmtDate(singleCycle.start_date, locale)} {cx('date_to')} {fmtDate(singleCycle.end_date, locale)} · {singleCycle.company_name}</p>
        </div>
        <div className="cyc-view-actions">
          {getStatusBadge(singleCycle.is_active)}
          {canManage && <button type="button" className="cyc-btn cyc-btn--ghost" onClick={() => setScoringModalOpen(true)}><AppIcon icon="SlidersHorizontal" /> {cx('view_setup')}</button>}
          {canManage && <button type="button" className="cyc-btn cyc-btn--ghost" onClick={() => setCopyModalOpen(true)}><AppIcon icon="Copy" /> {cx('view_copy_setup')}</button>}
          {currentUser?.role === 'super_admin' && <Link className="cyc-btn cyc-btn--ghost" to={`/cycles/copy-questions?target_cycle_id=${id}`}><AppIcon icon="Copy" /> {cx('view_copy_questions')}</Link>}
          {canManage && <button type="button" className="cyc-btn cyc-btn--primary" onClick={() => navigate(`/cycles/edit/${id}`)}><AppIcon icon="PenLine" /> {cx('edit_cycle')}</button>}
        </div>
      </section>

      <section className="cyc-stat-grid">
        <div className="cyc-stat-card">
          <span className="cyc-stat-icon"><AppIcon icon="Layers" /></span>
          <div><strong>{formatNumber(sections.length, {}, locale)}</strong><span>{cx('view_total_sections')}</span></div>
        </div>
        <div className="cyc-stat-card">
          <span className="cyc-stat-icon"><AppIcon icon="Target" /></span>
          <div><strong>{formatNumber(kpiCount, {}, locale)}</strong><span>{cx('view_kpi_sections')}</span></div>
        </div>
        <div className="cyc-stat-card">
          <span className="cyc-stat-icon"><AppIcon icon="ListChecks" /></span>
          <div><strong>{formatNumber(generalCount, {}, locale)}</strong><span>{cx('view_general_sections')}</span></div>
        </div>
        <div className="cyc-stat-card">
          <span className="cyc-stat-icon"><AppIcon icon="Scale" /></span>
          <div><strong>{fmtWeight(totalWeight, locale)}</strong><span>{cx('view_weight_used')}</span></div>
        </div>
      </section>

      {canManage && (
        <section className="cyc-card cyc-scoring-summary-card">
          <div className="cyc-sections-head">
            <div>
              <p className="cyc-eyebrow">{cx('view_configuration')}</p>
              <h3>{cx('view_scoring_rules')}</h3>
              <p>{cx('view_scoring_description')}</p>
            </div>
            <button type="button" className="cyc-btn cyc-btn--ghost" onClick={() => setScoringModalOpen(true)}><AppIcon icon="SlidersHorizontal" /> {cx('view_configure')}</button>
          </div>
          <div className="cyc-scoring-summary-grid">
            <div><span>{cx('view_rating_range')}</span><strong>{fmtRating(scoringConfig?.settings?.rating_min, 1, locale)} – {fmtRating(scoringConfig?.settings?.rating_max, 5, locale)}</strong></div>
            <div><span>{cx('view_rating_step')}</span><strong>{fmtRating(scoringConfig?.settings?.rating_step, 0.1, locale)}</strong></div>
            <div><span>{cx('view_rating_bands')}</span><strong>{formatNumber(scoringConfig?.rating_bands?.length || 5, {}, locale)}</strong></div>
            <div><span>{cx('view_profiles')}</span><strong>{formatNumber(scoringConfig?.profiles?.length || 0, {}, locale)}</strong><small>{scoringConfig?.profiles?.length ? cx('view_profiles_configured') : cx('view_base_weights')}</small></div>
            <div><span>{cx('view_management')}</span><strong>{Number(scoringConfig?.settings?.management_review_enabled || 0) === 1 ? cx('view_enabled') : cx('view_disabled')}</strong><small>{cx('view_post_review')}</small></div>
          </div>
        </section>
      )}

      <section className="cyc-card cyc-sections-card">
        <div className="cyc-sections-head">
          <div>
            <p className="cyc-eyebrow">{cx('view_sections')}</p>
            <h3>{cx('view_scoring_structure')}</h3>
            <p>{cx('view_sections_description')}</p>
          </div>
          {canManage && (
            <button type="button" className="cyc-btn cyc-btn--primary" onClick={() => setSectionModal({ mode: 'create' })}>
              <AppIcon icon="PlusCircle" /> {cx('view_add_section')}
            </button>
          )}
        </div>

        <div className={`cyc-weight-meter ${totalWeight === 100 ? 'cyc-weight-meter--complete' : totalWeight > 100 ? 'cyc-weight-meter--danger' : ''}`}>
          <div className="cyc-weight-meter__meta">
            <span>{cx('view_weight_total')}</span>
            <strong>{fmtWeight(totalWeight, locale)}</strong>
          </div>
          <div className="cyc-weight-meter__track"><span style={{ width: `${Math.min(totalWeight, 100)}%` }} /></div>
          <small>{remainingWeight === 0 ? cx('view_all_allocated') : cx('view_weight_available', { weight: fmtWeight(remainingWeight, locale) })}</small>
        </div>

        {sectionsLoading ? (
          <div className="cyc-section-grid">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="cyc-section-skeleton" />)}
          </div>
        ) : sectionsError ? (
          <div className="cyc-inline-error"><AppIcon icon="AlertCircle" /> {sectionsError}</div>
        ) : sections.length ? (
          <div className="cyc-section-grid">
            {sections.map((section) => (
              <motion.article className="cyc-section-card" key={section.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="cyc-section-card__top">
                  <span className={`cyc-section-code cyc-section-code--${section.type}`}>{section.code}</span>
                  <div>
                    <strong>{section.label}</strong>
                    <small>{section.description || cx('view_no_description')}</small>
                  </div>
                </div>
                <div className="cyc-section-card__meta">
                  <span>{getTypeBadge(section.type)}</span>
                  <span>{getStatusBadge(section.is_active)}</span>
                  <span className="cyc-section-weight">{fmtWeight(section.weight, locale)}</span>
                </div>
                {canManage && (
                  <div className="cyc-section-actions">
                    <button type="button" onClick={() => setSectionModal({ mode: 'edit', section })}><AppIcon icon="PenLine" /> {cx('edit')}</button>
                    <button type="button" className="cyc-row-danger" onClick={() => setDeleteSection(section)}><AppIcon icon="Trash2" /> {cx('delete')}</button>
                  </div>
                )}
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="cyc-empty-state cyc-empty-state--table">
            <div className="cyc-empty-icon"><AppIcon icon="Layers" /></div>
            <h3>{cx('view_no_sections')}</h3>
            <p>{cx('view_sections_prompt')}</p>
          </div>
        )}
      </section>

      <AnimatePresence>
        {sectionModal && (
          <SectionModal
            cycle={singleCycle}
            section={sectionModal.section}
            totalWeight={totalWeight}
            onClose={() => setSectionModal(null)}
            onSaved={handleSectionSaved}
          />
        )}

        {deleteSection && (
          <DeleteSectionDialog
            section={deleteSection}
            onCancel={() => setDeleteSection(null)}
            onConfirm={runDeleteSection}
          />
        )}

        {scoringModalOpen && (
          <ScoringConfigModal
            cycle={singleCycle}
            onClose={() => setScoringModalOpen(false)}
            onSaved={async () => {
              setScoringModalOpen(false);
              await fetchScoringConfig(id);
            }}
          />
        )}

        {copyModalOpen && (
          <CopyCycleDialog
            currentCycle={singleCycle}
            cycles={cycleList.filter((cycle) => Number(cycle.id) !== Number(singleCycle.id) && Number(cycle.company_id) === Number(singleCycle.company_id))}
            copyCycle={copyCycle}
            onClose={() => setCopyModalOpen(false)}
            onDone={async () => {
              setCopyModalOpen(false);
              await refreshSections();
              await fetchScoringConfig(id);
            }}
          />
        )}
      </AnimatePresence>
    </CycleShell>
  );
};

const CycleShell = ({ children, nav, setNav, theme }) => (
  <div className={`main-container theme-${theme}`}>
    <Header setNav={setNav} nav={nav} />
    <NavBar setNav={setNav} nav={nav} />
    <div className={`content-container theme-${theme}`}>
      <main className={`cyc-page theme-${theme}`}>{children}</main>
    </div>
  </div>
);

const getStatusBadge = (status) => Number(status) === 1
  ? <span className="cyc-status cyc-status--active">{cx('active')}</span>
  : <span className="cyc-status cyc-status--inactive">{cx('inactive')}</span>;

const getTypeBadge = (type) => type === 'kpi'
  ? <span className="cyc-type cyc-type--kpi">KPI</span>
  : <span className="cyc-type cyc-type--general">{cx('view_general')}</span>;

const DeleteSectionDialog = ({ section, onCancel, onConfirm }) => (
  <motion.div
    className="cyc-modal-backdrop"
    initial={false}
    animate={{ opacity: 1 }}
    exit={{ opacity: 1 }}
    transition={{ duration: 0.18 }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel?.();
    }}
  >
    <motion.div className="cyc-modal cyc-delete-modal" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}>
      <div className="cyc-modal-head">
        <div>
          <p className="cyc-eyebrow">{cx('confirmation')}</p>
          <h3>{cx('view_delete_section_title', { code: section.code })}</h3>
        </div>
        <button type="button" className="cyc-icon-btn" onClick={onCancel} aria-label={cx('view_delete_close')}><AppIcon icon="X" /></button>
      </div>
      <div className="cyc-modal-body cyc-confirm-body">
        <div className="cyc-modal-icon"><AppIcon icon="TriangleAlert" /></div>
        <p>{cx('view_delete_section_detail', { label: section.label })} {cx('view_delete_warning')}</p>
      </div>
      <div className="cyc-modal-actions">
        <button type="button" className="cyc-btn cyc-btn--ghost" onClick={onCancel}>{cx('cancel')}</button>
        <button type="button" className="cyc-btn cyc-btn--danger" onClick={onConfirm}>{cx('delete')}</button>
      </div>
    </motion.div>
  </motion.div>
);

const CopyCycleDialog = ({ currentCycle, cycles, copyCycle, onClose, onDone }) => {
  const [fromCycleId, setFromCycleId] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyOptions, setCopyOptions] = useState({
    copy_sections: true,
    copy_kpi_questions: true,
    copy_general_questions: true,
    copy_scoring_config: true,
  });

  const options = cycles.map((cycle) => ({
    value: String(cycle.id),
    label: `${cycle.title} (${cycle.year})`,
    description: cycle.company_code,
  }));

  const runCopy = async (event) => {
    event.preventDefault();
    if (!fromCycleId) return;

    setCopying(true);
    const result = await copyCycle({
      from_cycle_id: Number(fromCycleId),
      to_cycle_id: Number(currentCycle.id),
      ...copyOptions,
    });
    setCopying(false);

    if (result.success) onDone?.();
  };

  return (
    <motion.div
      className="cyc-modal-backdrop"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !copying) onClose?.();
      }}
    >
      <motion.form className="cyc-modal" onSubmit={runCopy} initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}>
        <div className="cyc-modal-head">
          <div>
            <p className="cyc-eyebrow">{cx('view_copy_setup')}</p>
            <h3>{cx('view_copy_sections')}</h3>
            <p>{cx('view_copy_into', { title: currentCycle.title })}</p>
          </div>
          <button type="button" className="cyc-icon-btn" onClick={onClose} disabled={copying} aria-label={cx('view_close')}><AppIcon icon="X" /></button>
        </div>

        <div className="cyc-modal-body">
        <AppSelect
          label={cx('view_source_cycle')}
          value={fromCycleId}
          onChange={setFromCycleId}
          options={options}
          placeholder={cx('view_source_cycle_placeholder')}
          searchable
          error={!fromCycleId ? '' : undefined}
        />

        <div className="cyc-copy-options">
          {Object.entries({
            copy_sections: cx('view_sections'),
            copy_kpi_questions: cx('view_copy_kpi'),
            copy_general_questions: cx('view_copy_general'),
            copy_scoring_config: cx('view_copy_scoring'),
          }).map(([key, label]) => (
            <label key={key} className="cyc-check-option">
              <input
                type="checkbox"
                checked={copyOptions[key]}
                onChange={(event) => setCopyOptions((prev) => ({ ...prev, [key]: event.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {options.length === 0 && <div className="cyc-inline-error"><AppIcon icon="Info" /> {cx('view_no_other_cycle')}</div>}
        </div>

        <div className="cyc-modal-actions">
          <button type="button" className="cyc-btn cyc-btn--ghost" onClick={onClose}>{cx('cancel')}</button>
          <button type="submit" className="cyc-btn cyc-btn--primary" disabled={copying || !fromCycleId}>
            {copying ? <><span className="cyc-spinner" /> {cx('view_copying')}</> : <><AppIcon icon="Copy" /> {cx('view_copy_setup')}</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

export default ViewCycle;
