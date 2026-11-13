import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber, compareLocalized } from '../../utils/format';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import api from '../../services/api';
import useAuthStore from '../../stores/useAuthStore';
import useGeneralQuestionsStore from '../../stores/useGeneralQuestionsStore';
import useKpiQuestionsStore from '../../stores/useKpiQuestionsStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import QuestionPageShell from './QuestionPageShell';
import { basePath, isKpiType, makePages, sectionType } from './helpers';
import './Questions.css';
import AppIcon from '../../components/ui/AppIcon';
import KpiWeightingDialog from './KpiWeightingDialog';

const qt = (key, options) => i18n.t(key, { ns: 'questions', ...options });
const localizedScope = (value) => qt(value === 'supervisor' ? 'scope_supervisor' : value === 'individual' ? 'scope_individual' : 'scope_department');
const statusOptions = () => [
  { value: '', label: qt('all_status') },
  { value: 1, label: qt('active') },
  { value: 0, label: qt('inactive') },
];
const reviewOptions = () => [
  { value: '', label: qt('all_review_states') },
  { value: 'ready', label: qt('ready') },
  { value: 'needs_review', label: qt('needs_review') },
];
const limitOptions = () => [10, 20, 50].map((count) => ({ value: count, label: qt('rows', { count }) }));

const SortButton = ({ label, field, sortBy, sortOrder, onSort }) => (
  <button type="button" className="qst-sort" onClick={() => onSort(field)}>
    {label}
    <AppIcon icon={sortBy === field && sortOrder === 'DESC' ? 'ArrowDown' : sortBy === field ? 'ArrowUp' : 'ArrowUpDown'} />
  </button>
);

const Pagination = ({ page, totalPages, onPageChange }) => {
  useTranslation('questions');
  const pages = makePages(page, totalPages);
  const current = Number(page || 1);
  const total = Math.max(Number(totalPages || 1), 1);

  if (total <= 1) return null;

  return (
    <div className="qst-pagination">
      <span className="qst-page-list">
        <button
          type="button"
          className="qst-page-btn"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <AppIcon icon="ChevronLeft" /> {qt('prev')}
        </button>

        {pages.map((item) => (
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={`qst-page-btn qst-page-btn--number ${item === current ? 'qst-page-btn--active' : ''}`}
              disabled={item === current}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="qst-page-ellipsis">…</span>
          )
        ))}

        <button
          type="button"
          className="qst-page-btn"
          disabled={current >= total}
          onClick={() => onPageChange(current + 1)}
        >
          {qt('next')} <AppIcon icon="ChevronRight" />
        </button>
      </span>
    </div>
  );
};

const QuestionStats = ({ questions, meta, type }) => {
  const { i18n: language } = useTranslation('questions');
  const locale = language.language;
  const sectionCount = new Set(questions.map((question) => question.section_id).filter(Boolean)).size;
  const departmentCount = new Set(questions.map((question) => question.department).filter(Boolean)).size;

  return (
    <div className="qst-stats">
      <div className="qst-stat-card">
        <span><AppIcon icon="Layers" /></span>
        <div>
          <strong>{formatNumber(meta?.total || 0, {}, locale)}</strong>
          <small>{isKpiType(type) ? qt('kpi_question_sets') : qt('general_question_sets')}</small>
        </div>
      </div>

      <div className="qst-stat-card">
        <span><AppIcon icon="ListChecks" /></span>
        <div>
          <strong>{formatNumber(meta?.total_questions || 0, {}, locale)}</strong>
          <small>{qt('matching_questions')}</small>
        </div>
      </div>

      <div className="qst-stat-card">
        <span><AppIcon icon="Layers" /></span>
        <div>
          <strong>{formatNumber(sectionCount, {}, locale)}</strong>
          <small>{qt('sections_on_page')}</small>
        </div>
      </div>

      {isKpiType(type) && (
        <div className="qst-stat-card">
          <span><AppIcon icon="Building2" /></span>
          <div>
            <strong>{formatNumber(departmentCount, {}, locale)}</strong>
            <small>{qt('departments_on_page')}</small>
          </div>
        </div>
      )}
    </div>
  );
};

