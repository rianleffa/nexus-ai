import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Search,
  Filter,
  Kanban,
  List,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  CheckCircle2,
  Tag,
  ArrowRight,
  FolderKanban,
  Users,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TaskPriorityBadge, TaskStatusBadge } from '../components/ui/Badge';
import { dataStore } from '../services/dataStore';
import { Task, TaskPriority, TaskStatus } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { getLocalDateISO } from '../utils/dates';

interface TasksProps {
  initialFilter?: string;
  onNavigate?: (page: string, prompt?: string, params?: Record<string, any>) => void;
}

export const Tasks: React.FC<TasksProps> = ({
  initialFilter,
  onNavigate,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const { showToast } = useNotification();


  const refresh = () => setTasks(dataStore.getTasks());

  useEffect(() => {
    refresh();
    const unsub = dataStore.subscribe(refresh);
    return unsub;
  }, []);

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    dataStore.updateTask(taskId, { status: newStatus });
    showToast(`Status atualizado para ${newStatus.replace('_', ' ')}!`, 'info');
  };

  const handleToggleComplete = (task: Task) => {
    if (task.status === 'concluido') {
      dataStore.updateTask(task.id, { status: 'a_fazer' });
      showToast('Tarefa reaberta.', 'info');
    } else {
      dataStore.completeTask(task.id);
      showToast(`Tarefa "${task.title}" concluída!`, 'success');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir esta tarefa?')) {
      dataStore.deleteTask(id);
      showToast('Tarefa excluída.', 'info');
    }
  };

  const todayStr = getLocalDateISO();

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.project_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = t.status !== 'concluido';
    } else if (statusFilter === 'overdue') {
      matchesStatus = t.status !== 'concluido' && t.due_date < todayStr;
    } else if (statusFilter === 'completed') {
      matchesStatus = t.status === 'concluido';
    }

    return matchesSearch && matchesPriority && matchesStatus;
  });

  const columns: { id: TaskStatus; title: string; color: string }[] = [
    { id: 'backlog', title: 'BACKLOG', color: 'border-t-slate-400' },
    { id: 'a_fazer', title: 'A FAZER', color: 'border-t-amber-500' },
    { id: 'em_andamento', title: 'EM ANDAMENTO', color: 'border-t-blue-500' },
    { id: 'concluido', title: 'CONCLUÍDO', color: 'border-t-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tarefas & Atividades
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerenciamento conectado de entregas com vínculos diretos a Clientes e Projetos
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

        </div>
      </div>

      {/* Search & Priority Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, projeto ou cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto text-xs">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
            {(['all', 'pending', 'overdue', 'completed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st === 'all' ? 'Todas' : st === 'pending' ? 'Pendentes' : st === 'overdue' ? 'Atrasadas' : 'Concluídas'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
            {(['all', 'urgente', 'alta', 'media', 'baixa'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-all ${
                  priorityFilter === p
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {p === 'all' ? 'Prioridades' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className={`bg-slate-100/70 dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 space-y-3 border-t-4 ${col.color}`}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">
                    {col.title}
                  </span>
                  <span className="text-xs font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full shadow-xs border border-slate-200/60 dark:border-slate-700">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 min-h-[350px]">
                  {colTasks.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-800/60 rounded-xl flex items-center justify-center text-[11px] text-slate-400">
                      Nenhuma tarefa
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isOverdue = task.status !== 'concluido' && task.due_date < todayStr;

                      return (
                        <Card
                          key={task.id}
                          className={`p-3.5 space-y-2.5 bg-white dark:bg-[#111827] shadow-sm hover:shadow-md transition-all group ${
                            isOverdue ? 'ring-1 ring-rose-500/40' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <TaskPriorityBadge priority={task.priority} />
                              {isOverdue && (
                                <span className="text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded">
                                  Atrasada
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {task.title}
                          </h4>

                          {task.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {task.due_date}
                            </span>
                            {(task.client_name || task.project_name) && (
                              <span className="truncate max-w-[120px] font-medium text-slate-600 dark:text-slate-300">
                                {task.project_name || task.client_name}
                              </span>
                            )}
                          </div>

                          {/* Column Quick Mover */}
                          <div className="pt-1 flex items-center justify-between gap-1">
                            <select
                              value={task.status}
                              onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                              className="w-full text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none"
                            >
                              <option value="backlog">Mover: Backlog</option>
                              <option value="a_fazer">Mover: A Fazer</option>
                              <option value="em_andamento">Mover: Em Andamento</option>
                              <option value="concluido">Mover: Concluído</option>
                            </select>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5 w-10"></th>
                  <th className="px-5 py-3.5">Título da Tarefa</th>
                  <th className="px-5 py-3.5">Projeto / Cliente</th>
                  <th className="px-5 py-3.5">Prioridade</th>
                  <th className="px-5 py-3.5">Prazo</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={task.status === 'concluido'}
                        onChange={() => handleToggleComplete(task)}
                        className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      <span className={task.status === 'concluido' ? 'line-through text-slate-400' : ''}>
                        {task.title}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {task.project_name || task.client_name || 'Geral'}
                    </td>
                    <td className="px-5 py-3.5">
                      <TaskPriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {task.due_date}
                    </td>
                    <td className="px-5 py-3.5">
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
};
