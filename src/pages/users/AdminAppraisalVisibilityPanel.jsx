import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import useToastStore from '../../stores/useToastStore';
import AppIcon from '../../components/ui/AppIcon';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

// Permission modes remain backend enum values; only their labels are localised.
const MODE_OPTIONS = [
  { value: 'none', icon: 'LockKeyhole' },
  { value: 'all', icon: 'Users' },
  { value: 'selected', icon: 'UserRoundCheck' },
];

const normalizedIds = (ids = []) => [...new Set(ids.map((id) => Number(id)).filter((id) => id > 0))].sort((a, b) => a - b);

const sameIds = (left, right) => {
  const a = normalizedIds(left);
  const b = normalizedIds(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
};

const AdminAppraisalVisibilityPanel = ({ adminId, adminName = 'this Admin' }) => {
  useTranslation('users');
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState('none');
  const [savedMode, setSavedMode] = useState('none');
  const [selectedIds, setSelectedIds] = useState([]);
  const [savedSelectedIds, setSavedSelectedIds] = useState([]);
  const [eligibleAdmins, setEligibleAdmins] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!adminId) return undefined;

    let active = true;
    setLoading(true);
    setLoadError('');

    api.get('/users/admin-appraisal-visibility', {
      params: { admin_id: Number(adminId) },
      skipPortalContext: true,
    })
      .then((response) => {
        if (!active) return;
        const data = response.data?.data || {};
        const nextMode = ['none', 'all', 'selected'].includes(data.visibility_mode)
          ? data.visibility_mode
          : 'none';
        const nextSelected = normalizedIds(data.selected_admin_ids || []);

        setMode(nextMode);
        setSavedMode(nextMode);
        setSelectedIds(nextSelected);
        setSavedSelectedIds(nextSelected);
        setEligibleAdmins(Array.isArray(data.eligible_admins) ? data.eligible_admins : []);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error.response?.data?.message
          || 'visibility_load_error'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [adminId]);

  const filteredAdmins = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligibleAdmins;

    return eligibleAdmins.filter((admin) => [
      admin.display_name,
      admin.first_name,
      admin.last_name,
      admin.email,
      admin.department,
      admin.job_title,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [eligibleAdmins, query]);

  const translatedModeOptions = MODE_OPTIONS.map((item) => ({ ...item, label: ux(`visibility_${item.value}`), description: ux(`visibility_${item.value}_description`) }));
  const dirty = mode !== savedMode
    || (mode === 'selected' && !sameIds(selectedIds, savedSelectedIds));

  const toggleSelectedAdmin = (id) => {
    const numericId = Number(id);
    setSelectedIds((current) => (
      current.includes(numericId)
        ? current.filter((item) => item !== numericId)
        : [...current, numericId]
    ));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    if (nextMode !== 'selected') setQuery('');
  };

  const handleSave = async () => {
    if (mode === 'selected' && selectedIds.length === 0) {
      showToast(ux('visibility_selected_required'), 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        admin_id: Number(adminId),
        visibility_mode: mode,
        target_admin_ids: mode === 'selected' ? normalizedIds(selectedIds) : [],
      };

      const response = await api.put('/users/admin-appraisal-visibility', payload, {
        skipPortalContext: true,
      });

      const saved = response.data?.data || payload;
      const nextMode = saved.visibility_mode || mode;
      const nextSelected = normalizedIds(saved.selected_admin_ids || payload.target_admin_ids);

      setMode(nextMode);
      setSavedMode(nextMode);
      setSelectedIds(nextSelected);
      setSavedSelectedIds(nextSelected);
      showToast(ux('visibility_saved_toast'), 'success');
    } catch (error) {
      showToast(
        error.response?.data?.message || ux('visibility_save_error'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="usr-form-section usr-admin-appraisal-access">
      <div className="usr-section-title usr-admin-appraisal-access__title">
        <AppIcon icon="ShieldCheck" />
        <span>{ux('visibility_heading')}</span>
        <span className="usr-admin-appraisal-access__super-admin-badge">{ux('visibility_super_admin')}</span>
      </div>

      <div className="usr-admin-appraisal-access__intro">
        <div className="usr-admin-appraisal-access__intro-icon">
          <AppIcon icon="Eye" />
        </div>
        <div>
          <span className="usr-admin-appraisal-access__intro-title">
            {ux('visibility_intro', { name: adminName })}
          </span>
          <span className="usr-admin-appraisal-access__intro-copy">
            {ux('visibility_copy')}
          </span>
        </div>
      </div>

      {loading && (
        <div className="usr-admin-appraisal-access__loading" aria-label={ux('visibility_load')}>
          <span className="usr-skeleton" />
          <span className="usr-skeleton" />
          <span className="usr-skeleton" />
        </div>
      )}

      {!loading && loadError && (
        <div className="usr-admin-appraisal-access__error" role="alert">
          <AppIcon icon="TriangleAlert" />
          <span>{loadError === 'visibility_load_error' ? ux(loadError) : loadError}</span>
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="usr-admin-appraisal-access__modes" role="radiogroup" aria-label={ux('visibility_mode')}>
            {translatedModeOptions.map((option) => {
              const active = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`usr-admin-appraisal-access__mode ${active ? 'usr-admin-appraisal-access__mode--active' : ''}`}
                  onClick={() => handleModeChange(option.value)}
                >
                  <span className="usr-admin-appraisal-access__mode-icon">
                    <AppIcon icon={option.icon} />
                  </span>
                  <span className="usr-admin-appraisal-access__mode-copy">
                    <span className="usr-admin-appraisal-access__mode-label">{option.label}</span>
                    <span className="usr-admin-appraisal-access__mode-description">{option.description}</span>
                  </span>
                  <span className="usr-admin-appraisal-access__radio-mark">
                    {active && <AppIcon icon="Check" />}
                  </span>
                </button>
              );
            })}
          </div>

          {mode === 'selected' && (
            <div className="usr-admin-appraisal-access__selector">
              <div className="usr-admin-appraisal-access__selector-head">
                <div>
                  <span className="usr-admin-appraisal-access__selector-title">{ux('visibility_select_heading')}</span>
                  <span className="usr-admin-appraisal-access__selector-copy">
                    {ux('visibility_selection', { count: selectedIds.length })}
                  </span>
                </div>

                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    className="usr-link-btn usr-admin-appraisal-access__clear"
                    onClick={() => setSelectedIds([])}
                  >
                    {ux('clear_selection')}
                  </button>
                )}
              </div>

              <div className="usr-admin-appraisal-access__search">
                <AppIcon icon="Search" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={ux('visibility_search')}
                  aria-label={ux('visibility_search_label')}
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label={ux('visibility_clear_search')}>
                    <AppIcon icon="X" />
                  </button>
                )}
              </div>

              <div className="usr-admin-appraisal-access__admin-list">
                {filteredAdmins.length === 0 ? (
                  <div className="usr-admin-appraisal-access__empty">
                    <AppIcon icon="Users" />
                    <span>{ux(eligibleAdmins.length === 0 ? 'visibility_empty' : 'visibility_no_results')}</span>
                  </div>
                ) : (
                  filteredAdmins.map((admin) => {
                    const id = Number(admin.id);
                    const checked = selectedIds.includes(id);
                    const meta = [admin.department, admin.job_title_display || admin.job_title].filter(Boolean).join(' · ');
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`usr-admin-appraisal-access__admin ${checked ? 'usr-admin-appraisal-access__admin--selected' : ''}`}
                        onClick={() => toggleSelectedAdmin(id)}
                        role="checkbox"
                        aria-checked={checked}
                      >
                        <span className="usr-admin-appraisal-access__avatar">
                          {String(admin.display_name || admin.email || 'A').trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="usr-admin-appraisal-access__admin-copy">
                          <span className="usr-admin-appraisal-access__admin-name">{admin.display_name || admin.email || ux('admin_number', { id })}</span>
                          {meta && <span className="usr-admin-appraisal-access__admin-meta">{meta}</span>}
                          {admin.email && <span className="usr-admin-appraisal-access__admin-email">{admin.email}</span>}
                        </span>
                        <span className="usr-admin-appraisal-access__checkbox-mark">
                          {checked && <AppIcon icon="Check" />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="usr-admin-appraisal-access__footer">
            <span className="usr-admin-appraisal-access__status">
              <AppIcon icon={dirty ? 'CircleDot' : 'CircleCheck'} />
              {ux(dirty ? 'visibility_dirty' : 'visibility_saved')}
            </span>
            <button
              type="button"
              className="usr-btn usr-btn--primary"
              onClick={handleSave}
              disabled={saving || !dirty || (mode === 'selected' && selectedIds.length === 0)}
            >
              {saving ? <><span className="usr-spinner" /> {ux('saving')}</> : <><AppIcon icon="Save" /> {ux('visibility_save')}</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAppraisalVisibilityPanel;
