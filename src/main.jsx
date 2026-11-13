import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import useThemeStore from './stores/useThemeStore';
import registerServiceWorker from './services/registerServiceWorker';
import { installNavigationSignals } from './utils/navigationSignals';
import './i18n';
import useLocaleStore from './stores/useLocaleStore';
import './styles/app-i18n-shell.css';

useThemeStore.getState().init();
void useLocaleStore.getState().init();
// Before the router starts, so every page change can show the loading bar.
installNavigationSignals();

const application = (
  <Router>
    <App />
  </Router>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  import.meta.env.DEV
    ? <React.StrictMode>{application}</React.StrictMode>
    : application
);

registerServiceWorker();
