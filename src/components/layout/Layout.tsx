import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { QuickCreateModal, QuickCreateTab } from './QuickCreateModal';
import { CommandSearchModal } from './CommandSearchModal';
import { QuickCreateContext } from './QuickCreateContext';

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: string, prompt?: string, params?: Record<string, any>) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentPage,
  onNavigate,
  children,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateDefaultTab, setQuickCreateDefaultTab] = useState<QuickCreateTab>('client');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleOpenQuickCreate = useCallback((tab?: QuickCreateTab) => {
    if (tab) setQuickCreateDefaultTab(tab);
    setIsQuickCreateOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => setIsSearchOpen(false), []);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const quickCreateTabByPage: Partial<Record<string, QuickCreateTab>> = {
    clients: 'client',
    projects: 'project',
    tasks: 'task',
    calendar: 'event',
    finance: 'revenue',
  };

  return (
    <QuickCreateContext.Provider value={handleOpenQuickCreate}>
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <Topbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenQuickCreate={() => handleOpenQuickCreate(quickCreateTabByPage[currentPage] || 'client')}
          onOpenSearch={() => setIsSearchOpen(true)}
          onNavigate={onNavigate}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </main>
      </div>

      {/* Quick Create Modal */}
      <QuickCreateModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        defaultTab={quickCreateDefaultTab}
      />

      {/* Command Search Modal (Ctrl+K) */}
      <CommandSearchModal
        isOpen={isSearchOpen}
        onClose={handleCloseSearch}
        onNavigate={onNavigate}
      />
    </div>
    </QuickCreateContext.Provider>
  );
};
