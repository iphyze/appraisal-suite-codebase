import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import './Responsive.css';
import './styles/rating-rings.css';
import AppErrorBoundary from './components/AppErrorBoundary';
import AppLoadingScreen from './components/AppLoadingScreen';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import PublicRoute from './services/PublicRoute';
import RouteTransitionLoader from './components/RouteTransitionLoader';
import InstallAppPrompt from './components/pwa/InstallAppPrompt';
import SupervisorAppraisalGuide from './components/onboarding/SupervisorAppraisalGuide';
import Toast from './services/Toast';
import CompanyManageRoute from './components/CompanyManageRoute';
import CompanyAccessBootstrap from './components/CompanyAccessBootstrap';
import useAuthStore from './stores/useAuthStore';
import { syncAuthenticatedSession } from './services/api';

const chunkErrorPattern = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;

const lazyWithRetry = (loader, key) => lazy(async () => {
  const retryKey = `lambert-app-chunk-retry:${key}`;

  try {
    const module = await loader();
    window.sessionStorage.removeItem(retryKey);
    return module;
  } catch (error) {
    const isChunkFailure = chunkErrorPattern.test(String(error?.message || error));
    const hasRetried = window.sessionStorage.getItem(retryKey) === '1';

    if (isChunkFailure && !hasRetried) {
      window.sessionStorage.setItem(retryKey, '1');
      window.location.reload();
      return new Promise(() => {});
    }

    window.sessionStorage.removeItem(retryKey);
    throw error;
  }
});

const loaders = {
  login: () => import('./pages/auth/Login'),
  changePassword: () => import('./pages/auth/ChangePassword'),
  passwordRecovery: () => import('./pages/auth/PasswordRecovery'),
  dashboard: () => import('./pages/home/Dashboard'),
  aiAssistant: () => import('./pages/ai/AiAssistant'),
  aiSettings: () => import('./pages/ai/AiFeatureSettings'),
  translations: () => import('./pages/translations/TranslationManagement'),
  emailDelivery: () => import('./pages/mail/EmailDeliverySettings'),
  companyGrants: () => import('./pages/company-access/CompanyAccessGrants'),
  aiInsights: () => import('./pages/ai/AiManagementInsights'),
  aiAnalytics: () => import('./pages/ai/AiAnalytics'),
  notFound: () => import('./pages/NotFound'),
  usersOverview: () => import('./pages/users/UsersOverview'),
  createUser: () => import('./pages/users/CreateUser'),
  editUser: () => import('./pages/users/EditUser'),
  viewUser: () => import('./pages/users/ViewUser'),
  cyclesOverview: () => import('./pages/cycles/CyclesOverview'),
  createCycle: () => import('./pages/cycles/CreateCycle'),
  editCycle: () => import('./pages/cycles/EditCycle'),
  viewCycle: () => import('./pages/cycles/ViewCycle'),
  copyQuestions: () => import('./pages/cycles/CopyQuestions'),
  questionsOverview: () => import('./pages/questions/QuestionsOverview'),
  createQuestion: () => import('./pages/questions/CreateQuestion'),
  editQuestion: () => import('./pages/questions/EditQuestion'),
  viewQuestion: () => import('./pages/questions/ViewQuestion'),
  supervisorAssignments: () => import('./pages/supervisors/SupervisorAssignments'),
  supervisorsOverview: () => import('./pages/supervisors/SupervisorsOverview'),
  viewSupervisor: () => import('./pages/supervisors/ViewSupervisor'),
  appraisals: () => import('./pages/appraisals/Appraisals'),
  appraisalForm: () => import('./pages/appraisals/AppraisalForm'),
  appraisalView: () => import('./pages/appraisals/AppraisalView'),
  myAppraisals: () => import('./pages/my-appraisals/MyAppraisals'),
  myProfile: () => import('./pages/profile/MyProfile'),
  companies: () => import('./pages/companies/Companies'),
  departments: () => import('./pages/departments/Departments'),
  sendEmail: () => import('./pages/mail/ManualEmail'),
  auditLog: () => import('./pages/audit/AuditLog'),
  notifications: () => import('./pages/notifications/Notifications'),
  comingSoon: () => import('./pages/ComingSoon'),
};

