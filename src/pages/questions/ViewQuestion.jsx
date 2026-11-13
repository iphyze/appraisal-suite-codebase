import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber } from '../../utils/format';
import { Link, useParams } from 'react-router-dom';
import PageNav from '../../components/PageNav';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useGeneralQuestionsStore from '../../stores/useGeneralQuestionsStore';
import useKpiQuestionsStore from '../../stores/useKpiQuestionsStore';
import QuestionPageShell from './QuestionPageShell';
import { basePath, getQuestionText, isKpiType } from './helpers';
import './Questions.css';
import AppIcon from '../../components/ui/AppIcon';

const qt = (key, options) => i18n.t(key, { ns: 'questions', ...options });
const localizedScope = (scope) => qt(scope === 'supervisor' ? 'scope_supervisor' : scope === 'individual' ? 'scope_individual' : 'scope_department');
const DetailItem = ({ label, value }) => (
  <div className="qst-detail-item">
    <span>{label}</span>
    <strong>{value || '—'}</strong>
  </div>
);

const groupStatusLabel = (status) => {
  if (status === 'inactive') return qt('inactive');
  if (status === 'mixed') return qt('mixed');
  return qt('active');
};

const weightModeLabel = (mode) => {
  if (mode === 'custom') return qt('custom_per_question_weights');
  if (mode === 'mixed') return qt('mixed_weighting_setup');
  return qt('equal_weighting');
};

