import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Plus,
  Building2,
  FolderKanban,
  FileText,
  DollarSign,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { dataStore } from '../services/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { FinancialTransaction, MyDayItem } from '../types';
import { isSupabaseConfigured } from '../services/supabase';
import { getLocalDateISO } from '../utils/dates';

interface DashboardProps {
  onNavigate: (page: string, initialPrompt?: string, params?: Record<string, any>) => void;
}

type ChartPeriod = '7d' | '30d' | 'month';

const getFinancialChartData = (transactions: FinancialTransaction[], period: ChartPeriod, now: Date) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const buckets: { label: string; start: string; end: string; receita: number; despesa: number }[] = [];

  if (period === '7d') {
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(start);
      date.setDate(start.getDate() - offset);
      const dateISO = getLocalDateISO(date);
      buckets.push({
        label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        start: dateISO,
        end: dateISO,
        receita: 0,
        despesa: 0,
      });
    }
  } else if (period === '30d') {
    const rangeStart = new Date(start);
    rangeStart.setDate(start.getDate() - 29);
    for (let index = 0; index < 5; index++) {
      const bucketStart = new Date(rangeStart);
      bucketStart.setDate(rangeStart.getDate() + index * 7);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketStart.getDate() + 6);
      if (bucketEnd > start) bucketEnd.setTime(start.getTime());
      if (bucketStart > start) continue;
      buckets.push({
        label: `${bucketStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}–${bucketEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
        start: getLocalDateISO(bucketStart),
        end: getLocalDateISO(bucketEnd),
        receita: 0,
        despesa: 0,
      });
    }
  } else {
    for (let index = 0; index < 5; index++) {
      const bucketStart = new Date(now.getFullYear(), now.getMonth(), index * 7 + 1);
      if (bucketStart > start) break;
      const bucketEnd = new Date(now.getFullYear(), now.getMonth(), Math.min(index * 7 + 7, start.getDate()));
      buckets.push({
        label: `${String(bucketStart.getDate()).padStart(2, '0')}–${String(bucketEnd.getDate()).padStart(2, '0')}`,
        start: getLocalDateISO(bucketStart),
        end: getLocalDateISO(bucketEnd),
        receita: 0,
        despesa: 0,
      });
    }
  }

  const rangeStart = buckets[0]?.start;
  const rangeEnd = buckets[buckets.length - 1]?.end;
  transactions.forEach((transaction) => {
    if (transaction.status !== 'pago') return;
    const paidDate = transaction.payment_date || transaction.due_date;
    if (!rangeStart || !rangeEnd || paidDate < rangeStart || paidDate > rangeEnd) return;
    const bucket = buckets.find((item) => paidDate >= item.start && paidDate <= item.end);
    if (bucket) bucket[transaction.type] += transaction.amount;
  });
  return buckets;
};

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
}) => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [, setTick] = useState(0);

  // Subscribe to reactive dataStore changes
  useEffect(() => {
    const unsub = dataStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const metrics = dataStore.getDashboardMetrics();
  const tasks = dataStore.getTasks();
  const projects = dataStore.getProjects();
  const documents = dataStore.getDocuments();
  const activities = dataStore.getActivities();
  const myDayItems = dataStore.getMyDayTimeline();
  const clientsInAlert = dataStore.getClientsNeedingAttention();
  const financialTransactions = dataStore.getFinancialTransactions();

  // Tasks breakdown
  const today = new Date();
  const todayStr = getLocalDateISO(today);
  const overdueTasks = tasks.filter((t) => t.status !== 'concluido' && t.due_date < todayStr);
  const todayTasks = tasks.filter((t) => t.status !== 'concluido' && t.due_date === todayStr);

  // Financial Chart period toggle
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const chartData = getFinancialChartData(financialTransactions, chartPeriod, today);
  const chartMax = Math.max(0, ...chartData.flatMap((item) => [item.receita, item.despesa]));
  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleToggleTaskComplete = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const completed = dataStore.completeTask(taskId);
    if (completed) {
      showToast(`Tarefa "${completed.title}" marcada como concluída!`, 'success');
    }
  };

  const handleMyDayItemClick = (item: MyDayItem) => {
    if (item.actionType === 'navigate_task') {
      onNavigate('tasks');
    } else if (item.actionType === 'navigate_calendar') {
      onNavigate('calendar');
    } else if (item.actionType === 'navigate_finance') {
      onNavigate('finance');
    } else if (item.actionType === 'navigate_client' && item.client_id) {
      onNavigate('clients', undefined, { clientId: item.client_id });
    }
  };

  const quickPrompts = [
    'O que tenho para fazer hoje?',
    'Quais clientes precisam de acompanhamento?',
    'Quanto recebi este mês?',
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Operacional — Centro de Operações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 uppercase tracking-wide">
              Centro de Operações
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Você tem <strong className="text-slate-800 dark:text-slate-200">{metrics.todayAppointments} compromissos hoje</strong>,{' '}
            <strong className="text-slate-800 dark:text-slate-200">{todayTasks.length} entregas para hoje</strong> e{' '}
            {overdueTasks.length > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold">{overdueTasks.length} tarefa(s) atrasada(s)</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">suas tarefas estão em dia</span>
            )}.
          </p>
        </div>

      </div>

      {/* 6 Metric KPI Cards (Totalmente Clicáveis e Conectados) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <MetricCard
          title="Clientes Ativos"
          value={metrics.activeClients}
          subtitle="Clientes com status ativo"
          trend="neutral"
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          onClick={() => onNavigate('clients')}
        />
        <MetricCard
          title="Tarefas Pendentes"
          value={metrics.pendingTasks}
          subtitle={`${overdueTasks.length} atrasada(s)`}
          trend={overdueTasks.length > 0 ? 'down' : 'neutral'}
          icon={<CheckSquare className="w-5 h-5" />}
          iconBg="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          onClick={() => onNavigate('tasks')}
        />
        <MetricCard
          title="Compromissos Hoje"
          value={metrics.todayAppointments}
          subtitle="Ver agenda do dia"
          trend="neutral"
          icon={<Calendar className="w-5 h-5" />}
          iconBg="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          onClick={() => onNavigate('calendar')}
        />
        <MetricCard
          title="Recebido no Mês"
          value={formatBRL(metrics.monthRevenue)}
          subtitle="Movimentações pagas"
          trend="neutral"
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          onClick={() => onNavigate('finance', undefined, { filter: 'receita' })}
        />
        <MetricCard
          title="Pago no Mês"
          value={formatBRL(metrics.monthExpenses)}
          subtitle="Despesas registradas como pagas"
          trend="neutral"
          icon={<TrendingDown className="w-5 h-5" />}
          iconBg="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          onClick={() => onNavigate('finance', undefined, { filter: 'despesa' })}
        />
        <MetricCard
          title="Saldo Acumulado"
          value={formatBRL(metrics.currentBalance)}
          subtitle="Receitas e despesas pagas registradas"
          trend="neutral"
          icon={<Wallet className="w-5 h-5" />}
          iconBg="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          onClick={() => onNavigate('finance')}
        />
      </div>

      {/* SEÇÃO PRINCIPAL: "MEU DIA" & CENTRO OPERACIONAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LINHA DO TEMPO: MEU DIA (2 Colunas) */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  MEU DIA — Linha do Tempo Operacional
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compromissos com horário e pendências por prazo ou prioridade
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                {dateLabel}
              </span>
            </div>
          </div>

          {/* Timeline List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {myDayItems.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sua agenda de hoje está livre</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Agende um compromisso ou crie uma tarefa para organizar o dia.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onNavigate('calendar')}>Abrir agenda</Button>
                  <Button size="sm" variant="outline" onClick={() => onNavigate('tasks')}>Ver tarefas</Button>
                </div>
              </div>
            ) : (
              myDayItems.map((item) => {
                const isOverdue = item.type === 'overdue_task';
                const isMeeting = item.type === 'appointment';
                const isFinance = item.type === 'finance_pending';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleMyDayItemClick(item)}
                    className="py-3 px-2 rounded-xl hover:bg-slate-50/90 dark:hover:bg-slate-800/50 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    {/* Time & Title */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className={`px-2.5 py-1 rounded-xl text-center min-w-[62px] shrink-0 font-mono font-bold text-xs ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                          : isMeeting
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60'
                          : isFinance
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}>
                        {item.time || 'Hoje'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors truncate">
                            {item.title}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${
                            item.badgeVariant === 'danger'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : item.badgeVariant === 'warning'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : item.badgeVariant === 'success'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}>
                            {item.badgeText}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {(item.type === 'overdue_task' || item.type === 'today_task') && (
                        <button
                          onClick={(e) => handleToggleTaskComplete(item.entity_id, e)}
                          title="Concluir tarefa agora"
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluir</span>
                        </button>
                      )}

                      <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* CLIENTES QUE PRECISAM DE ATENÇÃO (1 Coluna) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Clientes em Atenção</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ações comerciais prioritárias
              </p>
            </div>
            <button
              onClick={() => onNavigate('clients')}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
            >
              Ver CRM
            </button>
          </div>

          <div className="space-y-2.5">
            {clientsInAlert.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">{metrics.activeClients === 0 ? 'Cadastre seu primeiro cliente para acompanhar o relacionamento comercial.' : 'Nenhum cliente exige acompanhamento neste momento.'}</p>
                {metrics.activeClients === 0 && <Button className="mt-3" size="sm" variant="outline" onClick={() => onNavigate('clients')}>Cadastrar cliente</Button>}
              </div>
            ) : (
              clientsInAlert.slice(0, 4).map((alert, idx) => (
                <div
                  key={idx}
                  onClick={() => onNavigate('clients', undefined, { clientId: alert.client.id })}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 hover:border-brand-500/40 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors">
                      {alert.client.name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      alert.urgency === 'alta'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : alert.urgency === 'media'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                    }`}>
                      {alert.badgeText}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {alert.reason}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Assistente conectado ao serviço de IA configurado no servidor */}
      {isSupabaseConfigured && <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-[#0D1826] to-[#0A2218] border border-brand-500/30 p-6 shadow-xl text-white">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
              <span>NEXUS AI — Orquestrador Operacional</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Como posso acelerar sua empresa agora?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consulte seus dados e solicite ações nos módulos conectados. Alterações que exigem confirmação continuam sob seu controle.
            </p>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              {quickPrompts.slice(0, 3).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate('ai-assistant', prompt)}
                  className="text-xs bg-white/10 hover:bg-brand-500/30 hover:border-brand-400 border border-white/10 px-3 py-1.5 rounded-xl transition-all text-slate-200 text-left flex items-center gap-1.5"
                >
                  <span>"{prompt}"</span>
                  <ArrowRight className="w-3 h-3 text-brand-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2.5">
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('ai-assistant')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="shadow-glow"
            >
              Abrir Assistente Completo
            </Button>
          </div>
        </div>
      </div>}

      {/* LINHA 2: PROJETOS EM ANDAMENTO & FLUXO FINANCEIRO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projetos em Andamento (1 Coluna) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4 text-brand-500" />
                <span>Projetos em Andamento</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhe o progresso das entregas
              </p>
            </div>
            <button
              onClick={() => onNavigate('projects')}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum projeto cadastrado.</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => onNavigate('projects')}>Criar primeiro projeto</Button>
              </div>
            ) : projects.slice(0, 3).map((proj) => (
              <div
                key={proj.id}
                onClick={() => onNavigate('projects', undefined, { projectId: proj.id })}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-brand-500/40 cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors">
                    {proj.name}
                  </h4>
                  <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md">
                    {proj.progress}%
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {proj.client_name || 'Sem cliente vinculado'} • Prazo: {proj.due_date || 'Não definido'}
                </p>

                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${proj.progress}%` }}
                    className="h-full bg-gradient-to-r from-brand-600 to-emerald-400 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Fluxo Financeiro (2 Colunas) */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Fluxo Financeiro (Receitas x Despesas)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualização consolidada do fluxo de caixa
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setChartPeriod('7d')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  chartPeriod === '7d'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setChartPeriod('30d')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  chartPeriod === '30d'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                30 Dias
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  chartPeriod === 'month'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Este Mês
              </button>
            </div>
          </div>

          {/* Valores agrupados por período de pagamento concluído */}
          {chartMax === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sem movimentações pagas neste período</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Registre uma receita ou despesa e marque quando ela for paga para ver o fluxo de caixa.</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => onNavigate('finance')}>Abrir financeiro</Button>
            </div>
          ) : <div className="pt-2">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 h-48 items-end pb-4 border-b border-slate-200/60 dark:border-slate-800">
              {chartData.map((item, i) => {
                const recHeight = item.receita > 0 ? Math.max(8, Math.round((item.receita / chartMax) * 100)) : 0;
                const desHeight = item.despesa > 0 ? Math.max(8, Math.round((item.despesa / chartMax) * 100)) : 0;

                return (
                  <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1.5 h-36">
                      <div
                        style={{ height: `${recHeight}%` }}
                        className="w-1/2 max-w-[22px] bg-emerald-500 rounded-t-md hover:bg-emerald-400 transition-all duration-300 relative"
                        title={`Receita: ${formatBRL(item.receita)}`}
                      />
                      <div
                        style={{ height: `${desHeight}%` }}
                        className="w-1/2 max-w-[22px] bg-rose-500/80 rounded-t-md hover:bg-rose-400 transition-all duration-300 relative"
                        title={`Despesa: ${formatBRL(item.despesa)}`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>Receitas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <span>Despesas</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('finance')}
                className="text-brand-600 dark:text-brand-400 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Ver fluxo completo</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>}
        </Card>
      </div>

      {/* LINHA 3: ATIVIDADES RECENTES REAIS & DOCUMENTOS RECENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividades Recentes (Eventos Reais) */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" />
                <span>Atividades Recentes</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Histórico em tempo real de operações no sistema
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-mono">
              Live Feed
            </span>
          </div>

          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">As atividades aparecerão aqui conforme você cadastrar e atualizar informações.</div>
            ) : activities.slice(0, 5).map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0 ring-4 ring-brand-500/20" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 dark:text-slate-200 leading-snug">
                    {act.description}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {act.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Documentos Recentes */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-500" />
                <span>Documentos & Contratos Recentes</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arquivos e propostas comerciais arquivadas
              </p>
            </div>
            <button
              onClick={() => onNavigate('documents')}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-2.5">
            {documents.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum documento cadastrado.</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => onNavigate('documents')}>Abrir documentos</Button>
              </div>
            ) : documents.slice(0, 4).map((doc) => (
              <div
                key={doc.id}
                onClick={() => onNavigate('documents')}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs hover:border-brand-500/40 cursor-pointer transition-all"
              >
                <div className="truncate">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {doc.title}
                  </p>
                  <span className="text-[11px] text-slate-400">
                    {doc.client_name ? `${doc.client_name} • ` : ''}{doc.category} • {doc.file_size}
                  </span>
                </div>
                <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold shrink-0">
                  Abrir
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