const Login = lazyWithRetry(loaders.login, 'login');
const ChangePassword = lazyWithRetry(loaders.changePassword, 'change-password');
const PasswordRecovery = lazyWithRetry(loaders.passwordRecovery, 'password-recovery');
const Dashboard = lazyWithRetry(loaders.dashboard, 'dashboard');
const AiAssistant = lazyWithRetry(loaders.aiAssistant, 'ai-assistant');
const AiFeatureSettings = lazyWithRetry(loaders.aiSettings, 'ai-settings');
const TranslationManagement = lazyWithRetry(loaders.translations, 'translations');
const EmailDeliverySettings = lazyWithRetry(loaders.emailDelivery, 'email-delivery');
const CompanyAccessGrants = lazyWithRetry(loaders.companyGrants, 'company-grants');
const AiManagementInsights = lazyWithRetry(loaders.aiInsights, 'ai-management-insights');
const AiAnalytics = lazyWithRetry(loaders.aiAnalytics, 'ai-analytics');
const NotFound = lazyWithRetry(loaders.notFound, 'not-found');
const UsersOverview = lazyWithRetry(loaders.usersOverview, 'users-overview');
const CreateUser = lazyWithRetry(loaders.createUser, 'create-user');
const EditUser = lazyWithRetry(loaders.editUser, 'edit-user');
const ViewUser = lazyWithRetry(loaders.viewUser, 'view-user');
const CyclesOverview = lazyWithRetry(loaders.cyclesOverview, 'cycles-overview');
const CreateCycle = lazyWithRetry(loaders.createCycle, 'create-cycle');
const EditCycle = lazyWithRetry(loaders.editCycle, 'edit-cycle');
const ViewCycle = lazyWithRetry(loaders.viewCycle, 'view-cycle');
const CopyQuestions = lazyWithRetry(loaders.copyQuestions, 'copy-questions');
const QuestionsOverview = lazyWithRetry(loaders.questionsOverview, 'questions-overview');
const CreateQuestion = lazyWithRetry(loaders.createQuestion, 'create-question');
const EditQuestion = lazyWithRetry(loaders.editQuestion, 'edit-question');
const ViewQuestion = lazyWithRetry(loaders.viewQuestion, 'view-question');
const SupervisorAssignments = lazyWithRetry(loaders.supervisorAssignments, 'supervisor-assignments');
const SupervisorsOverview = lazyWithRetry(loaders.supervisorsOverview, 'supervisors-overview');
const ViewSupervisor = lazyWithRetry(loaders.viewSupervisor, 'view-supervisor');
const Appraisals = lazyWithRetry(loaders.appraisals, 'appraisals');
const AppraisalForm = lazyWithRetry(loaders.appraisalForm, 'appraisal-form');
const AppraisalView = lazyWithRetry(loaders.appraisalView, 'appraisal-view');
const MyAppraisals = lazyWithRetry(loaders.myAppraisals, 'my-appraisals');
const MyProfile = lazyWithRetry(loaders.myProfile, 'my-profile');
const Companies = lazyWithRetry(loaders.companies, 'companies');
const Departments = lazyWithRetry(loaders.departments, 'departments');
const ManualEmail = lazyWithRetry(loaders.sendEmail, 'send-email');
const AuditLog = lazyWithRetry(loaders.auditLog, 'audit-log');
const Notifications = lazyWithRetry(loaders.notifications, 'notifications');
const ComingSoon = lazyWithRetry(loaders.comingSoon, 'coming-soon');

