import {
  User,
  Company,
  Client,
  Project,
  Task,
  CalendarEvent,
  FinancialTransaction,
  Document,
  Notification,
  AIActionLog,
  MyDayItem,
  ClientFinancialSummary,
  ProjectFinancialSummary,
} from '../types';
import { supabaseSync, RemoteSyncData } from './supabaseSync';
import { getLocalDateISO } from '../utils/dates';

export interface ActivityItem {
  id: string;
  description: string;
  time: string;
  category: 'client' | 'finance' | 'calendar' | 'task' | 'ai';
}

const STORAGE_KEY = 'nexus_ai_database_v1';

const createRecordId = () => crypto.randomUUID();

export const defaultCompany: Company = {
  id: 'comp-1001',
  name: 'Empresa de demonstração',
  segment: 'Serviços empresariais',
  plan: 'pro',
  created_at: '2024-01-15T08:00:00Z',
};

export const defaultUser: User = {
  id: 'usr-001',
  company_id: defaultCompany.id,
  name: 'Usuário de demonstração',
  full_name: 'Usuário de demonstração',
  display_name: 'Usuário de demonstração',
  email: 'demo@example.invalid',
  role: 'admin',
  job_title: 'Administrador',
  avatar_url: '',
  status: 'ativo',
  created_at: '2024-01-15T08:00:00Z',
};

// Initial Seed Data
const initialClients: Client[] = [];

const initialProjects: Project[] = [];

const initialTasks: Task[] = [];

const initialEvents: CalendarEvent[] = [];

const initialTransactions: FinancialTransaction[] = [];

const initialDocuments: Document[] = [];

const initialNotifications: Notification[] = [];

const initialActivities: ActivityItem[] = [];

const initialActionLogs: AIActionLog[] = [];

// ------------------------------------------------------------------------------
// Central Reactive Database Store
// ------------------------------------------------------------------------------

type Listener = () => void;

