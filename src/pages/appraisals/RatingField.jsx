import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Star } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import { formatNumber } from '../../utils/format';
import { canonicalRatingText } from './ratingInput';

const decimalsFor = (value) => {
  const text = String(value ?? '');
  return text.includes('.') ? Math.min(text.split('.')[1].length, 2) : 0;
};

const configValues = (ratingConfig = {}) => ({
  min: Number.isFinite(Number(ratingConfig.rating_min)) ? Number(ratingConfig.rating_min) : 1,
  max: Number.isFinite(Number(ratingConfig.rating_max)) ? Number(ratingConfig.rating_max) : 5,
  step: Number.isFinite(Number(ratingConfig.rating_step)) && Number(ratingConfig.rating_step) > 0 ? Number(ratingConfig.rating_step) : 0.1,
});

const isStepAligned = (value, min, step) => Math.abs(((value - min) / step) - Math.round((value - min) / step)) <= 0.001;

const activePoints = (ratingConfig = {}) => (ratingConfig?.rating_points || [])
  .filter((point) => Number(point.is_active ?? 1) === 1 && Number.isFinite(Number(point.rating_value)))
  .sort((a, b) => (Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)) || (Number(a.rating_value) - Number(b.rating_value)));

const normalizeInput = (input, ratingConfig) => {
  const raw = canonicalRatingText(input);
  if (raw === '') return '';
  if (raw === null) return null;

  const { min, max, step } = configValues(ratingConfig);
  const number = Number(raw);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  const points = activePoints(ratingConfig);
  if (points.length && !points.some((point) => Math.abs(Number(point.rating_value) - number) <= 0.0001)) return null;
  if (!points.length && !isStepAligned(number, min, step)) return null;
  const precision = points.length
    ? Math.max(...points.map((point) => decimalsFor(point.rating_value)), 0)
    : decimalsFor(step);
  return Number(number.toFixed(Math.min(precision, 2)));
};

const meaningFor = (value, ratingBands = [], ratingPoints = [], fallback = 'Cycle rating') => {
  const point = (ratingPoints || []).find((item) => Math.abs(Number(item.rating_value) - Number(value)) <= 0.0001 && Number(item.is_active ?? 1) === 1);
  if (point) return [point.label, point.definition].filter(Boolean).join(' — ');
  const band = ratingBands.find((item) => (
    value >= Number(item.min_score) - 0.0001 && value <= Number(item.max_score) + 0.0001
  ));
  return band?.label || fallback;
};

const buildOptions = (ratingConfig, ratingBands, locale, fallback) => {
  const { min, max, step } = configValues(ratingConfig);
  const points = activePoints(ratingConfig);
  if (points.length) {
    return points.map((point) => {
      const value = Number(point.rating_value);
      return {
        value,
        label: formatNumber(value, { maximumFractionDigits: 3 }, locale),
        description: meaningFor(value, ratingBands, points, fallback),
      };
    });
  }

  const precision = decimalsFor(step);
  const count = Math.floor(((max - min) / step) + 0.0001) + 1;
  if (count > 250) return [];
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const value = Number((min + (index * step)).toFixed(precision));
    return {
      value,
      label: formatNumber(value, { minimumFractionDigits: precision, maximumFractionDigits: precision }, locale),
      description: meaningFor(value, ratingBands, [], fallback),
    };
  });
};

const isFivePointScale = (points = []) => {
  if (points.length !== 5) return false;
  return points.every((point, index) => Math.abs(Number(point.rating_value) - (index + 1)) <= 0.0001);
};

