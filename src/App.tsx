import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Layout } from './components/layout/Layout';
import { QuickCreateTab } from './components/layout/QuickCreateModal';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Projects } from './pages/Projects';
import { Tasks } from './pages/Tasks';
import { Calendar } from './pages/Calendar';
import { Financial } from './pages/Financial';
import { Documents } from './pages/Documents';
import { AIAssistant } from './pages/AIAssistant';
import { Reports } from './pages/Reports';
import { Architecture } from './pages/Architecture';
import { Settings } from './pages/Settings';

import { LandingPage } from './pages/LandingPage';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const wasAuthenticated = useRef(false);
  const [authView, setAuthView] = useState<'login' | 'register' | 'landing'>('login');
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [navParams, setNavParams] = useState<Record<string, any> | undefined>(undefined);

  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current) {
      setAuthView('login');
      setCurrentPage('dashboard');
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

  // If not authenticated, render LandingPage, Login or Register
  if (!isAuthenticated) {
    if (authView === 'landing') {
      return (
        <LandingPage
          onLoginClick={() => setAuthView('login')}
          onRegisterClick={() => setAuthView('register')}
        />
      );
    }
    if (authView === 'register') {
      return (
        <Register
          onNavigateToLogin={() => setAuthView('login')}
          onSuccess={() => setCurrentPage('dashboard')}
        />
      );
    }
    return (
      <Login
        onNavigateToRegister={() => setAuthView('register')}
        onNavigateToLanding={() => setAuthView('landing')}
        onSuccess={() => setCurrentPage('dashboard')}
      />
    );
  }

  // Render main application layout
  return (
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
