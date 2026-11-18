import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CircleAlert,
  Clock3,
  Plus,
  UserRound,
  Wallet,
  Workflow,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dataStore } from '../services/dataStore';
import { CalendarEvent, Task } from '../types';
import { getLocalDateISO } from '../utils/dates';
import { useQuickCreate } from '../components/layout/QuickCreateContext';

type PeriodFilter = '7d' | '30d' | 'month';

interface DashboardProps {
  onNavigate: (page: string, initialPrompt?: string, params?: Record<string, any>) => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatBRL = (value: number) => currency.format(value);
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

const getPeriodRange = (period: PeriodFilter, now: Date) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  if (period === '7d') start.setDate(today.getDate() - 6);
  if (period === '30d') start.setDate(today.getDate() - 29);
  if (period === 'month') start.setDate(1);
  return { start: getLocalDateISO(start), end: getLocalDateISO(today) };
};

const getPaidPeriodTotals = (transactions: ReturnType<typeof dataStore.getFinancialTransactions>, period: PeriodFilter, now: Date) => {
  const range = getPeriodRange(period, now);
  return transactions.reduce((totals, transaction) => {
    if (transaction.status !== 'pago') return totals;
    const paidDate = transaction.payment_date || transaction.due_date;
    if (paidDate < range.start || paidDate > range.end) return totals;
    totals[transaction.type] += transaction.amount;
    return totals;
  }, { receita: 0, despesa: 0 });
};

const Metric: React.FC<{
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, value, detail, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition-colors hover:border-brand-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/50 sm:p-5"
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">{icon}</span>
    </div>
    <p className="mt-4 break-words text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[1.75rem]">{value}</p>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
  </button>
);