const QuestionSetView = ({ group, id, isKpi }) => {
  const { i18n: language } = useTranslation('questions');
  const locale = language.language;
  const { isViewOnly: viewOnly, settingsLocked } = useCompanyWritePermission();
  // General questions are company-wide settings.
  const isViewOnly = isKpi ? viewOnly : settingsLocked;
  const typePath = isKpi ? '/questions/kpi' : '/questions/general';
  const setLabel = qt(isKpi ? 'kpi_question_set' : 'general_question_set');

  return (
    <section className="qst-view-card">
      <div className="qst-view-card__head">
        <div>
          <span className="qst-eyebrow">{setLabel}</span>
          <h2>{group.section_code} — {group.section_label}</h2>
          <p>
            {isKpi && group.department ? `${group.department_display || group.department} • ` : ''}
            {group.cycle_title || group.cycle_year} • {group.company_name || group.company_code}
          </p>
        </div>
        <div className="qst-view-card__actions">
          <Link className="qst-secondary-btn" to={typePath}><AppIcon icon="ArrowLeft" /> {qt('back')}</Link>
          {!isViewOnly && <Link className="qst-primary-btn" to={`${typePath}/edit/${group.group_id || group.id || id}`}><AppIcon icon="PenLine" /> {qt('edit')}</Link>}
        </div>
      </div>

      <div className="qst-detail-grid qst-detail-grid--group">
        {isKpi && <DetailItem label={qt('department')} value={group.department_display || group.department} />}
        {isKpi && <DetailItem label={qt('scope')} value={localizedScope(group.scope)} />}
        {isKpi && <DetailItem label={qt('supervisor')} value={group.supervisor_name} />}
        {isKpi && <DetailItem label={qt('staff')} value={group.staff_name} />}
        <DetailItem label={qt('question_count_label')} value={qt('question_count', { count: Number(group.question_count || 0), formattedCount: formatNumber(group.question_count || 0, {}, locale) })} />
        {isKpi && <DetailItem label={qt('weighting')} value={weightModeLabel(group.weight_mode)} />}
        {isKpi && (
          <DetailItem
            label={qt('objective_review')}
            value={Number(group.needs_review_count || 0) > 0
              ? qt('items_need_review', { count: Number(group.needs_review_count), formattedCount: formatNumber(group.needs_review_count, {}, locale) })
              : qt('ready')}
          />
        )}
        <DetailItem label={qt('status')} value={groupStatusLabel(group.group_status)} />
        <DetailItem label={qt('section_weight')} value={group.section_weight ? formatNumber(Number(group.section_weight) / 100, { style: 'percent', maximumFractionDigits: 2 }, locale) : '—'} />
      </div>

      <div className="qst-group-questions">
        <div className="qst-group-questions__head">
          <div>
            <span className="qst-eyebrow">{qt('questions_in_set')}</span>
            <h3>{qt(isKpi ? 'kpi_questions_count' : 'general_questions_count', { count: Number(group.question_count || group.questions?.length || 0), formattedCount: formatNumber(group.question_count || group.questions?.length || 0, {}, locale) })}</h3>
            <p>
              {isKpi
                ? qt('kpi_questions_shared')
                : qt('general_questions_shared')}
            </p>
          </div>
        </div>

        <div className="qst-group-question-list">
          {(group.questions || []).map((question, index) => (
            <article className="qst-group-question" key={question.id}>
              <span className="qst-group-question__index">{index + 1}</span>
              <div className="qst-group-question__body">
                <p>{question.question_text ? getQuestionText(question.question_text) : qt('untitled_question')}</p>
                <div className="qst-group-question__meta">
                  <span>{qt('order_index', { number: formatNumber(question.sort_order, {}, locale) })}</span>
                  <span className={`qst-status ${Number(question.is_active) === 1 ? 'qst-status--active' : 'qst-status--inactive'}`}>
                    {qt(Number(question.is_active) === 1 ? 'active' : 'inactive')}
                  </span>
                  {isKpi && (
                    <span className={`qst-weight-pill ${question.weight_percent !== null && question.weight_percent !== undefined && question.weight_percent !== '' ? 'qst-weight-pill--custom' : ''}`}>
                      {question.weight_percent !== null && question.weight_percent !== undefined && question.weight_percent !== '' ? formatNumber(Number(question.weight_percent) / 100, { style: 'percent', maximumFractionDigits: 2 }, locale) : qt('equal')}
                    </span>
                  )}
                  {isKpi && question.objective_code && (
                    <span className="qst-section-pill">{question.objective_code}</span>
                  )}
                  {isKpi && (
                    <span className={`qst-review-pill ${question.review_status === 'needs_review' ? 'qst-review-pill--needs-review' : ''}`}>
                      <AppIcon icon={question.review_status === 'needs_review' ? 'TriangleAlert' : 'CircleCheck'} />
                      {qt(question.review_status === 'needs_review' ? 'needs_review' : 'ready')}
                    </span>
                  )}
                </div>

                {isKpi && (question.measure_target || question.evidence_source || question.review_note) && (
                  <div className="qst-objective-detail">
                    {question.measure_target && (
                      <div className="qst-objective-detail__item qst-objective-detail__item--wide">
                        <span>{qt('measure_target')}</span>
                        <p>{question.measure_target}</p>
                      </div>
                    )}
                    {question.evidence_source && (
                      <div className="qst-objective-detail__item">
                        <span>{qt('evidence_data_source')}</span>
                        <p>{question.evidence_source}</p>
                      </div>
                    )}
                    {question.review_note && (
                      <div className="qst-objective-detail__item">
                        <span>{qt('review_note')}</span>
                        <p>{question.review_note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const ViewQuestion = ({ type = 'kpi' }) => {
  const { i18n: language } = useTranslation('questions');
  const locale = language.language;
  const { id } = useParams();
  const isKpi = isKpiType(type);
  const generalStore = useGeneralQuestionsStore();
  const kpiStore = useKpiQuestionsStore();
  const store = isKpi ? kpiStore : generalStore;
  const questionGroup = store.selectedQuestionGroup;
  useEffect(() => {
    if (isKpi) kpiStore.fetchKpiQuestionGroup(id);
    else generalStore.fetchGeneralQuestionGroup(id);

    return () => {
      if (isKpi) kpiStore.clearSelectedQuestionGroup();
      else generalStore.clearSelectedQuestionGroup();
    };
    // Store methods are stable Zustand actions; the route identity is what drives this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type, isKpi, locale]);

  useEffect(() => { document.title = qt(isKpi ? 'document_view_kpi' : 'document_view_general'); }, [isKpi, locale]);

  return (
    <QuestionPageShell>
      <PageNav
        pageTitle={qt(isKpi ? 'view_kpi_question_set' : 'view_general_question_set')}
        links={[
          { label: qt('dashboard'), to: '/dashboard', active: true },
          { label: qt(isKpi ? 'kpi_questions' : 'general_questions'), to: basePath(type), active: true },
          { label: qt('view'), to: `${basePath(type)}/view/${id}`, active: false },
        ]}
      />

      {store.loading ? (
        <div className="qst-form-card"><div className="qst-row-skeleton" /><div className="qst-row-skeleton" /><div className="qst-row-skeleton" /></div>
      ) : questionGroup ? (
        <QuestionSetView group={questionGroup} id={id} isKpi={isKpi} />
      ) : (
        <div className="qst-empty-state">
          <span><AppIcon icon="CircleHelp" /></span>
          <h2>{qt('not_found')}</h2>
          <p>{qt('not_found_description')}</p>
          <Link className="qst-primary-btn" to={basePath(type)}>{qt('back_to_questions')}</Link>
        </div>
      )}
    </QuestionPageShell>
  );
};

export default ViewQuestion;
