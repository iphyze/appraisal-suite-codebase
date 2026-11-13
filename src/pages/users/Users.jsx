import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useState } from "react";
import NavBar from "../NavBar";
import Header from "../Header";
import { NavLink } from "react-router-dom";
import AppIcon from '../../components/ui/AppIcon';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const Users = () => {

  useTranslation('users');
  const [nav, setNav] = useState(false);

  return(

  <div className="main-container">
    <Header setNav={setNav} nav={nav}/>
    <NavBar setNav={setNav} nav={nav}/>
    <div className="content-container">
      <div className="content-container-h-flexbox">
          <div className="cch-flexbox">
            <span className="cch-iconbox"><AppIcon icon="Users" className="cch-icon" /></span>
            <p className="content-header">{ux('users')}</p>
          </div>
          <div className="cch-title-box">
            <NavLink to='/users' className="ccht-titlelink">{ux('users')}</NavLink>
            <p className="ccht-titletext"> / {ux('home')}</p>
          </div>
      </div>


    </div>
  </div>

  )

};

export default Users;
