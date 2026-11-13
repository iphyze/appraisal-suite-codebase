import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { currentFormatLocale, formatDate, formatNumber, formatPercentage, formatScore } from '../../utils/format';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import NavBar from '../NavBar';
import Header from '../Header';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import AppIcon from '../../components/ui/AppIcon';
import SupervisorOnboardingExperience from '../../components/onboarding/SupervisorOnboardingExperience';
import api from '../../services/api';
import useAuthStore from '../../stores/useAuthStore';
import useDashboardStore from '../../stores/useDashboardStore';
import useThemeStore from '../../stores/useThemeStore';
import useToastStore from '../../stores/useToastStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import './Dashboard.css';
import { fmt } from '../../utils/helper';
import { ratingRingStyle } from '../../utils/ratingRingStyle';

const t = (key, options) => i18n.t(key, { ns: 'dashboard', ...options });
const fmtNumber = (value) => formatNumber(value || 0, {}, i18n.language);
const fmtPct = (value) => {
  const num = Number(value || 0);
  return formatPercentage(num / 100, num % 1 === 0 ? 0 : 1, i18n.language);
};
const dash = (value) => value === null || value === undefined || value === '' ? '—' : value;
const fmtScore = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const score = Number(value);
  return Number.isFinite(score) ? formatScore(score, i18n.language) : '0';
};

// Leave database-authored descriptions as-is until the translation-memory batch.
const scoreValue = (value) => {
  const raw = dash(value);
  return currentFormatLocale(i18n.language) === 'fr-FR' && raw !== '—' && Number.isFinite(Number(raw))
    ? formatNumber(Number(raw), { maximumFractionDigits: 2 }, i18n.language) : raw;
};

const appraisalStatus = (value) => {
  const raw = value || 'Pending';
  const keyByValue = { pending: 'general.pending', acknowledged: 'general.acknowledged', appraised: 'general.appraised', submitted: 'general.submitted', completed: 'general.completed' };
  return keyByValue[String(raw).toLowerCase()] ? t(keyByValue[String(raw).toLowerCase()]) : raw;
};

const historyScore = (value) => currentFormatLocale(i18n.language) === 'fr-FR'
  ? formatScore(Number(value || 0), i18n.language) : fmt(value);

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] },
});

const getName = (user) => `${user?.first_name || user?.fname || ''} ${user?.last_name || user?.lname || ''}`.trim() || user?.username || 'User';


const DashboardShell = ({ children }) => {
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`ap-dashboard theme-${theme}`}>{children}</div>
      </main>
    </div>
  );
};

const LoadingCards = () => (
  <div className="apdash-grid apdash-grid--4">
    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="apdash-skeleton-card" />)}
  </div>
);

const EmptyPanel = ({ icon = 'Info', title, message, action }) => (
  <div className="apdash-empty">
    <span className="apdash-empty__icon"><AppIcon icon={icon} size={20} /></span>
    <h3>{title}</h3>
    <p>{message}</p>
    {action}
  </div>
);

const StatCard = ({ label, value, note, trend, icon, tone = 'green', delay = 0 }) => (
  <motion.div className={`apdash-stat apdash-stat--${tone}`} {...fadeUp(delay)}>
    <div className="apdash-stat__top">
      <span className="apdash-stat__icon"><AppIcon icon={icon} size={18} /></span>
      <span className="apdash-stat__label">{label}</span>
    </div>
    <strong className="apdash-stat__value">{value}</strong>
    {(note || trend) && (
      <small className={`apdash-stat__note ${trend ? 'apdash-stat__note--trend' : ''}`}>
        {trend && <AppIcon icon="TrendingUp" size={14} />} {trend || note}
      </small>
    )}
  </motion.div>
);

