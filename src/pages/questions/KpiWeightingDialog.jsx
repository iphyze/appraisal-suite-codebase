import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber, parseLocalizedNumber } from '../../utils/format';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../services/api';
import useToastStore from '../../stores/useToastStore';
import AppIcon from '../../components/ui/AppIcon';

const qt = (key, options) => i18n.t(key, { ns: 'questions', ...options });
const hasValue = (value) => value !== null && value !== undefined && value !== '';

const distributeEvenly = (rows) => {
  if (!rows.length) return rows;
  const base = Math.floor((10000 / rows.length)) / 100;
  let used = 0;
  return rows.map((row, index) => {
    const weight = index === rows.length - 1
      ? Number((100 - used).toFixed(2))
      : base;
    used = Number((used + weight).toFixed(2));
    return { ...row, weight_percent: weight };
  });
};

const KpiWeightingDialog = ({ question, onClose, onSaved }) => {
  const { showToast } = useToastStore();
  const { i18n: language } = useTranslation('questions');
  const locale = language.language;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('equal');
  const [rows, setRows] = useState([]);
  const [themeClass, setThemeClass] = useState('theme-light');

  useEffect(() => {
    if (!question) return undefined;

    const page = document.querySelector('.qst-page');
    setThemeClass(page?.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light');

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [question, saving, onClose]);

  useEffect(() => {
    if (!question) {
      setRows([]);
      setMode('equal');
      return undefined;
    }

    let active = true;
    setLoading(true);

    const params = new URLSearchParams({
      section_id: String(question.section_id),
      department: question.department || '',
      is_active: '1',
      limit: '500',
      page: '1',
      sortBy: 'sort_order',
      sortOrder: 'ASC',
    });

    api.get(`/kpi-questions/list?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        const candidates = response.data?.data || [];
        const group = candidates.filter((item) => {
          if (question.staff_user_id) {
            return String(item.staff_user_id || '') === String(question.staff_user_id);
          }
          if (question.supervisor_id) {
            return !item.staff_user_id && String(item.supervisor_id || '') === String(question.supervisor_id);
          }
          return !item.staff_user_id && !item.supervisor_id;
        });

        const nextRows = group.map((item) => ({
          id: Number(item.id),
          question_text: item.question_text || '',
          weight_percent: hasValue(item.weight_percent) ? Number(item.weight_percent) : '',
          sort_order: Number(item.sort_order || 0),
        }));

        setRows(nextRows);
        setMode(nextRows.some((item) => hasValue(item.weight_percent)) ? 'custom' : 'equal');
      })
      .catch((error) => {
        showToast(error.response?.data?.message || qt('weight_load_error'), 'error');
        setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [question, showToast]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (parseLocalizedNumber(row.weight_percent) || 0), 0),
    [rows]
  );

  const scopeLabel = question?.staff_user_id
    ? `${qt('weight_individual_staff')}${question.staff_name ? ` • ${question.staff_name}` : ''}`
    : question?.supervisor_id
      ? `${qt('weight_supervisor_specific')}${question.supervisor_name ? ` • ${question.supervisor_name}` : ''}`
      : qt('weight_department_default');

  const setCustomMode = () => {
    setMode('custom');
    if (!rows.some((row) => hasValue(row.weight_percent))) {
      setRows((current) => distributeEvenly(current));
    }
  };

  const updateWeight = (id, value) => {
    setRows((current) => current.map((row) => (
      row.id === id ? { ...row, weight_percent: value } : row
    )));
  };

  const handleSave = async () => {
    if (!question || saving) return;

    if (mode === 'custom') {
      if (!rows.length) {
        showToast(qt('weight_no_questions'), 'error');
        return;
      }
      const invalid = rows.some((row) => {
        const weight = parseLocalizedNumber(row.weight_percent);
        return weight === null || weight <= 0 || weight > 100;
      });
      if (invalid) {
        showToast(qt('weight_invalid'), 'error');
        return;
      }
      if (Math.abs(total - 100) > 0.01) {
        showToast(qt('weight_total_error', { total: formatNumber(total / 100, { style: 'percent', maximumFractionDigits: 2 }, locale) }), 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        section_id: Number(question.section_id),
        department: question.department,
        supervisor_id: question.supervisor_id ? Number(question.supervisor_id) : null,
        staff_user_id: question.staff_user_id ? Number(question.staff_user_id) : null,
        mode,
        weights: mode === 'custom'
          ? rows.map((row) => ({ id: row.id, weight_percent: parseLocalizedNumber(row.weight_percent) }))
          : [],
      };

      const response = await api.post('/kpi-questions/set-weights', payload);
      showToast(qt('weight_saved'), 'success');
      onSaved?.();
      onClose();
    } catch (error) {
      showToast(error.response?.data?.message || qt('weight_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {question && (
        <motion.div
          className={`qst-weight-dialog-backdrop ${themeClass}`}
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            className={`qst-weight-dialog ${themeClass}`}
            initial={{ opacity: 0, y: 18, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="qst-weight-dialog__head">
              <div className="qst-weight-dialog__title">
                <span><AppIcon icon="Scale" /></span>
                <div>
                  <small>{qt('weight_eyebrow')}</small>
                  <h3>{qt('configure_question_weights')}</h3>
                  <p>{question.department_display || question.department} • {scopeLabel}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} disabled={saving} aria-label={qt('weight_close')}>
                <AppIcon icon="X" />
              </button>
            </header>

            <div className="qst-weight-dialog__body">
              <div className="qst-weight-mode">
                <button
                  type="button"
                  className={mode === 'equal' ? 'active' : ''}
                  onClick={() => setMode('equal')}
                >
                  <AppIcon icon="ListChecks" />
                  <span><strong>{qt('equal_weighting')}</strong><small>{qt('weight_keep_existing')}</small></span>
                </button>
                <button
                  type="button"
                  className={mode === 'custom' ? 'active' : ''}
                  onClick={setCustomMode}
                >
                  <AppIcon icon="Percent" />
                  <span><strong>{qt('weight_per_question')}</strong><small>{qt('weight_supervisor_defaults')}</small></span>
                </button>
              </div>

              <div className="qst-weight-dialog__note">
                <AppIcon icon="Info" />
                <p>{qt('weight_notice')}</p>
              </div>

              {loading ? (
                <div className="qst-weight-dialog__loading"><span className="qst-spinner" /> {qt('weight_loading')}</div>
              ) : rows.length === 0 ? (
                <div className="qst-weight-dialog__empty">{qt('weight_empty')}</div>
              ) : (
                <div className="qst-weight-list">
                  <div className="qst-weight-list__head">
                    <span>{qt('weight_active_questions', { count: rows.length, formattedCount: formatNumber(rows.length, {}, locale) })}</span>
                    {mode === 'custom' && (
                      <button type="button" onClick={() => setRows((current) => distributeEvenly(current))}>
                        {qt('weight_distribute')}
                      </button>
                    )}
                  </div>

                  {rows.map((row, index) => (
                    <div className="qst-weight-list__row" key={row.id}>
                      <span className="qst-weight-list__index">{index + 1}</span>
                      <p>{row.question_text}</p>
                      {mode === 'custom' ? (
                        <label>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={qt('weight_for_question', { number: index + 1 })}
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={row.weight_percent}
                            onChange={(event) => updateWeight(row.id, event.target.value)}
                          />
                          <span>%</span>
                        </label>
                      ) : (
                        <span className="qst-weight-list__equal">{qt('equal')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mode === 'custom' && rows.length > 0 && (
                <div className={`qst-weight-dialog__total ${Math.abs(total - 100) <= 0.01 ? 'complete' : total > 100 ? 'over' : ''}`}>
                  <span>{qt('weight_total')}</span>
                  <strong>{qt('weight_total_of', { total: formatNumber(total / 100, { style: 'percent', maximumFractionDigits: 2 }, locale) })}</strong>
                  <small>
                    {Math.abs(total - 100) <= 0.01
                      ? qt('weight_ready_to_save')
                      : total < 100
                        ? qt('weight_remaining', { amount: formatNumber((100 - total) / 100, { style: 'percent', maximumFractionDigits: 2 }, locale) })
                        : qt('weight_over', { amount: formatNumber((total - 100) / 100, { style: 'percent', maximumFractionDigits: 2 }, locale) })}
                  </small>
                </div>
              )}
            </div>

            <footer className="qst-weight-dialog__actions">
              <button type="button" className="qst-secondary-btn" onClick={onClose} disabled={saving}>{qt('weight_cancel')}</button>
              <button type="button" className="qst-primary-btn" onClick={handleSave} disabled={saving || loading || !rows.length}>
                {saving ? <><span className="qst-spinner" /> {qt('weight_saving')}</> : <><AppIcon icon="Save" /> {qt('weight_save')}</>}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default KpiWeightingDialog;
