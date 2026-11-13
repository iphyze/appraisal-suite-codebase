import i18n from '../i18n';
import { Component } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import AppIcon from './ui/AppIcon';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Application render error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="ap-boot-error" role="alert">
        <div className="ap-boot-error__card">
          <span className="ap-boot-error__icon"><AppIcon icon={TriangleAlert} size={24} /></span>
          <p className="ap-boot-error__eyebrow">{i18n.t('common:unable_to_finish_loading')}</p>
          <h1>{i18n.t('common:reload_workspace')}</h1>
          <p>{i18n.t('common:load_failure_detail')}</p>
          <button type="button" onClick={this.handleReload}>
            <AppIcon icon={RefreshCw} size={17} /> {i18n.t('common:reload_application')}
          </button>
        </div>
      </main>
    );
  }
}

export default AppErrorBoundary;
