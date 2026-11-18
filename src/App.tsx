import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
const Layout = lazy(() => import('./components/layout/Layout').then((module) => ({ default: module.Layout })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then((module) => ({ default: module.Register })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Clients = lazy(() => import('./pages/Clients').then((module) => ({ default: module.Clients })));
const Projects = lazy(() => import('./pages/Projects').then((module) => ({ default: module.Projects })));
const Tasks = lazy(() => import('./pages/Tasks').then((module) => ({ default: module.Tasks })));
const Calendar = lazy(() => import('./pages/Calendar').then((module) => ({ default: module.Calendar })));
const Financial = lazy(() => import('./pages/Financial').then((module) => ({ default: module.Financial })));
const Documents = lazy(() => import('./pages/Documents').then((module) => ({ default: module.Documents })));
const AIAssistant = lazy(() => import('./pages/AIAssistant').then((module) => ({ default: module.AIAssistant })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));
const Architecture = lazy(() => import('./pages/Architecture').then((module) => ({ default: module.Architecture })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const PasswordRecovery = lazy(() => import('./pages/PasswordRecovery').then((module) => ({ default: module.PasswordRecovery })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));

const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700" role="status" aria-live="polite">
    Carregando página…
  </div>
);

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const wasAuthenticated = useRef(false);
  const [authView, setAuthView] = useState<'login' | 'register' | 'landing'>('login');
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [navParams, setNavParams] = useState<Record<string, any> | undefined>(undefined);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() =>
    new URLSearchParams(window.location.search).get('auth') === 'recovery'
  );

  const returnToLogin = () => {
    const query = new URLSearchParams(window.location.search);
    query.delete('auth');
    const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
    setIsPasswordRecovery(false);
    setAuthView('login');
  };

  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current) {
      setAuthView('login');
      setCurrentPage('dashboard');
    }
    if (isAuthenticated && new URLSearchParams(window.location.search).get('auth') === 'confirmed') {
      const query = new URLSearchParams(window.location.search);
      query.delete('auth');
      const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  const navigateTo = (page: string, prompt?: string, params?: Record<string, any>) => {
    setCurrentPage(page);
    if (prompt) {
      setAiInitialPrompt(prompt);
    }
    if (params) {
      setNavParams(params);
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
    return <Suspense fallback={<PageLoading />}><PasswordRecovery onBackToLogin={returnToLogin} /></Suspense>;
  }

  // If not authenticated, render LandingPage, Login or Register
  if (!isAuthenticated) {
    if (authView === 'landing') {
      return (
        <Suspense fallback={<PageLoading />}>
        <LandingPage
          onLoginClick={() => setAuthView('login')}
          onRegisterClick={() => setAuthView('register')}
        />
        </Suspense>
      );
    }
    if (authView === 'register') {
      return (
        <Suspense fallback={<PageLoading />}>
        <Register
          onNavigateToLogin={() => setAuthView('login')}
          onSuccess={() => setCurrentPage('dashboard')}
        />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<PageLoading />}>
      <Login
        onNavigateToRegister={() => setAuthView('register')}
        onNavigateToLanding={() => setAuthView('landing')}
        onSuccess={() => setCurrentPage('dashboard')}
      />
      </Suspense>
    );
  }

  // Render main application layout
  return (
    <Suspense fallback={<PageLoading />}>
    <Layout currentPage={currentPage} onNavigate={navigateTo}>
      {currentPage === 'dashboard' && (
        <Dashboard
          onNavigate={navigateTo}
        />
      )}
      {currentPage === 'clients' && (
        <Clients
          initialClientId={navParams?.clientId}
          onNavigate={navigateTo}
        />
      )}
      {currentPage === 'projects' && (
        <Projects
          initialProjectId={navParams?.projectId}
          onNavigate={navigateTo}
        />
      )}
      {currentPage === 'tasks' && (
        <Tasks
          initialFilter={navParams?.filter}
          onNavigate={navigateTo}
        />
      )}
      {currentPage === 'calendar' && <Calendar onNavigate={navigateTo} />}
      {currentPage === 'finance' && (
        <Financial
          initialType={navParams?.filter as any}
          onNavigate={navigateTo}
        />
      )}
      {currentPage === 'documents' && <Documents onNavigate={navigateTo} />}
      {currentPage === 'ai-assistant' && (
        <AIAssistant
          initialPrompt={aiInitialPrompt}
          onNavigate={navigateTo}
        />
      )}
      {currentPage === 'reports' && <Reports />}
      {currentPage === 'architecture' && <Architecture />}
      {currentPage === 'settings' && <Settings />}
    </Layout>
    </Suspense>
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
