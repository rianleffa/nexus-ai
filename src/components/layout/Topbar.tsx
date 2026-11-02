import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Plus,
  Moon,
  Sun,
  Menu,
  Check,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { dataStore } from '../../services/dataStore';
import { Button } from '../ui/Button';
import { UserAvatar } from '../common/UserAvatar';

interface TopbarProps {
  onOpenMobileSidebar: () => void;
  onOpenQuickCreate: () => void;
  onOpenSearch: () => void;
  onNavigate: (page: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileSidebar,
  onOpenQuickCreate,
  onOpenSearch,
  onNavigate,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [, setDataVersion] = useState(0);
  const notifications = dataStore.getNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => dataStore.subscribe(() => setDataVersion((version) => version + 1)), []);

  const handleNotificationClick = (id: string, link?: string) => {
    dataStore.markNotificationAsRead(id);
    setShowNotifications(false);
    if (link) {
      const page = link.replace('/', '');
      onNavigate(page);
    }
  };

  return (
    <header className="h-16 bg-white/80 dark:bg-[#0E1420]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Toggle & Global Search Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Abrir menu"
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          aria-label="Buscar no sistema"
          className="flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:border-brand-500/50 hover:text-slate-700 dark:hover:text-slate-200 transition-all text-xs w-9 sm:w-64 md:w-80 group shadow-xs"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
          <span className="hidden sm:inline truncate">Buscar clientes, tarefas...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Ações globais, tema, notificações e perfil */}
      <div className="flex items-center gap-2.5">
        {/* Quick Create Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenQuickCreate}
          leftIcon={<Plus className="w-4 h-4" />}
          aria-label="Criar novo registro"
          className="shadow-sm hover:shadow-glow px-2 sm:px-3"
        >
          <span className="hidden sm:inline">Novo</span>
        </Button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ''}`}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      Notificações
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                        {unreadCount} nova(s)
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && <button
                    onClick={() => dataStore.markAllNotificationsAsRead()}
                    className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
                  >Marcar lidas</button>}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Você não tem notificações.</p>
                  ) : notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif.id, notif.link)}
                      className={`p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        notif.read
                          ? 'opacity-60 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(notif.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {notif.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => onNavigate('settings')}
          aria-label="Abrir perfil e configurações"
          className="pl-1.5 border-l border-slate-200 dark:border-slate-800 flex items-center gap-2 text-left"
        >
          <UserAvatar name={user?.name || 'Usuário'} avatarUrl={user?.avatar_url} size="sm" />
          <div className="hidden sm:block max-w-28">
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight truncate">{user?.name || 'Usuário'}</p>
            <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">{user?.job_title || 'Conta'}</p>
          </div>
        </button>      </div>
    </header>
  );
};
