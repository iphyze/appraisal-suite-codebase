import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useEffect, useState } from 'react';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import useThemeStore from '../../stores/useThemeStore';
import UserForm from './UserForm';
import './Users.css';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const CreateUser = () => {
  useTranslation('users');
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();

  useEffect(() => {
    document.title = `Appraisal Portal | ${ux('create_user')}`;
  }, [i18n.language]);

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`usr-page theme-${theme}`}>
          <PageNav
            pageTitle={ux('create_user')}
            links={[
              { label: ux('dashboard'), to: '/dashboard', active: true },
              { label: ux('users'), to: '/users/home', active: true },
              { label: ux('create_user'), to: '/users/create-user', active: false },
            ]}
          />
          <UserForm mode="create" />
        </main>
      </div>
    </div>
  );
};

export default CreateUser;