/** The code-split page for an address (same rules as the routes below). */
const loaderForPath = (path = '/') => {
  let loader = null;

  if (path === '/' || path === '/dashboard') loader = loaders.dashboard;
  else if (path === '/ai-assistant') loader = loaders.aiAssistant;
  else if (path === '/ai/settings') loader = loaders.aiSettings;
  else if (path === '/translations') loader = loaders.translations;
  else if (path === '/email-delivery') loader = loaders.emailDelivery;
  else if (path === '/users/company-access') loader = loaders.companyGrants;
  else if (path === '/login') loader = loaders.login;
  else if (path === '/change-password') loader = loaders.changePassword;
  else if (path === '/forgot-password' || path === '/reset-password') loader = loaders.passwordRecovery;
  else if (path === '/users/home') loader = loaders.usersOverview;
  else if (path === '/users/create-user') loader = loaders.createUser;
  else if (/^\/users\/edit\//.test(path)) loader = loaders.editUser;
  else if (/^\/users\/view\//.test(path)) loader = loaders.viewUser;
  else if (path === '/users/my-profile' || path === '/profile') loader = loaders.myProfile;
  else if (path === '/cycles' || path === '/cycles/home') loader = loaders.cyclesOverview;
  else if (path === '/cycles/create') loader = loaders.createCycle;
  else if (/^\/cycles\/edit\//.test(path)) loader = loaders.editCycle;
  else if (/^\/cycles\/view\//.test(path)) loader = loaders.viewCycle;
  else if (/^\/questions\/(kpi|general)$/.test(path) || path === '/questions') loader = loaders.questionsOverview;
  else if (/^\/questions\/(kpi|general)\/create$/.test(path)) loader = loaders.createQuestion;
  else if (/^\/questions\/(kpi|general)\/edit\//.test(path)) loader = loaders.editQuestion;
  else if (/^\/questions\/(kpi|general)\/view\//.test(path)) loader = loaders.viewQuestion;
  else if (path === '/supervisors') loader = loaders.supervisorsOverview;
  else if (path === '/supervisors/assignments') loader = loaders.supervisorAssignments;
  else if (/^\/supervisors\/view\//.test(path)) loader = loaders.viewSupervisor;
  else if (path === '/appraisals' || path === '/my-team-appraisals') loader = loaders.appraisals;
  else if (/^\/appraisals\/(create|edit)($|\/)/.test(path)) loader = loaders.appraisalForm;
  else if (/^\/appraisals\/view\//.test(path)) loader = loaders.appraisalView;
  else if (path === '/my-appraisals' || path === '/staff/my-appraisals' || path === '/staff/appraisals') loader = loaders.myAppraisals;
  else if (path === '/companies' || path === '/companies/create') loader = loaders.companies;
  else if (path === '/departments') loader = loaders.departments;
  else if (path === '/mail') loader = loaders.sendEmail;
  else if (path === '/audit-log') loader = loaders.auditLog;
  else if (path === '/notifications') loader = loaders.notifications;
  else if (/^\/sections\//.test(path)) loader = loaders.comingSoon;
  else loader = loaders.notFound;

  return loader;
};

const requestedChunks = new Set();
/** Starts downloading a page's code without waiting for it (safe to call repeatedly). */
const preloadPath = (path) => {
  const loader = loaderForPath(path || '/');
  if (!loader || requestedChunks.has(loader)) return;
  requestedChunks.add(loader);
  Promise.resolve().then(loader).catch(() => {
    requestedChunks.delete(loader); // React.lazy reports real loading errors
  });
};

preloadPath(window.location.pathname || '/');

/**
 * Makes page changes feel instant:
 * - downloads a page's code as soon as the pointer rests on (or keyboard focuses) a link to it;
 * - after sign-in, quietly downloads the pages people open most, while the browser is idle.
 */
const RoutePreloader = () => {
  const { authenticated, user } = useAuthStore();
  useEffect(() => {
    const onIntent = (event) => {
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;
      try {
        const next = new URL(anchor.href, window.location.href);
        if (next.origin === window.location.origin) preloadPath(next.pathname);
      } catch { /* ignore */ }
    };
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    document.addEventListener('touchstart', onIntent, { passive: true });
    return () => {
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('touchstart', onIntent);
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    const common = ['/dashboard', '/appraisals', '/appraisals/view/0', '/my-appraisals', '/notifications'];
    const appraisers = ['/appraisals/create', '/my-team-appraisals', '/supervisors'];
    const paths = ['admin', 'super_admin', 'supervisor'].includes(user?.role) ? [...common, ...appraisers] : common;
    const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 1500));
    const cancel = window.cancelIdleCallback || window.clearTimeout;
    let index = 0;
    let handle = null;
    const next = () => {
      if (index >= paths.length) return;
      preloadPath(paths[index]);
      index += 1;
      handle = idle(next, { timeout: 4000 });
    };
    handle = idle(next, { timeout: 4000 });
    return () => cancel(handle);
  }, [authenticated, user?.role]);

  return null;
};

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

// Browsers throttle background timers. Revalidate when the tab returns and
// periodically while visible; the API extends a VALID cookie near expiry.
const SessionLifecycle = () => {
  useEffect(() => {
    let lastInteractionAt = Date.now();
    const checkWhenActive = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (!useAuthStore.getState().authenticated) return;
      void syncAuthenticatedSession({ maxAgeMs: 60 * 1000 }).catch(() => {
        // Only a confirmed 401 logs the user out. Temporary disconnections
        // are handled by the normal request/error UI.
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkWhenActive();
    };
    const onInteraction = () => {
      lastInteractionAt = Date.now();
      checkWhenActive();
    };
    const checkWhileInUse = () => {
      // Do not silently extend a session on a completely idle open tab.
      if (Date.now() - lastInteractionAt < 10 * 60 * 1000) checkWhenActive();
    };
    window.addEventListener('focus', checkWhenActive);
    window.addEventListener('pointerdown', onInteraction, { passive: true });
    window.addEventListener('keydown', onInteraction);
    window.addEventListener('wheel', onInteraction, { passive: true });
    window.addEventListener('online', checkWhenActive);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(checkWhileInUse, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', checkWhenActive);
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('wheel', onInteraction);
      window.removeEventListener('online', checkWhenActive);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, []);
  return null;
};

const App = () => (
  <AppErrorBoundary>
    <Toast />
    <SessionLifecycle />
    <CompanyAccessBootstrap />
    <ScrollToTop />
    <RouteTransitionLoader />
    <RoutePreloader />
    <InstallAppPrompt />
    <SupervisorAppraisalGuide />
    <Suspense fallback={<AppLoadingScreen label="Loading your workspace" />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/forgot-password" element={<PasswordRecovery />} />
        <Route path="/reset-password" element={<PasswordRecovery />} />
        <Route path="/change-password" element={<Protected><ChangePassword /></Protected>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/ai-assistant" element={<Protected><AiAssistant /></Protected>} />
        <Route path="/ai/settings" element={<Protected><AiFeatureSettings /></Protected>} />
        <Route path="/translations" element={<Protected><TranslationManagement /></Protected>} />
        <Route path="/ai/insights" element={<Protected><AiManagementInsights /></Protected>} />
        <Route path="/analytics" element={<Protected><AiAnalytics /></Protected>} />

        <Route path="/my-appraisals" element={<Protected><MyAppraisals /></Protected>} />
        <Route path="/staff/my-appraisals" element={<Protected><MyAppraisals /></Protected>} />
        <Route path="/staff/appraisals" element={<Protected><MyAppraisals /></Protected>} />
        <Route path="/staff" element={<Protected><Navigate to="/users/home" replace /></Protected>} />
        <Route path="/staff/directory" element={<Protected><Navigate to="/users/home" replace /></Protected>} />

        <Route path="/supervisors" element={<Protected><SupervisorsOverview /></Protected>} />
        <Route path="/supervisors/view/:id" element={<Protected><ViewSupervisor /></Protected>} />
        <Route path="/supervisors/assignments" element={<Protected><CompanyManageRoute><SupervisorAssignments /></CompanyManageRoute></Protected>} />

        <Route path="/users/my-profile" element={<Protected><MyProfile /></Protected>} />
        <Route path="/profile" element={<Protected><MyProfile /></Protected>} />
        <Route path="/users/home" element={<Protected><UsersOverview /></Protected>} />
        <Route path="/users/company-access" element={<Protected><CompanyAccessGrants /></Protected>} />
        <Route path="/users/create-user" element={<Protected><CompanyManageRoute><CreateUser /></CompanyManageRoute></Protected>} />
        <Route path="/users/edit/:id" element={<Protected><CompanyManageRoute><EditUser /></CompanyManageRoute></Protected>} />
        <Route path="/users/view/:id" element={<Protected><ViewUser /></Protected>} />

        <Route path="/companies" element={<Protected><Companies /></Protected>} />
        <Route path="/companies/create" element={<Protected><Companies /></Protected>} />
        <Route path="/departments" element={<Protected><Departments /></Protected>} />

        <Route path="/cycles" element={<Protected><Navigate to="/cycles/home" replace /></Protected>} />
        <Route path="/cycles/home" element={<Protected><CyclesOverview /></Protected>} />
        <Route path="/cycles/create" element={<Protected><CompanyManageRoute companyWide><CreateCycle /></CompanyManageRoute></Protected>} />
        <Route path="/cycles/edit/:id" element={<Protected><CompanyManageRoute companyWide><EditCycle /></CompanyManageRoute></Protected>} />
        <Route path="/cycles/view/:id" element={<Protected><ViewCycle /></Protected>} />
        <Route path="/cycles/copy-questions" element={<Protected><CopyQuestions /></Protected>} />

        <Route path="/sections/*" element={<Protected><ComingSoon title="Sections" /></Protected>} />

        <Route path="/questions" element={<Protected><Navigate to="/questions/kpi" replace /></Protected>} />
        <Route path="/questions/kpi" element={<Protected><QuestionsOverview type="kpi" /></Protected>} />
        <Route path="/questions/kpi/create" element={<Protected><CompanyManageRoute><CreateQuestion type="kpi" /></CompanyManageRoute></Protected>} />
        <Route path="/questions/kpi/edit/:id" element={<Protected><CompanyManageRoute><EditQuestion type="kpi" /></CompanyManageRoute></Protected>} />
        <Route path="/questions/kpi/view/:id" element={<Protected><ViewQuestion type="kpi" /></Protected>} />
        <Route path="/questions/general" element={<Protected><QuestionsOverview type="general" /></Protected>} />
        <Route path="/questions/general/create" element={<Protected><CompanyManageRoute companyWide><CreateQuestion type="general" /></CompanyManageRoute></Protected>} />
        <Route path="/questions/general/edit/:id" element={<Protected><CompanyManageRoute companyWide><EditQuestion type="general" /></CompanyManageRoute></Protected>} />
        <Route path="/questions/general/view/:id" element={<Protected><ViewQuestion type="general" /></Protected>} />

        <Route path="/appraisals" element={<Protected><Appraisals /></Protected>} />
        <Route path="/my-team-appraisals" element={<Protected><Appraisals ownTeamOnly /></Protected>} />
        <Route path="/appraisals/create" element={<Protected><AppraisalForm mode="create" /></Protected>} />
        <Route path="/appraisals/create/:staffUserId/:cycleId" element={<Protected><AppraisalForm mode="create" /></Protected>} />
        <Route path="/appraisals/edit/:id" element={<Protected><AppraisalForm mode="edit" /></Protected>} />
        <Route path="/appraisals/view/:id" element={<Protected><AppraisalView /></Protected>} />

        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/mail" element={<Protected><CompanyManageRoute><ManualEmail /></CompanyManageRoute></Protected>} />
        <Route path="/email-delivery" element={<Protected><EmailDeliverySettings /></Protected>} />
        <Route path="/audit-log" element={<Protected><AuditLog /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </AppErrorBoundary>
);

export default App;
