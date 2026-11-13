import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber, formatPercentage, parseLocalizedNumber } from '../../utils/format';
import { motion } from 'framer-motion';
import AppIcon from '../../components/ui/AppIcon';
import AppSelect from '../../components/ui/AppSelect';
import useCyclesStore from '../../stores/useCyclesStore';
import useToastStore from '../../stores/useToastStore';
import './Cycles.css';

const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const STATUS_OPTIONS = [
  { value: 1, labelKey: 'active' },
  { value: 0, labelKey: 'inactive' },
];

const cleanNumber = (value) => String(value ?? '').replace(/[^0-9.,]/g, '').replace(',', '.').replace(/(\..*)\./g, '$1');
const numberValue = (value, fallback = 0) => {
  const number = parseLocalizedNumber(value);
  return number === null ? fallback : number;
};

const englishSource = (record, field) => record?.[`${field}_source`] ?? record?.[field] ?? '';

const makeBand = (sortOrder = 1) => ({
  label: '',
  min_score: '',
  max_score: '',
  sort_order: sortOrder,
  is_active: 1,
});

const makeRatingPoint = (sortOrder = 1) => ({
  rating_value: '',
  label: '',
  definition: '',
  evidence_requirement: '',
  requires_comment: 0,
  is_active: 1,
  sort_order: sortOrder,
});

const makeProfile = (sortOrder = 1, sections = []) => ({
  id: null,
  code: '',
  label: '',
  description: '',
  is_default: 0,
  is_active: 1,
  sort_order: sortOrder,
  section_weights: Object.fromEntries(sections.map((section) => [String(section.id), section.weight ?? ''])),
});

