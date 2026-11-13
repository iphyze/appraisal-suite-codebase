import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Link, useParams } from 'react-router-dom';
import PageNav from '../../components/PageNav';
import useGeneralQuestionsStore from '../../stores/useGeneralQuestionsStore';
import useKpiQuestionsStore from '../../stores/useKpiQuestionsStore';
import QuestionPageShell from './QuestionPageShell';
import QuestionForm from './QuestionForm';
import { basePath, isKpiType } from './helpers';
import './Questions.css';
import AppIcon from '../../components/ui/AppIcon';

const qt = (key) => i18n.t(key, { ns: 'questions' });
const EditQuestion = ({ type = 'kpi' }) => {
  const { i18n: { language: locale } } = useTranslation('questions');
  const { id } = useParams();
  const isKpi = isKpiType(type);
  const generalStore = useGeneralQuestionsStore();
  const kpiStore = useKpiQuestionsStore();
  const store = isKpi ? kpiStore : generalStore;
  const selected = store.selectedQuestionGroup;
  const editLabel = qt(isKpi ? 'form_edit_kpi_set' : 'form_edit_general_set');

  useEffect(() => {
    if (isKpi) kpiStore.fetchKpiQuestionGroup(id);
    else generalStore.fetchGeneralQuestionGroup(id);

    return () => {
      if (isKpi) kpiStore.clearSelectedQuestionGroup();
      else generalStore.clearSelectedQuestionGroup();
    };
    // Store methods are stable Zustand actions; the route identity is what drives this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type, isKpi]);

  useEffect(() => {
    document.title = qt(isKpi ? 'form_document_edit_kpi' : 'form_document_edit_general');
  }, [isKpi, locale]);

  return (
    <QuestionPageShell>
      <PageNav
        pageTitle={editLabel}
        links={[
          { label: qt('form_dashboard'), to: '/dashboard', active: true },
          { label: qt(isKpi ? 'form_kpi_questions_plural' : 'form_general_questions_plural'), to: basePath(type), active: true },
          { label: qt('edit'), to: `${basePath(type)}/edit/${id}`, active: false },
        ]}
      />

      {store.loading ? (
        <div className="qst-form-card"><div className="qst-row-skeleton" /><div className="qst-row-skeleton" /><div className="qst-row-skeleton" /></div>
      ) : selected ? (
        <QuestionForm type={type} mode="edit" initialQuestion={selected} />
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

export default EditQuestion;
