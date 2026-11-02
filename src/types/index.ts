// ==============================================================================
// NEXUS AI — Tipos e Interfaces do Sistema
// ==============================================================================

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  segment?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  city?: string;
  state?: string;
  plan: 'starter' | 'pro' | 'enterprise';
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: string;
  company_id: string;
  name: string;
  full_name: string;
  display_name: string;
  email: string;
  role: 'admin' | 'gerente' | 'colaborador';
  job_title: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  status: 'ativo' | 'inativo' | 'pendente';
  created_at: string;
  updated_at?: string;
}

export interface UserProfile extends User {}

export type ClientStatus = 'ativo' | 'inativo' | 'prospect';

export interface Client {
  id: string;
  company_id: string;
  name: string;
  company_name: string;
  document?: string; // CPF ou CNPJ
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  status: ClientStatus;
  total_revenue: number;
  last_interaction: string;
  created_at: string;
  updated_at?: string;
}

export type ProjectStatus = 'planejamento' | 'em_andamento' | 'pausado' | 'concluido';

export interface Project {
  id: string;
  company_id: string;
  client_id?: string;
  client_name?: string;
  lead_user_id?: string;
  name: string;
  description: string;
  budget: number;
  progress: number; // 0 to 100
  status: ProjectStatus;
  start_date: string;
  due_date: string;
  created_at: string;
  updated_at?: string;
}

export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type TaskStatus = 'backlog' | 'a_fazer' | 'em_andamento' | 'concluido';

export interface Task {
  id: string;
  company_id: string;
  project_id?: string;
  project_name?: string;
  client_id?: string;
  client_name?: string;
  assigned_to?: string;
  assigned_name?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export type CalendarEventType = 'reuniao' | 'ligacao' | 'tarefa' | 'compromisso' | 'outro';
export type CalendarEventStatus = 'agendado' | 'concluido' | 'cancelado';

export interface CalendarEvent {
  id: string;
  company_id: string;
  client_id?: string;
  client_name?: string;
  user_id: string;
  user_name?: string;
  title: string;
  description?: string;
  event_type: CalendarEventType;
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time?: string; // HH:mm
  duration_minutes: number;
  location?: string;
  status: CalendarEventStatus;
  created_at: string;
  updated_at?: string;
}

export type TransactionType = 'receita' | 'despesa';
export type TransactionStatus = 'pago' | 'pendente' | 'atrasado';
export type TransactionCategory =
  | 'Vendas'
  | 'Serviços'
  | 'Salários'
  | 'Marketing'
  | 'Operacional'
  | 'Impostos'
  | 'Outros';

export interface FinancialTransaction {
  id: string;
  company_id: string;
  client_id?: string;
  client_name?: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: TransactionCategory;
  due_date: string;
  payment_date?: string;
  payment_method: 'pix' | 'boleto' | 'cartao' | 'transferencia';
  status: TransactionStatus;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export type DocumentCategory =
  | 'Notas Fiscais'
  | 'Contratos'
  | 'Comprovantes'
  | 'Documentos da Empresa'
  | 'Financeiro'
  | 'Recursos Humanos'
  | 'Outros'
  | string;

export interface Document {
  id: string;
  company_id: string;
  client_id?: string;
  client_name?: string;
  title: string;
  category: DocumentCategory;
  file_path: string;
  file_size: string;
  file_type: string;
  mime_type?: string;
  data_url?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  read: boolean;
  link?: string;
  created_at: string;
}

// ------------------------------------------------------------------------------
// Operational & Cross-Module Summary Types
// ------------------------------------------------------------------------------

export type MyDayItemType = 'overdue_task' | 'appointment' | 'today_task' | 'finance_pending';

export interface MyDayItem {
  id: string;
  type: MyDayItemType;
  time?: string;
  title: string;
  subtitle?: string;
  client_id?: string;
  client_name?: string;
  project_id?: string;
  project_name?: string;
  entity_id: string;
  status: string;
  priority?: TaskPriority;
  amount?: number;
  badgeText: string;
  badgeVariant: 'danger' | 'warning' | 'info' | 'success';
  actionType: 'navigate_task' | 'navigate_calendar' | 'navigate_finance' | 'navigate_client';
}

export interface ClientFinancialSummary {
  totalContracted: number;
  totalReceived: number;
  totalPending: number;
  transactions: FinancialTransaction[];
}

export interface ProjectFinancialSummary {
  budget: number;
  totalRevenue: number;
  totalExpenses: number;
  netMargin: number;
}

// ------------------------------------------------------------------------------
// Report & Analytics Types
// ------------------------------------------------------------------------------

export type ReportPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface ReportFilterOptions {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
  compareWithPrevious?: boolean;
}

export interface ReportMetricsSummary {
  revenue: number;
  expenses: number;
  netMargin: number;
  marginPercentage: number;
  activeClientsCount: number;
  completedTasksCount: number;
  totalTasksCount: number;
  taskCompletionRate: number;
  appointmentsCount: number;
  revenueGrowthRate?: number;
  expenseGrowthRate?: number;
}

// ------------------------------------------------------------------------------
// AI & Function Calling Types
// ------------------------------------------------------------------------------

export interface AIToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  enum?: string[];
}

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required: string[];
  };
  requiresConfirmation?: boolean;
  confirmationMessage?: (args: Record<string, any>) => string;
  execute: (args: Record<string, any>, context: AIExecutionContext) => Promise<AIToolExecutionResult>;
}

export interface AIExecutionContext {
  user: User;
  company: Company;
}

export interface AIToolExecutionResult {
  success: boolean;
  data?: any;
  message: string;
  actionSummary?: string;
  changesMade?: {
    entity: 'client' | 'task' | 'calendar_event' | 'financial_transaction' | 'project' | 'document';
    action: 'created' | 'updated' | 'deleted';
    id?: string;
  };
}

export interface AIActionLog {
  id: string;
  company_id: string;
  user_id: string;
  tool_name: string;
  parameters: Record<string, any>;
  status: 'success' | 'rejected' | 'failed' | 'pending_confirmation';
  result?: any;
  error_message?: string;
  created_at: string;
}

export interface ChatStep {
  label: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  detail?: string;
}

export interface PendingConfirmation {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  message: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCall?: {
    toolName: string;
    parameters: Record<string, any>;
    steps: ChatStep[];
    result?: AIToolExecutionResult;
    status: 'interpreting' | 'validating' | 'executing' | 'success' | 'error' | 'pending_confirmation';
  };
  pendingConfirmation?: PendingConfirmation;
}
