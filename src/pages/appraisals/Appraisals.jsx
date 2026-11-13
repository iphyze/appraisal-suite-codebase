import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ratingRingStyle } from '../../utils/ratingRingStyle';
import { formatNumber, formatPercentage } from '../../utils/format';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import AppIcon from '../../components/ui/AppIcon';
import {
  Building2,
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  Eye,
  FileSpreadsheet,
  Hourglass,
  Info,
  List,
  LoaderCircle,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Target,
  ToggleRight,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import SupervisorOnboardingExperience from '../../components/onboarding/SupervisorOnboardingExperience';
import useAuthStore from '../../stores/useAuthStore';
import useAppraisalsStore from '../../stores/useAppraisalsStore';
import useToastStore from '../../stores/useToastStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import api from '../../services/api';
import AppraisalShell from './AppraisalShell';
import { STATUS_OPTIONS, dash, fmtNumber, fullName, makePages, displayAppraisalScore, localizedLimitOptions, localizedStatusOptions, displayAppraisalStatus } from './helpers';
import AdminAppraisals from './components/AdminAppraisals';
import SupervisorAppraisals from './components/SupervisorAppraisals';
import StaffAppraisals from './components/StaffAppraisals';
import ObjectiveSetupModal from './ObjectiveSetupModal';
import ScoringProfileModal from './ScoringProfileModal';
import './Appraisals.css';

const safeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatPercent = (value) => {
  const num = safeNumber(value);
  return formatPercentage(num / 100, num % 1 === 0 ? 0 : 1);
};


const MANAGEMENT_REVIEW_OPTIONS = [
  { value: 'all' }, { value: 'unreviewed' },
  { value: 'reviewed' }, { value: 'follow_up' },
];

const managementReviewLabel = (t, value) => {
  if (value === 'reviewed') return t('list.reviewed');
  if (value === 'follow_up') return t('list.followUpReview');
  return t('list.unreviewed');
};

const getSupervisorProgress = (stats = {}) => {
  const assigned = safeNumber(stats?.assigned_count);
  const appraised = safeNumber(stats?.appraised_count);
  const progress = assigned > 0 ? (appraised / assigned) * 100 : 0;
  return Math.max(0, Math.min(100, progress));
};

const StatCard = ({ icon, label, value, note, valueType = 'number' }) => {
  const displayValue = valueType === 'percent' ? formatPercent(value) : fmtNumber(value);
  return (
    <motion.div className="apr-stat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <span><AppIcon icon={icon} /></span>
      <div>
        <strong>{displayValue}</strong>
        <small>{label}</small>
        {note && <em>{note}</em>}
      </div>
    </motion.div>
  );
};

const Pagination = ({ page, totalPages, onChange }) => {
  const { t } = useTranslation('appraisals');
  if (Number(totalPages || 1) <= 1) return null;

  const pages = makePages(page, totalPages);

  return (
    <div className="apr-pagination">
      <button type="button" className="apr-page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <AppIcon icon={ChevronLeft} /> {t('list.previous')}
      </button>

      {pages.map((item) => typeof item === 'number' ? (
        <button
          key={item}
          type="button"
          className={`apr-page-btn apr-page-btn--number ${item === page ? 'apr-page-btn--active' : ''}`}
          disabled={item === page}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ) : <span key={item} className="apr-page-ellipsis">…</span>)}

      <button type="button" className="apr-page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        {t('list.next')} <AppIcon icon={ChevronRight} />
      </button>
    </div>
  );
};

const EmptyState = ({ title, message, action }) => (
  <div className="apr-empty">
    <span><AppIcon icon={Info} /></span>
    <h3>{title}</h3>
    <p>{message}</p>
    {action}
  </div>
);

const Appraisals = ({ ownTeamOnly = false }) => {
  const { t, i18n } = useTranslation('appraisals');
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [urlParams] = useSearchParams();
  const filterQuery = urlParams.toString();
  const focusedStaffId = /^\d+$/.test(urlParams.get('staff_user_id') || '') ? Number(urlParams.get('staff_user_id')) : null;
  const requestedCycleId = /^\d+$/.test(urlParams.get('cycle_id') || '') ? Number(urlParams.get('cycle_id')) : null;
  const role = user?.role;
  const { cycleId: portalCycleId, viewCompanyId, setCycleId: setPortalCycleId } = usePortalContextStore();
  const isStaff = role === 'staff';
  const isSupervisor = role === 'supervisor';
  const isAdminLike = ['super_admin', 'admin'].includes(role);
  const isOwnTeamView = ownTeamOnly && role === 'admin' && Number(user?.is_supervisor) === 1;
  const { isViewOnly } = useCompanyWritePermission();
  const canManageAdminRecords = !isViewOnly || isOwnTeamView;
  const supervisorWorkspace = isSupervisor || isOwnTeamView;

  const {
    candidates,
    candidateMeta,
    appraisals,
    meta,
    loading,
    onboardingLoading,
    fetchCandidates,
    fetchAppraisals,
    onboardSupervisor,
  } = useAppraisalsStore();

  const [cycles, setCycles] = useState([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [supervisors, setSupervisors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const effectiveSupervisorId = isOwnTeamView ? user?.id : supervisorId;
  const [department, setDepartment] = useState(() => isStaff ? '' : (urlParams.get('department') || ''));
  const [status, setStatus] = useState(() => {
    const requested = urlParams.get('status');
    return STATUS_OPTIONS.some((option) => option.value === requested) ? requested : (isStaff ? '' : 'all');
  });
  const [managementReviewStatus, setManagementReviewStatus] = useState('all');
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportStaffType, setExportStaffType] = useState('');
  const [exporting, setExporting] = useState(false);
  const [objectiveSetupStaff, setObjectiveSetupStaff] = useState(null);
  const [profileSetupStaff, setProfileSetupStaff] = useState(null);
  const [selectedProfileStaffIds, setSelectedProfileStaffIds] = useState([]);
  const [bulkProfileSetupOpen, setBulkProfileSetupOpen] = useState(false);

  const managementReviewEnabled = Number(candidateMeta?.management_review_enabled || 0) === 1;

  // Deep links from Smart Search hydrate the existing filters, including when
  // navigating to another search while this page remains mounted.
  useEffect(() => {
    const params = new URLSearchParams(filterQuery);
    const requestedStatus = params.get('status');
    const allowedStatus = STATUS_OPTIONS.some((option) => option.value === requestedStatus);
    setStatus(allowedStatus ? requestedStatus : (isStaff ? '' : 'all'));
    setDepartment(isStaff ? '' : (params.get('department') || ''));
    setPage(1);
  }, [filterQuery, isStaff, location.key]);

  useEffect(() => { document.title = `Appraisal Portal | ${t(isOwnTeamView ? 'list.teamPageTitle' : 'list.pageTitle')}`; }, [isOwnTeamView, t]);

  useEffect(() => {
    api.get('/cycles/list?limit=100&page=1&sortBy=year&sortOrder=DESC')
      .then((res) => {
        const data = res.data?.data || [];
        setCycles(data);
        const contextCycle = role === 'super_admin' && portalCycleId
          ? data.find((cycle) => String(cycle.id) === String(portalCycleId))
          : null;
        const requested = requestedCycleId ? data.find((cycle) => Number(cycle.id) === requestedCycleId) : null;
        const active = requested || contextCycle || data.find((cycle) => Number(cycle.is_active) === 1) || data[0];
        if (active && !cycleId) setCycleId(active.id);
      })
      .catch(() => setCycles([]))
      .finally(() => setCyclesLoading(false));

    api.get('/departments/list?limit=500&page=1&is_active=1&sortBy=name&sortOrder=ASC')
      .then((res) => setDepartments(res.data?.data || []))
      .catch(() => setDepartments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  useEffect(() => {
    if (!isAdminLike || ownTeamOnly) return;

    const selectedCycle = cycles.find((cycle) => String(cycle.id) === String(cycleId));
    const params = new URLSearchParams({ is_active: '1', sortBy: 'first_name', sortOrder: 'ASC' });

    if (cycleId) params.append('cycle_id', cycleId);
    if (selectedCycle?.company_id) params.append('company_id', selectedCycle.company_id);

    api.get(`/supervisors/search?${params.toString()}`)
      .then((res) => setSupervisors(res.data?.data || []))
      .catch(() => setSupervisors([]));
  }, [cycleId, cycles, isAdminLike, ownTeamOnly]);

  useEffect(() => {
    if (isStaff) {
      fetchAppraisals({ page, limit, search: searchQuery, cycle_id: cycleId, status });
      return;
    }

    if (cycleId && (isSupervisor || isAdminLike || effectiveSupervisorId)) {
      fetchCandidates({ page, limit, cycle_id: cycleId, supervisor_id: effectiveSupervisorId, scope: isOwnTeamView ? 'my_team' : undefined, staff_user_id: focusedStaffId || undefined, department, status, management_review_status: managementReviewStatus, search: searchQuery });
    }
  }, [isStaff, isSupervisor, isAdminLike, isOwnTeamView, cycleId, effectiveSupervisorId, focusedStaffId, department, status, managementReviewStatus, page, limit, searchQuery, fetchCandidates, fetchAppraisals, i18n.resolvedLanguage]);

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => String(cycle.id) === String(cycleId)) || candidateMeta?.cycle || null,
    [cycles, cycleId, candidateMeta?.cycle]
  );

  const cycleOptions = useMemo(() => cycles.map((cycle) => ({
    value: cycle.id,
    label: `${cycle.title} (${cycle.year})`,
    description: cycle.company_name || cycle.company_code || t(Number(cycle.is_active) === 1 ? 'list.activeCycle' : 'list.appraisalCycle'),
  })), [cycles, t]);

  const supervisorOptions = useMemo(() => [
    { value: '', label: t('list.allSupervisors'), description: t('list.allSupervisorDetail') },
    ...supervisors.map((sup) => ({
      value: sup.id,
      label: fullName(sup),
      description: t('list.supervisorAssigned', { role: sup.role_name === 'admin' ? t('list.adminSupervisor') : (sup.department || t('list.supervisorRole')), count: Number(sup.assigned_count || sup.total_subordinates || 0), countDisplay: formatNumber(sup.assigned_count || sup.total_subordinates || 0) }),
    })),
  ], [supervisors, t, i18n.language]);

  const departmentOptions = useMemo(() => [
    { value: '', label: t('list.allDepartments') },
    ...departments.map((dept) => ({
      value: dept.name,
      label: dept.name,
      description: role === 'super_admin' && !viewCompanyId ? (dept.company_name || dept.company_code || '') : '',
    })),
  ], [departments, role, viewCompanyId, t]);

  const statusOptions = useMemo(() => localizedStatusOptions(t, isStaff ? [{ value: '' }, ...STATUS_OPTIONS.slice(3)] : STATUS_OPTIONS), [isStaff, t]);
  const limitOptions = useMemo(() => localizedLimitOptions(t), [t]);
  const managementReviewOptions = useMemo(() => MANAGEMENT_REVIEW_OPTIONS.map(({ value }) => ({
    value, label: t(`list.${({ all: 'allManagementReviews', unreviewed: 'unreviewed', reviewed: 'reviewed', follow_up: 'followUpReview' })[value]}`),
  })), [t]);

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

  const handleCycleChange = (next) => {
    setCycleId(next);
    setManagementReviewStatus('all');
    setSelectedProfileStaffIds([]);
    if (role === 'super_admin') setPortalCycleId(next || '');
    setPage(1);
  };

  const handleSupervisorOnboard = async () => {
    const result = await onboardSupervisor({ cycle_id: cycleId });

    if (result.success) {
        fetchCandidates({ page: 1, limit, cycle_id: cycleId, supervisor_id: effectiveSupervisorId, scope: isOwnTeamView ? 'my_team' : undefined, department, status, management_review_status: managementReviewStatus, search: searchQuery });
      setPage(1);
    }
  };

  const exportTypeOptions = [
    { value: '', label: t('list.allEmployeeTypes') },
    { value: 'Local', label: t('list.local') },
    { value: 'Expatriate', label: t('list.expatriate') },
  ];

  const downloadExcel = async () => {
    if (!cycleId) {
      showToast(t('list.selectCycleError'), 'error');
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({ cycle_id: String(cycleId) });
      if (role === 'super_admin' && exportStaffType) params.append('staff_type', exportStaffType);
      const response = await api.get(`/exports/appraisals/excel?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      const selectedYear = selectedCycle?.year || 'cycle';
      const suffix = role === 'super_admin' && exportStaffType ? `_${exportStaffType}` : '';
      anchor.href = url;
      anchor.download = `${i18n.language === 'fr' ? 'Evaluations' : 'Appraisals'}_${selectedYear}${suffix}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(t('list.exportSuccess'), 'success');
    } catch (error) {
      showToast(error.response?.data?.message || t('list.exportError'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const stats = isStaff ? (meta?.stats || {}) : candidateMeta;
  const supervisorProgress = getSupervisorProgress(stats);
  const tableRows = isStaff ? appraisals : candidates;
  const profilesAvailable = !isStaff && (candidateMeta?.scoring_profiles || []).length > 0;
  const profileAssignableRows = useMemo(
    () => (isStaff ? [] : candidates.filter((row) => !row.appraisal_id && Number(row.can_manage_profile) === 1)),
    [candidates, isStaff]
  );
  const profileAssignableIds = useMemo(
    () => profileAssignableRows.map((row) => Number(row.staff_user_id)),
    [profileAssignableRows]
  );
  const selectedProfileStaff = useMemo(
    () => profileAssignableRows.filter((row) => selectedProfileStaffIds.includes(Number(row.staff_user_id))),
    [profileAssignableRows, selectedProfileStaffIds]
  );
  const allProfileRowsSelected = profileAssignableIds.length > 0 && profileAssignableIds.every((id) => selectedProfileStaffIds.includes(id));
  const showProfileSelection = canManageAdminRecords && profilesAvailable && profileAssignableRows.length > 0;

  const toggleProfileSelection = (staffUserId) => {
    const id = Number(staffUserId);
    setSelectedProfileStaffIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllProfileRows = () => {
    setSelectedProfileStaffIds((current) => {
      if (allProfileRowsSelected) return current.filter((id) => !profileAssignableIds.includes(id));
      return Array.from(new Set([...current, ...profileAssignableIds]));
    });
  };

  const isSelfAppraiser = supervisorWorkspace || (role === 'admin' && String(supervisorId) === String(user?.id));
  const supervisorRequiresOnboarding = isSelfAppraiser && cycleId && candidateMeta?.supervisor && Number(candidateMeta.supervisor.is_onboarded) === 0;
  const noCycles = !cyclesLoading && cycles.length === 0;
  const RoleAppraisals = isStaff ? StaffAppraisals : supervisorWorkspace ? SupervisorAppraisals : AdminAppraisals;

  useEffect(() => {
    setSelectedProfileStaffIds([]);
    setBulkProfileSetupOpen(false);
  }, [cycleId, effectiveSupervisorId, department, status, managementReviewStatus, searchQuery, page, limit]);

  if (ownTeamOnly && !isOwnTeamView) return <Navigate to="/appraisals" replace />;

  return (
    <AppraisalShell>
      <RoleAppraisals>
      <PageNav
        pageTitle={t(isOwnTeamView ? 'list.teamPageTitle' : 'list.pageTitle')}
        links={[{ label: t('nav:dashboard'), to: '/dashboard', active: true }, { label: t(isOwnTeamView ? 'list.teamPageTitle' : 'list.pageTitle') }]}
      />

      {focusedStaffId && !isStaff && (
        <section className="apr-prep-notice" role="status">
          <AppIcon icon={Target} />
          <div>
            <strong>{t('list.preparationTitle')}</strong>
            <p><Trans t={t} i18nKey="list.preparationDetail" components={{ bold: <b /> }} /></p>
          </div>
          <Link to="/appraisals" className="apr-btn apr-btn--ghost">{t('list.showAllEmployees')}</Link>
        </section>
      )}
      <section className="apr-hero">
        <div>
          <p className="apr-eyebrow">{t('list.eyebrow')}</p>
          <h2>{t(isStaff ? 'list.staffHeroTitle' : isOwnTeamView ? 'list.teamHeroTitle' : isSupervisor ? 'list.supervisorHeroTitle' : 'list.adminHeroTitle')}</h2>
          <p>
            {isStaff
              ? t('list.staffHeroDetail')
              : supervisorWorkspace
                ? t('list.supervisorHeroDetail')
                : t('list.adminHeroDetail')}
          </p>
        </div>

        {isAdminLike && !isOwnTeamView && !isViewOnly && (
          <Link className="apr-btn apr-btn--ghost" to="/cycles/create">
            <AppIcon icon={CalendarPlus} /> {t('list.createCycle')}
          </Link>
        )}
      </section>

      {cyclesLoading ? (
        <section className="apr-card apr-no-cycle-card">
          <div className="apr-empty">
            <span><AppIcon icon={LoaderCircle} className="apr-icon-spin" /></span>
            <h3>{t('list.loadingCyclesTitle')}</h3>
            <p>{t('list.loadingCyclesDetail')}</p>
          </div>
        </section>
      ) : noCycles ? (
        <section className="apr-card apr-no-cycle-card">
          <EmptyState
            title={t('list.noCyclesTitle')}
            message={isAdminLike
              ? t('list.noCyclesAdminDetail')
              : t('list.noCyclesDetail')}
            action={isAdminLike && (
              <Link className="apr-btn apr-btn--primary" to="/cycles/create">
                <AppIcon icon={CalendarPlus} /> {t('list.createAppraisalCycle')}
              </Link>
            )}
          />
        </section>
      ) : supervisorRequiresOnboarding ? (
        <SupervisorOnboardingExperience
          key={cycleId || 'supervisor-onboarding'}
          cycle={selectedCycle}
          cycleId={cycleId}
          cycleOptions={cycleOptions}
          onCycleChange={handleCycleChange}
          assignedCount={Number(candidateMeta?.assigned_count || 0)}
          supervisorName={candidateMeta?.supervisor?.full_name || fullName(candidateMeta?.supervisor) || fullName(user) || t('list.supervisorRole')}
          loading={onboardingLoading}
          onOnboard={handleSupervisorOnboard}
          backTo={isOwnTeamView ? "/my-team-appraisals" : "/dashboard"}
          backLabel={t(isOwnTeamView ? 'list.backToTeam' : 'list.backToDashboard')}
        />
      ) : (
        <>
          <div className="apr-stats">
            {isStaff ? (
              <>
                <StatCard icon={ClipboardCheck} label={t('list.totalAppraisals')} value={meta?.total || 0} />
                <StatCard icon={Clock3} label={t('list.pending')} value={stats?.pending_count || 0} />
                <StatCard icon={CircleCheck} label={t('list.acknowledged')} value={stats?.acknowledged_count || 0} />
                <StatCard icon={Star} label={t('list.averageScore')} value={stats?.avg_score || 0} />
              </>
            ) : (
              <>
                <StatCard icon={Users} label={t('list.assignedEmployees')} value={stats?.assigned_count || 0} />
                <StatCard icon={ClipboardCheck} label={t('list.appraised')} value={stats?.appraised_count || 0} />
                <StatCard icon={Hourglass} label={t('list.pending')} value={stats?.pending_count || 0} />
                <StatCard icon={TrendingUp} label={t('list.progress')} value={supervisorProgress} valueType="percent" />
              </>
            )}
          </div>



          {isAdminLike && !isOwnTeamView && (
            <div className="apr-dashboard-rich-grid">
              <section className="apr-section-card">
                <div className="apr-section-head"><div><span>{t('list.adminInsights')}</span><h3>{t('list.cycleActivity')}</h3><p>{t('list.cycleActivityDetail')}</p></div></div>
                <div className="apr-insight-list">
                  <div className="apr-insight-item"><span><AppIcon icon={Users} /> {t('list.assignedStaffInView')}</span><strong>{fmtNumber(stats?.assigned_count || 0)}</strong></div>
                  <div className="apr-insight-item"><span><AppIcon icon={ClipboardCheck} /> {t('list.completedAppraisals')}</span><strong>{fmtNumber(stats?.appraised_count || 0)}</strong></div>
                  <div className="apr-insight-item"><span><AppIcon icon={Hourglass} /> {t('list.pendingAppraisals')}</span><strong>{fmtNumber(stats?.pending_count || 0)}</strong></div>
                  {managementReviewEnabled && <>
                    <div className="apr-insight-item"><span><AppIcon icon={ShieldCheck} /> {t('list.awaitingReview')}</span><strong>{fmtNumber(stats?.review_unreviewed_count || 0)}</strong></div>
                    <div className="apr-insight-item"><span><AppIcon icon={TriangleAlert} /> {t('list.followUpRequired')}</span><strong>{fmtNumber(stats?.follow_up_count || 0)}</strong></div>
                  </>}
                </div>
              </section>
              <section className="apr-section-card">
                <div className="apr-section-head"><div><span>{t('list.progress')}</span><h3>{t('list.completionGauge')}</h3><p>{t('list.completionDetail')}</p></div></div>
                <div className="apr-score-donut-card">
                  <div className="apr-score-ring ap-gradient-ring" style={{ '--score-pct': `${supervisorProgress}%`, ...ratingRingStyle(supervisorProgress) }}>
                    <div className="apr-score-ring__inner"><strong>{formatPercent(supervisorProgress)}</strong><span>{t('list.completed')}</span></div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {!supervisorWorkspace && !isStaff && candidateMeta?.supervisor && Number(candidateMeta.supervisor.is_onboarded) === 0 && (
            <div className="apr-callout apr-callout--warn">
              <AppIcon icon={TriangleAlert} />
              <div>
                <strong>{t('list.supervisorOnboardingTitle')}</strong>
                <p>{t('list.supervisorOnboardingDetail')}</p>
              </div>
            </div>
          )}

          {!isStaff && !isOwnTeamView && (
            <section className="apr-export-strip">
              <div>
                <span className="apr-eyebrow">{t('list.excelReporting')}</span>
                <h3>{t('list.exportTitle')}</h3>
                <p>{t(isSupervisor ? 'list.exportSupervisorDetail' : role === 'super_admin' ? 'list.exportSuperAdminDetail' : 'list.exportAdminDetail')}</p>
              </div>
              <div className="apr-export-strip__actions">
                {role === 'super_admin' && (
                  <AppSelect value={exportStaffType} onChange={setExportStaffType} options={exportTypeOptions} searchable={false} clearable={false} icon={Users} />
                )}
                <button type="button" className="apr-btn apr-btn--primary" disabled={exporting || !cycleId} onClick={downloadExcel}>
                  {exporting ? <><span className="apr-spinner" /> {t('list.preparing')}</> : <><AppIcon icon={FileSpreadsheet} /> {t('list.downloadExcel')}</>}
                </button>
              </div>
            </section>
          )}

          <section className="apr-card">
            <div className="apr-filters">
              <form className="apr-search" onSubmit={submitSearch}>
                <AppIcon icon={Search} />
                <input name="appraisals_search" autoComplete="on" value={searchInput} onChange={handleSearchInputChange} placeholder={t('list.searchEmployeePlaceholder')} />
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
              <AppSelect label={t('list.cycle')} value={cycleId} onChange={handleCycleChange} options={cycleOptions} searchable placeholder={t('list.selectCycle')} icon={CalendarCheck} />
              {isAdminLike && !isOwnTeamView && <AppSelect label={t('list.supervisor')} value={supervisorId} onChange={(next) => { setSupervisorId(next); setPage(1); }} options={supervisorOptions} searchable placeholder={t('list.selectSupervisor')} icon={UserCheck} />}
              {!isStaff && <AppSelect label={t('list.department')} value={department} onChange={(next) => { setDepartment(next); setPage(1); }} options={departmentOptions} searchable placeholder={t('list.department')} icon={Building2} />}
              <AppSelect label={t('list.status')} value={status} onChange={(next) => { setStatus(next); setPage(1); }} options={statusOptions} searchable={false} clearable={false} icon={ToggleRight} />
              {isAdminLike && !isOwnTeamView && managementReviewEnabled && <AppSelect label={t('list.managementReview')} value={managementReviewStatus} onChange={(next) => { setManagementReviewStatus(next); setPage(1); }} options={managementReviewOptions} searchable={false} clearable={false} icon={ShieldCheck} />}
            </div>

            {showProfileSelection && (
              <div className="apr-bulk-level-bar">
                <div>
                  <AppIcon icon={UserRoundCheck} />
                  <span>
                    {selectedProfileStaff.length > 0
                      ? t('list.selectedEmployees', { count: selectedProfileStaff.length })
                      : t('list.selectBulkEmployees')}
                  </span>
                </div>
                <button
                  type="button"
                  className="apr-btn apr-btn--primary"
                  disabled={selectedProfileStaff.length === 0}
                  onClick={() => setBulkProfileSetupOpen(true)}
                >
                  <AppIcon icon={UserRoundCheck} /> {t('list.assignAppraisalLevel')}
                </button>
              </div>
            )}

            <div className="apr-table-wrap">
              <table className="apr-table">
                <thead>
                  <tr>
                    {showProfileSelection && (
                      <th className="apr-select-th">
                        <input
                          type="checkbox"
                          aria-label={t('list.selectAllEmployees')}
                          checked={allProfileRowsSelected}
                          onChange={toggleAllProfileRows}
                        />
                      </th>
                    )}
                    <th>{t('list.employee')}</th>
                    <th>{t('list.department')}</th>
                    <th>{t('list.jobTitle')}</th>
                    <th>{t('list.score')}</th>
                    <th>{t('list.status')}</th>
                    <th className="apr-action-th">{t('list.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx}><td colSpan={showProfileSelection ? 7 : 6}><span className="apr-row-skeleton" /></td></tr>
                  )) : tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={showProfileSelection ? 7 : 6}>
                        <EmptyState title={t('list.noRecordsTitle')} message={t(isStaff ? 'list.noStaffRecords' : isOwnTeamView ? 'list.noTeamRecords' : 'list.noAdminRecords')} />
                      </td>
                    </tr>
                  ) : tableRows.map((row) => {
                    const appraisalId = row.appraisal_id || row.id;
                    const isAppraised = !!appraisalId;
                    const canManageAppraisal = canManageAdminRecords && Number(row.can_manage_appraisal) === 1;
                    const canManageObjectives = canManageAdminRecords && Number(row.can_manage_objectives) === 1;
                    const canManageProfile = canManageAdminRecords && Number(row.can_manage_profile) === 1;
                    const profileRequired = Number(candidateMeta?.require_explicit_profile) === 1;
                    const profileMissing = profileRequired && !row.scoring_profile_id;

                    return (
                      <tr className={focusedStaffId === Number(row.staff_user_id) ? 'apr-focused-staff-row' : ''} key={`${row.staff_user_id || row.id}-${appraisalId || 'pending'}`}>
                        {showProfileSelection && (
                          <td className="apr-select-cell">
                            <input
                              type="checkbox"
                              aria-label={t('list.selectEmployee', { name: row.staff_fullname || fullName(row) })}
                              checked={selectedProfileStaffIds.includes(Number(row.staff_user_id))}
                              disabled={!canManageProfile || isAppraised}
                              onChange={() => toggleProfileSelection(row.staff_user_id)}
                            />
                          </td>
                        )}
                        <td>
                          <div className="apr-person-cell">
                            <span>{(row.staff_fullname || fullName(row)).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'S'}</span>
                            <div>
                              <strong>{row.staff_fullname || fullName(row)}</strong>
                              <small>{row.staff_email || row.email || row.unique_ref || row.staff_id}</small>
                            </div>
                          </div>
                        </td>
                        <td>{row.staff_department || row.department || '—'}</td>
                        <td>{row.staff_job_title_display || row.staff_job_title || row.job_title_display || row.job_title || '—'}</td>
                        <td><strong>{displayAppraisalScore(row.appraisal_summary)}</strong><small>{row.evaluation_statement || ''}</small></td>
                        <td>
                          <div className="apr-status-cell">
                            <div className="apr-status-cell__primary">
                              <span className={`apr-pill apr-pill--${(row.appraisal_status || row.status || 'pending').toLowerCase()}`}>{displayAppraisalStatus(t, row.appraisal_status || row.status)}</span>
                              {managementReviewEnabled && isAppraised && (isAdminLike || row.management_review_status === 'follow_up') && (
                                <span className={`apr-management-pill apr-management-pill--${row.management_review_status || 'unreviewed'}`}>
                                  <AppIcon icon={row.management_review_status === 'follow_up' ? TriangleAlert : ShieldCheck} />
                                  {managementReviewLabel(t, row.management_review_status)}
                                </span>
                              )}
                            </div>
                            {!isStaff && (
                              <div className="apr-setup-status-list">
                                {row.scoring_profile_label ? (
                                  <span className="apr-setup-status apr-setup-status--ready"><AppIcon icon={UserRoundCheck} /> {row.scoring_profile_label}</span>
                                ) : !isAppraised && profileMissing ? (
                                  <span className="apr-setup-status apr-setup-status--required"><AppIcon icon={TriangleAlert} /> {t('list.appraisalLevelRequired')}</span>
                                ) : null}
                                {!isAppraised && Number(row.objective_setup_required) === 1 && (
                                  <span className={`apr-setup-status apr-setup-status--${row.objective_plan_status === 'locked' ? 'ready' : 'required'}`}>
                                    <AppIcon icon={row.objective_plan_status === 'locked' ? CircleCheck : Target} />
                                    {t(row.objective_plan_status === 'locked' ? 'list.objectivesLocked' : row.objective_plan_status === 'draft' ? 'list.objectiveDraft' : 'list.objectivesNotSet')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="apr-actions">
                            {!isAppraised && profilesAvailable && canManageProfile && (
                              <button
                                type="button"
                                className={profileMissing ? 'apr-action-primary apr-level-action' : 'apr-level-action'}
                                onClick={() => setProfileSetupStaff(row)}
                                title={t(row.scoring_profile_label ? 'list.changeLevelTitle' : 'list.assignLevelTitle')}
                              >
                                <AppIcon icon={UserRoundCheck} /> {t(row.scoring_profile_label ? 'list.level' : 'list.setLevel')}
                              </button>
                            )}
                            {isAppraised ? (
                              <>
                                <button type="button" onClick={() => navigate(`/appraisals/view/${appraisalId}`, { state: isOwnTeamView ? { from: "/my-team-appraisals" } : undefined })} title={t('list.view')}><AppIcon icon={Eye} /></button>
                                {!isStaff && canManageAppraisal && <button type="button" onClick={() => navigate(`/appraisals/edit/${appraisalId}`, { state: isOwnTeamView ? { from: "/my-team-appraisals" } : undefined })} title={t('list.edit')}><AppIcon icon={PenLine} /></button>}
                              </>
                            ) : !isStaff ? (
                              Number(row.objective_setup_required) === 1 ? (
                                <>
                                  {canManageObjectives && (
                                    <button
                                      type="button"
                                      className={row.objective_plan_status === 'locked' ? '' : 'apr-action-primary'}
                                      onClick={() => setObjectiveSetupStaff(row)}
                                      title={t(canManageAppraisal ? 'list.objectiveReviewTitle' : 'list.objectivePrepareTitle')}
                                    >
                                      <AppIcon icon={Target} /> {t(row.objective_plan_status === 'locked' ? 'list.objectives' : row.objective_plan_status === 'draft' ? 'list.editObjectives' : 'list.setObjectives')}
                                    </button>
                                  )}
                                  {canManageAppraisal && row.objective_plan_status === 'locked' && !profileMissing && (
                                    <button type="button" className="apr-action-primary" onClick={() => navigate(`/appraisals/create/${row.staff_user_id}/${cycleId}`, { state: isOwnTeamView ? { from: "/my-team-appraisals" } : undefined })}>
                                      <AppIcon icon={Plus} /> {t('list.start')}
                                    </button>
                                  )}
                                </>
                              ) : canManageAppraisal && !profileMissing ? (
                                <button type="button" className="apr-action-primary" onClick={() => navigate(`/appraisals/create/${row.staff_user_id}/${cycleId}`, { state: isOwnTeamView ? { from: "/my-team-appraisals" } : undefined })}>
                                  <AppIcon icon={Plus} /> {t('list.start')}
                                </button>
                              ) : null
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="apr-card-footer">
              <span>{t('list.pageOf', { page: (isStaff ? meta?.page : candidateMeta?.page) || page, total: (isStaff ? meta?.total_pages : candidateMeta?.total_pages) || 1 })}</span>
              <Pagination page={page} totalPages={(isStaff ? meta?.total_pages : candidateMeta?.total_pages) || 1} onChange={setPage} />
            </div>
          </section>
        </>
      )}
      </RoleAppraisals>

      <AnimatePresence>
        {objectiveSetupStaff && Number(objectiveSetupStaff.objective_section_id) > 0 && (
          <ObjectiveSetupModal
            staff={objectiveSetupStaff}
            sectionId={Number(objectiveSetupStaff.objective_section_id)}
            cycle={selectedCycle}
            onClose={() => setObjectiveSetupStaff(null)}
            onChanged={async () => {
              await fetchCandidates({ page, limit, cycle_id: cycleId, supervisor_id: effectiveSupervisorId, scope: isOwnTeamView ? 'my_team' : undefined, department, status, management_review_status: managementReviewStatus, search: searchQuery });
            }}
          />
        )}
        {bulkProfileSetupOpen && selectedProfileStaff.length > 0 && (
          <ScoringProfileModal
            staffList={selectedProfileStaff}
            cycle={selectedCycle}
            profiles={candidateMeta?.scoring_profiles || []}
            required
            onClose={() => setBulkProfileSetupOpen(false)}
            onChanged={async () => {
              setSelectedProfileStaffIds([]);
              await fetchCandidates({ page, limit, cycle_id: cycleId, supervisor_id: effectiveSupervisorId, scope: isOwnTeamView ? 'my_team' : undefined, department, status, management_review_status: managementReviewStatus, search: searchQuery });
            }}
          />
        )}
        {profileSetupStaff && (
          <ScoringProfileModal
            staff={profileSetupStaff}
            cycle={selectedCycle}
            profiles={candidateMeta?.scoring_profiles || []}
            required={Number(candidateMeta?.require_explicit_profile) === 1}
            onClose={() => setProfileSetupStaff(null)}
            onChanged={async () => {
              await fetchCandidates({ page, limit, cycle_id: cycleId, supervisor_id: effectiveSupervisorId, scope: isOwnTeamView ? 'my_team' : undefined, department, status, management_review_status: managementReviewStatus, search: searchQuery });
            }}
          />
        )}
      </AnimatePresence>
    </AppraisalShell>
  );
};

export default Appraisals;
