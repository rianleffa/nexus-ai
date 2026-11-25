import type { Client, FinancialTransaction, Project, ReportPeriod, Task } from '../types';

const getLocalDateISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export type ReportFilters = {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  projectId?: string;
  category?: string;
  status?: string;
};

const sum = (rows: FinancialTransaction[]) => rows.reduce((total, row) => total + Number(row.amount || 0), 0);

export function getReportRange(filters: ReportFilters, today = new Date()) {
  const todayIso = getLocalDateISO(today);
  let startDate = `${today.getFullYear()}-01-01`;
  let endDate = `${today.getFullYear()}-12-31`;
  if (filters.period === 'today') startDate = endDate = todayIso;
  if (filters.period === 'week') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    startDate = getLocalDateISO(start);
    endDate = todayIso;
  }
  if (filters.period === 'month') {
    startDate = getLocalDateISO(new Date(today.getFullYear(), today.getMonth(), 1));
    endDate = getLocalDateISO(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }
  if (filters.period === 'quarter') {
    const firstMonth = Math.floor(today.getMonth() / 3) * 3;
    startDate = getLocalDateISO(new Date(today.getFullYear(), firstMonth, 1));
    endDate = getLocalDateISO(new Date(today.getFullYear(), firstMonth + 3, 0));
  }
  if (filters.period === 'custom') {
    startDate = filters.startDate || startDate;
    endDate = filters.endDate || todayIso;
  }
  return { startDate, endDate, today: todayIso };
}

