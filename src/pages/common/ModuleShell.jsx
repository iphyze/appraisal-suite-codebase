import React, { useState } from 'react';
import Header from '../Header';
import NavBar from '../NavBar';
import useThemeStore from '../../stores/useThemeStore';
import './Module.css';

const ModuleShell = ({ children, className = '' }) => {
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`mod-page theme-${theme} ${className}`}>{children}</div>
      </main>
    </div>
  );
};

export default ModuleShell;
