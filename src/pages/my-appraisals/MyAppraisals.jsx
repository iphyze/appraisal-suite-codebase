import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import AppIcon from '../../components/ui/AppIcon';
import { CalendarCheck, ChevronLeft, ChevronRight, CircleCheck, ClipboardCheck, Clock3, Eye, Gauge, Info, List, Search, Star, ToggleRight, X } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../stores/useAuthStore';
import useAppraisalsStore from '../../stores/useAppraisalsStore';
import AppraisalShell from '../appraisals/AppraisalShell';
import { STATUS_OPTIONS, dash, fmtNumber, makePages, displayAppraisalScore, localizedLimitOptions, localizedStatusOptions, displayAppraisalStatus } from '../appraisals/helpers';
import { formatScore } from '../../utils/format';
import '../appraisals/Appraisals.css';
import './MyAppraisals.css';
import { ratingRingStyle } from '../../utils/ratingRingStyle';

const ratingRingProgress = (value, maxRating = 5) => Math.max(0, Math.min(100, (Number(value || 0) / Math.max(Number(maxRating || 5), 0.01)) * 100));

const fullName = (user, fallback = 'User') => `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || fallback;

// Preserve the current numeric fallback and negative-number presentation.
const formattedScore = (value) => {
  const parsed = Number(dash(value));
  const score = Number.isFinite(parsed) ? parsed : 0;
  return score < 0 ? `(${formatScore(Math.abs(score))})` : formatScore(score);
};

const Pagination = ({ page, totalPages, onChange }) => {
  const { t } = useTranslation('appraisals');
  if (Number(totalPages || 1) <= 1) return null;
  return (
    <div className="apr-pagination">
      <button type="button" className="apr-page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}><AppIcon icon={ChevronLeft} /> {t('list.previous')}</button>
      {makePages(page, totalPages).map((item) => typeof item === 'number' ? (
        <button key={item} type="button" className={`apr-page-btn apr-page-btn--number ${item === page ? 'apr-page-btn--active' : ''}`} disabled={item === page} onClick={() => onChange(item)}>{item}</button>
      ) : <span key={item} className="apr-page-ellipsis">…</span>)}
      <button type="button" className="apr-page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>{t('list.next')} <AppIcon icon={ChevronRight} /></button>
    </div>
  );
};

const EmptyState = ({ title, message }) => (
  <div className="apr-empty">
    <span><AppIcon icon={Info} /></span>
    <h3>{title}</h3>
    <p>{message}</p>
  </div>
);

const MyAppraisals = () => {
  const { t, i18n } = useTranslation('appraisals');
  const navigate = useNavigate();
  const location = useLocation();
  const [urlParams] = useSearchParams();
  const filterQuery = urlParams.toString();
  const { user } = useAuthStore();
  const { appraisals, meta, loading, fetchAppraisals } = useAppraisalsStore();
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState(() => ['Pending', 'Acknowledged'].includes(urlParams.get('status')) ? urlParams.get('status') : '');
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const requestedStatus = new URLSearchParams(filterQuery).get('status');
    setStatus(['Pending', 'Acknowledged'].includes(requestedStatus) ? requestedStatus : '');
    setPage(1);
  }, [filterQuery, location.key]);

  useEffect(() => { document.title = `Appraisal Portal | ${t('mine.pageTitle')}`; }, [t]);

  useEffect(() => {
    if (user?.role === 'super_admin') return undefined;
    api.get('/cycles/list?limit=100&page=1&sortBy=year&sortOrder=DESC')
      .then((res) => setCycles(res.data?.data || []))
      .catch(() => setCycles([]));
  }, [user?.role, i18n.resolvedLanguage]);

  useEffect(() => {
    if (user?.role === 'super_admin') return;
    fetchAppraisals({
      scope: 'my',
      page,
      limit,
      cycle_id: cycleId,
      status,
      search: searchQuery,
    });
  }, [user?.role, page, limit, cycleId, status, searchQuery, fetchAppraisals, i18n.resolvedLanguage]);

  const cycleOptions = useMemo(() => [
    { value: '', label: t('mine.allCycles'), description: t('mine.allCyclesDetail') },
    ...cycles.map((cycle) => ({
      value: cycle.id,
      label: `${cycle.title} (${cycle.year})`,
      description: cycle.company_name || cycle.company_code || t(Number(cycle.is_active) === 1 ? 'list.activeCycle' : 'list.appraisalCycle'),
    })),
  ], [cycles, t]);

  const statusOptions = useMemo(() => localizedStatusOptions(t, [
    { value: '' },
    ...STATUS_OPTIONS.filter((item) => ['Pending', 'Acknowledged'].includes(item.value)),
  ]), [t]);
  const limitOptions = useMemo(() => localizedLimitOptions(t), [t]);
  const currentAppraisal = appraisals.find((item) => Number(item.cycle_id) === Number(cycles.find((cycle) => Number(cycle.is_active) === 1)?.id));
  const currentRingPct = currentAppraisal
    ? ratingRingProgress(currentAppraisal.appraisal_summary, currentAppraisal.rating_max)
    : 0;
  const stats = meta?.stats || {};

  const submitSearch = (event) => {
    event?.preventDefault?.();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const handleSearchInputChange = (event) => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);

    if (nextValue === '' && searchQuery) {
      clearSearch();
    }
  };

  if (user?.role === 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppraisalShell>
      <PageNav
        eyebrow={t('mine.eyebrow')}
        pageTitle={t('mine.pageTitle')}
        subtitle={t('mine.subtitle', { name: fullName(user, t('mine.fallbackUser')) })}
        links={[{ label: t('nav:dashboard'), to: '/dashboard', active: true }, { label: t('mine.pageTitle') }]}
      />

      <section className="apr-hero myapr-hero">
        <div>
          <p className="apr-eyebrow">{t('mine.heroEyebrow')}</p>
          <h2>{t('mine.heroTitle')}</h2>
          <p>
            {t('mine.heroDetail')}
          </p>
        </div>
        <Link className="apr-btn apr-btn--ghost" to="/dashboard"><AppIcon icon={Gauge} /> {t('nav:dashboard')}</Link>
      </section>

      <div className="apr-stats">
        <motion.div className="apr-stat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><span><AppIcon icon={ClipboardCheck} /></span><div><strong>{fmtNumber(meta?.total || 0)}</strong><small>{t('list.totalAppraisals')}</small></div></motion.div>
        <motion.div className="apr-stat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><span><AppIcon icon={Clock3} /></span><div><strong>{fmtNumber(stats?.pending_count || 0)}</strong><small>{t('list.pending')}</small></div></motion.div>
        <motion.div className="apr-stat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><span><AppIcon icon={CircleCheck} /></span><div><strong>{fmtNumber(stats?.acknowledged_count || 0)}</strong><small>{t('list.acknowledged')}</small></div></motion.div>
        <motion.div className="apr-stat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><span><AppIcon icon={Star} /></span><div><strong>{displayAppraisalScore(stats?.avg_score)}</strong><small>{t('list.averageScore')}</small></div></motion.div>
      </div>

      {currentAppraisal && (
        <section className="myapr-current-card">
          <div className="myapr-current-card__score ap-gradient-ring" style={{ '--score-pct': `${currentRingPct}%`, ...ratingRingStyle(currentRingPct) }}>
            <div className="myapr-current-card__score-inner">
              <strong>{formattedScore(currentAppraisal.appraisal_summary)}</strong>
              <span>{t('mine.currentScore')}</span>
            </div>
          </div>
          <div>
            <p className="apr-eyebrow">{t('mine.currentEyebrow')}</p>
            <h3>{currentAppraisal.cycle_title} ({currentAppraisal.cycle_year})</h3>
            <p><Trans t={t} i18nKey="mine.currentStatus" values={{ name: currentAppraisal.supervisor_name || '—', status: currentAppraisal.status ? displayAppraisalStatus(t, currentAppraisal.status) : '—' }} components={{ strong: <strong /> }} /></p>
          </div>
          <button type="button" className="apr-btn apr-btn--primary" onClick={() => navigate(`/appraisals/view/${currentAppraisal.id}`, { state: { from: '/my-appraisals' } })}><AppIcon icon={Eye} /> {t('mine.viewCurrent')}</button>
        </section>
      )}

      <section className="apr-card">
        <div className="apr-filters">
          <form className="apr-search" onSubmit={submitSearch}>
            <AppIcon icon={Search} />
            <input name="my_appraisals_search" autoComplete="on" value={searchInput} onChange={handleSearchInputChange} placeholder={t('mine.searchPlaceholder')} />
            {searchInput && <button type="button" onClick={clearSearch}><AppIcon icon={X} /></button>}
            <button type="submit">{t('list.search')}</button>
          </form>

          <AppSelect
            value={limit}
            onChange={(next) => { setLimit(Number(next)); setPage(1); }}
            options={limitOptions}
            searchable={false}
            clearable={false}
            icon={List}
          />
        </div>

        <div className="apr-filter-grid">
          <AppSelect label={t('list.cycle')} value={cycleId} onChange={(next) => { setCycleId(next); setPage(1); }} options={cycleOptions} searchable placeholder={t('mine.allCyclesPlaceholder')} icon={CalendarCheck} />
          <AppSelect label={t('list.status')} value={status} onChange={(next) => { setStatus(next); setPage(1); }} options={statusOptions} searchable={false} clearable={false} icon={ToggleRight} />
        </div>

        <div className="apr-table-wrap">
          <table className="apr-table myapr-table">
            <thead>
              <tr>
                <th>{t('list.cycle')}</th>
                <th>{t('list.supervisor')}</th>
                <th>{t('list.score')}</th>
                <th>{t('mine.kpi')}</th>
                <th>{t('list.status')}</th>
                <th>{t('mine.feedback')}</th>
                <th className="apr-action-th">{t('list.action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}><td colSpan="7"><span className="apr-row-skeleton" /></td></tr>
              )) : appraisals.length === 0 ? (
                <tr><td colSpan="7"><EmptyState title={t('mine.noRecordsTitle')} message={t('mine.noRecordsDetail')} /></td></tr>
              ) : appraisals.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.cycle_title || t('list.appraisalCycle')}</strong><small>{row.cycle_year || '—'}</small></td>
                  <td>{row.supervisor_name || '—'}<small>{row.supervisor_email || ''}</small></td>
                  <td><strong>{formattedScore(row.appraisal_summary)}</strong><small>{row.evaluation_statement || ''}</small></td>
                  <td>{formattedScore(row.kpi_rating)}</td>
                  <td><span className={`apr-pill apr-pill--${(row.status || 'pending').toLowerCase()}`}>{displayAppraisalStatus(t, row.status)}</span></td>
                  <td>{row.feedback ? <span className="apr-pill apr-pill--acknowledged">{t('mine.submitted')}</span> : <span className="apr-pill apr-pill--pending">{t('list.pending')}</span>}</td>
                  <td>
                    <div className="apr-actions">
                      <button type="button" onClick={() => navigate(`/appraisals/view/${row.id}`, { state: { from: '/my-appraisals' } })} title={t('mine.viewAppraisal')}><AppIcon icon={Eye} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="apr-card-footer">
          <span>{t('list.pageOf', { page: meta?.page || page, total: meta?.total_pages || 1 })}</span>
          <Pagination page={page} totalPages={meta?.total_pages || 1} onChange={setPage} />
        </div>
      </section>
    </AppraisalShell>
  );
};

export default MyAppraisals;
