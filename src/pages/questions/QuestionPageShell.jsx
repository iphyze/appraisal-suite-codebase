import React, { useState } from 'react';
import Header from '../Header';
import NavBar from '../NavBar';
import useThemeStore from '../../stores/useThemeStore';
import './Questions.css';

const QuestionPageShell = ({ children }) => {
  const [nav, setNav] = useState(false);
  const { theme } = useThemeStore();

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`qst-page theme-${theme}`}>{children}</main>
      </div>
    </div>
  );
};

export default QuestionPageShell;
