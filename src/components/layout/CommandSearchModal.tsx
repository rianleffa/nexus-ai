import React, { useState, useEffect } from 'react';
import { Search, X, Users, CheckSquare, Calendar, DollarSign, ArrowRight, FolderKanban } from 'lucide-react';
import { dataStore } from '../../services/dataStore';

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export const CommandSearchModal: React.FC<CommandSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Toggle from parent or open
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();
  const clients = dataStore.getClients().filter(
    (c) => c.name.toLowerCase().includes(q) || c.company_name.toLowerCase().includes(q)
  );
  const tasks = dataStore.getTasks().filter(
    (t) => t.title.toLowerCase().includes(q)
  );
  const projects = dataStore.getProjects().filter(
    (p) => p.name.toLowerCase().includes(q)
  );
  const events = dataStore.getCalendarEvents().filter(
    (e) => e.title.toLowerCase().includes(q)
  );

  const hasResults = clients.length > 0 || tasks.length > 0 || projects.length > 0 || events.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-20">
        <div className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 transition-all animate-in zoom-in-95">
          {/* Search bar */}
          <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar clientes, tarefas, projetos ou compromissos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none text-sm"
            />
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-slate-400">
              ESC
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results Area */}
          <div className="max-h-96 overflow-y-auto p-3 space-y-4">
            {!query && (
              <div className="py-8 text-center text-xs text-slate-400">
                Digite um termo para pesquisar instantaneamente em toda a empresa.
              </div>
            )}

            {query && !hasResults && (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Nenhum resultado encontrado para "{query}".
              </div>
            )}

            {/* Clients */}
            {clients.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Clientes ({clients.length})
                </div>
                <div className="space-y-1">
                  {clients.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onNavigate('clients');
                        onClose();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer text-xs group transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-500">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{c.company_name} • {c.email}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" /> Tarefas ({tasks.length})
                </div>
                <div className="space-y-1">
                  {tasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        onNavigate('tasks');
                        onClose();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer text-xs group transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-500">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-slate-500">Prazo: {t.due_date} • Prioridade: {t.priority}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {projects.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5" /> Projetos ({projects.length})
                </div>
                <div className="space-y-1">
                  {projects.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        onNavigate('projects');
                        onClose();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer text-xs group transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-500">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-500">Progresso: {p.progress}% • Status: {p.status}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {events.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Compromissos ({events.length})
                </div>
                <div className="space-y-1">
                  {events.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      onClick={() => {
                        onNavigate('calendar');
                        onClose();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer text-xs group transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-500">
                          {e.title}
                        </div>
                        <div className="text-[11px] text-slate-500">Data: {e.event_date} às {e.start_time}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
