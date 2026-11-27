import { supabase, isSupabaseConfigured } from './supabase';
import {
  Client,
  Project,
  Task,
  CalendarEvent,
  FinancialTransaction,
  Document,
  Notification,
  AIActionLog,
} from '../types';

export interface RemoteSyncData {
  clients?: Client[];
  projects?: Project[];
  tasks?: Task[];
  events?: CalendarEvent[];
  transactions?: FinancialTransaction[];
  documents?: Document[];
  documentCategories?: string[];
  notifications?: Notification[];
}

export type ConnectionStatus = 'connected' | 'offline_mode' | 'syncing' | 'error';

class SupabaseSyncService {
  private status: ConnectionStatus = isSupabaseConfigured ? 'connected' : 'offline_mode';
  private activeChannel: any = null;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((fn) => fn(newStatus));
    }
  }

  /**
   * Testa a conectividade com o Supabase e a existência das tabelas
   */
  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    tablesFound?: string[];
    tablesMissing?: string[];
    latencyMs?: number;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        message: 'Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.',
      };
    }

    const start = performance.now();
    try {
      const requiredTables = ['clients', 'projects', 'tasks', 'calendar_events', 'financial_transactions', 'documents', 'document_categories', 'notifications'];
      const probes = await Promise.all(requiredTables.map(async (table) => {
        const { error } = await supabase!.from(table).select('id').limit(0);
        return { table, error };
      }));
      const latencyMs = Math.round(performance.now() - start);
      const tablesFound = probes.filter(({ error }) => !error).map(({ table }) => table);
      const tablesMissing = probes.filter(({ error }) => !!error).map(({ table }) => table);
      const success = tablesMissing.length === 0;
      this.setStatus(success ? 'connected' : 'error');
      return {
        success,
        message: success
          ? `Conexão e tabelas verificadas via Supabase PostgreSQL (Latência: ${latencyMs}ms)`
          : `Conexão parcial: não foi possível consultar ${tablesMissing.join(', ')}. Verifique o esquema e as políticas RLS.`,
        latencyMs,
        tablesFound,
        tablesMissing,
      };
    } catch (err: any) {
      this.setStatus('error');
      return {
        success: false,
        message: `Falha ao alcançar o servidor Supabase: ${err.message || err}`,
      };
    }
  }

  /**
   * Busca todos os registros do tenant no Supabase
   */
  public async fetchRemoteData(companyId?: string, signal?: AbortSignal): Promise<RemoteSyncData | null> {
    if (!isSupabaseConfigured || !supabase || !companyId) {
      return null;
    }

    try {
      this.setStatus('syncing');

      const companyQuery = (table: string) => {
        const query = supabase!.from(table).select('*').eq('company_id', companyId);
        return signal ? query.abortSignal(signal) : query;
      };

      // Fetch in parallel for high speed
      const [
        clientsRes,
        projectsRes,
        tasksRes,
        eventsRes,
        transactionsRes,
        docsRes,
        docCatsRes,
        usersRes,
        notifsRes,
      ] = await Promise.all([
        companyQuery('clients').order('created_at', { ascending: false }),
        companyQuery('projects').order('created_at', { ascending: false }),
        companyQuery('tasks').order('created_at', { ascending: false }),
        companyQuery('calendar_events').order('event_date', { ascending: true }),
        companyQuery('financial_transactions').order('due_date', { ascending: false }),
        companyQuery('documents').order('created_at', { ascending: false }),
        companyQuery('document_categories').select('name').order('name', { ascending: true }),
        companyQuery('users').select('id, name'),
        companyQuery('notifications').order('created_at', { ascending: false }).limit(20),
      ]);

      const queryError = [clientsRes, projectsRes, tasksRes, eventsRes, transactionsRes, docsRes, docCatsRes, usersRes, notifsRes]
        .find((response) => response.error)?.error;
      if (queryError) throw queryError;

      this.setStatus('connected');

      const result: RemoteSyncData = {
        clients: [],
        projects: [],
        tasks: [],
        events: [],
        transactions: [],
        documents: [],
        documentCategories: [],
        notifications: [],
      };
      const clientNames = new Map((clientsRes.data || []).map((client: any) => [client.id, client.name]));
      const projectNames = new Map((projectsRes.data || []).map((project: any) => [project.id, project.name]));
      const userNames = new Map((usersRes.data || []).map((companyUser: any) => [companyUser.id, companyUser.name]));

      if (clientsRes.data) {
        result.clients = clientsRes.data.map((c: any) => ({
          id: c.id,
          company_id: c.company_id,
          name: c.name,
          photo_path: c.photo_path ?? null,
          company_name: c.company_name,
          document: c.document,
          email: c.email,
          phone: c.phone,
          address: c.address,
          notes: c.notes,
          status: c.status,
          total_revenue: Number(c.total_revenue) || 0,
          last_interaction: c.last_interaction,
          created_at: c.created_at,
        }));
      }

      if (projectsRes.data) {
        result.projects = projectsRes.data.map((p: any) => ({
          id: p.id,
          company_id: p.company_id,
          client_id: p.client_id,
          client_name: p.client_name || (p.client_id ? clientNames.get(p.client_id) : undefined),
          lead_user_id: p.lead_user_id,
          name: p.name,
          description: p.description,
          budget: Number(p.budget) || 0,
          progress: Number(p.progress) || 0,
          status: p.status,
          start_date: p.start_date,
          due_date: p.due_date,
          created_at: p.created_at,
        }));
      }

      if (tasksRes.data) {
        result.tasks = tasksRes.data.map((t: any) => ({
          id: t.id,
          company_id: t.company_id,
          project_id: t.project_id,
          client_id: t.client_id,
          assigned_to: t.assigned_to,
          assigned_name: t.assigned_to ? userNames.get(t.assigned_to) : undefined,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          due_date: t.due_date,
          tags: t.tags || [],
          created_at: t.created_at,
        }));
      }

      if (eventsRes.data) {
        result.events = eventsRes.data.map((e: any) => ({
          id: e.id,
          company_id: e.company_id,
          client_id: e.client_id,
          user_id: e.user_id || '',
          user_name: e.user_name,
          title: e.title,
          description: e.description,
          event_type: e.event_type,
          event_date: e.event_date,
          start_time: e.start_time ? String(e.start_time).slice(0, 5) : '10:00',
          duration_minutes: Number(e.duration_minutes) || 60,
          location: e.location,
          status: e.status,
          created_at: e.created_at,
        }));
      }

      if (transactionsRes.data) {
        result.transactions = transactionsRes.data.map((tr: any) => ({
          id: tr.id,
          company_id: tr.company_id,
          client_id: tr.client_id,
          project_id: tr.project_id,
          project_name: tr.project_id ? projectNames.get(tr.project_id) : undefined,
          type: tr.type,
          description: tr.description,
          amount: Number(tr.amount) || 0,
          category: tr.category,
          due_date: tr.due_date,
          payment_date: tr.payment_date,
          payment_method: tr.payment_method,
          status: tr.status,
          notes: tr.notes,
          created_at: tr.created_at,
        }));
      }

      if (docsRes.data) {
        result.documents = docsRes.data.map((d: any) => ({
          id: d.id,
          company_id: d.company_id,
          client_id: d.client_id,
          title: d.title,
          category: d.category,
          file_path: d.file_path,
          file_size: d.file_size || '—',
          file_type: d.mime_type || 'application/octet-stream',
          created_at: d.created_at,
        }));
      }

      if (docCatsRes.data) {
        result.documentCategories = docCatsRes.data.map((dc: any) => dc.name);
      }

      if (notifsRes.data) {
        result.notifications = notifsRes.data.map((n: any) => ({
          id: n.id,
          company_id: n.company_id,
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          type: n.type,
          read: Boolean(n.read),
          link: n.link,
          created_at: n.created_at,
        }));
      }

      return result;
    } catch (err) {
      console.warn('[SupabaseSync] Falha na sincronização remota, mantendo cache local:', err);
      this.setStatus('error');
      return null;
    }
  }

  /**
   * Inscreve nos canais Realtime para escutar alterações em tempo real do Postgres
   */
  public subscribeToRealtime(companyId: string, onRemoteChange: () => void): () => void {
    if (!isSupabaseConfigured || !supabase || !companyId) {
      return () => {};
    }

    try {
      if (this.activeChannel) {
        supabase.removeChannel(this.activeChannel);
      }

      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      const channel = supabase.channel(`public:nexus_changes:${companyId}`);
      const tables = ['clients', 'projects', 'tasks', 'calendar_events', 'financial_transactions', 'documents', 'document_categories', 'notifications', 'users'];
      for (const table of tables) {
        channel.on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter: `company_id=eq.${companyId}`,
        }, () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            refreshTimer = undefined;
            onRemoteChange();
          }, 150);
        });
      }

      this.activeChannel = channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[SupabaseSync] Canal Realtime conectado com sucesso.');
          }
        });

      return () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        if (supabase) void supabase.removeChannel(channel);
        if (this.activeChannel === channel) this.activeChannel = null;
      };
    } catch (e) {
      console.warn('[SupabaseSync] Erro ao subscrever canal realtime:', e);
      return () => {};
    }
  }

  // --------------------------------------------------------------------------
  // Sincronização de Mutações (Push to Supabase)
  // --------------------------------------------------------------------------

  // Clientes
  public async syncClient(action: 'upsert' | 'delete', client: Partial<Client> & { id: string }, photoChange?: { previousPath?: string | null }, confirmedWrite?: "create" | "edit") {
    if (!isSupabaseConfigured || !supabase) {
      if (photoChange) throw new Error('O banco de dados em nuvem não está disponível.');
      return;
    }
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('clients').delete().eq('id', client.id);
        if (error) throw error;
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw authError || new Error('Sessão do usuário não encontrada.');
        const payload = {
          id: client.id,
          company_id: client.company_id,
          user_id: authData.user.id,
          name: client.name,
          ...(photoChange ? { photo_path: client.photo_path } : {}),
          company_name: client.company_name,
          document: client.document,
          email: client.email,
          phone: client.phone,
          address: client.address,
          notes: client.notes,
          status: client.status || 'ativo',
          total_revenue: client.total_revenue || 0,
          last_interaction: client.last_interaction || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (photoChange) {
          const table = supabase.from('clients');
          const pending = photoChange.previousPath === undefined
            ? table.insert(payload)
            : table.update({
                name: payload.name,
                company_name: payload.company_name,
                document: payload.document,
                email: payload.email,
                phone: payload.phone,
                address: payload.address,
                notes: payload.notes,
                status: payload.status,
                photo_path: client.photo_path,
                updated_at: payload.updated_at,
              }).eq('id', client.id).eq('company_id', client.company_id!)
                .filter('photo_path', photoChange.previousPath === null ? 'is' : 'eq', photoChange.previousPath);
          const { error } = await pending.select('id').single();
          if (error) throw error;
        } else if (confirmedWrite) {
          const query = supabase.from('clients');
          const { id, company_id, user_id: _owner, total_revenue: _revenue, last_interaction: _interaction, ...details } = payload;
          const mutation = confirmedWrite === 'create'
            ? query.insert(payload)
            : query.update(details).eq('id', id).eq('company_id', company_id!);
          const { error } = await mutation.select('id').single();
          if (error) throw error;
        } else {
          const { error } = await supabase.from('clients').upsert(payload);
          if (error) throw error;
        }
      }
      this.setStatus('connected');
    } catch (err) {
      this.setStatus('error');
      if (photoChange || confirmedWrite) throw new Error('Não foi possível confirmar a gravação do cliente. Atualize a lista antes de tentar novamente.');
      console.warn('[SupabaseSync] Erro ao sincronizar cliente:', err);
    }
  }

  // Projetos
  public async syncProject(action: 'upsert' | 'delete', project: Partial<Project> & { id: string }, confirmInsert = false) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('projects').delete().eq('id', project.id);
        if (error) throw error;
      } else {
        const payload = {
          id: project.id,
          company_id: project.company_id,
          client_id: project.client_id || null,
          client_name: project.client_name || null,
          lead_user_id: project.lead_user_id || null,
          name: project.name,
          description: project.description,
          budget: project.budget || 0,
          progress: project.progress || 0,
          status: project.status || 'em_andamento',
          start_date: project.start_date || null,
          due_date: project.due_date || null,
          updated_at: new Date().toISOString(),
        };
        const query = supabase.from('projects');
        const { error } = confirmInsert
          ? await query.insert(payload).select('id').abortSignal(AbortSignal.timeout(15_000)).single()
          : await query.upsert(payload);
        if (error) throw error;
      }
      this.setStatus('connected');
    } catch (err) {
      this.setStatus('error');
      if (confirmInsert) throw new Error('Não foi possível confirmar a criação do projeto. Atualize a lista antes de tentar novamente.');
      console.warn('[SupabaseSync] Erro ao sincronizar projeto:', err);
    }
  }

  // Tarefas
  public async syncTask(action: 'upsert' | 'delete', task: Partial<Task> & { id: string }, write: 'insert' | 'update' = 'update') {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('tasks').delete().eq('id', task.id).eq('company_id', task.company_id!).select('id').abortSignal(AbortSignal.timeout(15_000)).single();
        if (error) throw error;
      } else {
        const payload = {
          id: task.id,
          company_id: task.company_id,
          project_id: task.project_id || null,
          client_id: task.client_id || null,
          assigned_to: task.assigned_to || null,
          title: task.title,
          description: task.description,
          priority: task.priority || 'media',
          status: task.status || 'a_fazer',
          due_date: task.due_date || null,
          tags: task.tags || [],
          updated_at: new Date().toISOString(),
        };
        const query = supabase.from('tasks');
        const { id, company_id, ...details } = payload;
        const mutation = write === 'insert' ? query.insert(payload) : query.update(details).eq('id', id).eq('company_id', company_id!);
        const { error } = await mutation.select('id').abortSignal(AbortSignal.timeout(15_000)).single();
        if (error) throw error;
      }
      this.setStatus('connected');
    } catch (err) {
      this.setStatus('error');
      throw new Error('Não foi possível confirmar a alteração da tarefa. Atualize a lista antes de tentar novamente.', { cause: err });
    }
  }

  // Agenda / Compromissos
  public async syncCalendarEvent(action: 'upsert' | 'delete', event: Partial<CalendarEvent> & { id: string }, write?: 'insert' | 'update') {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('calendar_events').delete().eq('id', event.id);
        if (error) throw error;
      } else {
        const payload = {
          id: event.id,
          company_id: event.company_id,
          client_id: event.client_id || null,
          user_id: event.user_id || null,
          title: event.title,
          description: event.description,
          event_type: event.event_type || 'reuniao',
          event_date: event.event_date,
          start_time: event.start_time,
          duration_minutes: event.duration_minutes || 60,
          location: event.location,
          status: event.status || 'agendado',
          updated_at: new Date().toISOString(),
        };
        const query = supabase.from('calendar_events');
        const { id, company_id, ...details } = payload;
        const { error } = write
          ? await (write === 'insert' ? query.insert(payload) : query.update(details).eq('id', id).eq('company_id', company_id!))
            .select('id').abortSignal(AbortSignal.timeout(15_000)).single()
          : await query.upsert(payload);
        if (error) throw error;
      }
      this.setStatus('connected');
    } catch (err) {
      this.setStatus('error');
      if (write) throw new Error('Não foi possível confirmar o compromisso. Atualize a agenda antes de tentar novamente.', { cause: err });
      console.warn('[SupabaseSync] Erro ao sincronizar evento da agenda:', err);
    }
  }

  // Financeiro
  public async syncFinancialTransaction(
    action: 'upsert' | 'delete',
    transaction: Partial<FinancialTransaction> & { id: string }
  ): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return true;
    try {
      if (action === 'delete') {
        const { data, error } = await supabase.from('financial_transactions').delete()
          .eq('id', transaction.id)
          .eq('company_id', transaction.company_id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Nenhum lançamento foi excluído. Verifique as permissões da empresa.');
      } else {
        const { data, error } = await supabase.from('financial_transactions').upsert({
          id: transaction.id,
          company_id: transaction.company_id,
          client_id: transaction.client_id || null,
          project_id: transaction.project_id || null,
          type: transaction.type,
          description: transaction.description,
          amount: transaction.amount || 0,
          category: transaction.category,
          due_date: transaction.due_date,
          payment_date: transaction.payment_date || null,
          payment_method: transaction.payment_method || 'pix',
          status: transaction.status || 'pendente',
          notes: transaction.notes,
          updated_at: new Date().toISOString(),
        }).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('O Supabase não confirmou o salvamento do lançamento.');
      }
      this.setStatus('connected');
      return true;
    } catch (err) {
      this.setStatus('error');
      console.warn('[SupabaseSync] Erro ao sincronizar transação financeira:', err);
      return false;
    }
  }

  // Documentos
  public async syncDocument(action: 'upsert' | 'delete', document: Partial<Document> & { id: string }): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return true;
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('documents').delete().eq('id', document.id);
        if (error) throw error;
        if (document.file_path && document.company_id && document.file_path.startsWith(`${document.company_id}/`)) {
          const { error: storageError } = await supabase.storage.from('documents').remove([document.file_path]);
          if (storageError) console.warn('[SupabaseSync] O cadastro foi excluído, mas o arquivo no Storage precisa de revisão.', storageError);
        }
      } else {
        const { error } = await supabase.from('documents').upsert({
          id: document.id,
          company_id: document.company_id,
          client_id: document.client_id || null,
          title: document.title,
          category: document.category,
          file_path: document.file_path,
          file_size: document.file_size,
          mime_type: document.file_type || document.mime_type,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      return true;
    } catch (err) {
      console.warn('[SupabaseSync] Erro ao sincronizar documento:', err);
      return false;
    }
  }

  public async syncDocumentCategory(category: string, companyId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return true;
    try {
      const { data, error: lookupError } = await supabase
        .from('document_categories')
        .select('id')
        .eq('company_id', companyId)
        .eq('name', category)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (data) return true;

      const { error } = await supabase.from('document_categories').insert({ company_id: companyId, name: category });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[SupabaseSync] Erro ao sincronizar categoria de documento:', err);
      return false;
    }
  }

  // Log de Ação da IA
  public async syncAIActionLog(log: AIActionLog) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from('ai_action_logs').insert({
        id: log.id,
        company_id: log.company_id,
        user_id: log.user_id || null,
        tool_name: log.tool_name,
        parameters: log.parameters,
        status: log.status,
        result: log.result,
        error_message: log.error_message,
        created_at: log.created_at || new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[SupabaseSync] Erro ao registrar log da IA no Supabase:', err);
    }
  }
}

export const supabaseSync = new SupabaseSyncService();