const ProgressRing = ({ value = 0, label = t('general.progress') }) => {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="apdash-ring ap-gradient-ring" style={{ '--pct': `${pct}%`, ...ratingRingStyle(pct) }}>
      <div className="apdash-ring__inner">
        <strong>{fmtPct(pct)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
};

const ScoreRing = ({ value = 0, label = t('general.rating'), max = 5 }) => {
  const safeMax = Math.max(Number(max || 5), 0.01);
  const score = Math.max(0, Math.min(safeMax, Number(value || 0)));
  const pct = (score / safeMax) * 100;
  return (
    <div className="apdash-score-ring ap-gradient-ring" style={{ '--pct': `${pct}%`, ...ratingRingStyle(pct) }}>
      <div className="apdash-score-ring__inner">
        <strong>{score ? formatScore(score, i18n.language) : '—'}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
};

const SectionCard = ({ title, subtitle, icon, children, action, delay = 0 }) => (
  <motion.section className="apdash-card" {...fadeUp(delay)}>
    <div className="apdash-card__head">
      <div>
        <span className="apdash-card__eyebrow"><AppIcon icon={icon} size={16} /> {title}</span>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </motion.section>
);

const DistributionBars = ({ rows = [], labelKey = 'evaluation_statement', valueKey = 'cnt' }) => {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

  if (!rows.length) {
    return <EmptyPanel icon="BarChart3" title={t('distribution.noneTitle')} message={t('distribution.noneMessage')} />;
  }

  return (
    <div className="apdash-bars">
      {rows.map((row, index) => {
        const value = Number(row[valueKey] || 0);
        return (
          <div className="apdash-bar-row" key={`${row[labelKey]}-${index}`}>
            <div className="apdash-bar-row__meta">
              <span>{row[labelKey] || t('general.unrated')}</span>
              <strong>{fmtNumber(value)}</strong>
            </div>
            <div className="apdash-bar-row__track"><span style={{ width: `${(value / max) * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
};

const CompanySwitcher = ({ companies = [], value, onChange }) => {
  const normalized = companies
    .filter(Boolean)
    .reduce((acc, company) => {
      if (!acc.some((item) => String(item.id) === String(company.id))) acc.push(company);
      return acc;
    }, []);

  return (
    <div className="apdash-company-switcher" aria-label={t('company.switcherAria')}>
      <button
        type="button"
        className={!value ? 'apdash-company-switcher__btn apdash-company-switcher__btn--active' : 'apdash-company-switcher__btn'}
        onClick={() => onChange('')}
      >
        {t('general.all')}
      </button>
      {normalized.map((company) => (
        <button
          key={company.id}
          type="button"
          className={String(value) === String(company.id) ? 'apdash-company-switcher__btn apdash-company-switcher__btn--active' : 'apdash-company-switcher__btn'}
          onClick={() => onChange(company.id)}
          title={company.name}
        >
          {company.code || company.name}
        </button>
      ))}
    </div>
  );
};

const AdminPendingQuickActions = ({ supervisors = [] }) => {
  const lowestProgress = [...supervisors]
    .filter((sup) => Number(sup.total_assigned || 0) > 0)
    .sort((a, b) => {
      const byProgress = Number(a.progress_percent || 0) - Number(b.progress_percent || 0);
      if (byProgress !== 0) return byProgress;
      return Number(b.pending_count || 0) - Number(a.pending_count || 0);
    })
    .slice(0, 5);

  return (
    <SectionCard
      title={t('pendingActions.title')}
      subtitle={t('pendingActions.subtitle')}
      icon="Zap"
      delay={0.2}
      action={<Link className="apdash-secondary-btn" to="/supervisors/assignments"><AppIcon icon="ExternalLink" /> {t('pendingActions.supervisorList')}</Link>}
    >
      <div className="apdash-risk-list">
        {lowestProgress.map((sup) => (
          <Link
            to={`/supervisors/assignments?supervisor_id=${sup.id}`}
            className="apdash-risk-item"
            key={sup.id}
          >
            <span className="apdash-risk-item__avatar">{String(sup.supervisor_name || 'S').slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{sup.supervisor_name}</strong>
              <small>{sup.department || t('general.noDepartment')} • {t('pendingActions.pendingCount', { count: Number(sup.pending_count || 0) })}</small>
            </div>
            <span className="apdash-risk-item__pct">{fmtPct(sup.progress_percent)}</span>
            <AppIcon icon="ChevronRight" />
          </Link>
        ))}
        {lowestProgress.length === 0 && (
          <EmptyPanel icon="CircleCheck" title={t('pendingActions.noneTitle')} message={t('pendingActions.noneMessage')} />
        )}
      </div>
    </SectionCard>
  );
};

const FeedbackForm = ({ appraisal, loading, onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const canSubmit = acknowledged && feedback.trim().length >= 2 && !loading;

  if (!appraisal || appraisal.feedback) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await onSubmit(appraisal.id, feedback.trim(), acknowledged);
    if (result?.success) setFeedback('');
  };

  return (
    <form className="apdash-feedback" onSubmit={submit}>
      <div className="apdash-feedback__head">
        <span className="apdash-feedback__icon" aria-hidden="true"><AppIcon icon="MessageSquare" size={20} /></span>
        <div>
          <strong>{t('feedbackForm.heading')}</strong>
          <p>{t('feedbackForm.help')}</p>
        </div>
      </div>
      <label className="apdash-feedback__ack">
        <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
        <span>{t('feedbackForm.acknowledge')}</span>
      </label>
      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder={t('feedbackForm.placeholder')}
        rows={4}
      />
      <div className="apdash-feedback__actions">
        <span>{t('feedbackForm.characters', { count: feedback.trim().length })}</span>
        <button type="submit" className="apdash-primary-btn" disabled={!canSubmit}>
          {loading ? <><span className="apdash-spinner" /> {t('feedbackForm.submitting')}</> : <><AppIcon icon="Send" /> {t('feedbackForm.submit')}</>}
        </button>
      </div>
    </form>
  );
};

const AppraisalTimeline = ({ history = [] }) => {
  if (!history.length) {
    return <EmptyPanel title={t('timeline.emptyTitle')} message={t('timeline.emptyMessage')} />;
  }

  return (
    <div className="apdash-timeline">
      {history.map((row) => (
        <div className="apdash-timeline__item" key={row.id}>
          <span className="apdash-timeline__dot" />
          <div className="apdash-timeline__card">
            <div className="apdash-timeline__head">
              <div>
                <strong>{row.cycle_title || row.cycle_year}</strong>
                <small>{row.supervisor_name || t('general.noSupervisor')} • {row.created_at ? formatDate(row.created_at, { day: 'numeric', month: 'numeric', year: 'numeric' }, i18n.language) : '—'}</small>
              </div>
              <span className={`apdash-pill apdash-pill--${String(row.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>{appraisalStatus(row.status)}</span>
            </div>
            <div className="apdash-timeline__meta">
              <span>{t('general.score')} <strong>{historyScore(dash(row.appraisal_summary))}</strong></span>
              <span>{t('timeline.kpi')} <strong>{historyScore(dash(row.kpi_rating))}</strong></span>
              <span>{t('general.rating')} <strong>{dash(row.evaluation_statement)}</strong></span>
            </div>
            {row.feedback && <p className="apdash-timeline__feedback">“{row.feedback}”</p>}
          </div>
        </div>
      ))}
    </div>
  );
};


const NoCycleCallout = ({ role, canManage = true }) => {
  const isAdminLike = ['super_admin', 'admin'].includes(role);

  return (
    <motion.div className="apdash-no-cycle" {...fadeUp(0.05)}>
      <span className="apdash-no-cycle__icon">
        <AppIcon icon="CalendarPlus" />
      </span>
      <div className="apdash-no-cycle__content">
        <span>{t('noCycle.eyebrow')}</span>
        <h2>{isAdminLike ? t('noCycle.adminTitle') : t('noCycle.staffTitle')}</h2>
        <p>
          {isAdminLike
            ? t('noCycle.adminMessage')
            : t('noCycle.staffMessage')}
        </p>
      </div>
      {isAdminLike && canManage && (
        <Link className="apdash-primary-btn apdash-primary-btn--large" to="/cycles/create">
          <AppIcon icon="PlusCircle" /> {t('noCycle.createAppraisalCycle')}
        </Link>
      )}
    </motion.div>
  );
};

const AdminQuickActionsStrip = ({ exporting = false, onExport, canManage = true }) => (
  <motion.div className="apdash-admin-strip" {...fadeUp(0.08)}>
    {canManage && <Link to="/users/create-user"><AppIcon icon="UserPlus" /> {t('actions.createUser')}</Link>}
    {canManage && <Link to="/cycles/create"><AppIcon icon="CalendarPlus" /> {t('actions.createCycle')}</Link>}
    {canManage && <Link to="/questions/kpi/create"><AppIcon icon="Target" /> {t('actions.kpiQuestions')}</Link>}
    {canManage && <Link to="/questions/general/create"><AppIcon icon="ListChecks" /> {t('actions.generalQuestions')}</Link>}
    {canManage && <Link to="/supervisors/assignments"><AppIcon icon="ArrowRightLeft" /> {t('actions.supervisorAssignments')}</Link>}
    {onExport && (
      <button type="button" onClick={onExport} disabled={exporting}>
        {exporting ? <span className="apdash-spinner apdash-spinner--green" /> : <AppIcon icon="FileSpreadsheet" />}
        {exporting ? t('actions.preparingReport') : t('actions.managementReport')}
      </button>
    )}
  </motion.div>
);


const ManagementInsightsPanel = ({ insights = {}, cycle }) => {
  const objectiveSetup = insights?.objective_setup || {};
  const review = insights?.management_review || {};
  const revisions = insights?.revision_summary || {};
  const sections = insights?.section_performance || [];
  const profiles = insights?.profile_distribution || [];
  const objectives = insights?.objective_performance || [];
  const development = insights?.development_themes || [];

  const locked = Number(objectiveSetup.locked || 0);
  const required = Number(objectiveSetup.required_plans || 0);
  const reviewOutstanding = Number(review.follow_up || 0) + Number(review.unreviewed || 0) + Number(review.stale || 0);

  return (
    <>
      <div className="apdash-grid apdash-grid--4 apdash-management-kpis">
        <StatCard
          label={t('management.objectiveSetup')}
          value={required ? `${fmtNumber(locked)}/${fmtNumber(required)}` : '—'}
          note={objectiveSetup.enabled ? t('management.locked', { progress: fmtPct(objectiveSetup.progress_percent) }) : t('management.notRequired')}
          icon="Target"
          tone="green"
          delay={0.13}
        />
        <StatCard
          label={t('management.followUp')}
          value={review.enabled ? fmtNumber(review.follow_up) : '—'}
          note={review.enabled ? t('management.requireReview', { count: reviewOutstanding }) : t('management.oversightDisabled')}
          icon="TriangleAlert"
          tone="amber"
          delay={0.15}
        />
        <StatCard
          label={t('management.revisedAppraisals')}
          value={fmtNumber(revisions.revised_appraisals)}
          note={t('management.supervisorUpdates', { count: Number(revisions.total_revisions || 0) })}
          icon="Repeat2"
          tone="blue"
          delay={0.17}
        />
        <StatCard
          label={t('management.evidenceExceptions')}
          value={fmtNumber(insights?.evidence_exception_count)}
          note={t('management.evidenceNote')}
          icon="ShieldCheck"
          tone="purple"
          delay={0.19}
        />
      </div>

      <div className="apdash-grid apdash-grid--2">
        <SectionCard
          title={t('management.sectionPerformance')}
          subtitle={cycle?.title ? t('management.sectionSubtitleWithCycle', { cycle: cycle.title }) : t('management.sectionSubtitle')}
          icon="Layers"
          delay={0.2}
        >
          <div className="apdash-table-wrap">
            <table className="apdash-table">
              <thead><tr><th>{t('general.section')}</th><th>{t('general.appraisals')}</th><th>{t('general.avgScore')}</th></tr></thead>
              <tbody>
                {sections.map((row, index) => (
                  <tr key={`${row.section_code}-${index}`}>
                    <td>{row.section_label || row.section_code || t('general.section')}</td>
                    <td>{fmtNumber(row.appraisal_count)}</td>
                    <td><strong>{scoreValue(row.avg_score)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sections.length && <EmptyPanel title={t('management.sectionEmptyTitle')} message={t('management.sectionEmptyMessage')} />}
          </div>
        </SectionCard>

        <SectionCard title={t('management.performanceByLevel')} subtitle={t('management.levelSubtitle')} icon="Users" delay={0.22}>
          <div className="apdash-bars">
            {profiles.map((row, index) => (
              <div className="apdash-profile-row" key={`${row.profile_label}-${index}`}>
                <div className="apdash-bar-row">
                  <div className="apdash-bar-row__meta">
                    <span>{row.profile_label || t('general.unassigned')}</span>
                    <strong>{fmtNumber(row.cnt)}</strong>
                  </div>
                  <div className="apdash-profile-row__score">{t('management.avgPrefix', { score: scoreValue(row.avg_score) })}</div>
                </div>
              </div>
            ))}
            {!profiles.length && <EmptyPanel title={t('management.levelEmptyTitle')} message={t('management.levelEmptyMessage')} />}
          </div>
        </SectionCard>
      </div>

      <div className="apdash-grid apdash-grid--2">
        <SectionCard title={t('management.objectivePerformance')} subtitle={t('management.objectiveSubtitle')} icon="Target" delay={0.24}>
          <div className="apdash-table-wrap">
            <table className="apdash-table">
              <thead><tr><th>{t('management.objective')}</th><th>{t('management.ratings')}</th><th>{t('general.avgDot')}</th></tr></thead>
              <tbody>
                {objectives.slice(0, 8).map((row, index) => (
                  <tr key={`${row.objective_code}-${index}`}>
                    <td title={row.objective}>
                      <span className="apdash-objective-code">{row.objective_code}</span>
                      <small className="apdash-objective-text">{row.objective}</small>
                    </td>
                    <td>{fmtNumber(row.rating_count)}</td>
                    <td><strong>{scoreValue(row.avg_rating)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!objectives.length && <EmptyPanel title={t('management.objectiveEmptyTitle')} message={t('management.objectiveEmptyMessage')} />}
          </div>
        </SectionCard>

        <SectionCard title={t('management.developmentThemes')} subtitle={t('management.developmentSubtitle')} icon="TrendingUp" delay={0.26}>
          <div className="apdash-theme-list">
            {development.slice(0, 8).map((row, index) => (
              <div className="apdash-theme-item" key={`${row.development}-${index}`}>
                <span>{row.development}</span>
                <strong>{fmtNumber(row.cnt)}</strong>
              </div>
            ))}
            {!development.length && <EmptyPanel title={t('management.developmentEmptyTitle')} message={t('management.developmentEmptyMessage')} />}
          </div>
        </SectionCard>
      </div>
    </>
  );
};

const AdminDashboard = ({ payload, onboardingLoading, onOnboard, supervisorName, exporting, onExport, canManage = true }) => {
  const stats = payload?.stats || {};
  const cycle = payload?.cycle;

  return (
    <>
      {Number(payload?.appraiser_assignment_count || 0) > 0 && !payload?.appraiser_is_onboarded && (
        <SupervisorOnboardingExperience
          cycle={cycle}
          assignedCount={Number(payload?.appraiser_assignment_count || 0)}
          supervisorName={supervisorName}
          loading={onboardingLoading}
          onOnboard={onOnboard}
          roleLabel={t('general.supervisor')}
        />
      )}

      <AdminQuickActionsStrip exporting={exporting} onExport={onExport} canManage={canManage} />

      <div className="apdash-grid apdash-grid--4">
        <StatCard label={t('admin.eligibleEmployees')} value={fmtNumber(stats.total_staff)} note={t('admin.eligibleNote')} icon="Users" />
        <StatCard label={t('admin.appraised')} value={fmtNumber(stats.total_appraised)} note={t('admin.completedPct', { progress: fmtPct(stats.progress_percent) })} icon="ClipboardCheck" tone="blue" delay={0.04} />
        <StatCard label={t('general.pending')} value={fmtNumber(stats.pending_appraisals)} note={t('admin.awaiting')} icon="Hourglass" tone="amber" delay={0.08} />
        <StatCard label={t('general.avgScore')} value={scoreValue(stats.avg_score)} note={t('admin.kpiAvg', { score: scoreValue(stats.avg_kpi_score) })} icon="Star" tone="purple" delay={0.12} />
      </div>

      <AdminPendingQuickActions supervisors={stats.supervisor_progress || []} />

      <div className="apdash-grid apdash-grid--2">
        <SectionCard title={t('admin.cycleProgress')} subtitle={cycle ? `${cycle.title} • ${cycle.year}` : t('admin.noActiveCycleFound')} icon="PieChart" delay={0.14}>
          <div className="apdash-progress-card">
            <ProgressRing value={stats.progress_percent} label={t('admin.completedCount')} />
            <div className="apdash-status-stack">
              <span><AppIcon icon="CircleCheck" /> {t('admin.acknowledgedCount')} <strong>{fmtNumber(stats.acknowledged)}</strong></span>
              <span><AppIcon icon="History" /> {t('admin.pendingAcknowledgement')} <strong>{fmtNumber(stats.pending_status)}</strong></span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('admin.scoreDistribution')} subtitle={t('admin.distributionSubtitle')} icon="Signal" delay={0.18}>
          <DistributionBars rows={stats.score_distribution || []} />
        </SectionCard>
      </div>

      <div className="apdash-grid apdash-grid--2">
        <SectionCard title={t('admin.departmentBreakdown')} subtitle={t('admin.departmentSubtitle')} icon="Building2" delay={0.22}>
          <div className="apdash-table-wrap">
            <table className="apdash-table">
              <thead><tr><th>{t('admin.department')}</th><th>{t('admin.appraised')}</th><th>{t('general.avgScore')}</th></tr></thead>
              <tbody>
                {(stats.department_breakdown || []).slice(0, 8).map((row, index) => (
                  <tr key={`${row.department}-${index}`}>
                    <td>{row.department || t('general.unassigned')}</td>
                    <td>{fmtNumber(row.appraised)}</td>
                    <td><strong>{scoreValue(row.avg_score)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(stats.department_breakdown || []).length === 0 && <EmptyPanel title={t('admin.noDepartmentTitle')} message={t('admin.noDepartmentMessage')} />}
          </div>
        </SectionCard>

        <SectionCard title={t('admin.supervisorProgress')} subtitle={t('admin.supervisorSubtitle')} icon="ArrowRightLeft" delay={0.26}>
          <div className="apdash-supervisors">
            {(stats.supervisor_progress || []).slice(0, 7).map((sup) => (
              <div className="apdash-supervisor" key={sup.id}>
                <div>
                  <strong>{sup.supervisor_name}</strong>
                  <small>{sup.department || t('general.noDepartment')} • {t('admin.staffDone', { appraised: fmtNumber(sup.appraised_count), assigned: fmtNumber(sup.total_assigned) })}</small>
                </div>
                <span>{fmtPct(sup.progress_percent)}</span>
              </div>
            ))}
            {(stats.supervisor_progress || []).length === 0 && <EmptyPanel title={t('admin.noSupervisorActivity')} message={t('admin.noSupervisorActivityMessage')} />}
          </div>
        </SectionCard>
      </div>

      <ManagementInsightsPanel insights={stats.management_insights || {}} cycle={cycle} />

      <SectionCard
        title={t('personal.myOwn')}
        subtitle={t('personal.personalRecord')}
        icon="UserCheck"
        delay={0.29}
        action={<Link className="apdash-secondary-btn" to="/my-appraisals"><AppIcon icon="History" /> {t('general.viewHistory')}</Link>}
      >
        {payload?.my_appraisal ? (
          <div className="apdash-current apdash-current--compact">
            <div className="apdash-current__rating">
              <ScoreRing value={payload.my_appraisal.appraisal_summary} label={t('general.rating')} max={cycle?.rating_max} />
              <p>{payload.my_appraisal.evaluation_statement || t('general.unrated')}</p>
            </div>
            <div className="apdash-status-stack">
              <span><AppIcon icon="UserCheck" /> {t('general.supervisor')} <strong>{payload.my_appraisal.supervisor_name || '—'}</strong></span>
              <span><AppIcon icon="Info" /> {t('general.status')} <strong>{payload.my_appraisal.status ? appraisalStatus(payload.my_appraisal.status) : '—'}</strong></span>
              <span><AppIcon icon="Target" /> {t('general.kpiRating')} <strong>{scoreValue(payload.my_appraisal.kpi_rating)}</strong></span>
            </div>
          </div>
        ) : (
          <EmptyPanel
            icon="ClipboardList"
            title={t('personal.notAppraisedTitle')}
            message={t('personal.notAppraisedAdmin', { cycle: cycle?.title || t('personal.thisCycle') })}
            action={<Link className="apdash-primary-btn" to="/my-appraisals"><AppIcon icon="UserCheck" /> {t('general.openMyAppraisals')}</Link>}
          />
        )}
      </SectionCard>
    </>
  );
};

const SupervisorDashboard = ({ payload, onboardingLoading, onOnboard, supervisorName }) => {
  const stats = payload?.stats || {};
  const cycle = payload?.cycle;
  const pending = payload?.pending_subordinates || [];
  const myAppraisal = payload?.my_appraisal;

  if (!payload?.is_onboarded) {
    return (
      <SupervisorOnboardingExperience
        cycle={cycle}
        assignedCount={stats.total_assigned || 0}
        supervisorName={supervisorName}
        loading={onboardingLoading}
        onOnboard={onOnboard}
      />
    );
  }

  return (
    <>
      <div className="apdash-grid apdash-grid--4">
        <StatCard label={t('supervisorDashboard.assignedStaff')} value={fmtNumber(stats.total_assigned)} note={t('supervisorDashboard.teamNote')} icon="Users" />
        <StatCard label={t('admin.completedCount')} value={fmtNumber(stats.appraised_count)} note={t('supervisorDashboard.completePct', { progress: fmtPct(stats.progress_percent) })} icon="ClipboardCheck" tone="blue" delay={0.04} />
        <StatCard label={t('general.pending')} value={fmtNumber(stats.pending_count)} note={t('supervisorDashboard.stillToAppraise')} icon="Hourglass" tone="amber" delay={0.08} />
        <StatCard label={t('general.averageScore')} value={scoreValue(stats.avg_score)} note={t('admin.kpiAvg', { score: scoreValue(stats.avg_kpi_score) })} icon="Star" tone="purple" delay={0.12} />
      </div>

      <div className="apdash-grid apdash-grid--2">
        <SectionCard title={t('supervisorDashboard.myCycleProgress')} subtitle={cycle ? `${cycle.title} • ${cycle.year}` : t('general.currentCycle')} icon="PieChart" delay={0.14}>
          <div className="apdash-progress-card">
            <ProgressRing value={stats.progress_percent} label={t('admin.completedCount')} />
            <div className="apdash-status-stack">
              <span><AppIcon icon="UserCheck" /> {t('supervisorDashboard.onboarding')} <strong>{t('supervisorDashboard.done')}</strong></span>
              <span><AppIcon icon="ListChecks" /> {t('supervisorDashboard.assigned')} <strong>{fmtNumber(stats.total_assigned)}</strong></span>
              <span><AppIcon icon="History" /> {t('general.pending')} <strong>{fmtNumber(stats.pending_count)}</strong></span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('admin.scoreDistribution')} subtitle={t('supervisorDashboard.distributionSubtitle')} icon="Signal" delay={0.18}>
          <DistributionBars rows={stats.score_distribution || []} />
        </SectionCard>
      </div>

      <SectionCard
        title={t('supervisorDashboard.pendingSubordinates')}
        subtitle={t('supervisorDashboard.pendingSubtitle')}
        icon="History"
        delay={0.22}
        action={<Link className="apdash-secondary-btn" to="/appraisals"><AppIcon icon="ExternalLink" /> {t('actions.viewAppraisals')}</Link>}
      >
        <div className="apdash-person-grid">
          {pending.map((staff) => (
            <div className="apdash-person" key={staff.id}>
              <span className="apdash-person__avatar">{`${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase() || 'S'}</span>
              <div>
                <strong>{staff.first_name} {staff.last_name}</strong>
                <small>{staff.job_title_display || staff.job_title || t('general.staff')} • {staff.department || t('general.noDepartment')}</small>
              </div>
              <Link
                to={`/appraisals?staff_user_id=${encodeURIComponent(staff.id)}&cycle_id=${encodeURIComponent(cycle?.id || '')}`}
                title={t('supervisorDashboard.reviewSetup', { name: `${staff.first_name} ${staff.last_name}` })}
                aria-label={t('supervisorDashboard.prepareAppraisal', { name: `${staff.first_name} ${staff.last_name}` })}
              ><AppIcon icon="PenLine" /></Link>
            </div>
          ))}
          {pending.length === 0 && <EmptyPanel icon="CircleCheck" title={t('supervisorDashboard.allCaughtUp')} message={t('supervisorDashboard.noPendingStaff')} />}
        </div>
      </SectionCard>

      <SectionCard
        title={t('personal.myOwn')}
        subtitle={t('personal.personalSummary')}
        icon="UserCheck"
        delay={0.24}
        action={<Link className="apdash-secondary-btn" to="/my-appraisals"><AppIcon icon="History" /> {t('general.viewHistory')}</Link>}
      >
        {myAppraisal ? (
          <div className="apdash-current apdash-current--compact">
            <div className="apdash-current__rating">
              <ScoreRing value={myAppraisal.appraisal_summary} label={t('general.rating')} max={cycle?.rating_max} />
              <p>{myAppraisal.evaluation_statement || t('general.unrated')}</p>
            </div>
            <div className="apdash-status-stack">
              <span><AppIcon icon="UserCheck" /> {t('general.supervisor')} <strong>{myAppraisal.supervisor_name || '—'}</strong></span>
              <span><AppIcon icon="Info" /> {t('general.status')} <strong>{myAppraisal.status ? appraisalStatus(myAppraisal.status) : '—'}</strong></span>
              <span><AppIcon icon="Target" /> {t('general.kpiRating')} <strong>{scoreValue(myAppraisal.kpi_rating)}</strong></span>
            </div>
          </div>
        ) : (
          <EmptyPanel
            icon="ClipboardList"
            title={t('personal.notAppraisedTitle')}
            message={t('personal.notAppraisedSupervisor', { cycle: cycle?.title || t('personal.thisCycle') })}
            action={<Link className="apdash-primary-btn" to="/my-appraisals"><AppIcon icon="UserCheck" /> {t('general.openMyAppraisals')}</Link>}
          />
        )}
      </SectionCard>
    </>
  );
};

const StaffDashboard = ({ payload, feedbackLoading, onSubmitFeedback }) => {
  const current = payload?.current_appraisal;
  const sections = payload?.section_scores || [];
  const history = payload?.appraisal_history || [];

  return (
    <>
      <div className="apdash-grid apdash-grid--3">
        <StatCard label={t('staffDashboard.currentScore')} value={fmtScore(current?.appraisal_summary)} note={current?.evaluation_statement || t('staffDashboard.notYetAppraised')} icon="Star" />
        <StatCard label={t('general.kpiRating')} value={fmtScore(current?.kpi_rating)} note={t('general.currentCycle')} icon="Target" tone="blue" delay={0.04} />
        <StatCard label={t('staffDashboard.totalCycles')} value={fmtNumber(payload?.total_cycles)} note={t('staffDashboard.historyNote')} icon="History" tone="purple" delay={0.08} />
      </div>

      <div className="apdash-grid apdash-grid--2">
        <SectionCard title={t('staffDashboard.currentAppraisal')} subtitle={payload?.cycle ? `${payload.cycle.title} • ${payload.cycle.year}` : t('general.noActiveCycle')} icon="ClipboardCheck" delay={0.14}>
          {current ? (
            <div className="apdash-current">
              <div className="apdash-current__rating">
                <ScoreRing value={current.appraisal_summary} label={t('general.rating')} max={payload?.cycle?.rating_max} />
                <p>{current.evaluation_statement || t('general.unrated')}</p>
              </div>
              <div className="apdash-status-stack">
                <span><AppIcon icon="UserCheck" /> {t('general.supervisor')} <strong>{current.supervisor_name || '—'}</strong></span>
                <span><AppIcon icon="Info" /> {t('general.status')} <strong>{current.status ? appraisalStatus(current.status) : '—'}</strong></span>
                <span><AppIcon icon="PenLine" /> {t('general.feedback')} <strong>{current.feedback ? t('general.submitted') : t('general.pending')}</strong></span>
              </div>
            </div>
          ) : <EmptyPanel title={t('staffDashboard.notYetAppraised')} message={t('staffDashboard.notSubmitted')} />}
        </SectionCard>

        <SectionCard title={t('staffDashboard.scoreBreakdown')} subtitle={t('staffDashboard.normalScoreSummary')} icon="Layers" delay={0.18}>
          <div className="apdash-bars">
            {sections.map((section) => (
              <div className="apdash-bar-row" key={section.section_code}>
                <div className="apdash-bar-row__meta">
                  <span>{section.section_label}</span>
                  <strong>{scoreValue(section.section_avg)}</strong>
                </div>
                <div className="apdash-bar-row__track"><span style={{ width: `${Math.min((Number(section.section_avg || 0) / Math.max(Number(payload?.cycle?.rating_max || 5), 0.01)) * 100, 100)}%` }} /></div>
              </div>
            ))}
            {sections.length === 0 && <EmptyPanel title={t('staffDashboard.noSectionScores')} message={t('staffDashboard.noSectionScoresMessage')} />}
          </div>
        </SectionCard>
      </div>

      {current?.feedback ? (
        <SectionCard title={t('feedbackForm.submittedHeading')} subtitle={t('feedbackForm.submittedSubtitle')} icon="MessageSquare" delay={0.2}>
          <div className="apdash-feedback apdash-feedback--readonly">
            <AppIcon icon="Quote" />
            <p>{current.feedback}</p>
          </div>
        </SectionCard>
      ) : (
        current && <FeedbackForm appraisal={current} loading={feedbackLoading} onSubmit={onSubmitFeedback} />
      )}

      <SectionCard title={t('timeline.title')} subtitle={t('timeline.subtitle')} icon="History" delay={0.22}>
        <AppraisalTimeline history={history} />
      </SectionCard>
    </>
  );
};

const SuperAdminDashboard = ({ payload, exporting, onExport }) => {
  const companies = payload?.companies || [];
  const totals = companies.reduce((acc, company) => {
    const item = company?.stats || {};
    acc.staff += Number(item.total_staff || 0);
    acc.appraised += Number(item.total_appraised || 0);
    acc.supervisors += Number(item.total_supervisors || 0);
    acc.onboarded += Number(item.onboarded_supervisors || 0);
    acc.acknowledged += Number(item.acknowledged || 0);
    acc.pendingStatus += Number(item.pending_status || 0);
    acc.pendingAppraisals += Number(item.pending_appraisals || 0);
    if (item.avg_score !== null && item.avg_score !== undefined && Number.isFinite(Number(item.avg_score))) {
      acc.scoreTotal += Number(item.avg_score) * Number(item.total_appraised || 0);
    }
    (item.score_distribution || []).forEach((row) => {
      const key = row.evaluation_statement || t('general.unrated');
      acc.distribution[key] = (acc.distribution[key] || 0) + Number(row.cnt || 0);
    });
    return acc;
  }, { staff: 0, appraised: 0, supervisors: 0, onboarded: 0, acknowledged: 0, pendingStatus: 0, pendingAppraisals: 0, scoreTotal: 0, distribution: {} });

  const progress = totals.staff > 0 ? (totals.appraised / totals.staff) * 100 : 0;
  const acknowledgementRate = totals.appraised > 0 ? (totals.acknowledged / totals.appraised) * 100 : 0;
  const onboardingRate = totals.supervisors > 0 ? (totals.onboarded / totals.supervisors) * 100 : 0;
  const averageScore = totals.appraised > 0 ? fmtScore(totals.scoreTotal / totals.appraised) : '—';
  const distribution = Object.entries(totals.distribution).map(([evaluation_statement, cnt]) => ({ evaluation_statement, cnt }));

  return (
    <>
      <AdminQuickActionsStrip exporting={exporting} onExport={companies.length === 1 ? onExport : undefined} />
      <div className="apdash-grid apdash-grid--4">
        <StatCard label={t('company.companies')} value={fmtNumber(companies.length)} note={t('company.activeOrganisations')} icon="Building2" />
        <StatCard label={t('admin.eligibleEmployees')} value={fmtNumber(totals.staff)} note={t('company.acrossCompanies')} icon="Users" tone="blue" delay={0.04} />
        <StatCard label={t('admin.appraised')} value={fmtNumber(totals.appraised)} note={t('admin.completedPct', { progress: fmtPct(progress) })} icon="ClipboardCheck" tone="purple" delay={0.08} />
        <StatCard label={t('admin.acknowledgedCount')} value={fmtNumber(totals.acknowledged)} note={t('superAdmin.responseRate', { progress: fmtPct(acknowledgementRate) })} icon="UserCheck" tone="amber" delay={0.12} />
      </div>

      <div className="apdash-grid apdash-grid--3 apdash-executive-row">
        <SectionCard title={t('superAdmin.portfolioProgress')} subtitle={t('superAdmin.portfolioSubtitle')} icon="PieChart" delay={0.13}>
          <div className="apdash-progress-card apdash-progress-card--compact">
            <ProgressRing value={progress} label={t('admin.appraised')} />
            <div className="apdash-status-stack">
              <span><AppIcon icon="History" /> {t('admin.awaiting')} <strong>{fmtNumber(totals.pendingAppraisals)}</strong></span>
              <span><AppIcon icon="MessageSquare" /> {t('admin.pendingAcknowledgement')} <strong>{fmtNumber(totals.pendingStatus)}</strong></span>
              <span><AppIcon icon="Star" /> {t('general.averageScore')} <strong>{averageScore}</strong></span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('superAdmin.supervisorOnboarding')} subtitle={t('superAdmin.onboardingSubtitle')} icon="UserCheck" delay={0.16}>
          <div className="apdash-progress-card apdash-progress-card--compact">
            <ProgressRing value={onboardingRate} label={t('superAdmin.onboarded')} />
            <div className="apdash-status-stack">
              <span><AppIcon icon="ArrowRightLeft" /> {t('superAdmin.supervisors')} <strong>{fmtNumber(totals.supervisors)}</strong></span>
              <span><AppIcon icon="CircleCheck" /> {t('superAdmin.onboarded')} <strong>{fmtNumber(totals.onboarded)}</strong></span>
              <span><AppIcon icon="Hourglass" /> {t('superAdmin.outstanding')} <strong>{fmtNumber(Math.max(totals.supervisors - totals.onboarded, 0))}</strong></span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('admin.scoreDistribution')} subtitle={t('superAdmin.distributionSubtitle')} icon="Signal" delay={0.18}>
          <DistributionBars rows={distribution} />
        </SectionCard>
      </div>

      {companies.length === 1 && companies[0]?.stats?.management_insights && (
        <ManagementInsightsPanel insights={companies[0].stats.management_insights} cycle={companies[0].cycle} />
      )}

      <SectionCard title={t('company.performance')} subtitle={t('company.performanceSubtitle')} icon="Building2" delay={0.2}>
        <div className="apdash-company-grid">
          {companies.map((company) => {
            const item = company?.stats || {};
            const pct = Number(item.progress_percent || 0);
            const ack = Number(item.acknowledged || 0);
            const responseRate = Number(item.total_appraised || 0) > 0 ? (ack / Number(item.total_appraised || 0)) * 100 : 0;
            return (
              <div className="apdash-company" key={company.id}>
                <div className="apdash-company__head">
                  <div>
                    <strong>{company.name}</strong>
                    <small>{company.cycle ? `${company.cycle.title} • ${company.cycle.year}` : t('general.noActiveCycle')}</small>
                  </div>
                  <span>{fmtPct(pct)}</span>
                </div>
                <div className="apdash-bar-row__track"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                <div className="apdash-company__stats">
                  <span>{t('company.employees')} <strong>{fmtNumber(item.total_staff)}</strong></span>
                  <span>{t('admin.appraised')} <strong>{fmtNumber(item.total_appraised)}</strong></span>
                  <span>{t('admin.acknowledgedCount')} <strong>{fmtNumber(ack)}</strong></span>
                  <span>{t('company.response')} <strong>{fmtPct(responseRate)}</strong></span>
                  <span>{t('general.avg')} <strong>{scoreValue(item.avg_score)}</strong></span>
                </div>
              </div>
            );
          })}
          {companies.length === 0 && <EmptyPanel title={t('company.noCompaniesTitle')} message={t('company.noCompaniesMessage')} />}
        </div>
      </SectionCard>
    </>
  );
};

const DashboardContent = () => {
  const { i18n: languageContext } = useTranslation('dashboard');
  const { user } = useAuthStore();
  const portalContext = usePortalContextStore();
  const { isViewOnly } = useCompanyWritePermission();
  const { showToast } = useToastStore();
  const {
    data,
    loading,
    error,
    fetchDashboardData,
    onboardSupervisor,
    submitAppraisalFeedback,
    onboardingLoading,
    feedbackLoading,
    cycleId,
    setCycleId,
    clearCycleId,
    viewCompanyId,
    setViewCompanyId,
    clearViewCompanyId,
  } = useDashboardStore();

  const [companyOptions, setCompanyOptions] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [managementExporting, setManagementExporting] = useState(false);

  const payload = data?.data;
  const role = payload?.role || user?.role;

  useEffect(() => {
    if (['super_admin', 'admin'].includes(user?.role)) {
      // A cycle saved for a different company must not be reused after a switch.
      const companyChanged = String(viewCompanyId || '') !== String(portalContext.viewCompanyId || '');
      const selectedCycle = portalContext.cycleId || (companyChanged || portalContext.viewCompanyId ? '' : cycleId);
      fetchDashboardData(selectedCycle, portalContext.viewCompanyId || '');
    } else {
      fetchDashboardData();
    }
    // Global context changes reload the workspace from the navigation switcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = t('page.documentTitle');
  }, [languageContext.language]);

  useEffect(() => {
    let alive = true;
    setCyclesLoading(true);

    api.get('/cycles/list?limit=100&page=1&sortBy=year&sortOrder=DESC')
      .then((response) => {
        if (!alive) return;
        setCycles(response.data?.data || []);
      })
      .catch(() => {
        if (!alive) return;
        setCycles([]);
      })
      .finally(() => {
        if (alive) setCyclesLoading(false);
      });

    return () => {
      alive = false;
    };
    // Cycle titles are translated by the server: reload them when the language changes.
  }, [role, viewCompanyId, i18n.resolvedLanguage]);

  useEffect(() => {
    if (payload?.role === 'super_admin' && Array.isArray(payload?.companies) && payload.companies.length > 1) {
      setCompanyOptions(payload.companies.map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
      })));
    }
  }, [payload?.role, payload?.companies]);

  const cycleOptions = useMemo(() => {
    const fromLookup = cycles.map((cycle) => ({
      value: cycle.id,
      label: `${cycle.title} (${cycle.year})`,
      description: cycle.is_active ? t('page.activeCycle') : (cycle.company_code || cycle.company_name || t('general.cycle')),
    }));

    if (fromLookup.length) return fromLookup;

    if (payload?.role === 'super_admin') {
      return (payload?.companies || [])
        .map((company) => company.cycle)
        .filter(Boolean)
        .reduce((acc, cycle) => {
          if (!acc.some((item) => String(item.value) === String(cycle.id))) {
            acc.push({
              value: cycle.id,
              label: `${cycle.title} (${cycle.year})`,
              description: cycle.is_active ? t('page.activeCycle') : t('page.selectedCycle'),
            });
          }
          return acc;
        }, []);
    }

    const cycle = payload?.cycle;
    return cycle ? [{ value: cycle.id, label: `${cycle.title} (${cycle.year})`, description: cycle.is_active ? t('page.activeCycle') : t('page.selectedCycle') }] : [];
  }, [cycles, payload, languageContext.language]);


  const subtitle = user?.company_name
    ? t('page.welcomeCompany', { name: getName(user), company: user.company_name })
    : t('page.welcome', { name: getName(user) });

  const handleCompanyChange = (companyId) => {
    if (companyId) return setViewCompanyId(companyId);
    return clearViewCompanyId();
  };

  const downloadManagementReport = async () => {
    const targetCycleId = cycleId || payload?.cycle?.id || (payload?.companies?.length === 1 ? payload.companies[0]?.cycle?.id : '');
    if (!targetCycleId) {
      showToast(t('toast.selectCycle'), 'error');
      return;
    }

    setManagementExporting(true);
    try {
      const params = new URLSearchParams({ cycle_id: String(targetCycleId) });
      if (role === 'super_admin' && viewCompanyId) params.append('view_company_id', String(viewCompanyId));

      const response = await api.get(`/exports/management/appraisals/excel?${params.toString()}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Management_Appraisal_Report_${payload?.cycle?.year || payload?.companies?.[0]?.cycle?.year || 'Cycle'}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showToast(t('toast.reportDownloaded'), 'success');
    } catch (error) {
      let message = t('toast.reportFailed');
      if (error?.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await error.response.data.text());
          message = body?.message || message;
        } catch {
          // Keep the generic export message when a non-JSON response is returned.
        }
      } else {
        message = error?.response?.data?.message || message;
      }
      showToast(message, 'error');
    } finally {
      setManagementExporting(false);
    }
  };

  const handleOnboard = async () => {
    const result = await onboardSupervisor({ cycle_id: cycleId || payload?.cycle?.id });
    if (result?.success) {
      showToast(t('toast.onboarded'), 'success');
    } else if (result?.message) {
      showToast(result.message, 'error');
    }
    return result;
  };

  const hasCycle = Boolean(payload?.cycle) || cycleOptions.length > 0;
  const shouldShowNoCycle = !loading && !error && !hasCycle;

  return (
    <DashboardShell>
      <div className="apdash-page">
        <PageNav
          eyebrow={t('page.eyebrow')}
          pageTitle={t('page.title')}
          subtitle={isViewOnly ? t('page.viewOnly', { subtitle }) : subtitle}
          links={[{ label: t('page.title') }]}
          actions={role !== 'super_admin' ? (
            <div className="apdash-actions-inline">
              <div className="apdash-filter-inline">
                {cycleOptions.length ? (
                  <AppSelect
                    value={cycleId || payload?.cycle?.id || ''}
                    onChange={(next) => next ? setCycleId(next) : clearCycleId()}
                    options={cycleOptions}
                    placeholder={cyclesLoading ? t('page.loadingCycles') : t('page.switchCycle')}
                    searchable={false}
                    clearable={!!cycleId}
                    icon="CalendarCheck"
                  />
                ) : !isViewOnly ? (
                  <Link className="apdash-secondary-btn apdash-cycle-create-btn" to="/cycles/create">
                    <AppIcon icon="PlusCircle" /> {t('actions.createCycle')}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div className="apdash-loading-stack" key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingCards />
              <div className="apdash-grid apdash-grid--2"><div className="apdash-skeleton-panel" /><div className="apdash-skeleton-panel" /></div>
            </motion.div>
          ) : error ? (
            <EmptyPanel
              icon="TriangleAlert"
              title={t('page.failedTitle')}
              message={error}
              action={<button type="button" className="apdash-primary-btn" onClick={() => fetchDashboardData()}><AppIcon icon="RefreshCw" /> {t('page.retry')}</button>}
            />
          ) : shouldShowNoCycle ? (
            <NoCycleCallout role={role} canManage={!isViewOnly} />
          ) : role === 'super_admin' ? (
            <SuperAdminDashboard
              payload={payload}
              exporting={managementExporting}
              onExport={downloadManagementReport}
            />
          ) : role === 'admin' ? (
            <AdminDashboard
              payload={payload}
              onboardingLoading={onboardingLoading}
              onOnboard={handleOnboard}
              supervisorName={getName(user)}
              exporting={managementExporting}
              onExport={downloadManagementReport}
              canManage={!isViewOnly}
            />
          ) : role === 'supervisor' ? (
            <SupervisorDashboard payload={payload} onboardingLoading={onboardingLoading} onOnboard={handleOnboard} supervisorName={getName(user)} />
          ) : role === 'staff' ? (
            <StaffDashboard payload={payload} feedbackLoading={feedbackLoading} onSubmitFeedback={submitAppraisalFeedback} />
          ) : (
            <EmptyPanel title={t('page.unavailableTitle')} message={t('page.unavailableMessage')} />
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
};

const Dashboard = () => <DashboardContent />;

export default Dashboard;
