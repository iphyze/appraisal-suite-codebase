import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatScore, formatNumber } from '../../utils/format';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const APPRAISAL_PATH = /^\/appraisals\/view\/\d+$/;

const statusLabel = (status, t) => {
  const value = String(status || '').toLowerCase();
  if (value === 'pending') return { text: t('record_pending'), tone: 'pending' };
  if (value === 'acknowledged') return { text: t('record_acknowledged'), tone: 'done' };
  return status ? { text: status, tone: 'neutral' } : null;
};

/**
 * The records an answer was built from, as clickable rows.
 * Older saved answers only carry a name and link, so they fall back to simple chips.
 */
export default function AiRecordList({ references }) {
  const { t } = useTranslation('ai');
  const refs = (references || []).filter((ref) => APPRAISAL_PATH.test(String(ref?.link || '')));
  if (!refs.length) return null;

  const detailed = refs.some((ref) => ref.year || ref.score != null);
  if (!detailed) {
    return (
      <div className="ap-ai__chips" aria-label={t('record_sources_aria')}>
        {refs.map((ref) => <Link key={ref.link} to={ref.link} className="ap-ai__chip">{ref.label}</Link>)}
      </div>
    );
  }

  return (
    <div className="ap-ai__records">
      <p className="ap-ai__records-title">{t('record_count', { count: refs.length, countFormatted: formatNumber(refs.length, {}, i18n.language) })}</p>
      <ul>
        {refs.map((ref) => {
          const status = statusLabel(ref.status, t);
          const score = ref.score != null && !Number.isNaN(Number(ref.score)) ? formatScore(Number(ref.score), i18n.language) : null;
          return (
            <li key={ref.link}>
              <Link to={ref.link} className="ap-ai__record">
                {ref.year && <span className="ap-ai__record-year">{ref.year}</span>}
                <span className="ap-ai__record-who">
                  <strong>{ref.label}</strong>
                  <small>{[ref.department, ref.evaluation].filter(Boolean).join(', ')}</small>
                </span>
                {status && <span className={`ap-ai__record-status is-${status.tone}`}>{status.text}</span>}
                {score && <span className="ap-ai__record-score">{score}</span>}
                <ChevronRight size={16} className="ap-ai__record-go" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
