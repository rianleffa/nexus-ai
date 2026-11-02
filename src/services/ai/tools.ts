import { AITool, AIExecutionContext, AIToolExecutionResult } from '../../types';
import { dataStore } from '../dataStore';
import { addDaysToLocalDateISO, getLocalDateISO } from '../../utils/dates';

// Helper to format currency
const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const aiTools: Record<string, AITool> = {
  // --------------------------------------------------------------------------
  // CLIENT TOOLS
  // --------------------------------------------------------------------------
  get_clients: {
    name: 'get_clients',
    description: 'Lista os clientes cadastrados da empresa com filtros opcionais por nome ou status.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtro por status: ativo, inativo ou prospect.',
          enum: ['ativo', 'inativo', 'prospect'],
        },
        search: {
          type: 'string',
          description: 'Termo de busca para filtrar por nome ou empresa.',
        },
      },
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let clients = dataStore.getClients();
      if (args.status) {
        clients = clients.filter((c) => c.status === args.status);
      }
      if (args.search) {
        const q = String(args.search).toLowerCase();
        clients = clients.filter(
          (c) => c.name.toLowerCase().includes(q) || c.company_name.toLowerCase().includes(q)
        );
      }
      return {
        success: true,
        data: clients,
        message: `Foram encontrados ${clients.length} cliente(s).`,
        actionSummary: `Consulta de clientes realizada (${clients.length} registros).`,
      };
    },
  },

  get_client: {
    name: 'get_client',
    description: 'Obtém detalhes completos de um cliente específico pelo ID ou nome aproximado.',
    parameters: {
      type: 'object',
      properties: {
        client_name_or_id: {
          type: 'string',
          description: 'Nome ou ID do cliente a ser consultado.',
          required: true,
        },
      },
      required: ['client_name_or_id'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const query = args.client_name_or_id;
      const client =
        dataStore.getClient(query) || dataStore.findClientByName(query);

      if (!client) {
        return {
          success: false,
          message: `Nenhum cliente encontrado com a identificação "${query}".`,
        };
      }

      return {
        success: true,
        data: client,
        message: `Cliente encontrado: ${client.name} (${client.company_name}).`,
        actionSummary: `Detalhes de ${client.name} carregados com sucesso.`,
      };
    },
  },

  create_client: {
    name: 'create_client',
    description: 'Cadastra um novo cliente na empresa.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do contato ou responsável principal.', required: true },
        company_name: { type: 'string', description: 'Nome fantasia ou razão social da empresa.', required: true },
        email: { type: 'string', description: 'E-mail profissional de contato.', required: true },
        phone: { type: 'string', description: 'Telefone ou WhatsApp com DDD.', required: true },
        status: { type: 'string', description: 'Status inicial: ativo, inativo ou prospect.', enum: ['ativo', 'inativo', 'prospect'] },
        document: { type: 'string', description: 'CPF ou CNPJ (opcional).' },
        address: { type: 'string', description: 'Endereço completo (opcional).' },
        notes: { type: 'string', description: 'Observações comerciais (opcional).' },
      },
      required: ['name', 'company_name', 'email', 'phone'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const client = dataStore.createClient({
        name: args.name,
        company_name: args.company_name,
        email: args.email,
        phone: args.phone,
        status: args.status || 'ativo',
        document: args.document,
        address: args.address,
        notes: args.notes,
      });

      return {
        success: true,
        data: client,
        message: `Cliente ${client.name} (${client.company_name}) cadastrado com sucesso!`,
        actionSummary: `Cliente ${client.name} criado.`,
        changesMade: {
          entity: 'client',
          action: 'created',
          id: client.id,
        },
      };
    },
  },

  update_client: {
    name: 'update_client',
    description: 'Atualiza dados de um cliente existente.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do cliente.', required: true },
        phone: { type: 'string', description: 'Novo telefone.' },
        email: { type: 'string', description: 'Novo e-mail.' },
        status: { type: 'string', description: 'Novo status.', enum: ['ativo', 'inativo', 'prospect'] },
        notes: { type: 'string', description: 'Novas observações.' },
      },
      required: ['id'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const updated = dataStore.updateClient(args.id, args);
      if (!updated) {
        return { success: false, message: `Cliente com ID ${args.id} não foi encontrado.` };
      }
      return {
        success: true,
        data: updated,
        message: `Dados do cliente ${updated.name} foram atualizados com sucesso.`,
        actionSummary: `Cliente ${updated.name} atualizado.`,
        changesMade: { entity: 'client', action: 'updated', id: updated.id },
      };
    },
  },

  // --------------------------------------------------------------------------
  // CALENDAR TOOLS
  // --------------------------------------------------------------------------
  get_calendar_events: {
    name: 'get_calendar_events',
    description: 'Consulta eventos e compromissos na agenda para uma data específica ou período.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Data específica no formato YYYY-MM-DD.' },
        client_name: { type: 'string', description: 'Filtrar compromissos com um cliente específico.' },
      },
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let events = dataStore.getCalendarEvents();
      if (args.date) {
        events = events.filter((e) => e.event_date === args.date);
      }
      if (args.client_name) {
        const q = String(args.client_name).toLowerCase();
        events = events.filter((e) => e.client_name?.toLowerCase().includes(q));
      }
      return {
        success: true,
        data: events,
        message: `Foram localizados ${events.length} compromisso(s).`,
        actionSummary: `${events.length} compromisso(s) na agenda.`,
      };
    },
  },

  create_calendar_event: {
    name: 'create_calendar_event',
    description: 'Agenda uma nova reunião, ligação ou compromisso no calendário.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título ou assunto do compromisso.', required: true },
        event_date: { type: 'string', description: 'Data no formato YYYY-MM-DD.', required: true },
        start_time: { type: 'string', description: 'Horário no formato HH:mm.', required: true },
        client_name: { type: 'string', description: 'Nome do cliente associado (opcional).' },
        duration_minutes: { type: 'number', description: 'Duração em minutos (padrão: 60).' },
        location: { type: 'string', description: 'Localização ou link da reunião (ex: Google Meet).' },
        description: { type: 'string', description: 'Pauta ou descrição adicional.' },
      },
      required: ['title', 'event_date', 'start_time'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let clientId: string | undefined;
      let clientName = args.client_name;

      if (args.client_name) {
        const found = dataStore.findClientByName(args.client_name);
        if (found) {
          clientId = found.id;
          clientName = found.name;
        }
      }

      // Check conflict
      const conflict = dataStore.checkCalendarConflict(
        args.event_date,
        args.start_time,
        args.duration_minutes || 60
      );

      if (conflict.hasConflict) {
        return {
          success: false,
          message: `Não agendei: o horário conflita com "${conflict.conflictingEvent?.title}" às ${conflict.conflictingEvent?.start_time}. Escolha outro horário.`,
        };
      }

      const event = dataStore.createCalendarEvent({
        title: args.title,
        event_date: args.event_date,
        start_time: args.start_time,
        client_id: clientId,
        client_name: clientName,
        user_id: context.user.id,
        user_name: context.user.name,
        duration_minutes: args.duration_minutes || 60,
        location: args.location,
        description: args.description,
        event_type: 'reuniao',
        status: 'agendado',
      });

      const dateParts = event.event_date.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : event.event_date;
      return {
        success: true,
        data: event,
        message: `Pronto! Reunião criada para ${formattedDate} às ${event.start_time}${clientName ? ` com ${clientName}` : ''}.`,
        actionSummary: `Compromisso "${event.title}" agendado para ${formattedDate} às ${event.start_time}.`,
        changesMade: {
          entity: 'calendar_event',
          action: 'created',
          id: event.id,
        },
      };
    },
  },

  reschedule_calendar_event: {
    name: 'reschedule_calendar_event',
    description: 'Reagenda ou altera o horário ou data de uma reunião existente.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome do cliente, horário atual ou título da reunião a ser alterada.', required: true },
        new_date: { type: 'string', description: 'Nova data no formato YYYY-MM-DD.', required: true },
        new_start_time: { type: 'string', description: 'Novo horário de início no formato HH:mm.', required: true },
        new_duration_minutes: { type: 'number', description: 'Nova duração em minutos (opcional).' },
      },
      required: ['query', 'new_date', 'new_start_time'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const updated = dataStore.rescheduleCalendarEvent(
        args.query,
        args.new_date,
        args.new_start_time,
        args.new_duration_minutes
      );

      if (!updated) {
        return {
          success: false,
          message: `Não foi encontrado nenhum compromisso agendado correspondente a "${args.query}" para reagendar.`,
        };
      }

      const dateParts = updated.event_date.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : updated.event_date;

      return {
        success: true,
        data: updated,
        message: `Reunião reagendada com sucesso para ${formattedDate} às ${updated.start_time}!`,
        actionSummary: `Compromisso "${updated.title}" movido para ${formattedDate} às ${updated.start_time}.`,
        changesMade: { entity: 'calendar_event', action: 'updated', id: updated.id },
      };
    },
  },

  cancel_calendar_event: {
    name: 'cancel_calendar_event',
    description: 'Cancela uma reunião ou compromisso existente. Requer confirmação explícita do usuário.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome do cliente, horário ou título da reunião a ser cancelada.', required: true },
      },
      required: ['query'],
    },
    requiresConfirmation: true,
    confirmationMessage: (args) =>
      `Identifiquei a solicitação para cancelar a reunião "${args.query}". Deseja realmente confirmar o cancelamento deste compromisso na agenda?`,
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const canceled = dataStore.cancelCalendarEvent(args.query);

      if (!canceled) {
        return {
          success: false,
          message: `Não foi possível localizar o compromisso "${args.query}" para cancelamento.`,
        };
      }

      return {
        success: true,
        data: canceled,
        message: `O compromisso "${canceled.title}" (${canceled.event_date} às ${canceled.start_time}) foi cancelado com sucesso.`,
        actionSummary: `Compromisso "${canceled.title}" cancelado.`,
        changesMade: { entity: 'calendar_event', action: 'updated', id: canceled.id },
      };
    },
  },

  update_calendar_event: {
    name: 'update_calendar_event',
    description: 'Atualiza horário, status ou informações de um compromisso existente.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do evento.', required: true },
        status: { type: 'string', description: 'Novo status.', enum: ['agendado', 'concluido', 'cancelado'] },
        start_time: { type: 'string', description: 'Novo horário HH:mm.' },
      },
      required: ['id'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const updated = dataStore.updateCalendarEvent(args.id, args);
      if (!updated) {
        return { success: false, message: 'Evento não encontrado.' };
      }
      return {
        success: true,
        data: updated,
        message: `Compromisso "${updated.title}" atualizado com sucesso.`,
        actionSummary: `Compromisso atualizado.`,
        changesMade: { entity: 'calendar_event', action: 'updated', id: updated.id },
      };
    },
  },

  // --------------------------------------------------------------------------
  // TASK TOOLS
  // --------------------------------------------------------------------------
  get_tasks: {
    name: 'get_tasks',
    description: 'Lista tarefas pendentes, atrasadas ou concluídas.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['backlog', 'a_fazer', 'em_andamento', 'concluido'] },
        overdue_only: { type: 'boolean', description: 'Filtrar apenas tarefas atrasadas.' },
        priority: { type: 'string', enum: ['baixa', 'media', 'alta', 'urgente'] },
      },
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let tasks = dataStore.getTasks();
      const today = getLocalDateISO();

      if (args.overdue_only) {
        tasks = tasks.filter((t) => t.status !== 'concluido' && t.due_date < today);
      }
      if (args.status) {
        tasks = tasks.filter((t) => t.status === args.status);
      }
      if (args.priority) {
        tasks = tasks.filter((t) => t.priority === args.priority);
      }

      return {
        success: true,
        data: tasks,
        message: `Localizadas ${tasks.length} tarefa(s) correspondente(s).`,
        actionSummary: `${tasks.length} tarefa(s) consultadas.`,
      };
    },
  },

  create_task: {
    name: 'create_task',
    description: 'Cria uma nova tarefa no sistema com prioridade e prazo.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título claro da tarefa.', required: true },
        description: { type: 'string', description: 'Descrição detalhada.' },
        priority: { type: 'string', enum: ['baixa', 'media', 'alta', 'urgente'], required: true },
        due_date: { type: 'string', description: 'Prazo limite YYYY-MM-DD.', required: true },
        client_name: { type: 'string', description: 'Nome do cliente vinculado (opcional).' },
        project_name: { type: 'string', description: 'Nome do projeto vinculado (opcional).' },
      },
      required: ['title', 'priority', 'due_date'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let clientId: string | undefined;
      let clientName = args.client_name;
      if (args.client_name) {
        const c = dataStore.findClientByName(args.client_name);
        if (c) {
          clientId = c.id;
          clientName = c.name;
        }
      }

      const task = dataStore.createTask({
        title: args.title,
        description: args.description || '',
        priority: args.priority || 'media',
        due_date: args.due_date,
        status: 'a_fazer',
        client_id: clientId,
        client_name: clientName,
        project_name: args.project_name,
        assigned_name: context.user.name,
      });

      return {
        success: true,
        data: task,
        message: `Tarefa "${task.title}" cadastrada com prioridade ${task.priority.toUpperCase()} para o dia ${task.due_date}.`,
        actionSummary: `Tarefa "${task.title}" criada com sucesso.`,
        changesMade: { entity: 'task', action: 'created', id: task.id },
      };
    },
  },

  complete_task: {
    name: 'complete_task',
    description: 'Marca uma tarefa pendente como concluída.',
    parameters: {
      type: 'object',
      properties: {
        task_id_or_title: { type: 'string', description: 'ID ou parte do título da tarefa.', required: true },
      },
      required: ['task_id_or_title'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const q = String(args.task_id_or_title).toLowerCase();
      const allTasks = dataStore.getTasks();
      const task = allTasks.find(
        (t) => t.id === args.task_id_or_title || t.title.toLowerCase().includes(q)
      );

      if (!task) {
        return { success: false, message: `Nenhuma tarefa encontrada com o termo "${args.task_id_or_title}".` };
      }

      dataStore.completeTask(task.id);
      return {
        success: true,
        data: task,
        message: `A tarefa "${task.title}" foi marcada como concluída!`,
        actionSummary: `Tarefa "${task.title}" concluída.`,
        changesMade: { entity: 'task', action: 'updated', id: task.id },
      };
    },
  },

  // --------------------------------------------------------------------------
  // FINANCIAL TOOLS (Includes confirmation barriers for sensitive values)
  // --------------------------------------------------------------------------
  get_financial_transactions: {
    name: 'get_financial_transactions',
    description: 'Consulta lançamentos financeiros de receitas e despesas.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['receita', 'despesa'] },
        status: { type: 'string', enum: ['pago', 'pendente', 'atrasado'] },
      },
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let txs = dataStore.getFinancialTransactions();
      if (args.type) {
        txs = txs.filter((t) => t.type === args.type);
      }
      if (args.status) {
        txs = txs.filter((t) => t.status === args.status);
      }
      const total = txs.reduce((acc, c) => acc + c.amount, 0);

      return {
        success: true,
        data: txs,
        message: `Total consultado: ${formatBRL(total)} em ${txs.length} lançamento(s).`,
        actionSummary: `Consulta financeira realizada (${formatBRL(total)}).`,
      };
    },
  },

  create_financial_transaction: {
    name: 'create_financial_transaction',
    description: 'Registra um novo lançamento financeiro (Receita ou Despesa). Requer confirmação para despesas ou valores elevados.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['receita', 'despesa'], required: true },
        description: { type: 'string', description: 'Descrição da transação.', required: true },
        amount: { type: 'number', description: 'Valor numérico em reais (R$).', required: true },
        category: {
          type: 'string',
          enum: ['Vendas', 'Serviços', 'Salários', 'Marketing', 'Operacional', 'Impostos', 'Outros'],
          required: true,
        },
        due_date: { type: 'string', description: 'Data de vencimento YYYY-MM-DD.', required: true },
        status: { type: 'string', enum: ['pago', 'pendente', 'atrasado'] },
        client_name: { type: 'string', description: 'Cliente ou fornecedor vinculado.' },
      },
      required: ['type', 'description', 'amount', 'category', 'due_date'],
    },
    // Sensibilidade: Exige confirmação explícita para despesas ou valores >= 1000
    requiresConfirmation: true,
    confirmationMessage: (args) => {
      const val = formatBRL(args.amount || 0);
      const tipo = args.type === 'despesa' ? 'uma despesa' : 'uma receita';
      return `Identifiquei a solicitação para registrar ${tipo} de **${val}** referente a "${args.description}". Deseja confirmar este lançamento financeiro no sistema?`;
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const tx = dataStore.createFinancialTransaction({
        type: args.type,
        description: args.description,
        amount: Number(args.amount),
        category: args.category || (args.type === 'receita' ? 'Serviços' : 'Operacional'),
        due_date: args.due_date,
        payment_date: args.status === 'pago' ? args.due_date : undefined,
        payment_method: 'pix',
        status: args.status || 'pago',
        client_name: args.client_name,
      });

      return {
        success: true,
        data: tx,
        message: `${tx.type === 'receita' ? 'Receita' : 'Despesa'} de ${formatBRL(tx.amount)} registrada com sucesso no fluxo de caixa.`,
        actionSummary: `Lançamento ${formatBRL(tx.amount)} (${tx.type}) registrado.`,
        changesMade: { entity: 'financial_transaction', action: 'created', id: tx.id },
      };
    },
  },

  // --------------------------------------------------------------------------
  // PROJECTS & DASHBOARD SUMMARY
  // --------------------------------------------------------------------------
  get_projects: {
    name: 'get_projects',
    description: 'Consulta projetos em andamento, planejamento ou concluídos.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['planejamento', 'em_andamento', 'pausado', 'concluido'] },
      },
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let projects = dataStore.getProjects();
      if (args.status) {
        projects = projects.filter((p) => p.status === args.status);
      }
      return {
        success: true,
        data: projects,
        message: `Existem ${projects.length} projeto(s) listado(s):\n` + projects.map((p) => `• "${p.name}" (${p.client_name || 'Geral'}) - ${p.progress}% [${p.status}]`).join('\n'),
        actionSummary: `${projects.length} projeto(s) carregados.`,
      };
    },
  },

  create_project: {
    name: 'create_project',
    description: 'Cadastra um novo projeto para a empresa ou para um cliente específico.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do projeto.', required: true },
        client_name: { type: 'string', description: 'Nome do cliente associado.' },
        budget: { type: 'number', description: 'Orçamento do projeto em reais (R$).' },
        due_date: { type: 'string', description: 'Prazo de conclusão no formato YYYY-MM-DD.' },
        description: { type: 'string', description: 'Escopo ou descrição das entregas.' },
      },
      required: ['name'],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let clientId: string | undefined;
      let clientName = args.client_name;

      if (args.client_name) {
        const found = dataStore.findClientByName(args.client_name);
        if (found) {
          clientId = found.id;
          clientName = found.name;
        }
      }

      const proj = dataStore.createProject({
        name: args.name,
        client_id: clientId,
        client_name: clientName || 'Projeto interno',
        budget: Number(args.budget) || 0,
        due_date: args.due_date || addDaysToLocalDateISO(30),
        start_date: getLocalDateISO(),
        description: args.description || 'Projeto cadastrado via NEXUS AI Assistant',
        progress: 0,
        status: 'em_andamento',
      });

      return {
        success: true,
        data: proj,
        message: `Projeto "${proj.name}" criado com sucesso${clientName ? ` para o cliente ${clientName}` : ''}${proj.budget > 0 ? ` com orçamento de ${formatBRL(proj.budget)}` : ''}!`,
        actionSummary: `Projeto "${proj.name}" criado.`,
        changesMade: { entity: 'project', action: 'created', id: proj.id },
      };
    },
  },

  get_my_day: {
    name: 'get_my_day',
    description: 'Consulta a visão diária consolidada do usuário: tarefas atrasadas, reuniões de hoje com horários, entregas do dia e contas/receitas pendentes.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const items = dataStore.getMyDayTimeline();
      const overdue = items.filter((i) => i.type === 'overdue_task');
      const appointments = items.filter((i) => i.type === 'appointment');
      const todayTasks = items.filter((i) => i.type === 'today_task');
      const finance = items.filter((i) => i.type === 'finance_pending');

      const lines = [
        `=== RESUMO DO SEU DIA (${new Date().toLocaleDateString('pt-BR')}) ===`,
        `⚠️ Tarefas Atrasadas (${overdue.length}):`,
        ...overdue.map((t) => `  • ${t.title} (${t.subtitle || ''})`),
        `📅 Compromissos de Hoje (${appointments.length}):`,
        ...appointments.map((a) => `  • [${a.time}] ${a.title} (${a.subtitle || ''})`),
        `⏰ Entregas para Hoje (${todayTasks.length}):`,
        ...todayTasks.map((t) => `  • ${t.title}`),
        `💰 Pendências Financeiras (${finance.length}):`,
        ...finance.map((f) => `  • ${f.title} - ${f.subtitle || ''}`),
      ];

      return {
        success: true,
        data: items,
        message: lines.join('\n'),
        actionSummary: `Visão "Meu Dia" carregada (${items.length} itens operacionais).`,
      };
    },
  },

  get_clients_needing_attention: {
    name: 'get_clients_needing_attention',
    description: 'Identifica clientes em situação de alerta ou que exigem follow-up comercial e operacional.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const alerts = dataStore.getClientsNeedingAttention();
      const lines = alerts.map((a) => `• ${a.client.name} (${a.client.company_name}): [${a.badgeText.toUpperCase()}] ${a.reason}`);

      return {
        success: true,
        data: alerts,
        message: alerts.length > 0
          ? `Clientes que exigem atenção:\n${lines.join('\n')}`
          : `Excelente notícia! Nenhum cliente possui pendências ou alertas no momento.`,
        actionSummary: `${alerts.length} cliente(s) em atenção identificados.`,
      };
    },
  },

  get_documents: {
    name: 'get_documents',
    description: 'Consulta os documentos armazenados na empresa.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string' },
      },
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      let docs = dataStore.getDocuments();
      if (args.category) {
        docs = docs.filter((d) => d.category.toLowerCase() === args.category.toLowerCase());
      }
      return {
        success: true,
        data: docs,
        message: `${docs.length} documento(s) encontrado(s).`,
        actionSummary: `${docs.length} documento(s) localizados.`,
      };
    },
  },

  get_dashboard_summary: {
    name: 'get_dashboard_summary',
    description: 'Obtém o resumo consolidado dos indicadores principais da empresa.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async (args, context): Promise<AIToolExecutionResult> => {
      const metrics = dataStore.getDashboardMetrics();
      return {
        success: true,
        data: metrics,
        message: `Resumo do Sistema:\n• Clientes Ativos: ${metrics.activeClients}\n• Tarefas Pendentes: ${metrics.pendingTasks}\n• Compromissos Hoje: ${metrics.todayAppointments}\n• Receita do Mês: ${formatBRL(metrics.monthRevenue)}\n• Despesas do Mês: ${formatBRL(metrics.monthExpenses)}\n• Saldo Atual: ${formatBRL(metrics.currentBalance)}`,
        actionSummary: 'Resumo de indicadores executivos consolidado.',
      };
    },
  },
};
