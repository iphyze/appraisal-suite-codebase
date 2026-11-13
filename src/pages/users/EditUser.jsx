import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import useThemeStore from '../../stores/useThemeStore';
import useUsersStore from '../../stores/useUsersStore';
import UserForm from './UserForm';
import './Users.css';
import AppIcon from '../../components/ui/AppIcon';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const EditUser = () => {
  useTranslation('users');
  const [nav, setNav] = useState(false);
  const { id } = useParams();
  const { theme } = useThemeStore();
  const { singleUser, fetchingSingle, singleUserError, fetchSingleUser, clearSingleUser } = useUsersStore();

  useEffect(() => {
    document.title = `Appraisal Portal | ${ux('edit_user')}`;
    fetchSingleUser(id);
    return () => clearSingleUser();
  }, [id, fetchSingleUser, clearSingleUser]);

  useEffect(() => { document.title = `Appraisal Portal | ${ux('edit_user')}`; }, [i18n.language]);

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`usr-page theme-${theme}`}>
          <PageNav
            pageTitle={ux('edit_user')}
            links={[
              { label: ux('dashboard'), to: '/dashboard', active: true },
              { label: ux('users'), to: '/users/home', active: true },
              { label: ux('edit_user'), to: `/users/edit/${id}`, active: false },
            ]}
          />

          {fetchingSingle && <UserSkeleton />}

          {!fetchingSingle && singleUser && <UserForm mode="edit" initialUser={singleUser} />}

          {!fetchingSingle && singleUserError && (
            <div className="usr-empty-state">
              <div className="usr-empty-icon"><AppIcon icon="TriangleAlert" /></div>
              <h3>{ux('failed_to_load_user')}</h3>
              <p>{singleUserError}</p>
              <Link to="/users/home" className="usr-btn usr-btn--primary">{ux('back_to_users')}</Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const UserSkeleton = () => (
  <div className="usr-form-card usr-skeleton-card">
    <div className="usr-skeleton usr-skeleton--title" />
    <div className="usr-skeleton-grid">
      {Array.from({ length: 10 }).map((_, index) => <div className="usr-skeleton" key={index} />)}
    </div>
  </div>
);

export default EditUser;