export function buildReportAnalytics(input: {
  transactions: FinancialTransaction[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  filters: ReportFilters;
  now?: Date;
}) {
  const now = input.now || new Date();
  const { startDate, endDate, today } = getReportRange(input.filters, now);
  const filters = input.filters;
  const hasAssociation = (row: { client_id?: string; project_id?: string }) =>
    (!filters.clientId || row.client_id === filters.clientId) &&
    (!filters.projectId || row.project_id === filters.projectId);

  const selectedTransactions = input.transactions.filter((row) => {
    const paidDate = row.payment_date || row.due_date;
    const inRange = (row.status === 'pago' && paidDate >= startDate && paidDate <= endDate) ||
      (row.status !== 'pago' && row.due_date >= startDate && row.due_date <= endDate);
    return inRange && hasAssociation(row) &&
      (!filters.category || row.category === filters.category) &&
      (!['pago', 'pendente', 'atrasado'].includes(filters.status || '') || row.status === filters.status);
  });
  const cashTransactions = selectedTransactions.filter((row) => row.status === 'pago' &&
    (row.payment_date || row.due_date) >= startDate && (row.payment_date || row.due_date) <= endDate);
  const received = cashTransactions.filter((row) => row.type === 'receita');
  const paid = cashTransactions.filter((row) => row.type === 'despesa');
  const pendingReceivables = selectedTransactions.filter((row) => row.type === 'receita' && row.status !== 'pago');
  const pendingPayables = selectedTransactions.filter((row) => row.type === 'despesa' && row.status !== 'pago');
  const overdue = selectedTransactions.filter((row) => row.status !== 'pago' &&
    (row.status === 'atrasado' || row.due_date < today));
  const revenue = sum(received);
  const expenses = sum(paid);
  const cashResult = revenue - expenses;
  const marginPercentage = revenue ? (cashResult / revenue) * 100 : 0;
  const rangeStart = new Date(`${startDate}T00:00:00`);
  const rangeEnd = new Date(`${endDate}T00:00:00`);
  const periodDays = Math.max(1, Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1);
  const priorEnd = new Date(rangeStart); priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd); priorStart.setDate(priorStart.getDate() - periodDays + 1);
  const previousStartDate = getLocalDateISO(priorStart);
  const previousEndDate = getLocalDateISO(priorEnd);
  const previousPaid = input.transactions.filter((row) => {
    const paidDate = row.payment_date || row.due_date;
    return row.status === 'pago' && paidDate >= previousStartDate && paidDate <= previousEndDate && hasAssociation(row) &&
      (!filters.category || row.category === filters.category) &&
      (!['pago', 'pendente', 'atrasado'].includes(filters.status || '') || row.status === filters.status);
  });
  const previousRevenue = sum(previousPaid.filter((row) => row.type === 'receita'));
  const previousExpenses = sum(previousPaid.filter((row) => row.type === 'despesa'));
  const previousCashResult = previousRevenue - previousExpenses;
  const percentChange = (current: number, previous: number) => previous ? Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1)) : undefined;

  const filteredClients = input.clients.filter((client) =>
    (!filters.clientId || client.id === filters.clientId) &&
    (!['ativo', 'em_negociacao', 'pendente', 'inativo'].includes(filters.status || '') || client.status === filters.status));
  const filteredProjects = input.projects.filter((project) =>
    (!filters.projectId || project.id === filters.projectId) &&
    (!filters.clientId || project.client_id === filters.clientId) &&
    project.due_date >= startDate && project.due_date <= endDate &&
    (!['planejamento', 'em_andamento', 'pausado', 'concluido'].includes(filters.status || '') || project.status === filters.status));
  const filteredTasks = input.tasks.filter((task) => {
    const inRange = task.due_date >= startDate && task.due_date <= endDate;
    return inRange && hasAssociation(task) &&
      (!['backlog', 'a_fazer', 'em_andamento', 'concluido'].includes(filters.status || '') || task.status === filters.status);
  });
  const completedTasks = filteredTasks.filter((task) => task.status === 'concluido').length;

  const monthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const monthlySeries = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + index, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const monthRows = input.transactions.filter((row) => row.status === 'pago' &&
      (row.payment_date || row.due_date).slice(0, 7) === monthKey && hasAssociation(row) &&
      (!filters.category || row.category === filters.category));
    const monthRevenue = sum(monthRows.filter((row) => row.type === 'receita'));
    const monthExpenses = sum(monthRows.filter((row) => row.type === 'despesa'));
    return { month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(monthDate), year: monthDate.getFullYear(), monthKey,
      revenue: monthRevenue, expenses: monthExpenses, balance: monthRevenue - monthExpenses };
  });

  const categoryTotals: Record<string, number> = {};
  paid.forEach((row) => { categoryTotals[row.category] = (categoryTotals[row.category] || 0) + Number(row.amount || 0); });
  const revenueByClient: Record<string, number> = {};
  received.forEach((row) => { const name = row.client_name || 'Sem cliente vinculado'; revenueByClient[name] = (revenueByClient[name] || 0) + Number(row.amount || 0); });
  const countBy = (rows: { status: string }[]) => rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {});
  const dueByMonth = (type: 'receita' | 'despesa') => Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + index, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    return { label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(monthDate), value: sum(selectedTransactions.filter((row) =>
      row.type === type && row.status !== 'pago' && row.due_date.slice(0, 7) === monthKey)) };
  });

  return {
    startDate, endDate, today, selectedTransactions, cashTransactions, received, paid, pendingReceivables, pendingPayables, overdue,
    revenue, expenses, cashResult, marginPercentage: Number(marginPercentage.toFixed(1)),
    previousPeriod: { startDate: previousStartDate, endDate: previousEndDate, revenue: previousRevenue, expenses: previousExpenses, cashResult: previousCashResult,
      revenueChangePercent: percentChange(revenue, previousRevenue), expenseChangePercent: percentChange(expenses, previousExpenses), cashResultChangePercent: percentChange(cashResult, previousCashResult) },
    accountsReceivable: sum(pendingReceivables), accountsPayable: sum(pendingPayables), overdueAmount: sum(overdue),
    clients: filteredClients, projects: filteredProjects, tasks: filteredTasks,
    activeClients: filteredClients.filter((client) => client.status === 'ativo').length,
    clientStatusTotals: countBy(filteredClients),
    ongoingProjects: filteredProjects.filter((project) => project.status === 'em_andamento').length,
    completedProjects: filteredProjects.filter((project) => project.status === 'concluido').length,
    projectStatusTotals: countBy(filteredProjects), taskStatusTotals: countBy(filteredTasks),
    completedTasks, totalTasks: filteredTasks.length,
    taskCompletionRate: filteredTasks.length ? Number(((completedTasks / filteredTasks.length) * 100).toFixed(1)) : 0,
    monthlySeries, categoryTotals, revenueByClient, receivablesByMonth: dueByMonth('receita'), payablesByMonth: dueByMonth('despesa'),
  };
}

export type ReportAnalytics = ReturnType<typeof buildReportAnalytics>;
