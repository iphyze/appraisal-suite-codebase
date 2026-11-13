import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import '../../styles/app-i18n-users.css';
import React, { useEffect, useState } from 'react';
import PageNav from '../../components/PageNav';
import AppIcon from '../../components/ui/AppIcon';
import api from '../../services/api';
import ModuleShell from '../common/ModuleShell';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const Field = ({ label, value }) => <div className="mod-stat"><span><AppIcon icon="Info" size={17} /></span><div><strong>{value || '—'}</strong><small>{label}</small></div></div>;

const MyProfile = () => {
  useTranslation('users');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `Appraisal Portal | ${ux('my_profile')}`;
    api.get('/users/my-profile').then((res) => setProfile(res.data?.data || null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { document.title = `Appraisal Portal | ${ux('my_profile')}`; }, [i18n.language]);

  return (
    <ModuleShell className="mod-page--people-i18n">
      <PageNav pageTitle={ux('my_profile')} links={[{ label: ux('dashboard'), to: '/dashboard', active: true }, { label: ux('my_profile') }]} />
      <section className="mod-hero"><div><p className="mod-eyebrow">{ux('profile')}</p><h2>{profile?.fullname || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || ux('my_profile')}</h2><p>{ux('profile_summary')}</p></div></section>
      {loading ? <div className="mod-card mod-empty"><span className="mod-spinner" aria-hidden="true" /><h3>{ux('loading_profile')}</h3></div> : (
        <>
          <section className="mod-stats">
            <Field label={ux('role')} value={['super_admin','admin','supervisor','staff'].includes(profile?.role) ? ux(profile.role) : profile?.role?.replaceAll('_', ' ')} />
            <Field label={ux('company')} value={profile?.company_name} />
            <Field label={ux('department')} value={profile?.department} />
            <Field label={ux('staff_id')} value={profile?.staff_id} />
          </section>
          <section className="mod-card">
            <div className="mod-form">
              <div className="mod-form-grid">
                <label>{ux('first_name')}<input value={profile?.first_name || ''} readOnly /></label>
                <label>{ux('last_name')}<input value={profile?.last_name || ''} readOnly /></label>
                <label>{ux('email')}<input value={profile?.email || ''} readOnly /></label>
                <label>{ux('job_title')}<input value={profile?.job_title_display || profile?.job_title || ''} readOnly /></label>
                <label>{ux('staff_type')}<input value={['Local','Expatriate'].includes(profile?.staff_type) ? ux(profile.staff_type.toLowerCase()) : profile?.staff_type || ''} readOnly /></label>
                <label>{ux('location')}<input value={profile?.location || ''} readOnly /></label>
              </div>
            </div>
          </section>
        </>
      )}
    </ModuleShell>
  );
};
export default MyProfile;
