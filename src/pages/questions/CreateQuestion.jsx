import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import PageNav from '../../components/PageNav';
import QuestionPageShell from './QuestionPageShell';
import QuestionForm from './QuestionForm';
import { basePath, isKpiType } from './helpers';
import './Questions.css';

const qt = (key) => i18n.t(key, { ns: 'questions' });
const CreateQuestion = ({ type = 'kpi' }) => {
  const { i18n: { language: locale } } = useTranslation('questions');
  const isKpi = isKpiType(type);
  const title = qt(isKpi ? 'form_create_kpi' : 'form_create_general');
  useEffect(() => { document.title = qt(isKpi ? 'form_document_create_kpi' : 'form_document_create_general'); }, [isKpi, locale]);
  return <QuestionPageShell>
    <PageNav
      pageTitle={title}
      links={[
        { label: qt('form_dashboard'), to: '/dashboard', active: true },
        { label: qt(isKpi ? 'form_kpi_questions_plural' : 'form_general_questions_plural'), to: basePath(type), active: true },
        { label: qt('form_create'), to: `${basePath(type)}/create`, active: false },
      ]}
    />
    <QuestionForm type={type} mode="create" />
  </QuestionPageShell>;
};

export default CreateQuestion;
