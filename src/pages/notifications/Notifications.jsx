import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber, formatRelativeTime } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  Info,
  Mail,
  MailOpen,
  MessageSquare,
  PenLine,
  UserCheck,
} from 'lucide-react';
import PageNav from '../../components/PageNav';
import useNotificationsStore from '../../stores/useNotificationsStore';
import useToastStore from '../../stores/useToastStore';
import { openVerifiedNotification } from '../../services/notificationNavigation';
import ModuleShell from '../common/ModuleShell';
import './Notifications.css';

const FILTERS = [
  { value: 'all', labelKey: 'ntf_filter_all', icon: Bell },
  { value: 'unread', labelKey: 'ntf_filter_unread', icon: Mail },
  { value: 'read', labelKey: 'ntf_filter_read', icon: MailOpen },
];

const TYPE_META = {
  appraisal_created: { icon: ClipboardCheck, tone: 'green' },
  appraisal_updated: { icon: PenLine, tone: 'blue' },
  feedback_submitted: { icon: MessageSquare, tone: 'amber' },
  supervisor_onboarded: { icon: UserCheck, tone: 'purple' },
  manual_message: { icon: MailOpen, tone: 'green' },
  info: { icon: Info, tone: 'green' },
};


// Keep the original compact English timeline; use Intl relative labels in French.
const notificationTime = (value, locale, t) => {
  if (!value) return '';
  if (locale === 'fr') return formatRelativeTime(value, new Date(), locale);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return t('ntf_just_now');
  if (minutes < 60) return t('ntf_minutes_ago', { minutes });
  if (minutes < 1440) return t('ntf_hours_ago', { hours: Math.floor(minutes / 60) });
  return formatDateTime(date, { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }, locale);
};

const Notifications = () => {
  const { t, i18n } = useTranslation('mail');
  const locale = i18n.language;
  const { items, unread, meta, loading, pulseRevision, fetchNotifications, markRead } = useNotificationsStore();
  const [filter, setFilter] = useState('all');
  const hasLoadedRef = useRef(false);
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => {
    document.title = t('ntf_document_title');
  }, [t, locale]);

  useEffect(() => {
    fetchNotifications({
      status: filter,
      limit: 50,
      silent: hasLoadedRef.current,
    });
    hasLoadedRef.current = true;
  }, [filter, pulseRevision, fetchNotifications, locale]);

  const totals = useMemo(() => ({
    all: Number(meta?.total || items.length || 0),
    unread: Number(unread || 0),
    read: Number(meta?.read || 0),
  }), [meta, items.length, unread]);

  const openNotification = async (item) => {
    if (openingId !== null) return;
    setOpeningId(item.id);
    try {
      await openVerifiedNotification(item, { navigate, markRead, showToast });
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <ModuleShell className="ntf-page">
      <PageNav
        pageTitle={t('ntf_title')}
        links={[{ label: t('ntf_dashboard'), to: '/dashboard', active: true }, { label: t('ntf_title') }]}
      />

      <section className="ntf-hero">
        <div>
          <p className="ntf-eyebrow">{t('ntf_eyebrow')}</p>
          <h2>{t('ntf_heading')}</h2>
          <p>{t('ntf_description')}</p>
        </div>
        {unread > 0 && (
          <button type="button" className="ntf-btn ntf-btn--primary" onClick={() => markRead()}>
            <CheckCheck size={16} /> {t('ntf_mark_all')}
          </button>
        )}
      </section>

      <div className="ntf-stats">
        <div className="ntf-stat"><span><Bell size={20} /></span><strong>{formatNumber(totals.all, {}, locale)}</strong><small>{t('ntf_stat_all')}</small></div>
        <div className="ntf-stat ntf-stat--unread"><span><Mail size={20} /></span><strong>{formatNumber(totals.unread, {}, locale)}</strong><small>{t('ntf_stat_unread')}</small></div>
        <div className="ntf-stat"><span><MailOpen size={20} /></span><strong>{formatNumber(totals.read, {}, locale)}</strong><small>{t('ntf_stat_read')}</small></div>
      </div>

      <section className="ntf-card">
        <div className="ntf-toolbar" role="tablist" aria-label={t('ntf_filter_accessibility')}>
          {FILTERS.map((item) => {
            const FilterIcon = item.icon;
            return (
            <button
              key={item.value}
              type="button"
              className={`ntf-filter ${filter === item.value ? 'ntf-filter--active' : ''}`}
              onClick={() => setFilter(item.value)}
            >
              <FilterIcon size={15} /> {t(item.labelKey)}
              <span>{formatNumber(totals[item.value], {}, locale)}</span>
            </button>
            );
          })}
        </div>

        {loading ? (
          <div className="ntf-loading">
            {Array.from({ length: 4 }).map((_, index) => <span key={index} className="ntf-skeleton" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="ntf-empty">
            <span><BellOff size={24} /></span>
            <h3>{filter === 'unread' ? t('ntf_empty_unread') : t('ntf_empty_all')}</h3>
            <p>{filter === 'unread' ? t('ntf_empty_unread_detail') : t('ntf_empty_all_detail')}</p>
          </div>
        ) : (
          <div className="ntf-list">
            {items.map((item) => {
              const visual = TYPE_META[item.type] || TYPE_META.info;
              const NotificationIcon = visual.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ntf-item ${Number(item.is_read) === 0 ? 'ntf-item--unread' : ''}`}
                  onClick={() => openNotification(item)}
                  disabled={openingId !== null}
                  aria-busy={openingId === item.id}
                >
                  <span className={`ntf-item__icon ntf-item__icon--${visual.tone}`}><NotificationIcon size={20} /></span>
                  <span className="ntf-item__content">
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <small className="ntf-item__meta">
                      {item.company_name && <span className="ntf-company-label">{item.company_name}</span>}
                      <span>{notificationTime(item.created_at, locale, t)}</span>
                    </small>
                  </span>
                  {Number(item.is_read) === 0 && <span className="ntf-item__dot" aria-label={t('ntf_unread_accessibility')} />}
                  <ChevronRight className="ntf-item__arrow" size={14} />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </ModuleShell>
  );
};

export default Notifications;