class DataStore {
  private user: User = defaultUser;
  private company: Company = defaultCompany;
  private clients: Client[] = [];
  private projects: Project[] = [];
  private tasks: Task[] = [];
  private events: CalendarEvent[] = [];
  private transactions: FinancialTransaction[] = [];
  private documents: Document[] = [];
  private documentCategories: string[] = [
    'Notas Fiscais',
    'Contratos',
    'Comprovantes',
    'Documentos da Empresa',
    'Financeiro',
    'Recursos Humanos',
    'Outros',
  ];
  private notifications: Notification[] = [];
  private activities: ActivityItem[] = [];
  private actionLogs: AIActionLog[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.user = parsed.user || defaultUser;
        this.company = parsed.company || defaultCompany;
        this.clients = parsed.clients || initialClients;
        this.projects = parsed.projects || initialProjects;
        this.tasks = parsed.tasks || initialTasks;
        this.events = parsed.events || initialEvents;
        this.transactions = parsed.transactions || initialTransactions;
        this.documents = parsed.documents || initialDocuments;
        this.documentCategories = parsed.documentCategories || this.documentCategories;
        this.notifications = parsed.notifications || initialNotifications;
        this.activities = parsed.activities || initialActivities;
        this.actionLogs = parsed.actionLogs || initialActionLogs;
        return;
      }
    } catch (e) {
      console.warn('Erro ao carregar dados do localStorage, usando padrões:', e);
    }

    this.clients = [...initialClients];
    this.projects = [...initialProjects];
    this.tasks = [...initialTasks];
    this.events = [...initialEvents];
    this.transactions = [...initialTransactions];
    this.documents = [...initialDocuments];
    this.notifications = [...initialNotifications];
    this.activities = [...initialActivities];
    this.actionLogs = [...initialActionLogs];
    this.persist();
  }

  private persist() {
    try {
      const data = {
        user: this.user,
        company: this.company,
        clients: this.clients,
        projects: this.projects,
        tasks: this.tasks,
        events: this.events,
        transactions: this.transactions,
        documents: this.documents,
        documentCategories: this.documentCategories,
        notifications: this.notifications,
        activities: this.activities,
        actionLogs: this.actionLogs,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Falha ao persistir no localStorage:', e);
    }
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public resetToDefault() {
    this.user = { ...defaultUser };
    this.company = { ...defaultCompany };
    this.clients = [...initialClients];
    this.projects = [...initialProjects];
    this.tasks = [...initialTasks];
    this.events = [...initialEvents];
    this.transactions = [...initialTransactions];
    this.documents = [...initialDocuments];
    this.documentCategories = [
      'Notas Fiscais',
      'Contratos',
      'Comprovantes',
      'Documentos da Empresa',
      'Financeiro',
      'Recursos Humanos',
      'Outros',
    ];
    this.notifications = [...initialNotifications];
    this.activities = [...initialActivities];
    this.actionLogs = [...initialActionLogs];
    this.persist();
  }

  public clearTenantData() {
    this.clients = [];
    this.projects = [];
    this.tasks = [];
    this.events = [];
    this.transactions = [];
    this.documents = [];
    this.notifications = [];
    this.activities = [];
    this.actionLogs = [];
    this.persist();
  }

  public syncFromRemote(remoteData: RemoteSyncData) {
    let changed = false;
    if (remoteData.clients) {
      this.clients = remoteData.clients;
      changed = true;
    }
    if (remoteData.projects) {
      this.projects = remoteData.projects;
      changed = true;
    }
    if (remoteData.tasks) {
      this.tasks = remoteData.tasks;
      changed = true;
    }
    if (remoteData.events) {
      this.events = remoteData.events;
      changed = true;
    }
    if (remoteData.transactions) {
      this.transactions = remoteData.transactions;
      changed = true;
    }
    if (remoteData.documents) {
      this.documents = remoteData.documents;
      changed = true;
    }
    if (remoteData.documentCategories) {
      this.documentCategories = remoteData.documentCategories;
      changed = true;
    }
    if (remoteData.notifications) {
      this.notifications = remoteData.notifications;
      changed = true;
    }
    if (changed) {
      this.persist();
    }
  }

  // ----------------------------------------------------------------------------
  // User Profile
  // ----------------------------------------------------------------------------
  public getUser(): User {
    return { ...this.user };
  }

  public updateUser(updates: Partial<User>): User {
    this.user = {
      ...this.user,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.full_name && !updates.name) {
      this.user.name = updates.full_name;
    }
    if (updates.name && !updates.full_name) {
      this.user.full_name = updates.name;
    }
    this.persist();
    return { ...this.user };
  }

  // ----------------------------------------------------------------------------
  // Company Profile
  // ----------------------------------------------------------------------------
  public getCompany(): Company {
    return { ...this.company };
  }

  public updateCompany(updates: Partial<Company>): Company {
    this.company = {
      ...this.company,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    return { ...this.company };
  }

  // ----------------------------------------------------------------------------
  // Dashboard & Metrics
  // ----------------------------------------------------------------------------
  public getDashboardMetrics() {
    const activeClientsCount = this.clients.filter((c) => c.status === 'ativo').length;
    const pendingTasksCount = this.tasks.filter((t) => t.status !== 'concluido').length;

    const now = new Date();
    const todayStr = getLocalDateISO(now);
    const monthStart = getLocalDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = getLocalDateISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const todayEventsCount = this.events.filter((e) => e.event_date === todayStr && e.status !== 'cancelado').length;

    const paidInMonth = this.transactions.filter((t) => {
      if (t.status !== 'pago') return false;
      const paidDate = t.payment_date || t.due_date;
      return paidDate >= monthStart && paidDate <= monthEnd;
    });
    const totalIncome = paidInMonth
      .filter((t) => t.type === 'receita')
      .reduce((acc, cur) => acc + cur.amount, 0);

    const totalExpense = paidInMonth
      .filter((t) => t.type === 'despesa')
      .reduce((acc, cur) => acc + cur.amount, 0);

    const paidTransactions = this.transactions.filter((t) => t.status === 'pago');
    const netBalance = paidTransactions
      .reduce((acc, cur) => acc + (cur.type === 'receita' ? cur.amount : -cur.amount), 0);

    return {
      activeClients: activeClientsCount,
      pendingTasks: pendingTasksCount,
      todayAppointments: todayEventsCount,
      monthRevenue: totalIncome,
      monthExpenses: totalExpense,
      currentBalance: netBalance,
    };
  }

  // ----------------------------------------------------------------------------
  // Operations Hub & Cross-Module Intelligence
  // ----------------------------------------------------------------------------
  public getClientFinancialSummary(clientId: string): ClientFinancialSummary {
    const client = this.getClient(clientId);
    const clientName = client?.name || '';

    const txs = this.transactions.filter(
      (t) => t.client_id === clientId || (clientName && t.client_name === clientName)
    );

    const clientProjects = this.projects.filter(
      (p) => p.client_id === clientId || (clientName && p.client_name === clientName)
    );
    const projectsBudgetTotal = clientProjects.reduce((acc, p) => acc + p.budget, 0);

    const paidRevenue = txs
      .filter((t) => t.type === 'receita' && t.status === 'pago')
      .reduce((acc, t) => acc + t.amount, 0);

    const pendingRevenue = txs
      .filter((t) => t.type === 'receita' && t.status !== 'pago')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalContracted = Math.max(
      projectsBudgetTotal,
      client?.total_revenue || 0,
      paidRevenue + pendingRevenue
    );

    return {
      totalContracted,
      totalReceived: paidRevenue,
      totalPending: pendingRevenue,
      transactions: txs,
    };
  }

  public getProjectFinancialSummary(projectId: string): ProjectFinancialSummary {
    const project = this.getProject(projectId);
    if (!project) {
      return { budget: 0, totalRevenue: 0, totalExpenses: 0, netMargin: 0 };
    }

    const relatedTxs = this.transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(project.name.toLowerCase()) ||
        (project.client_name && t.client_name === project.client_name)
    );

    const revenue = relatedTxs
      .filter((t) => t.type === 'receita' && t.status === 'pago')
      .reduce((acc, t) => acc + t.amount, 0);

    const expenses = relatedTxs
      .filter((t) => t.type === 'despesa' && t.status === 'pago')
      .reduce((acc, t) => acc + t.amount, 0);

    return {
      budget: project.budget,
      totalRevenue: revenue,
      totalExpenses: expenses,
      netMargin: revenue - expenses,
    };
  }

  public getClientsNeedingAttention(): {
    client: Client;
    reason: string;
    urgency: 'alta' | 'media' | 'baixa';
    badgeText: string;
  }[] {
    const todayStr = getLocalDateISO();
    const results: {
      client: Client;
      reason: string;
      urgency: 'alta' | 'media' | 'baixa';
      badgeText: string;
    }[] = [];

    for (const client of this.clients) {
      // 1. Check for overdue tasks
      const clientTasks = this.tasks.filter(
        (t) =>
          (t.client_id === client.id || t.client_name === client.name) &&
          t.status !== 'concluido'
      );
      const overdue = clientTasks.filter((t) => t.due_date < todayStr);

      if (overdue.length > 0) {
        results.push({
          client,
          reason: `${overdue.length} tarefa(s) atrasada(s): "${overdue[0].title}"`,
          urgency: 'alta',
          badgeText: 'Tarefa Atrasada',
        });
        continue;
      }

      // 2. Check for pending high-value invoices
      const pendingTxs = this.transactions.filter(
        (t) =>
          (t.client_id === client.id || t.client_name === client.name) &&
          t.type === 'receita' &&
          t.status !== 'pago'
      );
      if (pendingTxs.length > 0) {
        const totalPending = pendingTxs.reduce((acc, t) => acc + t.amount, 0);
        results.push({
          client,
          reason: `R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em recebimentos pendentes`,
          urgency: 'media',
          badgeText: 'Cobrança Pendente',
        });
        continue;
      }

      // 3. Clientes em negociação
      if (client.status === 'em_negociacao') {
        results.push({
          client,
          reason: 'Em negociação aguardando proposta ou alinhamento comercial',
          urgency: 'media',
          badgeText: 'Em negociação',
        });
        continue;
      }

      if (client.status === 'pendente') {
        results.push({
          client,
          reason: 'Cadastro pendente de atualização ou validação',
          urgency: 'media',
          badgeText: 'Pendente',
        });
        continue;
      }

      // 4. Inactive clients
      if (client.status === 'inativo') {
        results.push({
          client,
          reason: 'Cliente sem novas interações ou contratações recentes',
          urgency: 'baixa',
          badgeText: 'Sem Atividade',
        });
      }
    }

    return results;
  }

  public getMyDayTimeline(): MyDayItem[] {
    const now = new Date();
    const todayStr = getLocalDateISO(now);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = getLocalDateISO(nextWeek);
    const items: MyDayItem[] = [];

    // 1. Overdue Tasks (prioridade máxima do início do dia)
    const overdueTasks = this.tasks.filter(
      (t) => t.status !== 'concluido' && t.due_date < todayStr
    );
    overdueTasks.forEach((t) => {
      items.push({
        id: `day-overdue-${t.id}`,
        type: 'overdue_task',
        time: undefined,
        title: `Tarefa Atrasada: ${t.title}`,
        subtitle: `${t.client_name ? `Cliente: ${t.client_name} • ` : ''}Venceu em ${t.due_date}`,
        client_id: t.client_id,
        client_name: t.client_name,
        project_id: t.project_id,
        project_name: t.project_name,
        entity_id: t.id,
        status: t.status,
        priority: t.priority,
        badgeText: 'Atrasada',
        badgeVariant: 'danger',
        actionType: 'navigate_task',
      });
    });

    // 2. Today's Appointments (com seus horários reais)
    const todayEvents = this.events.filter(
      (e) => e.event_date === todayStr && e.status !== 'cancelado'
    );
    todayEvents.forEach((e) => {
      items.push({
        id: `day-evt-${e.id}`,
        type: 'appointment',
        time: e.start_time,
        title: `${e.event_type === 'reuniao' ? 'Reunião' : 'Compromisso'}: ${e.title}`,
        subtitle: `${e.client_name ? `Com ${e.client_name} • ` : ''}${e.location || 'Local não informado'} (${e.duration_minutes || 60}min)`,
        client_id: e.client_id,
        client_name: e.client_name,
        entity_id: e.id,
        status: e.status,
        badgeText: e.status === 'concluido' ? 'Realizada' : 'Agendada',
        badgeVariant: e.status === 'concluido' ? 'success' : 'info',
        actionType: 'navigate_calendar',
      });
    });

    // 3. Today's Tasks
    const todayTasks = this.tasks.filter(
      (t) => t.status !== 'concluido' && t.due_date === todayStr
    );
    todayTasks.forEach((t) => {
      items.push({
        id: `day-today-${t.id}`,
        type: 'today_task',
        time: undefined,
        title: `Entrega: ${t.title}`,
        subtitle: `${t.client_name ? `Cliente: ${t.client_name} • ` : ''}Prioridade ${t.priority.toUpperCase()}`,
        client_id: t.client_id,
        client_name: t.client_name,
        project_id: t.project_id,
        project_name: t.project_name,
        entity_id: t.id,
        status: t.status,
        priority: t.priority,
        badgeText: 'Para Hoje',
        badgeVariant: 'warning',
        actionType: 'navigate_task',
      });
    });

    // 4. Pending Finance for today or pending
    const pendingTxs = this.transactions
      .filter((t) => t.status !== 'pago' && t.due_date <= nextWeekStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    pendingTxs.slice(0, 2).forEach((tx) => {
      const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount);
      items.push({
        id: `day-fin-${tx.id}`,
        type: 'finance_pending',
        time: undefined,
        title: tx.type === 'receita' ? `Recebimento Pendente: ${tx.description}` : `Pagamento Previsto: ${tx.description}`,
        subtitle: `${tx.client_name ? `Cliente: ${tx.client_name} • ` : ''}Valor: ${formattedVal} (Vence em ${tx.due_date})`,
        client_id: tx.client_id,
        client_name: tx.client_name,
        entity_id: tx.id,
        status: tx.status,
        amount: tx.amount,
        badgeText: tx.status === 'atrasado' ? 'Atrasado' : tx.type === 'receita' ? 'A Receber' : 'A Pagar',
        badgeVariant: tx.status === 'atrasado' ? 'danger' : tx.type === 'receita' ? 'success' : 'warning',
        actionType: 'navigate_finance',
      });
    });

    const typeOrder: Record<MyDayItem['type'], number> = {
      overdue_task: 0,
      appointment: 1,
      today_task: 2,
      finance_pending: 3,
    };
    return items.sort((a, b) => {
      const byType = typeOrder[a.type] - typeOrder[b.type];
      if (byType !== 0) return byType;
      if (a.type === 'appointment' && b.type === 'appointment') {
        return (a.time || '').localeCompare(b.time || '');
      }
      if (a.type === 'overdue_task' && b.type === 'overdue_task') {
        return a.subtitle?.localeCompare(b.subtitle || '') || 0;
      }
      return 0;
    });
  }

  // ----------------------------------------------------------------------------
  // Activity Log
  // ----------------------------------------------------------------------------
  public getActivities(): ActivityItem[] {
    return [...this.activities];
  }

  public addActivity(description: string, category: ActivityItem['category']) {
    const newItem: ActivityItem = {
      id: `act-${Date.now()}`,
      description,
      time: 'Agora mesmo',
      category,
    };
    this.activities.unshift(newItem);
    if (this.activities.length > 25) this.activities.pop();
    this.persist();
  }

  // ----------------------------------------------------------------------------
  // Clients
  // ----------------------------------------------------------------------------
  public getClients(): Client[] {
    return [...this.clients];
  }

  public getClient(id: string): Client | undefined {
    return this.clients.find((c) => c.id === id);
  }

  public findClientByName(nameQuery: string): Client | undefined {
    const q = nameQuery.toLowerCase().trim();
    return this.clients.find(
      (c) => c.name.toLowerCase().includes(q) || c.company_name.toLowerCase().includes(q)
    );
  }

  public createClient(data: Omit<Client, 'id' | 'company_id' | 'created_at' | 'total_revenue' | 'last_interaction'>): Client {
    const newClient: Client = {
      id: createRecordId(),
      company_id: this.company.id,
      ...data,
      total_revenue: 0,
      last_interaction: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.clients.unshift(newClient);
    this.addActivity(`${newClient.name} foi cadastrado como cliente.`, 'client');
    this.persist();
    supabaseSync.syncClient('upsert', newClient);
    return newClient;
  }

  public updateClient(id: string, updates: Partial<Client>): Client | null {
    const idx = this.clients.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.clients[idx] = {
      ...this.clients[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    supabaseSync.syncClient('upsert', this.clients[idx]);
    return this.clients[idx];
  }

  public deleteClient(id: string): boolean {
    const initialLen = this.clients.length;
    this.clients = this.clients.filter((c) => c.id !== id);
    if (this.clients.length !== initialLen) {
      this.persist();
      supabaseSync.syncClient('delete', { id });
      return true;
    }
    return false;
  }

  // ----------------------------------------------------------------------------
  // Projects
  // ----------------------------------------------------------------------------
  public getProjects(): Project[] {
    return [...this.projects];
  }

  public getProject(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  public createProject(data: Omit<Project, 'id' | 'company_id' | 'created_at'>): Project {
    const newProj: Project = {
      id: createRecordId(),
      company_id: this.company.id,
      ...data,
      created_at: new Date().toISOString(),
    };
    this.projects.unshift(newProj);
    this.addActivity(`Projeto "${newProj.name}" foi criada.`, 'task');
    this.persist();
    supabaseSync.syncProject('upsert', newProj);
    return newProj;
  }

  public updateProject(id: string, updates: Partial<Project>): Project | null {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.projects[idx] = { ...this.projects[idx], ...updates };
    this.persist();
    supabaseSync.syncProject('upsert', this.projects[idx]);
    return this.projects[idx];
  }

  public deleteProject(id: string): boolean {
    const initialLen = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id);
    if (this.projects.length !== initialLen) {
      this.persist();
      supabaseSync.syncProject('delete', { id });
      return true;
    }
    return false;
  }

  // ----------------------------------------------------------------------------
  // Tasks
  // ----------------------------------------------------------------------------
  public getTasks(): Task[] {
    return [...this.tasks];
  }

  public getTask(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  public createTask(data: Omit<Task, 'id' | 'company_id' | 'created_at'>): Task {
    const newTask: Task = {
      id: createRecordId(),
      company_id: this.company.id,
      ...data,
      created_at: new Date().toISOString(),
    };
    this.tasks.unshift(newTask);
    this.addActivity(`Tarefa "${newTask.title}" adicionada.`, 'task');
    this.persist();
    supabaseSync.syncTask('upsert', newTask);
    return newTask;
  }

  public updateTask(id: string, updates: Partial<Task>): Task | null {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.tasks[idx] = {
      ...this.tasks[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    supabaseSync.syncTask('upsert', this.tasks[idx]);
    return this.tasks[idx];
  }

  public completeTask(id: string): Task | null {
    const task = this.getTask(id);
    if (!task) return null;
    task.status = 'concluido';
    task.updated_at = new Date().toISOString();
    this.addActivity(`Tarefa "${task.title}" concluída.`, 'task');
    this.persist();
    supabaseSync.syncTask('upsert', task);
    return task;
  }

  public deleteTask(id: string): boolean {
    const initialLen = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length !== initialLen) {
      this.persist();
      supabaseSync.syncTask('delete', { id });
      return true;
    }
    return false;
  }

  // ----------------------------------------------------------------------------
  // Calendar Events & Conflict Management
  // ----------------------------------------------------------------------------
  public getCalendarEvents(): CalendarEvent[] {
    return [...this.events];
  }

  public timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  public minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  public checkCalendarConflict(
    event_date: string,
    start_time: string,
    duration_minutes: number = 60,
    excludeId?: string
  ): { hasConflict: boolean; conflictingEvent?: CalendarEvent } {
    const startMins = this.timeToMinutes(start_time);
    const endMins = startMins + duration_minutes;

    const activeEvents = this.events.filter(
      (e) => e.event_date === event_date && e.status !== 'cancelado' && e.id !== excludeId
    );

    for (const evt of activeEvents) {
      const evtStart = this.timeToMinutes(evt.start_time);
      const evtEnd = evtStart + (evt.duration_minutes || 60);

      // Overlap: start < otherEnd && end > otherStart
      if (startMins < evtEnd && endMins > evtStart) {
        return { hasConflict: true, conflictingEvent: evt };
      }
    }

    return { hasConflict: false };
  }

  public createCalendarEvent(data: Omit<CalendarEvent, 'id' | 'company_id' | 'created_at'>): CalendarEvent {
    const duration = data.duration_minutes || 60;
    const end_time = data.end_time || this.minutesToTime(this.timeToMinutes(data.start_time) + duration);

    const newEvent: CalendarEvent = {
      id: createRecordId(),
      company_id: this.company.id,
      ...data,
      duration_minutes: duration,
      end_time,
      created_at: new Date().toISOString(),
    };
    this.events.unshift(newEvent);
    this.addActivity(`Novo compromisso "${newEvent.title}" agendado para ${newEvent.event_date} às ${newEvent.start_time}.`, 'calendar');
    this.persist();
    supabaseSync.syncCalendarEvent('upsert', newEvent);
    return newEvent;
  }

  public updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): CalendarEvent | null {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    const current = this.events[idx];
    const duration = updates.duration_minutes || current.duration_minutes || 60;
    const startTime = updates.start_time || current.start_time;
    const endTime = updates.end_time || this.minutesToTime(this.timeToMinutes(startTime) + duration);

    this.events[idx] = {
      ...current,
      ...updates,
      duration_minutes: duration,
      end_time: endTime,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    supabaseSync.syncCalendarEvent('upsert', this.events[idx]);
    return this.events[idx];
  }

  public rescheduleCalendarEvent(
    query: string,
    newDate: string,
    newStartTime: string,
    newDuration?: number
  ): CalendarEvent | null {
    const q = query.toLowerCase().trim();
    const evt = this.events.find(
      (e) =>
        e.status !== 'cancelado' &&
        (e.id === query ||
          e.title.toLowerCase().includes(q) ||
          e.client_name?.toLowerCase().includes(q) ||
          e.start_time.includes(q))
    );

    if (!evt) return null;

    const duration = newDuration || evt.duration_minutes || 60;
    const end_time = this.minutesToTime(this.timeToMinutes(newStartTime) + duration);

    evt.event_date = newDate;
    evt.start_time = newStartTime;
    evt.end_time = end_time;
    evt.duration_minutes = duration;
    evt.updated_at = new Date().toISOString();

    this.addActivity(`Compromisso "${evt.title}" reagendado para ${newDate} às ${newStartTime}.`, 'calendar');
    this.persist();
    supabaseSync.syncCalendarEvent('upsert', evt);
    return evt;
  }

  public cancelCalendarEvent(query: string): CalendarEvent | null {
    const q = query.toLowerCase().trim();
    const evt = this.events.find(
      (e) =>
        e.status !== 'cancelado' &&
        (e.id === query ||
          e.title.toLowerCase().includes(q) ||
          e.client_name?.toLowerCase().includes(q))
    );

    if (!evt) return null;

    evt.status = 'cancelado';
    evt.updated_at = new Date().toISOString();

    this.addActivity(`Compromisso "${evt.title}" cancelado.`, 'calendar');
    this.persist();
    supabaseSync.syncCalendarEvent('upsert', evt);
    return evt;
  }

  public deleteCalendarEvent(id: string): boolean {
    const initialLen = this.events.length;
    this.events = this.events.filter((e) => e.id !== id);
    if (this.events.length !== initialLen) {
      this.persist();
      supabaseSync.syncCalendarEvent('delete', { id });
      return true;
    }
    return false;
  }

  // ----------------------------------------------------------------------------
  // Financial Transactions
  // ----------------------------------------------------------------------------
  public getFinancialTransactions(): FinancialTransaction[] {
    return [...this.transactions];
  }

  public createFinancialTransaction(data: Omit<FinancialTransaction, 'id' | 'company_id' | 'created_at'>): FinancialTransaction {
    const newTx: FinancialTransaction = {
      id: createRecordId(),
      company_id: this.company.id,
      ...data,
      created_at: new Date().toISOString(),
    };
    this.transactions.unshift(newTx);
    const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(newTx.amount);
    this.addActivity(
      newTx.type === 'receita'
        ? `Receita de ${formattedVal} registrada ("${newTx.description}").`
        : `Despesa de ${formattedVal} registrada ("${newTx.description}").`,
      'finance'
    );
    this.persist();
    supabaseSync.syncFinancialTransaction('upsert', newTx);
    return newTx;
  }

  public updateFinancialTransaction(id: string, updates: Partial<FinancialTransaction>, syncRemotely = true): FinancialTransaction | null {
    const idx = this.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.transactions[idx] = {
      ...this.transactions[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    if (syncRemotely) void supabaseSync.syncFinancialTransaction('upsert', this.transactions[idx]);
    return this.transactions[idx];
  }

  public deleteFinancialTransaction(id: string, syncRemotely = true): boolean {
    const transaction = this.transactions.find((item) => item.id === id);
    const initialLen = this.transactions.length;
    this.transactions = this.transactions.filter((t) => t.id !== id);
    if (this.transactions.length !== initialLen) {
      this.persist();
      if (syncRemotely) void supabaseSync.syncFinancialTransaction('delete', { id, company_id: transaction?.company_id });
      return true;
    }
    return false;
  }

  // ----------------------------------------------------------------------------
  // Documents & Document Categories
  // ----------------------------------------------------------------------------
  public getDocuments(): Document[] {
    return [...this.documents];
  }

  public getDocumentCategories(): string[] {
    return [...this.documentCategories];
  }

  public async addDocumentCategory(category: string): Promise<boolean> {
    const trimmed = category.trim();
    if (!trimmed) return false;
    if (this.documentCategories.includes(trimmed)) return true;
    const savedRemotely = await supabaseSync.syncDocumentCategory(trimmed, this.company.id);
    if (!savedRemotely) return false;
    if (trimmed) {
      this.documentCategories.push(trimmed);
      this.persist();
    }
    return true;
  }

  public async addDocument(data: Omit<Document, 'id' | 'company_id' | 'created_at'>): Promise<Document | null> {
    const newDoc: Document = {
      id: createRecordId(),
      company_id: this.company.id,
      ...data,
      created_at: new Date().toISOString(),
    };
    const savedRemotely = await supabaseSync.syncDocument('upsert', newDoc);
    if (!savedRemotely) return null;
    this.documents.unshift(newDoc);
    this.addActivity(`Documento "${newDoc.title}" adicionado.`, 'client');
    this.persist();
    return newDoc;
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const existingDoc = this.documents.find((document) => document.id === id);
    if (!existingDoc) return false;
    const removedRemotely = await supabaseSync.syncDocument('delete', existingDoc);
    if (!removedRemotely) return false;
    this.documents = this.documents.filter((d) => d.id !== id);
    this.persist();
    return true;
  }

  // ----------------------------------------------------------------------------
  // Reports & Advanced Analytics Engine
  // ----------------------------------------------------------------------------
  public getFilteredReportMetrics(
    period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom',
    customStart?: string,
    customEnd?: string
  ) {
    const now = new Date();
    const todayStr = getLocalDateISO(now);

    // Determine date boundaries
    let startDate = `${now.getFullYear()}-01-01`;
    let endDate = `${now.getFullYear()}-12-31`;

    if (period === 'today') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = getLocalDateISO(d);
      endDate = todayStr;
    } else if (period === 'month') {
      startDate = getLocalDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
      endDate = getLocalDateISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (period === 'quarter') {
      const firstQuarterMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = getLocalDateISO(new Date(now.getFullYear(), firstQuarterMonth, 1));
      endDate = getLocalDateISO(new Date(now.getFullYear(), firstQuarterMonth + 3, 0));
    } else if (period === 'year') {
      startDate = `${now.getFullYear()}-01-01`;
      endDate = `${now.getFullYear()}-12-31`;
    } else if (period === 'custom') {
      startDate = customStart || `${now.getFullYear()}-01-01`;
      endDate = customEnd || `${now.getFullYear()}-12-31`;
    }

    // Filter transactions
    const periodTxs = this.transactions.filter(
      (t) => t.due_date >= startDate && t.due_date <= endDate
    );

    const paidPeriodTxs = this.transactions.filter((t) => {
      if (t.status !== 'pago') return false;
      const paidDate = t.payment_date || t.due_date;
      return paidDate >= startDate && paidDate <= endDate;
    });

    const revenue = paidPeriodTxs
      .filter((t) => t.type === 'receita')
      .reduce((acc, c) => acc + c.amount, 0);

    const expenses = paidPeriodTxs
      .filter((t) => t.type === 'despesa')
      .reduce((acc, c) => acc + c.amount, 0);

    const netMargin = revenue - expenses;
    const marginPercentage = revenue > 0 ? ((netMargin / revenue) * 100) : 0;

    // Filter Tasks
    const periodTasks = this.tasks.filter(
      (t) => t.due_date >= startDate && t.due_date <= endDate
    );
    const completedTasks = periodTasks.filter((t) => t.status === 'concluido').length;
    const totalTasks = periodTasks.length;
    const taskRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Filter Events
    const periodEvents = this.events.filter(
      (e) => e.event_date >= startDate && e.event_date <= endDate && e.status !== 'cancelado'
    ).length;

    // Monthly breakdown for charts
    const monthlySeries: { month: string; revenue: number; expenses: number; balance: number }[] = [];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 0; i < 12; i++) {
      const monthStart = getLocalDateISO(new Date(now.getFullYear(), i, 1));
      const monthEnd = getLocalDateISO(new Date(now.getFullYear(), i + 1, 0));
      const monthTransactions = this.transactions.filter((t) => {
        const paidDate = t.payment_date || t.due_date;
        return t.status === 'pago' && paidDate >= monthStart && paidDate <= monthEnd;
      });
      const rev = monthTransactions
        .filter((t) => t.type === 'receita')
        .reduce((acc, c) => acc + c.amount, 0);

      const exp = monthTransactions
        .filter((t) => t.type === 'despesa')
        .reduce((acc, c) => acc + c.amount, 0);

      monthlySeries.push({
        month: months[i],
        revenue: rev,
        expenses: exp,
        balance: rev - exp,
      });
    }

    // Category breakdown for expenses
    const categoryTotals: Record<string, number> = {};
    paidPeriodTxs
      .filter((t) => t.type === 'despesa')
      .forEach((t) => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      });

    return {
      startDate,
      endDate,
      revenue,
      expenses,
      netMargin,
      marginPercentage: Number(marginPercentage.toFixed(1)),
      activeClients: this.clients.filter((c) => c.status === 'ativo').length,
      totalClients: this.clients.length,
      completedTasks,
      totalTasks,
      taskCompletionRate: Number(taskRate.toFixed(1)),
      totalAppointments: periodEvents,
      monthlySeries,
      categoryTotals,
      transactions: periodTxs,
    };
  }

  // ----------------------------------------------------------------------------
  // Notifications
  // ----------------------------------------------------------------------------
  public getNotifications(): Notification[] {
    return [...this.notifications];
  }

  public markNotificationAsRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.persist();
    }
  }

  public markAllNotificationsAsRead() {
    this.notifications.forEach((n) => (n.read = true));
    this.persist();
  }

  // ----------------------------------------------------------------------------
  // AI Action Logs
  // ----------------------------------------------------------------------------
  public getAIActionLogs(): AIActionLog[] {
    return [...this.actionLogs];
  }

  public logAIAction(
    toolName: string,
    parameters: Record<string, any>,
    status: AIActionLog['status'],
    result?: any,
    errorMessage?: string
  ): AIActionLog {
    const log: AIActionLog = {
      id: createRecordId(),
      company_id: this.company.id,
      user_id: this.user.id,
      tool_name: toolName,
      parameters,
      status,
      result,
      error_message: errorMessage,
      created_at: new Date().toISOString(),
    };
    this.actionLogs.unshift(log);
    if (this.actionLogs.length > 50) this.actionLogs.pop();
    this.persist();
    supabaseSync.syncAIActionLog(log);
    return log;
  }
}

export const dataStore = new DataStore();