const priorityWeight: Record<Task['priority'], number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const openQuickCreate = useQuickCreate();
  const [, setTick] = useState(0);
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const now = new Date();
  const today = getLocalDateISO(now);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndISO = getLocalDateISO(weekEnd);

  useEffect(() => dataStore.subscribe(() => setTick((tick) => tick + 1)), []);

  const metrics = dataStore.getDashboardMetrics();
  const activeOperations = dataStore.getProjects().filter((project) => project.status === 'em_andamento').length;
  const transactions = dataStore.getFinancialTransactions();
  const totals = getPaidPeriodTotals(transactions, period, now);
  const periodBalance = totals.receita - totals.despesa;
  const totalVolume = totals.receita + totals.despesa;
  const revenueWidth = totalVolume ? (totals.receita / totalVolume) * 100 : 0;
  const expenseWidth = totalVolume ? (totals.despesa / totalVolume) * 100 : 0;

  const upcomingEvents = dataStore.getCalendarEvents()
    .filter((event: CalendarEvent) => event.status !== 'cancelado'
      && event.event_date >= today && event.event_date <= weekEndISO
      && (event.event_date !== today || event.start_time >= `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`))
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time))
    .slice(0, 3);

  const priorityTasks = dataStore.getTasks()
    .filter((task: Task) => task.status !== 'concluido'
      && (task.due_date <= today || task.priority === 'urgente' || (task.priority === 'alta' && task.due_date <= weekEndISO)))
    .sort((a, b) => Number(a.due_date > today) - Number(b.due_date > today)
      || priorityWeight[a.priority] - priorityWeight[b.priority]
      || a.due_date.localeCompare(b.due_date))
    .slice(0, 3);

  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = user?.name?.split(' ')[0];
  const periodLabel: Record<PeriodFilter, string> = { '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', month: 'Este mês' };

  return (
    <div className="space-y-5 pb-8 sm:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{greeting}{firstName ? `, ${firstName}` : ''} · {dateLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Visão Geral</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <label htmlFor="dashboard-period" className="text-xs font-medium text-slate-500 dark:text-slate-400">Período financeiro</label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="month">Este mês</option>
          </select>
          <button
            type="button"
            onClick={() => onNavigate('ai-assistant')}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-500/30 px-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
          >
            <Bot className="h-4 w-4" />
            Perguntar ao Nexus AI
          </button>
        </div>
      </header>

      <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Saldo Financeiro" value={formatBRL(metrics.currentBalance)} detail="Acumulado · movimentações pagas" icon={<Wallet className="h-4 w-4" />} onClick={() => onNavigate('finance')} />
        <Metric label="Clientes Ativos" value={metrics.activeClients} detail="Ver carteira de clientes" icon={<UserRound className="h-4 w-4" />} onClick={() => onNavigate('clients')} />
        <Metric label="Operações em Andamento" value={activeOperations} detail="Acompanhar operações" icon={<Workflow className="h-4 w-4" />} onClick={() => onNavigate('projects')} />
        <Metric label="Tarefas Pendentes" value={metrics.pendingTasks} detail="Ver todas as tarefas" icon={<CheckSquare className="h-4 w-4" />} onClick={() => onNavigate('tasks')} />
      </section>

      <section aria-label="Ações rápidas" className="rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex items-center gap-2 px-1 pb-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Plus className="h-3.5 w-3.5 text-brand-500" /> Ações rápidas
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction icon={UserRound} label="Cadastrar cliente" onClick={() => openQuickCreate('client')} />
          <QuickAction icon={CheckSquare} label="Criar tarefa" onClick={() => openQuickCreate('task')} />
          <QuickAction icon={ArrowUpRight} label="Nova movimentação" onClick={() => openQuickCreate('revenue')} />
          <QuickAction icon={CalendarDays} label="Agendar reunião" onClick={() => openQuickCreate('event')} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5" aria-labelledby="finance-summary-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="finance-summary-heading" className="text-base font-semibold text-slate-900 dark:text-white">Resumo financeiro</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Movimentações pagas · {periodLabel[period]}</p>
            </div>
            <button type="button" onClick={() => onNavigate('finance')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Abrir financeiro <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
            <FinanceValue label="Receitas" value={formatBRL(totals.receita)} icon={<ArrowDownRight className="h-4 w-4" />} />
            <FinanceValue label="Despesas" value={formatBRL(totals.despesa)} icon={<ArrowUpRight className="h-4 w-4" />} />
            <FinanceValue label="Saldo do período" value={formatBRL(periodBalance)} icon={<Wallet className="h-4 w-4" />} emphasized />
          </div>

          <div className="mt-5" aria-label={`Composição das movimentações pagas: ${Math.round(revenueWidth)}% receitas, ${Math.round(expenseWidth)}% despesas`}>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="bg-brand-500 transition-[width]" style={{ width: `${revenueWidth}%` }} />
              <div className="bg-slate-400 dark:bg-slate-600 transition-[width]" style={{ width: `${expenseWidth}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Receitas e despesas do período</span>
              <span>{periodLabel[period]}</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5" aria-labelledby="priorities-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="priorities-heading" className="text-base font-semibold text-slate-900 dark:text-white">Agenda e prioridades</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Próximos compromissos e tarefas urgentes</p>
            </div>
            <button type="button" onClick={() => onNavigate('calendar')} aria-label="Abrir agenda" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-brand-400">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" /> Próximos compromissos
            </div>
            {upcomingEvents.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingEvents.map((event) => (
                  <li key={event.id}>
                    <button type="button" onClick={() => onNavigate('calendar')} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-brand-600 dark:hover:text-brand-400">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">{event.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{event.client_name ? `${event.client_name} · ` : ''}{event.event_date === today ? 'Hoje' : formatDate(event.event_date)}</span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{event.start_time}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">Nenhum compromisso nos próximos dias.</p>}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <CircleAlert className="h-3.5 w-3.5" /> Tarefas urgentes
            </div>
            {priorityTasks.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {priorityTasks.map((task) => {
                  const overdue = task.due_date < today;
                  return (
                    <li key={task.id}>
                      <button type="button" onClick={() => onNavigate('tasks')} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-brand-600 dark:hover:text-brand-400">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">{task.title}</span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Clock3 className="h-3 w-3" />{overdue ? `Atrasada · ${formatDate(task.due_date)}` : task.due_date === today ? 'Vence hoje' : `Vence ${formatDate(task.due_date)}`}</span>
                        </span>
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${overdue || task.priority === 'urgente' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'}`}>
                          {overdue ? 'Atrasada' : task.priority === 'urgente' ? 'Urgente' : 'Alta'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">Nenhuma tarefa urgente no momento.</p>}
            <button type="button" onClick={() => onNavigate('tasks')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Ver todas as tarefas <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const QuickAction: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
  <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-300 sm:px-3 sm:text-sm">
    <span className="shrink-0 text-brand-600 dark:text-brand-400"><Icon className="h-4 w-4" /></span>
    <span className="min-w-0 truncate">{label}</span>
  </button>
);

const FinanceValue: React.FC<{ label: string; value: string; icon: React.ReactNode; emphasized?: boolean }> = ({ label, value, icon, emphasized = false }) => (
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className={emphasized ? 'text-brand-500' : ''}>{icon}</span>{label}
    </div>
    <p className={`mt-1 break-words text-lg font-semibold tracking-tight ${emphasized ? 'text-slate-950 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{value}</p>
  </div>
);
