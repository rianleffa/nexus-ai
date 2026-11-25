import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { RetryableLazy } from './components/common/RetryableLazy';

type PageLoader = () => Promise<React.ComponentType<any>>;
const loadLayout: PageLoader = async () => (await import('./components/layout/Layout')).Layout;
const loadLogin: PageLoader = async () => (await import('./pages/Login')).Login;
const loadRegister: PageLoader = async () => (await import('./pages/Register')).Register;
const loadDashboard: PageLoader = async () => (await import('./pages/DashboardOverview')).Dashboard;
const loadClients: PageLoader = async () => (await import('./pages/Clients')).Clients;
const loadProjects: PageLoader = async () => (await import('./pages/Projects')).Projects;
const loadTasks: PageLoader = async () => (await import('./pages/Tasks')).Tasks;
const loadCalendar: PageLoader = async () => (await import('./pages/Calendar')).Calendar;
const loadFinancial: PageLoader = async () => (await import('./pages/Financial')).Financial;
const loadDocuments: PageLoader = async () => (await import('./pages/Documents')).Documents;
const loadAIAssistant: PageLoader = async () => (await import('./pages/AIAssistant')).AIAssistant;
const loadReports: PageLoader = async () => (await import('./pages/Reports')).Reports;
const loadArchitecture: PageLoader = async () => (await import('./pages/Architecture')).Architecture;
const loadSettings: PageLoader = async () => (await import('./pages/Settings')).Settings;
const loadPasswordRecovery: PageLoader = async () => (await import('./pages/PasswordRecovery')).PasswordRecovery;
const loadLandingPage: PageLoader = async () => (await import('./pages/LandingPage')).LandingPage;

const pagePaths: Record<string, string> = {
  dashboard: '/dashboard', clients: '/clients', projects: '/operations', tasks: '/tasks',
  calendar: '/calendar', finance: '/finance', documents: '/documents',
  'ai-assistant': '/assistant', reports: '/reports', architecture: '/architecture', settings: '/settings',
};
const pageFromPath = (pathname: string) =>
  Object.entries(pagePaths).find(([, path]) => path === pathname.replace(/\/$/, '') || path === pathname)?.[0] || 'dashboard';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const wasAuthenticated = useRef(false);
  const authInitialized = useRef(false);
  const [authView, setAuthView] = useState<'login' | 'register' | 'landing'>('login');
  const [currentPage, setCurrentPage] = useState<string>(() => pageFromPath(window.location.pathname));
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [navParams, setNavParams] = useState<Record<string, any> | undefined>(() => window.history.state?.navParams);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() =>
    new URLSearchParams(window.location.search).get('auth') === 'recovery'
  );

  const returnToLogin = () => {
    const query = new URLSearchParams(window.location.search);
    query.delete('auth');
    const nextUrl = `/${query.size ? `?${query}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
    setIsPasswordRecovery(false);
    setAuthView('login');
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      setCurrentPage(event.state?.page || pageFromPath(window.location.pathname));
      setNavParams(event.state?.navParams);
      setAiInitialPrompt(event.state?.aiInitialPrompt);
      setIsPasswordRecovery(new URLSearchParams(window.location.search).get('auth') === 'recovery');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!authInitialized.current) {
      authInitialized.current = true;
      wasAuthenticated.current = isAuthenticated;
      return;
    }
    if (isAuthenticated && !wasAuthenticated.current) {
      setAuthView('login');
      setCurrentPage('dashboard');
      window.history.replaceState({ page: 'dashboard' }, '', pagePaths.dashboard);
    } else if (!isAuthenticated && wasAuthenticated.current) {
      setAuthView('login');
      window.history.replaceState(null, '', '/');
    }
    if (isAuthenticated && new URLSearchParams(window.location.search).get('auth') === 'confirmed') {
      const query = new URLSearchParams(window.location.search);
      query.delete('auth');
      const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, isLoading]);

  const navigateTo = (page: string, prompt?: string, params?: Record<string, any>) => {
    const nextPage = pagePaths[page] ? page : 'dashboard';
    const nextPrompt = prompt || aiInitialPrompt;
    const nextUrl = pagePaths[nextPage];
    const nextParams = nextPage === 'ai-assistant'
      ? { ...(params || {}), sourcePage: currentPage }
      : params;
    const nextState = { page: nextPage, navParams: nextParams, aiInitialPrompt: nextPrompt };
    if (window.location.pathname !== nextUrl) {
      window.history.pushState(nextState, '', nextUrl);
    } else {
      window.history.replaceState(nextState, '', nextUrl);
    }
    setCurrentPage(nextPage);
    if (prompt) {
      setAiInitialPrompt(prompt);
    }
    if (nextParams) {
      setNavParams(nextParams);
    } else {
      setNavParams(undefined);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-3 text-sm" role="status" aria-live="polite">
          <span className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-brand-400 animate-spin" />
          Verificando sessão...
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <RetryableLazy load={loadPasswordRecovery} componentProps={{ onBackToLogin: returnToLogin }} />;
  }

  // If not authenticated, render LandingPage, Login or Register
  if (!isAuthenticated) {
    if (authView === 'landing') {
      return <RetryableLazy load={loadLandingPage} componentProps={{ onLoginClick: () => setAuthView('login'), onRegisterClick: () => setAuthView('register') }} />;
    }
    if (authView === 'register') {
      return <RetryableLazy load={loadRegister} componentProps={{ onNavigateToLogin: () => setAuthView('login'), onSuccess: () => navigateTo('dashboard') }} />;
    }
    return <RetryableLazy load={loadLogin} componentProps={{ onNavigateToRegister: () => setAuthView('register'), onNavigateToLanding: () => setAuthView('landing'), onSuccess: () => navigateTo('dashboard') }} />;
  }

  // Render main application layout
  const pageLoaders: Record<string, PageLoader> = {
    dashboard: loadDashboard, clients: loadClients, projects: loadProjects, tasks: loadTasks,
    calendar: loadCalendar, finance: loadFinancial, documents: loadDocuments,
    'ai-assistant': loadAIAssistant, reports: loadReports, architecture: loadArchitecture, settings: loadSettings,
  };
  const pageProps: Record<string, Record<string, unknown>> = {
    dashboard: { onNavigate: navigateTo },
    clients: { initialClientId: navParams?.clientId, initialFilter: navParams?.filter, onNavigate: navigateTo },
    projects: { initialProjectId: navParams?.projectId, initialFilter: navParams?.filter, onNavigate: navigateTo },
    tasks: { initialFilter: navParams?.filter, initialTaskId: navParams?.taskId, onNavigate: navigateTo },
    calendar: { initialEventId: navParams?.eventId, onNavigate: navigateTo },
    finance: { initialType: navParams?.filter, onNavigate: navigateTo },
    documents: { onNavigate: navigateTo },
    'ai-assistant': { initialPrompt: aiInitialPrompt, initialContextPage: navParams?.sourcePage, onNavigate: navigateTo },
    reports: {}, architecture: {}, settings: {},
  };
  const page = pagePaths[currentPage] ? currentPage : 'dashboard';

  return (
    <RetryableLazy
      load={loadLayout}
      componentProps={{
        currentPage: page,
        onNavigate: navigateTo,
        children: <RetryableLazy key={`${page}:${JSON.stringify(navParams || {})}`} load={pageLoaders[page]} componentProps={pageProps[page]} />,
      }}
    />
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