/** Cycle-aware rating selector. Five configured 1–5 points can render as compact cards. */
const RatingField = ({
  value,
  onChange,
  error = false,
  placeholder,
  ratingConfig,
  ratingBands = [],
  variant = 'input',
}) => {
  const { t, i18n } = useTranslation('appraisals');
  const locale = i18n.language;
  const { min, max, step } = configValues(ratingConfig);
  const points = activePoints(ratingConfig);
  const precision = points.length
    ? Math.min(Math.max(...points.map((point) => decimalsFor(point.rating_value)), 0), 2)
    : decimalsFor(step);
  const formatRating = useCallback((number) => formatNumber(number, {
    minimumFractionDigits: points.length ? 0 : precision,
    maximumFractionDigits: precision,
  }, locale), [precision, locale, points.length]);
  const ratingRuleText = points.length
    ? t('rating.configuredValues', { values: points.map((point) => formatNumber(point.rating_value, { maximumFractionDigits: 3 }, locale)).join(', ') })
    : t('rating.rangeRule', {
        min: formatNumber(min, { maximumFractionDigits: 2 }, locale),
        max: formatNumber(max, { maximumFractionDigits: 2 }, locale),
        step: formatNumber(step, { maximumFractionDigits: 2 }, locale),
      });
  const ratingOptions = useMemo(() => buildOptions(ratingConfig, ratingBands, locale, t('rating.cycleRating')), [ratingConfig, ratingBands, locale, t]);
  const useFivePointCards = variant === 'cards' && isFivePointScale(points);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value !== '' && value != null ? formatRating(value) : '');
  const [highlighted, setHighlighted] = useState(-1);
  const blurTimer = useRef(null);
  const optionRefs = useRef([]);

  useEffect(() => {
    setInputValue(value !== '' && value != null ? formatRating(value) : '');
  }, [value, formatRating]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim();
    if (!query) return ratingOptions;
    const localizedQuery = locale === 'fr' ? query.replace('.', ',') : query.replace(',', '.');
    return ratingOptions.filter((option) => String(option.label).startsWith(localizedQuery));
  }, [inputValue, ratingOptions, locale]);

  const commit = (text) => {
    const normalized = normalizeInput(text, ratingConfig);
    if (normalized === '') {
      onChange?.('');
      setInputValue('');
      return;
    }
    if (normalized !== null) {
      onChange?.(normalized);
      setInputValue(formatRating(normalized));
    }
  };

  const selectOption = (option) => {
    if (!option) return;
    onChange?.(option.value);
    setInputValue(formatRating(option.value));
    setOpen(false);
    setHighlighted(-1);
  };

  const handleChange = (event) => {
    const next = event.target.value.replace(/[^0-9.,]/g, '').slice(0, 8);
    setInputValue(next);
    setOpen(true);
    setHighlighted(0);

    const normalized = normalizeInput(next, ratingConfig);
    if (normalized === '') onChange?.('');
    if (normalized !== null && normalized !== '') onChange?.(normalized);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((prev) => (prev > 0 ? prev - 1 : Math.max(filteredOptions.length - 1, 0)));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && highlighted >= 0 && filteredOptions[highlighted]) selectOption(filteredOptions[highlighted]);
      else {
        commit(inputValue);
        setOpen(false);
      }
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  useEffect(() => {
    if (!open || highlighted < 0) return;
    optionRefs.current[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  if (useFivePointCards) {
    return (
      <div className={`apr-rating-cards ${error ? 'apr-rating-cards--error' : ''}`} data-invalid={error ? 'true' : undefined}>
        <div className="apr-rating-cards__grid" role="radiogroup" aria-label={t('rating.performanceRating')}>
          {points.map((point) => {
            const pointValue = Number(point.rating_value);
            const selected = Number(value) === pointValue;
            return (
              <div
                key={pointValue}
                className={`apr-rating-choice-wrap apr-rating-choice--${pointValue} ${selected ? 'is-selected' : ''}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`apr-rating-choice ${selected ? 'is-selected' : ''}`}
                  onClick={() => onChange?.(pointValue)}
                  title={point.definition || point.label || t('rating.ratingLabel', { value: pointValue })}
                >
                  <span>{pointValue}</span>
                </button>
                <small className="apr-rating-choice__label">{point.label || t('rating.ratingLabel', { value: pointValue })}</small>
              </div>
            );
          })}
        </div>
        {error && <small className="apr-rating-field__error">{t('rating.fivePointError')}</small>}
      </div>
    );
  }

  return (
    <div className={`apr-rating-field ${open ? 'apr-rating-field--open' : ''} ${error ? 'apr-rating-field--error' : ''}`} data-invalid={error ? 'true' : undefined}>
      <div className="apr-rating-field__control">
        <input
          className="apr-rating-field__input"
          type="text"
          inputMode="decimal"
          value={inputValue}
          placeholder={placeholder || t('rating.placeholder')}
          aria-invalid={error}
          aria-label={t('rating.ariaLabel', { rule: ratingRuleText })}
          onFocus={() => { setOpen(true); setHighlighted(0); }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => {
              commit(inputValue);
              setOpen(false);
            }, 140);
          }}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <AppIcon icon={Star} className="apr-rating-field__icon" />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="apr-rating-field__dropdown"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            {filteredOptions.length ? filteredOptions.map((option, index) => (
              <button
                key={option.value}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                className={`apr-rating-field__option ${Number(option.value) === Number(value) ? 'apr-rating-field__option--selected' : ''} ${index === highlighted ? 'apr-rating-field__option--highlighted' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => selectOption(option)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            )) : (
              <p className="apr-rating-field__empty">{t('rating.validValues')}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {error && <small className="apr-rating-field__error">{t('rating.required', { rule: ratingRuleText })}</small>}
    </div>
  );
};

export default RatingField;