const QuestionsOverview = ({ type = 'kpi' }) => {
  const { i18n: language } = useTranslation('questions');
  const locale = language.language;
  const isKpi = isKpiType(type);
  const { user } = useAuthStore();
  const generalStore = useGeneralQuestionsStore();
  const kpiStore = useKpiQuestionsStore();
  const store = isKpi ? kpiStore : generalStore;
  const portalCycleId = usePortalContextStore((state) => state.cycleId);

  const [cycles, setCycles] = useState([]);
  const [cyclesLoaded, setCyclesLoaded] = useState(false);
  const [sections, setSections] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cycleId, setCycleId] = useState(() => portalCycleId || '');
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('sort_order');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [weightTarget, setWeightTarget] = useState(null);

  const questions = store.questionGroups || [];
  const meta = store.groupMeta || { total: 0, total_questions: 0, page: 1, total_pages: 1, limit };
  const { isViewOnly, settingsLocked } = useCompanyWritePermission();
  // General questions are company-wide settings; KPI questions can be staff-specific (checked per question by the server).
  const isAdminLike = ['super_admin', 'admin'].includes(user?.role) && !(type === 'general' ? settingsLocked : isViewOnly);

  useEffect(() => {
    document.title = qt(isKpi ? 'document_kpi_title' : 'document_general_title');
  }, [type, isKpi, locale]);

  useEffect(() => {
    let active = true;
    setCyclesLoaded(false);

    api.get('/cycles/list?limit=500&page=1&sortBy=year&sortOrder=DESC')
      .then((response) => {
        if (!active) return;
        setCycles(response.data?.data || []);
      })
      .catch(() => {
        if (active) setCycles([]);
      })
      .finally(() => {
        if (active) setCyclesLoaded(true);
      });

    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!portalCycleId) return;

    setCycleId(String(portalCycleId));
    setSectionId('');
    setPage(1);
  }, [portalCycleId]);

  useEffect(() => {
    if (!cyclesLoaded || !cycleId) return;

    const selectedCycleStillExists = cycles.some(
      (cycle) => String(cycle.id) === String(cycleId)
    );

    if (!selectedCycleStillExists) {
      setCycleId('');
      setSectionId('');
      setPage(1);
    }
  }, [cyclesLoaded, cycles, cycleId]);

  useEffect(() => {
    const params = new URLSearchParams({
      limit: '100',
      page: '1',
      type: sectionType(type),
      is_active: '1',
      sortBy: 'sort_order',
      sortOrder: 'ASC',
    });

    if (cycleId) params.append('cycle_id', cycleId);

    api.get(`/sections/list?${params.toString()}`)
      .then((response) => setSections(response.data?.data || []))
      .catch(() => setSections([]));
  }, [cycleId, type, locale]);

  const buildFetchParams = (nextPage = page) => {
    const params = {
      page: nextPage,
      limit,
      search: searchQuery,
      section_id: sectionId,
      is_active: status,
      sortBy,
      sortOrder,
    };

    if (isKpi) {
      params.department = department;
      params.review_status = reviewStatus;
      params.cycle_id = cycleId;
    } else {
      params.cycle_id = cycleId;
    }

    return params;
  };

  const fetchQuestions = (nextPage = page) => {
    const params = buildFetchParams(nextPage);

    if (isKpi) return store.fetchKpiQuestionGroups(params);
    return store.fetchGeneralQuestionGroups(params);
  };

  useEffect(() => {
    fetchQuestions(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, page, limit, searchQuery, sectionId, status, department, reviewStatus, cycleId, sortBy, sortOrder, locale]);

  const cycleOptions = useMemo(() => [
    { value: '', label: qt('all_cycles') },
    ...cycles.map((cycle) => ({
      value: cycle.id,
      label: `${cycle.title} (${cycle.year})`,
      description: cycle.company_code,
    })),
  ], [cycles, locale]);

  const sectionOptions = useMemo(() => [
    { value: '', label: qt(isKpi ? 'all_kpi_sections' : 'all_general_sections') },
    ...sections.map((section) => ({
      value: section.id,
      label: `${section.code} — ${section.label}`,
      description: `${section.weight}% • ${section.cycle_year}`,
    })),
  ], [sections, isKpi, locale]);

  const departmentOptions = useMemo(() => {
    const apiDepartments = Array.isArray(meta?.filter_options?.departments)
      ? meta.filter_options.departments
      : [];

    // Keep a current-page fallback for compatibility with older API deployments,
    // but prefer the pagination-independent filter metadata from the API.
    const values = new Map();
    apiDepartments.forEach((item) => {
      const name = String(item || '').trim();
      if (name) values.set(name.toLowerCase(), name);
    });
    questions.forEach((question) => {
      const name = String(question?.department || '').trim();
      if (name && !values.has(name.toLowerCase())) values.set(name.toLowerCase(), name);
    });

    return [
      { value: '', label: qt('all_departments') },
      ...[...values.values()]
        .sort((a, b) => compareLocalized(a, b, locale))
        .map((name) => ({ value: name, label: meta?.filter_options?.department_labels?.[name] || questions.find((item) => item.department === name)?.department_display || name })),
    ];
  }, [meta?.filter_options?.departments, meta?.filter_options?.department_labels, questions, locale]);

  const submitSearch = (event) => {
    event?.preventDefault?.();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setPage(1);
    if (searchQuery) setSearchQuery('');
  };

  const handleSearchInputChange = (event) => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);

    if (nextValue === '' && searchQuery) {
      clearSearch();
    }
  };

  const handleSort = (field) => {
    setPage(1);

    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
  };



  return (
    <QuestionPageShell>
      <PageNav
        pageTitle={qt(isKpi ? 'kpi_questions' : 'general_questions')}
        links={[
          { label: qt('dashboard'), to: '/dashboard', active: true },
          { label: qt('questions'), to: basePath(type), active: false },
        ]}
      />

      <motion.section
        className="qst-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <div>
          <span className="qst-eyebrow">{qt('question_bank')}</span>
          <h2>
            {isKpi
              ? qt('hero_kpi_title')
              : qt('hero_general_title')}
          </h2>
          <p>
            {isKpi
              ? qt('hero_kpi_description')
              : qt('hero_general_description')}
          </p>
        </div>

        <div className="qst-hero__actions">
          <Link className="qst-tab-link" to={isKpi ? '/questions/general' : '/questions/kpi'}>
            <AppIcon icon="Repeat2" /> {qt(isKpi ? 'general_questions' : 'kpi_questions')}
          </Link>

          {user?.role === 'super_admin' && <Link className="qst-tab-link" to={`/cycles/copy-questions${cycleId ? `?source_cycle_id=${cycleId}` : ''}`}>
            <AppIcon icon="Copy" /> {qt('copy_questions')}
          </Link>}

          {isAdminLike && <Link className="qst-primary-btn" to={`${basePath(type)}/create`}>
            <AppIcon icon="PlusCircle" /> {qt('create_question')}
          </Link>}
        </div>
      </motion.section>

      <QuestionStats questions={questions} meta={meta} type={type} />

      <section className="qst-panel">
        <div className="qst-filters">
          <div className="qst-filter-row qst-filter-row--top">
            <form className="qst-search" onSubmit={submitSearch}>
              <AppIcon icon="Search" />

              <input
                name="questions_search"
                autoComplete="on"
                value={searchInput}
                onChange={handleSearchInputChange}
                placeholder={isKpi ? qt('search_kpi_placeholder') : qt('search_general_placeholder')}
              />

              {searchInput && (
                <button
                  type="button"
                  className="qst-search__clear"
                  onClick={clearSearch}
                  aria-label={qt('clear_search')}
                >
                  <AppIcon icon="X" />
                </button>
              )}

              <button type="submit">{qt('search')}</button>
            </form>

            <div className="qst-filter-limit">
              <AppSelect
                value={limit}
                onChange={(next) => {
                  setLimit(Number(next));
                  setPage(1);
                }}
                options={limitOptions()}
                searchable={false}
                clearable={false}
                icon="List"
              />
            </div>
          </div>

          <div className="qst-filter-row qst-filter-row--bottom">
            <div className="qst-filter-control">
              <AppSelect
                value={cycleId}
                onChange={(next) => {
                  setCycleId(next);
                  setSectionId('');
                  setPage(1);
                }}
                options={cycleOptions}
                searchable={false}
                clearable={false}
                icon="CalendarCheck"
              />
            </div>

            <div className="qst-filter-control">
              <AppSelect
                value={sectionId}
                onChange={(next) => {
                  setSectionId(next);
                  setPage(1);
                }}
                options={sectionOptions}
                searchable
                placeholder={qt('section')}
                icon="Layers"
              />
            </div>

            {isKpi && (
              <div className="qst-filter-control">
                <AppSelect
                  value={department}
                  onChange={(next) => {
                    setDepartment(next);
                    setPage(1);
                  }}
                  options={departmentOptions}
                  searchable
                  placeholder={qt('department')}
                  icon="Building2"
                />
              </div>
            )}

            {isKpi && (
              <div className="qst-filter-control">
                <AppSelect
                  value={reviewStatus}
                  onChange={(next) => {
                    setReviewStatus(next);
                    setPage(1);
                  }}
                  options={reviewOptions()}
                  searchable={false}
                  clearable={false}
                  icon="CircleCheck"
                />
              </div>
            )}

            <div className="qst-filter-control">
              <AppSelect
                value={status}
                onChange={(next) => {
                  setStatus(next);
                  setPage(1);
                }}
                options={statusOptions()}
                searchable={false}
                clearable={false}
                icon="ToggleRight"
              />
            </div>
          </div>
        </div>

        <div className="qst-result-line">
          <strong>{qt('question_sets_found', { count: Number(meta.total || 0), formattedCount: formatNumber(meta.total || 0, {}, locale) })}</strong>
          {searchQuery && <span>{qt('filtered_by', { search: searchQuery })}</span>}
        </div>

        <div className="qst-table-wrap">
          {isKpi ? (
            <table className="qst-table qst-table--groups">
              <thead>
                <tr>
                  <th><SortButton label={qt('kpi_set')} field="id" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></th>
                  <th><SortButton label={qt('department')} field="department" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></th>
                  <th>{qt('scope')}</th>
                  <th>{qt('questions')}</th>
                  <th>{qt('weighting')}</th>
                  <th>{qt('review')}</th>
                  <th>{qt('cycle')}</th>
                  <th>{qt('status')}</th>
                  <th className="qst-action-th">{qt('action')}</th>
                </tr>
              </thead>

              <tbody>
                {store.loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={9}><span className="qst-row-skeleton" /></td>
                    </tr>
                  ))
                ) : questions.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="qst-empty-row">{cyclesLoaded ? qt('no_kpi_sets') : qt('loading_question_setup')}</div>
                    </td>
                  </tr>
                ) : questions.map((group) => (
                  <tr key={group.group_id || group.id}>
                    <td>
                      <div className="qst-set-cell">
                        <span className="qst-section-pill">{group.section_code || '—'}</span>
                        <div>
                          <strong>{group.section_label || qt('untitled_kpi_section')}</strong>
                          <small>{group.company_name || group.company_code}</small>
                        </div>
                      </div>
                    </td>

                    <td>{group.department_display || group.department || '—'}</td>

                    <td>
                      <span className={`qst-scope qst-scope--${group.scope || 'department'}`}>
                        {localizedScope(group.scope)}
                      </span>
                      {group.supervisor_name && <small className="qst-muted-text">{group.supervisor_name}</small>}
                      {group.staff_name && <small className="qst-muted-text">{group.staff_name}</small>}
                    </td>

                    <td>
                      <span className="qst-count-pill">
                        {qt('question_count', { count: Number(group.question_count || 0), formattedCount: formatNumber(group.question_count || 0, {}, locale) })}
                      </span>
                    </td>

                    <td>
                      <span className={`qst-weight-pill ${group.weight_mode === 'custom' ? 'qst-weight-pill--custom' : group.weight_mode === 'mixed' ? 'qst-weight-pill--mixed' : ''}`}>
                        {qt(group.weight_mode === 'custom' ? 'custom' : group.weight_mode === 'mixed' ? 'mixed' : 'equal')}
                      </span>
                    </td>

                    <td>
                      <span className={`qst-review-pill ${group.review_status === 'needs_review' ? 'qst-review-pill--needs-review' : ''}`}>
                        <AppIcon icon={group.review_status === 'needs_review' ? 'TriangleAlert' : 'CircleCheck'} />
                        {group.review_status === 'needs_review'
                          ? qt('to_review', { count: Number(group.needs_review_count || 0), formattedCount: formatNumber(group.needs_review_count || 0, {}, locale) })
                          : qt('ready')}
                      </span>
                    </td>

                    <td>
                      <strong>{group.cycle_year || '—'}</strong>
                      <small className="qst-muted-text">{group.cycle_title}</small>
                    </td>

                    <td>
                      <span className={`qst-status qst-status--${group.group_status || 'active'}`}>
                        {qt(group.group_status === 'mixed' ? 'mixed' : group.group_status === 'inactive' ? 'inactive' : 'active')}
                      </span>
                    </td>

                    <td>
                      <div className="qst-actions">
                        <Link to={`${basePath(type)}/view/${group.group_id || group.id}`} title={qt('view_question_set')}>
                          <AppIcon icon="Eye" />
                        </Link>

                        {isAdminLike && <Link to={`${basePath(type)}/edit/${group.group_id || group.id}`} title={qt('edit_question_set')}>
                          <AppIcon icon="PenLine" />
                        </Link>}

                        {isAdminLike && (
                          <button
                            type="button"
                            onClick={() => setWeightTarget(group)}
                            title={qt('configure_kpi_weights')}
                          >
                            <AppIcon icon="Scale" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="qst-table qst-table--groups">
              <thead>
                <tr>
                  <th><SortButton label={qt('general_set')} field="id" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></th>
                  <th>{qt('questions')}</th>
                  <th>{qt('cycle')}</th>
                  <th>{qt('status')}</th>
                  <th className="qst-action-th">{qt('action')}</th>
                </tr>
              </thead>

              <tbody>
                {store.loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={5}><span className="qst-row-skeleton" /></td>
                    </tr>
                  ))
                ) : questions.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="qst-empty-row">{cyclesLoaded ? qt('no_general_sets') : qt('loading_question_setup')}</div>
                    </td>
                  </tr>
                ) : questions.map((group) => (
                  <tr key={group.group_id || group.id}>
                    <td>
                      <div className="qst-set-cell">
                        <span className="qst-section-pill">{group.section_code || '—'}</span>
                        <div>
                          <strong>{group.section_label || qt('untitled_general_section')}</strong>
                          <small>{group.company_name || group.company_code}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="qst-count-pill">
                        {qt('question_count', { count: Number(group.question_count || 0), formattedCount: formatNumber(group.question_count || 0, {}, locale) })}
                      </span>
                    </td>

                    <td>
                      <strong>{group.cycle_year || '—'}</strong>
                      <small className="qst-muted-text">{group.cycle_title}</small>
                    </td>

                    <td>
                      <span className={`qst-status qst-status--${group.group_status || 'active'}`}>
                        {qt(group.group_status === 'mixed' ? 'mixed' : group.group_status === 'inactive' ? 'inactive' : 'active')}
                      </span>
                    </td>

                    <td>
                      <div className="qst-actions">
                        <Link to={`${basePath(type)}/view/${group.group_id || group.id}`} title={qt('view_question_set')}>
                          <AppIcon icon="Eye" />
                        </Link>

                        {isAdminLike && <Link to={`${basePath(type)}/edit/${group.group_id || group.id}`} title={qt('edit_question_set')}>
                          <AppIcon icon="PenLine" />
                        </Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="qst-panel__footer">
          <span>
            {qt('page_of', { page: formatNumber(meta.page || page, {}, locale), total: formatNumber(meta.total_pages || 1, {}, locale) })}
          </span>

          <Pagination
            page={page}
            totalPages={meta.total_pages || 1}
            onPageChange={setPage}
          />
        </div>
      </section>

      <KpiWeightingDialog
        question={weightTarget}
        onClose={() => setWeightTarget(null)}
        onSaved={() => fetchQuestions(page)}
      />

    </QuestionPageShell>
  );
};

export default QuestionsOverview;