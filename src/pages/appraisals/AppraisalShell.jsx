import React, { useState } from 'react';
import Header from '../Header';
import NavBar from '../NavBar';
import useThemeStore from '../../stores/useThemeStore';
import './Appraisals.css';
import '../../styles/app-i18n-appraisals.css';

const AppraisalShell = ({ children }) => {
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page theme-${theme}`}>{children}</div>
      </main>
    </div>
  );
};

export default AppraisalShell;