const ScoringConfigModal = ({ cycle, onClose, onSaved }) => {
  const { i18n: language } = useTranslation('cycles');
  const locale = language.language;
  const statusOptions = STATUS_OPTIONS.map(({ value, labelKey }) => ({ value, label: cx(labelKey) }));
  const yesNoOptions = [{ value: 0, label: cx('section_no') }, { value: 1, label: cx('section_yes') }];
  const { scoringConfig, fetchScoringConfig, updateScoringConfig } = useCyclesStore();
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ rating_min: 1, rating_max: 5, rating_step: 0.1, require_explicit_profile: 0, management_review_enabled: 0 });
  const [ratingPoints, setRatingPoints] = useState([]);
  const [bands, setBands] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const sections = scoringConfig?.sections || [];
  const activeSections = useMemo(() => sections.filter((section) => Number(section.is_active) === 1), [sections]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const result = await fetchScoringConfig(cycle.id);
      if (!mounted) return;
      if (result.success) {
        const config = result.data || {};
        setSettings(config.settings || { rating_min: 1, rating_max: 5, rating_step: 0.1, require_explicit_profile: 0, management_review_enabled: 0 });
        setRatingPoints((config.rating_points || []).map((point, index) => ({
          ...point,
          label: englishSource(point, 'label'),
          definition: englishSource(point, 'definition'),
          evidence_requirement: englishSource(point, 'evidence_requirement'),
          rating_value: point.rating_value ?? '',
          requires_comment: Number(point.requires_comment || 0),
          is_active: Number(point.is_active ?? 1),
          sort_order: Number(point.sort_order || index + 1),
        })));
        setBands((config.rating_bands || []).map((band, index) => ({ ...band, label: englishSource(band, 'label'), sort_order: Number(band.sort_order || index + 1) })));
        setProfiles((config.profiles || []).map((profile, index) => ({
          ...profile,
          label: englishSource(profile, 'label'),
          description: englishSource(profile, 'description'),
          is_default: Number(profile.is_default || 0),
          is_active: Number(profile.is_active ?? 1),
          sort_order: Number(profile.sort_order || index + 1),
          section_weights: profile.section_weights || {},
        })));
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [cycle.id, fetchScoringConfig]);

  const profileTotal = (profile) => activeSections.reduce(
    (sum, section) => sum + numberValue(profile.section_weights?.[String(section.id)]),
    0
  );

  const updateRatingPoint = (index, field, value) => {
    setRatingPoints((current) => current.map((point, pointIndex) => pointIndex === index ? { ...point, [field]: value } : point));
  };

  const updateBand = (index, field, value) => {
    setBands((current) => current.map((band, bandIndex) => bandIndex === index ? { ...band, [field]: value } : band));
  };

  const updateProfile = (index, field, value) => {
    setProfiles((current) => current.map((profile, profileIndex) => {
      if (profileIndex !== index) return profile;
      if (field === 'is_default' && Number(value) === 1) {
        return { ...profile, is_default: 1, is_active: 1 };
      }
      if (field === 'is_active' && Number(value) === 0) {
        return { ...profile, is_active: 0, is_default: 0 };
      }
      return { ...profile, [field]: value };
    }).map((profile, profileIndex) => (
      field === 'is_default' && Number(value) === 1 && profileIndex !== index
        ? { ...profile, is_default: 0 }
        : profile
    )));
  };

  const updateProfileWeight = (profileIndex, sectionId, value) => {
    setProfiles((current) => current.map((profile, index) => index === profileIndex ? {
      ...profile,
      section_weights: {
        ...(profile.section_weights || {}),
        [String(sectionId)]: cleanNumber(value),
      },
    } : profile));
  };

  const addProfile = () => setProfiles((current) => [
    ...current,
    makeProfile(current.length + 1, activeSections),
  ]);

  const validate = () => {
    const min = numberValue(settings.rating_min, NaN);
    const max = numberValue(settings.rating_max, NaN);
    const step = numberValue(settings.rating_step, NaN);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return cx('scoring_error_range');
    if (!Number.isFinite(step) || step <= 0 || step > (max - min)) return cx('scoring_error_step');
    const stepCount = (max - min) / step;
    if (Math.abs(stepCount - Math.round(stepCount)) > 0.001) return cx('scoring_error_step_divide');
    const pointValues = new Set();
    for (const point of ratingPoints) {
      const value = parseLocalizedNumber(point.rating_value);
      if (!Number.isFinite(value) || value < min || value > max) return cx('scoring_error_point_value');
      const stepIndex = (value - min) / step;
      if (Math.abs(stepIndex - Math.round(stepIndex)) > 0.001) return cx('scoring_error_point_step', { value: formatNumber(value, { maximumFractionDigits: 2 }, locale) });
      if (!String(point.label || '').trim()) return cx('scoring_error_point_label', { value: formatNumber(value, { maximumFractionDigits: 2 }, locale) });
      const key = value.toFixed(2);
      if (pointValues.has(key)) return cx('scoring_error_point_duplicate', { value: formatNumber(value, { maximumFractionDigits: 2 }, locale) });
      pointValues.add(key);
    }

    if (!bands.length) return cx('scoring_error_band_required');

    for (const band of bands) {
      if (!String(band.label || '').trim()) return cx('scoring_error_band_label');
      if (parseLocalizedNumber(band.min_score) === null || parseLocalizedNumber(band.max_score) === null) return cx('scoring_error_band_limits');
    }

    const codes = new Set();
    for (const profile of profiles) {
      const code = String(profile.code || '').trim().toUpperCase();
      if (!code || !String(profile.label || '').trim()) return cx('scoring_error_profile_fields');
      if (codes.has(code)) return cx('scoring_error_profile_duplicate', { code });
      codes.add(code);
      if (Number(profile.is_active) === 1 && activeSections.length) {
        const total = profileTotal(profile);
        const missing = activeSections.some((section) => {
          const value = profile.section_weights?.[String(section.id)];
          return value === '' || value === null || value === undefined || parseLocalizedNumber(value) === null;
        });
        if (missing) return cx('scoring_error_profile_weight', { profile: profile.label || code });
        if (Math.abs(total - 100) > 0.01) return cx('scoring_error_profile_total', { profile: profile.label || code, total: formatPercentage(total / 100, 2, locale) });
      }
    }
    return '';
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const error = validate();
    if (error) {
      showToast(error, 'error');
      return;
    }

    setSaving(true);
    const result = await updateScoringConfig({
      cycle_id: Number(cycle.id),
      settings: {
        rating_min: numberValue(settings.rating_min),
        rating_max: numberValue(settings.rating_max),
        rating_step: numberValue(settings.rating_step),
        require_explicit_profile: Number(settings.require_explicit_profile || 0),
        management_review_enabled: Number(settings.management_review_enabled || 0),
      },
      rating_points: ratingPoints.map((point, index) => ({
        ...point,
        rating_value: numberValue(point.rating_value),
        label: String(point.label || '').trim(),
        definition: String(point.definition || '').trim(),
        evidence_requirement: String(point.evidence_requirement || '').trim(),
        requires_comment: Number(point.requires_comment || 0),
        is_active: Number(point.is_active ?? 1),
        sort_order: index + 1,
      })),
      rating_bands: bands.map((band, index) => ({
        ...band,
        label: String(band.label || '').trim(),
        min_score: numberValue(band.min_score),
        max_score: numberValue(band.max_score),
        sort_order: index + 1,
        is_active: Number(band.is_active ?? 1),
      })),
      profiles: profiles.map((profile, index) => ({
        ...profile,
        code: String(profile.code || '').trim().toUpperCase(),
        label: String(profile.label || '').trim(),
        description: String(profile.description || '').trim(),
        sort_order: index + 1,
        is_default: Number(profile.is_default || 0),
        is_active: Number(profile.is_active ?? 1),
        section_weights: Object.fromEntries(
          Object.entries(profile.section_weights || {}).map(([sectionId, weight]) => [sectionId, numberValue(weight)])
        ),
      })),
    });
    setSaving(false);
    if (result.success) onSaved?.(result.data);
  };

  return (
    <motion.div
      className="cyc-modal-backdrop"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <motion.form
        className="cyc-modal cyc-scoring-modal"
        onSubmit={handleSave}
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.97 }}
      >
        <div className="cyc-modal-head">
          <div>
            <p className="cyc-eyebrow">{cx('view_configuration')}</p>
            <h3>{cx('scoring_heading')}</h3>
            <p>{cycle.title} • {cycle.year}</p>
          </div>
          <button type="button" className="cyc-icon-btn" onClick={onClose} aria-label={cx('view_close')}><AppIcon icon="X" /></button>
        </div>

        <div className="cyc-modal-body cyc-scoring-modal__body">
        {loading ? (
          <div className="cyc-scoring-loading"><span className="cyc-spinner" /> {cx('scoring_loading')}</div>
        ) : (
          <>
            <section className="cyc-config-block">
              <div className="cyc-config-block__head">
                <div><span>{cx('scoring_rating_input')}</span><h4>{cx('scoring_rating_scale')}</h4></div>
                <small>{cx('scoring_rating_range_hint')}</small>
              </div>
              <div className="cyc-form-grid cyc-form-grid--scoring">
                {[
                  ['rating_min', 'scoring_min_rating', '1', 'ArrowDown'],
                  ['rating_max', 'scoring_max_rating', '5', 'ArrowUp'],
                  ['rating_step', 'view_rating_step', '0.1', 'ArrowRightLeft'],
                ].map(([field, label, placeholder, icon]) => (
                  <div className="cyc-field" key={field}>
                    <label>{cx(label)}</label>
                    <div className="cyc-input">
                      <AppIcon icon={icon} />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={settings[field]}
                        onChange={(event) => setSettings((current) => ({ ...current, [field]: cleanNumber(event.target.value) }))}
                        placeholder={placeholder}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="cyc-form-grid cyc-form-grid--scoring cyc-form-grid--scoring-option">
                <AppSelect
                  label={cx('scoring_require_profile')}
                  value={Number(settings.require_explicit_profile || 0)}
                  onChange={(value) => setSettings((current) => ({ ...current, require_explicit_profile: Number(value) }))}
                  options={[{ value: 0, label: cx('scoring_default_weights') }, { value: 1, label: cx('scoring_assign_every') }]}
                  searchable={false}
                  clearable={false}
                />
                <AppSelect
                  label={cx('view_management')}
                  value={Number(settings.management_review_enabled || 0)}
                  onChange={(value) => setSettings((current) => ({ ...current, management_review_enabled: Number(value) }))}
                  options={[{ value: 0, label: cx('scoring_review_disabled') }, { value: 1, label: cx('scoring_review_enabled') }]}
                  searchable={false}
                  clearable={false}
                />
              </div>
            </section>

            <section className="cyc-config-block">
              <div className="cyc-config-block__head cyc-config-block__head--actions">
                <div>
                  <span>{cx('scoring_rating_guidance')}</span>
                  <h4>{cx('scoring_rating_points')}</h4>
                  <small>{cx('scoring_points_hint')}</small>
                </div>
                <button type="button" className="cyc-btn cyc-btn--ghost cyc-btn--small" onClick={() => setRatingPoints((current) => [...current, makeRatingPoint(current.length + 1)])}><AppIcon icon="Plus" /> {cx('scoring_add_point')}</button>
              </div>
              {!ratingPoints.length ? (
                <div className="cyc-config-empty"><AppIcon icon="Star" /><span>{cx('scoring_no_points')}</span></div>
              ) : (
                <div className="cyc-rating-point-list">
                  {ratingPoints.map((point, index) => (
                    <article className="cyc-rating-point-card" key={`${point.id || 'new'}-${index}`}>
                      <div className="cyc-rating-point-card__head">
                        <strong>{point.label || cx('scoring_point_fallback', { count: index + 1 })}</strong>
                        <button type="button" className="cyc-icon-btn cyc-icon-btn--danger" onClick={() => setRatingPoints((current) => current.filter((_, pointIndex) => pointIndex !== index))} aria-label={cx('scoring_remove_point')}><AppIcon icon="Trash2" /></button>
                      </div>
                      <div className="cyc-form-grid cyc-form-grid--rating-point">
                        <div className="cyc-field"><label>{cx('scoring_rating_value')}</label><div className="cyc-input"><AppIcon icon="Star" /><input type="text" inputMode="decimal" value={point.rating_value ?? ''} onChange={(event) => updateRatingPoint(index, 'rating_value', cleanNumber(event.target.value))} placeholder={cx('scoring_value_example')} /></div></div>
                        <div className="cyc-field"><label>{cx('scoring_label')}</label><div className="cyc-input"><AppIcon icon="Tag" /><input value={point.label || ''} onChange={(event) => updateRatingPoint(index, 'label', event.target.value)} placeholder={cx('scoring_label_example')} /></div></div>
                        <AppSelect label={cx('scoring_comment_required')} value={Number(point.requires_comment || 0)} onChange={(value) => updateRatingPoint(index, 'requires_comment', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                        <AppSelect label={cx('status')} value={Number(point.is_active ?? 1)} onChange={(value) => updateRatingPoint(index, 'is_active', Number(value))} options={statusOptions} searchable={false} clearable={false} />
                        <div className="cyc-field cyc-field--wide"><label>{cx('scoring_definition')}</label><div className="cyc-input"><AppIcon icon="AlignLeft" /><input value={point.definition || ''} onChange={(event) => updateRatingPoint(index, 'definition', event.target.value)} placeholder={cx('scoring_definition_example')} /></div></div>
                        <div className="cyc-field cyc-field--wide"><label>{cx('scoring_evidence')}</label><div className="cyc-input"><AppIcon icon="ClipboardCheck" /><input value={point.evidence_requirement || ''} onChange={(event) => updateRatingPoint(index, 'evidence_requirement', event.target.value)} placeholder={cx('scoring_evidence_example')} /></div></div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="cyc-config-block">
              <div className="cyc-config-block__head cyc-config-block__head--actions">
                <div><span>{cx('scoring_result')}</span><h4>{cx('view_rating_bands')}</h4></div>
                <button type="button" className="cyc-btn cyc-btn--ghost cyc-btn--small" onClick={() => setBands((current) => [...current, makeBand(current.length + 1)])}><AppIcon icon="Plus" /> {cx('scoring_add_band')}</button>
              </div>
              <div className="cyc-band-list">
                {bands.map((band, index) => (
                  <div className="cyc-band-row" key={`${band.id || 'new'}-${index}`}>
                    <div className="cyc-field cyc-field--band-label">
                      <label>{cx('scoring_label')}</label>
                      <div className="cyc-input"><AppIcon icon="Tag" /><input value={band.label || ''} onChange={(event) => updateBand(index, 'label', event.target.value)} placeholder={cx('scoring_band_example')} /></div>
                    </div>
                    <div className="cyc-field">
                      <label>{cx('scoring_min')}</label>
                      <div className="cyc-input"><AppIcon icon="ArrowDown" /><input type="text" inputMode="decimal" value={band.min_score ?? ''} onChange={(event) => updateBand(index, 'min_score', cleanNumber(event.target.value))} /></div>
                    </div>
                    <div className="cyc-field">
                      <label>{cx('scoring_max')}</label>
                      <div className="cyc-input"><AppIcon icon="ArrowUp" /><input type="text" inputMode="decimal" value={band.max_score ?? ''} onChange={(event) => updateBand(index, 'max_score', cleanNumber(event.target.value))} /></div>
                    </div>
                    <button type="button" className="cyc-icon-btn cyc-icon-btn--danger" onClick={() => setBands((current) => current.filter((_, bandIndex) => bandIndex !== index))} aria-label={cx('scoring_remove_band')}><AppIcon icon="Trash2" /></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="cyc-config-block">
              <div className="cyc-config-block__head cyc-config-block__head--actions">
                <div>
                  <span>{cx('scoring_optional_weighting')}</span>
                  <h4>{cx('view_profiles')}</h4>
                  <small>{cx('scoring_profile_hint')}</small>
                </div>
                <button type="button" className="cyc-btn cyc-btn--ghost cyc-btn--small" onClick={addProfile}><AppIcon icon="Plus" /> {cx('scoring_add_profile')}</button>
              </div>

              {!profiles.length ? (
                <div className="cyc-config-empty"><AppIcon icon="Scale" /><span>{cx('scoring_no_profiles')}</span></div>
              ) : (
                <div className="cyc-profile-list">
                  {profiles.map((profile, profileIndex) => {
                    const total = profileTotal(profile);
                    return (
                      <article className="cyc-profile-card" key={`${profile.id || 'new'}-${profileIndex}`}>
                        <div className="cyc-profile-card__head">
                          <div>
                            <strong>{profile.label || cx('scoring_profile_fallback', { count: profileIndex + 1 })}</strong>
                            <small>{cx('scoring_profile_allocated', { weight: formatPercentage(total / 100, 2, locale) })}</small>
                          </div>
                          <button type="button" className="cyc-icon-btn cyc-icon-btn--danger" onClick={() => setProfiles((current) => current.filter((_, index) => index !== profileIndex))} aria-label={cx('scoring_remove_profile')}><AppIcon icon="Trash2" /></button>
                        </div>

                        <div className="cyc-form-grid cyc-form-grid--profile">
                          <div className="cyc-field">
                            <label>{cx('scoring_profile_code')}</label>
                            <div className="cyc-input"><AppIcon icon="Hash" /><input value={profile.code || ''} maxLength={50} onChange={(event) => updateProfile(profileIndex, 'code', event.target.value.toUpperCase())} placeholder={cx('scoring_code_example')} /></div>
                          </div>
                          <div className="cyc-field">
                            <label>{cx('scoring_profile_label')}</label>
                            <div className="cyc-input"><AppIcon icon="Tag" /><input value={profile.label || ''} onChange={(event) => updateProfile(profileIndex, 'label', event.target.value)} placeholder={cx('scoring_profile_example')} /></div>
                          </div>
                          <AppSelect label={cx('status')} value={Number(profile.is_active ?? 1)} onChange={(value) => updateProfile(profileIndex, 'is_active', Number(value))} options={statusOptions} searchable={false} clearable={false} />
                          <AppSelect label={cx('scoring_default_profile')} value={Number(profile.is_default || 0)} onChange={(value) => updateProfile(profileIndex, 'is_default', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                          <div className="cyc-field cyc-field--wide">
                            <label>{cx('section_description')}</label>
                            <div className="cyc-input"><AppIcon icon="AlignLeft" /><input value={profile.description || ''} onChange={(event) => updateProfile(profileIndex, 'description', event.target.value)} placeholder={cx('scoring_profile_description_example')} /></div>
                          </div>
                        </div>

                        <div className="cyc-profile-weights">
                          {activeSections.map((section) => (
                            <div className="cyc-profile-weight" key={section.id}>
                              <div><strong>{section.code} — {section.label}</strong><small>{cx('scoring_base_weight', { weight: formatPercentage(Number(section.weight || 0) / 100, 2, locale) })}</small></div>
                              <div className="cyc-profile-weight__input"><input type="text" inputMode="decimal" value={profile.section_weights?.[String(section.id)] ?? ''} onChange={(event) => updateProfileWeight(profileIndex, section.id, event.target.value)} /><span>%</span></div>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        </div>

        <div className="cyc-modal-actions">
          <button type="button" className="cyc-btn cyc-btn--ghost" onClick={onClose}>{cx('cancel')}</button>
          <button type="submit" className="cyc-btn cyc-btn--primary" disabled={loading || saving}>
            {saving ? <><span className="cyc-spinner" /> {cx('saving')}</> : <><AppIcon icon="Save" /> {cx('scoring_save')}</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

export default ScoringConfigModal;
