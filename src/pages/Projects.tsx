import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  ArrowLeft,
  CheckSquare,
  FileText,
  Search,
  ExternalLink,
  Tag,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProjectStatusBadge, TaskPriorityBadge, Badge } from '../components/ui/Badge';
import { dataStore } from '../services/dataStore';
import { Project, ProjectStatus } from '../types';
import { useNotification } from '../contexts/NotificationContext';

interface ProjectsProps {
  initialProjectId?: string;
  onNavigate?: (page: string, prompt?: string, params?: Record<string, any>) => void;
}

export const Projects: React.FC<ProjectsProps> = ({
  initialProjectId,
  onNavigate,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const { showToast } = useNotification();


  const refresh = () => {
    const list = dataStore.getProjects();
    setProjects(list);
    if (initialProjectId && !selectedProject) {
      const found = list.find((p) => p.id === initialProjectId);
      if (found) setSelectedProject(found);
    }
  };

  useEffect(() => {
    refresh();
    const unsub = dataStore.subscribe(refresh);
    return unsub;
  }, [initialProjectId]);

  const filteredProjects = projects.filter(
    (p) => statusFilter === 'all' || p.status === statusFilter
  );

  // Connected entities for selected project (360 View)
  const projectTasks = selectedProject
    ? dataStore.getTasks().filter((t) => t.project_id === selectedProject.id || t.project_name === selectedProject.name)
    : [];

  const projectEvents = selectedProject
    ? dataStore.getCalendarEvents().filter((e) => selectedProject.client_id
      ? e.client_id === selectedProject.client_id
      : Boolean(selectedProject.client_name && e.client_name === selectedProject.client_name))
    : [];

  const projectFinancial = selectedProject
    ? dataStore.getProjectFinancialSummary(selectedProject.id)
    : { budget: 0, totalRevenue: 0, totalExpenses: 0, netMargin: 0 };

  const projectDocuments = selectedProject
    ? dataStore.getDocuments().filter((d) => d.client_id === selectedProject.client_id || (selectedProject.client_name && d.client_name === selectedProject.client_name))
    : [];

  return (
    <div className="space-y-6">
      {selectedProject ? (
        /* VISÃO 360° DO PROJETO */
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={() => setSelectedProject(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para todos os projetos</span>
            </button>
            <div className="flex items-center gap-2">
              <ProjectStatusBadge status={selectedProject.status} />
            </div>
          </div>

          <Card className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedProject.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cliente Vinculado:{' '}
                  {selectedProject.client_id && onNavigate ? (
                    <button
                      onClick={() => onNavigate('clients', undefined, { clientId: selectedProject.client_id })}
                      className="font-bold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{selectedProject.client_name || 'Projeto interno'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {selectedProject.client_name || 'Projeto interno'}
                    </span>
                  )}
                  {' • '}Início: {selectedProject.start_date} • Prazo final: {selectedProject.due_date}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-bold tracking-wider">
                  Orçamento Previsto
                </span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                  R$ {selectedProject.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
              {selectedProject.description}
            </p>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Progresso Geral das Entregas</span>
                <span className="text-brand-600 dark:text-brand-400 font-bold">{selectedProject.progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${selectedProject.progress}%` }}
                  className="h-full bg-gradient-to-r from-brand-600 to-emerald-400 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </Card>

          {/* Project Relations Grid: Tasks & Meetings & Documents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Associated Project Tasks */}
            <Card className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-brand-500" />
                  <span>Tarefas do Projeto ({projectTasks.length})</span>
                </h3>
              </div>

              {projectTasks.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhuma tarefa cadastrada para este projeto.</p>
              ) : (
                <div className="space-y-2">
                  {projectTasks.map((t) => (
                    <div key={t.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{t.title}</p>
                        <span className="text-[11px] text-slate-400">Prazo: {t.due_date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TaskPriorityBadge priority={t.priority} />
                        <Badge variant={t.status === 'concluido' ? 'success' : 'warning'}>{t.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 2. Connected Meetings */}
            <Card className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-500" />
                  <span>Reuniões & Alinhamentos ({projectEvents.length})</span>
                </h3>
              </div>

              {projectEvents.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhum compromisso agendado para este projeto.</p>
              ) : (
                <div className="space-y-2">
                  {projectEvents.map((e) => (
                    <div key={e.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{e.title}</p>
                        <span className="text-[11px] text-slate-400">{e.event_date} às {e.start_time} • {e.location}</span>
                      </div>
                      <Badge variant="info">{e.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        /* Projects List */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Projetos & Entregas
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanhe o andamento de contratos, orçamentos e marcos operacionais
              </p>
            </div>

          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl self-start text-xs">
            {(['all', 'planejamento', 'em_andamento', 'pausado', 'concluido'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg font-medium capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st === 'all' ? 'Todos' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Project Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                hoverable
                onClick={() => setSelectedProject(project)}
                className="cursor-pointer space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white hover:text-brand-500 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {project.client_name || 'Projeto interno'}
                    </p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>Progresso</span>
                    <span className="text-slate-800 dark:text-slate-200">{project.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${project.progress}%` }}
                      className="h-full bg-brand-500 rounded-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Prazo: {project.due_date}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    R$ {project.budget.toLocaleString('pt-BR')}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

    </div>
  );
};
