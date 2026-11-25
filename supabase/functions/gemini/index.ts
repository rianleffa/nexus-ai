import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isInvalidApiKey, validDate } from './validation.mjs';
import { fetchWithRetry } from './retry.mjs';
import { selectDeclarations, combineClientMeetingCalls, getInstantReply, isReadOnlyRequest, extractCalendarClientName } from './toolSelection.mjs';
import { BusinessRuleError, buildSystemInstruction, calendarInput, missingClientGuidance, validTimeZone } from './business.mjs';

const allowedOrigins = new Set([
  'https://nexus-ai-sigma-sooty.vercel.app',
  'https://nexus-ai-rian-ce04.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);
const headersFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

const configuredModel = Deno.env.get('GEMINI_MODEL')?.trim();
const model = !configuredModel || configuredModel === 'gemini-3.1-flash-lite'
  ? 'gemini-3.5-flash-lite'
  : configuredModel;
const chatRateWindows = new Map<string, { startedAt: number; count: number }>();
const toolNames = [
  'get_clients', 'get_client', 'get_projects', 'get_tasks', 'get_calendar_events',
  'get_financial_transactions', 'get_dashboard_summary', 'get_my_day',
  'get_clients_needing_attention', 'get_documents',
  'create_client_and_meeting', 'create_client', 'update_client', 'create_project', 'update_project', 'create_task',
  'update_task', 'create_calendar_event', 'create_financial_transaction', 'complete_task',
  'reschedule_calendar_event', 'cancel_calendar_event', 'update_calendar_event', 'delete_client',
  'delete_project', 'delete_task', 'update_financial_transaction', 'delete_financial_transaction', 'delete_document',
] as const;
type ToolName = typeof toolNames[number];
const writeTools = new Set<ToolName>([
  'create_client_and_meeting', 'create_client', 'update_client', 'create_project', 'update_project', 'create_task',
  'update_task', 'create_calendar_event', 'create_financial_transaction',
  'complete_task', 'reschedule_calendar_event', 'cancel_calendar_event', 'update_calendar_event',
  'delete_client', 'delete_project', 'delete_task', 'update_financial_transaction', 'delete_financial_transaction', 'delete_document',
]);
const automaticWriteTools = new Set<ToolName>([
  'create_client_and_meeting', 'create_client', 'update_client', 'create_project', 'update_project',
  'create_task', 'update_task', 'complete_task', 'create_calendar_event', 'reschedule_calendar_event', 'update_calendar_event',
]);

const declarations = [
  { name: 'create_client_and_meeting', description: 'Cadastra o cliente (se não existir) e agenda a reunião vinculada em uma única transação ao receber um pedido explícito. Nome, data e horário obrigatórios; se faltar algum dado, pergunte antes de chamar. Não peça confirmação adicional para esse pedido claro.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, email: { type: 'STRING' }, phone: { type: 'STRING' }, title: { type: 'STRING' }, description: { type: 'STRING' }, event_date: { type: 'STRING' }, start_time: { type: 'STRING' } }, required: ['name','event_date','start_time'] } },
  { name: 'get_clients', description: 'Consulta clientes cadastrados, opcionalmente por nome ou status.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, status: { type: 'STRING', description: 'Use Ativo como padrão; mapeie Em negociação para em_negociacao, Pendente para pendente e Inativo para inativo.', enum: ['ativo', 'em_negociacao', 'pendente', 'inativo'] } } } },
  { name: 'get_client', description: 'Consulta um cliente específico pelo nome ou UUID.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'get_projects', description: 'Consulta projetos da empresa.', parameters: { type: 'OBJECT', properties: { status: { type: 'STRING', enum: ['planejamento', 'em_andamento', 'pausado', 'concluido'] }, query: { type: 'STRING' } } } },
  { name: 'get_tasks', description: 'Consulta tarefas da empresa, incluindo as atrasadas.', parameters: { type: 'OBJECT', properties: { status: { type: 'STRING', enum: ['backlog', 'a_fazer', 'em_andamento', 'concluido'] }, pending_only: { type: 'BOOLEAN', description: 'Inclui todas as tarefas não concluídas; use para pendentes, sem filtrar status.' }, overdue_only: { type: 'BOOLEAN' }, query: { type: 'STRING' } } } },
  { name: 'get_calendar_events', description: 'Consulta compromissos da agenda, podendo filtrar por data, título ou cliente.', parameters: { type: 'OBJECT', properties: { date: { type: 'STRING', description: 'Data no formato YYYY-MM-DD.' }, query: { type: 'STRING' }, client_name: { type: 'STRING' } } } },
  { name: 'get_financial_transactions', description: 'Consulta receitas e despesas; use para responder perguntas financeiras.', parameters: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: ['receita', 'despesa'] }, status: { type: 'STRING', enum: ['pago', 'pendente', 'atrasado'] }, month: { type: 'STRING', description: 'Mês no formato YYYY-MM.' } } } },
  { name: 'get_dashboard_summary', description: 'Consulta indicadores consolidados da empresa.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'get_my_day', description: 'Consulta tarefas atrasadas e de hoje, compromissos de hoje e lançamentos financeiros pendentes.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'get_clients_needing_attention', description: 'Lista clientes em negociação, pendentes e inativos que podem exigir acompanhamento.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'get_documents', description: 'Pesquisa documentos já enviados à empresa por nome/título e categoria.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, category: { type: 'STRING' } } } },
  { name: 'create_client', description: 'Cadastra um cliente quando o usuário solicitar explicitamente. Apenas name é obrigatório; email, telefone e documento são opcionais. Use status ativo por padrão e os status em_negociacao, pendente ou inativo somente quando o usuário informar.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, company_name: { type: 'STRING' }, email: { type: 'STRING' }, phone: { type: 'STRING' }, document: { type: 'STRING' }, notes: { type: 'STRING' }, status: { type: 'STRING', description: 'Use Ativo como padrão; mapeie Em negociação para em_negociacao, Pendente para pendente e Inativo para inativo.', enum: ['ativo', 'em_negociacao', 'pendente', 'inativo'] } }, required: ['name'] } },
  { name: 'update_client', description: 'Atualiza os dados de um único cliente identificado sem ambiguidade por nome, e-mail ou UUID após pedido explícito, sem confirmação adicional para alterações simples.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Nome, e-mail ou UUID do cliente.' }, name: { type: 'STRING' }, company_name: { type: 'STRING' }, email: { type: 'STRING' }, phone: { type: 'STRING' }, document: { type: 'STRING' }, notes: { type: 'STRING' }, status: { type: 'STRING', description: 'Use Ativo como padrão; mapeie Em negociação para em_negociacao, Pendente para pendente e Inativo para inativo.', enum: ['ativo', 'em_negociacao', 'pendente', 'inativo'] } }, required: ['query'] } },
  { name: 'delete_client', description: 'Exclui um cliente somente após confirmação explícita. Use nome ou UUID; peça mais detalhes se houver homônimos.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'create_project', description: 'Cadastra um projeto após pedido explícito e claro, sem confirmação adicional. O nome é obrigatório; pergunte se estiver faltando.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, client_name: { type: 'STRING' }, description: { type: 'STRING' }, budget: { type: 'NUMBER' }, due_date: { type: 'STRING' } }, required: ['name'] } },
  { name: 'update_project', description: 'Atualiza um projeto existente identificada sem ambiguidade pelo nome ou UUID, sem confirmação adicional para uma alteração simples e explícita.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Nome ou UUID do projeto.' }, name: { type: 'STRING' }, client_name: { type: 'STRING' }, description: { type: 'STRING' }, budget: { type: 'NUMBER' }, progress: { type: 'INTEGER' }, status: { type: 'STRING', enum: ['planejamento', 'em_andamento', 'pausado', 'concluido'] }, due_date: { type: 'STRING' } }, required: ['query'] } },
  { name: 'delete_project', description: 'Exclui um projeto somente após confirmação explícita. Use nome ou UUID.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'create_task', description: 'Cria uma tarefa após pedido explícito e claro, sem confirmação adicional. Título e prazo são obrigatórios; pergunte se faltar algum.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' }, priority: { type: 'STRING', enum: ['baixa', 'media', 'alta', 'urgente'] }, due_date: { type: 'STRING' }, client_name: { type: 'STRING' }, project_name: { type: 'STRING', description: 'Nome do projeto vinculado, se houver.' } }, required: ['title', 'due_date'] } },
  { name: 'update_task', description: 'Atualiza uma tarefa identificada sem ambiguidade por título ou UUID após pedido explícito e claro, sem confirmação adicional para alterações simples.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Título ou UUID da tarefa.' }, title: { type: 'STRING' }, description: { type: 'STRING' }, priority: { type: 'STRING', enum: ['baixa', 'media', 'alta', 'urgente'] }, status: { type: 'STRING', enum: ['backlog', 'a_fazer', 'em_andamento', 'concluido'] }, due_date: { type: 'STRING', description: 'Data no formato YYYY-MM-DD.' }, client_name: { type: 'STRING' }, project_name: { type: 'STRING', description: 'Nome do projeto vinculado, se houver.' } }, required: ['query'] } },
  { name: 'delete_task', description: 'Exclui uma tarefa somente após confirmação explícita. Use título ou UUID.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'create_calendar_event', description: 'Agenda um compromisso após pedido explícito e claro, sem confirmação adicional. Cliente é opcional. Se a pessoa indicada não estiver cadastrada, pergunte se prefere cadastrá-la ou agendar sem vínculo.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' }, event_type: { type: 'STRING', enum: ['reuniao', 'ligacao', 'tarefa', 'compromisso', 'outro'] }, participant_name: { type: 'STRING', description: 'Use somente quando o texto do usuário pedir explicitamente reunião sem vínculo com cliente.' }, event_date: { type: 'STRING' }, start_time: { type: 'STRING' }, duration_minutes: { type: 'INTEGER' }, client_name: { type: 'STRING', description: 'Use para o nome da pessoa citada em “com Nome”; o servidor verifica o cadastro antes de agendar.' }, location: { type: 'STRING' } }, required: ['title', 'event_date', 'start_time'] } },
  { name: 'create_financial_transaction', description: 'Registra receita ou despesa após confirmação explícita.', parameters: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: ['receita', 'despesa'] }, description: { type: 'STRING' }, amount: { type: 'NUMBER' }, category: { type: 'STRING', description: 'Opcional. Se não informada, use Outros.' }, due_date: { type: 'STRING' }, status: { type: 'STRING', enum: ['pago', 'pendente', 'atrasado'] }, client_name: { type: 'STRING' } }, required: ['type', 'description', 'amount', 'due_date'] } },
  { name: 'update_financial_transaction', description: 'Atualiza um lançamento financeiro pelo identificador ou descrição após confirmação. A permissão financeira do usuário será verificada.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, description: { type: 'STRING' }, amount: { type: 'NUMBER' }, category: { type: 'STRING' }, due_date: { type: 'STRING' }, status: { type: 'STRING', enum: ['pago', 'pendente', 'atrasado'] }, type: { type: 'STRING', enum: ['receita', 'despesa'] } }, required: ['query'] } },
  { name: 'delete_financial_transaction', description: 'Exclui um lançamento financeiro somente após confirmação explícita e permissão financeira. Use descrição ou UUID.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'delete_document', description: 'Exclui um documento e seu arquivo armazenado somente após confirmação explícita. Use título ou UUID; arquivo só é removido se estiver no bucket de documentos do projeto.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'complete_task', description: 'Conclui uma tarefa identificada sem ambiguidade pelo título ou UUID após pedido explícito, sem confirmação adicional.', parameters: { type: 'OBJECT', properties: { task_id_or_title: { type: 'STRING' } }, required: ['task_id_or_title'] } },
  { name: 'reschedule_calendar_event', description: 'Reagenda um compromisso identificado sem ambiguidade pelo título para a nova data e horário solicitados, sem confirmação adicional.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, new_date: { type: 'STRING' }, new_start_time: { type: 'STRING' }, new_duration_minutes: { type: 'INTEGER' } }, required: ['query', 'new_date', 'new_start_time'] } },
  { name: 'cancel_calendar_event', description: 'Cancela um compromisso identificado pelo título, após confirmação.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'update_calendar_event', description: 'Atualiza o horário ou estado de um compromisso identificado por título ou UUID. Se for cancelar, pede confirmação.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, status: { type: 'STRING', enum: ['agendado', 'concluido', 'cancelado'] }, start_time: { type: 'STRING' } }, required: ['query'] } },
];

const json = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headersFor(origin), 'Content-Type': 'application/json; charset=utf-8' },
});
const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (message: string): never => { throw new Error(message); };

function b64url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function fromB64url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function signConfirmation(payload: Record<string, unknown>, key: string) {
  const encoded = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(encoded));
  return `${encoded}.${b64url(new Uint8Array(signature))}`;
}
async function verifyConfirmation(token: string, key: string, userId: string) {
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) fail('A confirmação expirou. Envie a solicitação novamente.');
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', cryptoKey, fromB64url(signature), new TextEncoder().encode(encoded));
  if (!valid) fail('Token de confirmação inválido. Envie a solicitação novamente.');
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded)));
  if (payload.userId !== userId || payload.expiresAt < Date.now()) fail('A confirmação expirou. Envie a solicitação novamente.');
  return payload as { userId: string; companyId: string; logId: string; expiresAt: number };
}

async function logAction(db: SupabaseClient, row: Record<string, unknown>) {
  const { data, error } = await db.from('ai_action_logs').insert(row).select('id').single();
  if (error) throw Object.assign(new Error(`Não foi possível registrar a auditoria da ação: ${error.message}`), { code: error.code });
  return data.id as string;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
async function makeIdempotencyKey(companyId: string, userId: string, tool: ToolName, args: Record<string, unknown>) {
  const timeBucket = Math.floor(Date.now() / 120_000);
  const material = `${companyId}:${userId}:${tool}:${timeBucket}:${canonicalJson(args)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return b64url(new Uint8Array(digest));
}

async function findRecentDuplicate(db: SupabaseClient, companyId: string, userId: string, tool: ToolName, args: Record<string, unknown>) {
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data, error } = await db.from('ai_action_logs').select('id,status,result,created_at')
    .eq('company_id', companyId).eq('user_id', userId).eq('tool_name', tool)
    .contains('parameters', args).in('status', ['pending_confirmation', 'success', 'failed'])
    .gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchAllRows(query: any, maxRows = 10_000) {
  const rows: any[] = [];
  let total = 0;
  for (let offset = 0; offset < maxRows; offset += 1000) {
    const { data, error, count } = await query.range(offset, Math.min(offset + 999, maxRows - 1));
    if (error) throw error;
    rows.push(...(data || []));
    total = count ?? rows.length;
    if (!data?.length || rows.length >= total || data.length < 1000) break;
  }
  return { rows, total, truncated: total > rows.length };
}

async function findClientId(db: SupabaseClient, companyId: string, query: unknown) {
  const term = clean(query, 255);
  if (!term) return null;
  let request = db.from('clients').select('id,name,company_name').eq('company_id', companyId).limit(2);
  request = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(term)
    ? request.eq('id', term)
    : request.ilike('name', `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
  const { data, error } = await request;
  if (error) throw error;
  if (!data?.length) return null;
  if (data.length > 1) throw new BusinessRuleError(`Encontrei mais de um cliente para “${term}”. Informe o nome completo ou o identificador para evitar vincular a pessoa errada.`);
  return data[0];
}

function explicitlyUnlinkedMeeting(message: unknown) {
  if (typeof message !== 'string') return false;
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\bsem\s+(?:vinculo|vincular|cliente)\b/.test(normalized);
}
async function prepareCalendarAction(db: SupabaseClient, companyId: string, tool: ToolName, args: Record<string, unknown>, explicitlyUnlinked = false) {
  if (tool === 'create_client_and_meeting') {
    const name = clean(args.name, 255);
    if (!name) throw new BusinessRuleError('Qual é o nome do cliente que deseja cadastrar e vincular à reunião?');
    args.name = name;
    args.title = clean(args.title, 255) || `Reunião com ${name}`;
    calendarInput(args);
    const found = await db.from('clients').select('id,name').eq('company_id', companyId).ilike('name', name.replaceAll('%', '\\%').replaceAll('_', '\\_')).limit(2);
    if (found.error) throw found.error;
    if (found.data?.length > 1) throw new BusinessRuleError('Há mais de um cliente com esse nome. Informe o cadastro exato antes de confirmar.');
    args.existing_client_id = found.data?.[0]?.id || null;
  }
  if (tool === 'create_calendar_event') {
    calendarInput(args);
    if (explicitlyUnlinked) {
      if (!args.participant_name && args.client_name) args.participant_name = clean(args.client_name, 255);
      delete args.client_name;
    } else {
      const personName = clean(args.client_name || args.participant_name, 255);
      if (personName) {
        const client = await findClientId(db, companyId, personName);
        if (!client) throw new BusinessRuleError(missingClientGuidance(personName));
        args.client_name = client.name;
        delete args.participant_name;
      }
    }
  }
  if (tool === 'reschedule_calendar_event' || tool === 'cancel_calendar_event') {
    const term = clean(args.query, 255);
    if (!term) throw new BusinessRuleError('Informe o título do compromisso que deseja alterar.');
    if (tool === 'reschedule_calendar_event' && (!validDate(args.new_date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(args.new_start_time)))) {
      throw new BusinessRuleError('Informe a nova data e o horário da reunião no formato HH:mm.');
    }
    const found = await db.from('calendar_events').select('id,title').eq('company_id', companyId).neq('status', 'cancelado').ilike('title', '%' + term.replaceAll('%', '\\%').replaceAll('_', '\\_') + '%').limit(2);
    if (found.error) throw found.error;
    if (!found.data?.length) throw new BusinessRuleError('Não encontrei esse compromisso na agenda da sua empresa. Informe o título ou consulte a agenda para escolher o compromisso.');
    if (found.data.length > 1) throw new BusinessRuleError('Há mais de um compromisso compatível. Especifique o título para evitar alterar a reunião errada.');
    args.event_id = found.data[0].id;
    args.query = found.data[0].title;
  }
}

const financeTools = new Set<ToolName>(['create_financial_transaction', 'update_financial_transaction', 'delete_financial_transaction']);
async function prepareResolvedAction(db: SupabaseClient, companyId: string, tool: ToolName, args: Record<string, unknown>) {
  const targets: Partial<Record<ToolName, { table: string; column: string; key: string }>> = {
    delete_client: { table: 'clients', column: 'name', key: 'client_id' },
    delete_project: { table: 'projects', column: 'name', key: 'project_id' },
    delete_task: { table: 'tasks', column: 'title', key: 'task_id' },
    update_calendar_event: { table: 'calendar_events', column: 'title', key: 'event_id' },
    update_financial_transaction: { table: 'financial_transactions', column: 'description', key: 'transaction_id' },
    delete_financial_transaction: { table: 'financial_transactions', column: 'description', key: 'transaction_id' },
    delete_document: { table: 'documents', column: 'title', key: 'document_id' },
  };
  const target = targets[tool];
  if (!target) return;
  const term = clean(args.query, 255);
  if (!term) throw new BusinessRuleError('Informe qual registro deseja alterar ou excluir.');
  let lookup = db.from(target.table).select(`id,${target.column}`).eq('company_id', companyId).limit(2);
  if (tool === 'update_calendar_event') lookup = lookup.neq('status', 'cancelado');
  lookup = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(term)
    ? lookup.eq('id', term)
    : lookup.ilike(target.column, `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
  const found = await lookup;
  if (found.error) throw found.error;
  if (!found.data?.length) throw new BusinessRuleError(`Não encontrei esse registro em ${target.table}. Consulte a lista e informe o nome ou identificador.`);
  if (found.data.length > 1) throw new BusinessRuleError('Encontrei mais de um registro compatível. Informe o nome completo ou UUID para evitar alterar o item errado.');
  args[target.key] = found.data[0].id;
  args.query = found.data[0][target.column];
}

async function executeTool(db: SupabaseClient, companyId: string, userId: string, tool: ToolName, args: Record<string, unknown>, timeZone = 'America/Sao_Paulo') {
  const query = clean(args.query, 255);
  let data: any;
  let table = '';
  switch (tool) {
    case 'get_clients': {
      table = 'clients'; let q = db.from(table).select('id,name,company_name,email,phone,status,total_revenue,last_interaction').eq('company_id', companyId).order('name').limit(50);
      if (args.status) q = q.eq('status', args.status);
      if (query) q = q.ilike('name', `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const result = await q; if (result.error) throw result.error; data = result.data;
      break;
    }
    case 'get_client': {
      table = 'clients'; const found = await findClientId(db, companyId, args.query);
      if (!found) { data = { found: false, query: clean(args.query, 255), guidance: missingClientGuidance(args.query) }; break; }
      const result = await db.from(table).select('id,name,company_name,email,phone,document,address,notes,status,total_revenue,last_interaction').eq('company_id', companyId).eq('id', found.id).single();
      if (result.error) throw result.error; data = [result.data]; break;
    }
    case 'get_clients_needing_attention': {
      table = 'clients'; const today = saoPauloDate(timeZone);
      const [clients, tasks, transactions] = await Promise.all([
        db.from(table).select('id,name,company_name,email,phone,status,last_interaction').eq('company_id', companyId).order('name').limit(500),
        db.from('tasks').select('id,title,client_id,due_date').eq('company_id', companyId).neq('status', 'concluido').lt('due_date', today).order('due_date').limit(1000),
        db.from('financial_transactions').select('client_id,amount').eq('company_id', companyId).eq('type', 'receita').neq('status', 'pago').limit(1000),
      ]);
      const error = clients.error || tasks.error || transactions.error; if (error) throw error;
      data = (clients.data || []).flatMap((client) => {
        const overdue = (tasks.data || []).filter((task) => task.client_id === client.id);
        if (overdue.length) return [{ client, reason: `${overdue.length} tarefa(s) atrasada(s): “${overdue[0].title}”`, urgency: 'alta', badgeText: 'Tarefa Atrasada' }];
        const pending = (transactions.data || []).filter((row) => row.client_id === client.id);
        if (pending.length) return [{ client, reason: `R$ ${pending.reduce((sum: number, row: any) => sum + Number(row.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em recebimentos pendentes`, urgency: 'media', badgeText: 'Cobrança Pendente' }];
        if (client.status === 'em_negociacao') return [{ client, reason: 'Cliente em negociação aguardando proposta ou alinhamento comercial', urgency: 'media', badgeText: 'Em negociação' }];
        if (client.status === 'pendente') return [{ client, reason: 'Cadastro pendente de atualização ou validação', urgency: 'media', badgeText: 'Pendente' }];
        if (client.status === 'inativo') return [{ client, reason: 'Cliente sem novas interações ou contratações recentes', urgency: 'baixa', badgeText: 'Sem Atividade' }];
        return [];
      }); break;
    }
    case 'get_documents': {
      table = 'documents'; let q = db.from(table).select('id,title,category,file_size,mime_type,status,created_at,client_id,project_id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50);
      if (args.category) q = q.ilike('category', `%${clean(args.category, 100).replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      if (query) q = q.ilike('title', `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const result = await q; if (result.error) throw result.error; data = result.data; break;
    }
    case 'get_projects': {
      table = 'projects'; let q = db.from(table).select('id,name,client_name,description,budget,progress,status,start_date,due_date').eq('company_id', companyId).order('due_date').limit(50);
      if (args.status) q = q.eq('status', args.status); if (query) q = q.ilike('name', `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const result = await q; if (result.error) throw result.error; data = result.data; break;
    }
    case 'get_tasks': {
      table = 'tasks'; let q = db.from(table).select('id,title,description,priority,status,due_date,client_id,project_id,assigned_to').eq('company_id', companyId).order('due_date').limit(100);
      if (args.pending_only === true) q = q.neq('status', 'concluido'); else if (args.status) q = q.eq('status', args.status); if (args.overdue_only === true) q = q.lt('due_date', saoPauloDate(timeZone)).neq('status', 'concluido'); if (query) q = q.ilike('title', `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const result = await q; if (result.error) throw result.error; data = result.data; break;
    }
    case 'get_calendar_events': {
      table = 'calendar_events'; let q = db.from(table).select('id,title,description,event_type,event_date,start_time,duration_minutes,location,status,client_id,user_id').eq('company_id', companyId).neq('status', 'cancelado').order('event_date').order('start_time').limit(100);
      if (args.date) { if (!validDate(args.date)) fail('Informe a data no formato YYYY-MM-DD.'); q = q.eq('event_date', args.date); }
      if (query) q = q.ilike('title', `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      if (args.client_name) { const client = await findClientId(db, companyId, args.client_name); if (!client) throw new BusinessRuleError(missingClientGuidance(args.client_name)); q = q.eq('client_id', client.id); }
      const result = await q; if (result.error) throw result.error; data = result.data; break;
    }
    case 'get_financial_transactions': {
      table = 'financial_transactions'; let q = db.from(table).select('id,type,description,amount,category,due_date,payment_date,payment_method,status,client_id', { count: 'exact' }).eq('company_id', companyId).order('due_date', { ascending: false });
      if (args.type) q = q.eq('type', args.type); if (args.status) q = q.eq('status', args.status);
      if (args.month !== undefined && (typeof args.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(args.month))) fail('Informe o mês no formato YYYY-MM.');
      if (typeof args.month === 'string') {
        const monthStart = new Date(`${args.month}-01T00:00:00Z`);
        if (!Number.isNaN(monthStart.getTime())) {
          const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
          q = q.gte('due_date', `${args.month}-01`).lt('due_date', nextMonth);
        }
      }
      const result = await fetchAllRows(q); data = { rows: result.rows.slice(0, 100), count: result.total, totalAmount: result.rows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0), truncated: result.truncated || result.rows.length > 100 }; break;
    }
    case 'get_dashboard_summary': {
      const month = saoPauloDate(timeZone).slice(0, 7);
      const monthStart = `${month}-01`;
      const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
      const [clients, projects, tasks, events] = await Promise.all([
        db.from('clients').select('id,status', { count: 'exact' }).eq('company_id', companyId),
        db.from('projects').select('id,status', { count: 'exact' }).eq('company_id', companyId),
        db.from('tasks').select('id,status,due_date', { count: 'exact' }).eq('company_id', companyId),
        db.from('calendar_events').select('id,event_date', { count: 'exact' }).eq('company_id', companyId).eq('event_date', saoPauloDate(timeZone)).neq('status', 'cancelado'),
      ]);
      const error = clients.error || projects.error || tasks.error || events.error; if (error) throw error;
      const finances = await fetchAllRows(db.from('financial_transactions').select('type,amount,status,payment_date', { count: 'exact' }).eq('company_id', companyId).eq('status', 'pago').gte('payment_date', monthStart).lt('payment_date', nextMonth));
      const rows = finances.rows || [];
      data = {
        activeClients: (clients.data || []).filter((x) => x.status === 'ativo').length,
        pendingTasks: (tasks.data || []).filter((x) => x.status !== 'concluido').length,
        overdueTasks: (tasks.data || []).filter((x) => x.status !== 'concluido' && x.due_date && x.due_date < saoPauloDate(timeZone)).length,
        activeProjects: (projects.data || []).filter((x) => x.status === 'em_andamento').length,
        todayAppointments: events.count || 0,
        monthRevenue: rows.filter((x) => x.type === 'receita').reduce((sum, x) => sum + Number(x.amount), 0),
        monthExpenses: rows.filter((x) => x.type === 'despesa').reduce((sum, x) => sum + Number(x.amount), 0),
        financialTotalsTruncated: finances.truncated,
      };
      table = 'dashboard'; break;
    }
    case 'get_my_day': {
      const today = saoPauloDate(timeZone);
      const [tasks, events, finance] = await Promise.all([
        db.from('tasks').select('id,title,status,priority,due_date').eq('company_id', companyId).neq('status', 'concluido').lte('due_date', today).order('due_date').limit(100),
        db.from('calendar_events').select('id,title,event_date,start_time,status').eq('company_id', companyId).eq('event_date', today).neq('status', 'cancelado').order('start_time').limit(100),
        db.from('financial_transactions').select('id,type,description,amount,due_date,status').eq('company_id', companyId).in('status', ['pendente', 'atrasado']).lte('due_date', today).order('due_date').limit(100),
      ]);
      const error = tasks.error || events.error || finance.error; if (error) throw error;
      data = { overdueOrTodayTasks: tasks.data, todaysAppointments: events.data, dueFinancialTransactions: finance.data }; table = 'my_day'; break;
    }
    case 'create_client': {
      table = 'clients'; const name = clean(args.name, 255); if (!name) fail('Informe o nome do cliente.');
      const status = args.status === undefined ? 'ativo' : String(args.status);
      if (!['ativo', 'em_negociacao', 'pendente', 'inativo'].includes(status)) fail('Informe um status válido para o cliente.');
      const result = await db.from(table).insert({ company_id: companyId, user_id: userId, name, company_name: clean(args.company_name, 255) || null, email: clean(args.email, 255) || null, phone: clean(args.phone, 50) || null, document: clean(args.document, 50) || null, notes: clean(args.notes, 2000) || null, status }).select('id,name,company_name,email,phone,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'update_client': {
      table = 'clients'; const found = await findClientId(db, companyId, args.query); if (!found) throw new BusinessRuleError('Não encontrei esse cliente na sua empresa. Informe o nome completo ou consulte a lista de clientes.');
      const updates: Record<string, unknown> = {}; for (const key of ['name','company_name','email','phone','document','notes','status']) if (args[key] !== undefined) updates[key] = key === 'status' ? args[key] : clean(args[key], key === 'notes' ? 2000 : 255);
      if (!Object.keys(updates).length) fail('Informe ao menos um campo para atualizar.');
      if (updates.status !== undefined && !['ativo', 'em_negociacao', 'pendente', 'inativo'].includes(String(updates.status))) fail('Informe um status válido para o cliente.');
      const result = await db.from(table).update(updates).eq('company_id', companyId).eq('id', found.id).select('id,name,company_name,email,phone,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'delete_client': {
      table = 'clients'; const id = clean(args.client_id, 36); if (!id) fail('Cliente não foi identificado antes da confirmação.');
      const result = await db.from(table).delete().eq('company_id', companyId).eq('id', id).select('id,name').single();
      if (result.error) throw new BusinessRuleError(result.error.code === '23503' ? 'Este cliente ainda está vinculado a outros registros e não pode ser excluído até que esses vínculos sejam resolvidos.' : `Não foi possível excluir o cliente: ${result.error.message}`);
      data = result.data; break;
    }
    case 'create_project': {
      table = 'projects'; const name = clean(args.name, 255); if (!name) fail('Informe o nome do projeto.');
      const client = args.client_name ? await findClientId(db, companyId, args.client_name) : null;
      if (args.client_name && !client) throw new BusinessRuleError(missingClientGuidance(args.client_name));
      if (args.due_date && !validDate(args.due_date)) fail('Informe o prazo no formato YYYY-MM-DD.');
      const result = await db.from(table).insert({ company_id: companyId, name, client_id: client?.id || null, client_name: client?.name || clean(args.client_name, 255) || 'Projeto interno', description: clean(args.description, 2000), budget: Math.max(0, Number(args.budget) || 0), due_date: validDate(args.due_date) ? args.due_date : null, start_date: saoPauloDate(timeZone), progress: 0, status: 'em_andamento' }).select('id,name,client_name,budget,due_date,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'update_project': {
      table = 'projects'; const term = clean(args.query, 255); if (!term) fail('Informe o nome ou UUID do projeto.');
      let find = db.from(table).select('id,name').eq('company_id', companyId).limit(2);
      find = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(term) ? find.eq('id', term) : find.ilike('name', `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const found = await find; if (found.error) throw found.error;
      if (!found.data?.length) fail('Projeto não encontrado.');
      if (found.data.length > 1) fail('Encontrei projetos com nomes parecidos. Informe um nome mais específico.');
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) { const name = clean(args.name, 255); if (!name) fail('O nome do projeto não pode ficar vazio.'); updates.name = name; }
      if (args.description !== undefined) updates.description = clean(args.description, 2000);
      if (args.client_name !== undefined) {
        const clientName = clean(args.client_name, 255);
        const client = clientName ? await findClientId(db, companyId, clientName) : null;
        if (clientName && !client) fail(`Não encontrei o cliente “${clientName}”.`);
        updates.client_id = client?.id || null;
        updates.client_name = client?.name || null;
      }
      if (args.budget !== undefined) { const budget = Number(args.budget); if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000_000) fail('Informe um orçamento válido.'); updates.budget = budget; }
      if (args.progress !== undefined) { const progress = Number(args.progress); if (!Number.isInteger(progress) || progress < 0 || progress > 100) fail('O progresso deve ser um número inteiro entre 0 e 100.'); updates.progress = progress; }
      if (args.status !== undefined) { if (!['planejamento', 'em_andamento', 'pausado', 'concluido'].includes(String(args.status))) fail('Informe um status válido para o projeto.'); updates.status = args.status; }
      if (args.due_date !== undefined) { if (args.due_date !== null && !validDate(args.due_date)) fail('Informe o prazo no formato YYYY-MM-DD.'); updates.due_date = args.due_date || null; }
      if (!Object.keys(updates).length) fail('Informe ao menos um campo para atualizar.');
      const result = await db.from(table).update(updates).eq('company_id', companyId).eq('id', found.data[0].id).select('id,name,client_name,description,budget,progress,status,due_date').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'delete_project': {
      table = 'projects'; const id = clean(args.project_id, 36); if (!id) fail('Projeto não foi identificado antes da confirmação.');
      const result = await db.from(table).delete().eq('company_id', companyId).eq('id', id).select('id,name').single();
      if (result.error) throw new BusinessRuleError(result.error.code === '23503' ? 'Este projeto ainda está vinculado a tarefas ou documentos e não pode ser excluído enquanto houver esses vínculos.' : `Não foi possível excluir o projeto: ${result.error.message}`);
      data = result.data; break;
    }
    case 'create_task': {
      table = 'tasks'; const title = clean(args.title, 255); if (!title || !validDate(args.due_date)) fail('Informe o título e um prazo válido (YYYY-MM-DD).');
      const client = args.client_name ? await findClientId(db, companyId, args.client_name) : null;
      if (args.client_name && !client) throw new BusinessRuleError(missingClientGuidance(args.client_name));
      let projectId: string | null = null; if (args.project_name) { const found = await db.from('projects').select('id').eq('company_id', companyId).ilike('name', `%${clean(args.project_name, 255).replaceAll('%', '\\%').replaceAll('_', '\\_')}%`).limit(2); if (found.error) throw found.error; if (found.data?.length > 1) fail('Há mais de um projeto com esse nome. Informe o nome completo.'); projectId = found.data?.[0]?.id || null; if (!projectId) fail(`Não encontrei o projeto “${clean(args.project_name, 255)}”.`); }
      const priority = ['baixa','media','alta','urgente'].includes(String(args.priority)) ? args.priority : 'media';
      const result = await db.from(table).insert({ company_id: companyId, title, description: clean(args.description, 2000), priority, due_date: args.due_date, status: 'a_fazer', client_id: client?.id || null, project_id: projectId, assigned_to: userId }).select('id,title,priority,status,due_date').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'update_task': {
      table = 'tasks'; const term = clean(args.query, 255); if (!term) fail('Informe o título ou UUID da tarefa.');
      let find = db.from(table).select('id,title').eq('company_id', companyId).limit(2);
      find = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(term)
        ? find.eq('id', term)
        : find.ilike('title', `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const found = await find; if (found.error) throw found.error;
      if (!found.data?.length) fail('Tarefa não encontrada.');
      if (found.data.length > 1) fail('Encontrei tarefas com títulos parecidos. Informe um título mais específico.');

      const updates: Record<string, unknown> = {};
      if (args.title !== undefined) { const title = clean(args.title, 255); if (!title) fail('O título da tarefa não pode ficar vazio.'); updates.title = title; }
      if (args.description !== undefined) updates.description = clean(args.description, 2000);
      if (args.priority !== undefined) { if (!['baixa', 'media', 'alta', 'urgente'].includes(String(args.priority))) fail('Informe uma prioridade válida.'); updates.priority = args.priority; }
      if (args.status !== undefined) { if (!['backlog', 'a_fazer', 'em_andamento', 'concluido'].includes(String(args.status))) fail('Informe um status válido para a tarefa.'); updates.status = args.status; }
      if (args.due_date !== undefined) { if (!validDate(args.due_date)) fail('Informe o prazo no formato YYYY-MM-DD.'); updates.due_date = args.due_date; }
      if (args.client_name !== undefined) {
        const client = clean(args.client_name, 255) ? await findClientId(db, companyId, args.client_name) : null;
        if (clean(args.client_name, 255) && !client) throw new BusinessRuleError(missingClientGuidance(args.client_name));
        updates.client_id = client?.id || null;
      }
      if (args.project_name !== undefined) {
        const projectName = clean(args.project_name, 255);
        if (!projectName) updates.project_id = null;
        else {
          const project = await db.from('projects').select('id').eq('company_id', companyId).ilike('name', `%${projectName.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`).limit(2);
          if (project.error) throw project.error;
          if (!project.data?.length) fail(`Não encontrei o projeto “${projectName}”.`);
          if (project.data.length > 1) fail('Há mais de um projeto com esse nome. Informe o nome completo.');
          updates.project_id = project.data[0].id;
        }
      }
      if (!Object.keys(updates).length) fail('Informe ao menos um campo para atualizar.');
      const result = await db.from(table).update(updates).eq('company_id', companyId).eq('id', found.data[0].id).select('id,title,description,priority,status,due_date,client_id,project_id').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'delete_task': {
      table = 'tasks'; const id = clean(args.task_id, 36); if (!id) fail('Tarefa não foi identificada antes da confirmação.');
      const result = await db.from(table).delete().eq('company_id', companyId).eq('id', id).select('id,title').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'complete_task': {
      table = 'tasks'; const term = clean(args.task_id_or_title, 255); if (!term) fail('Informe qual tarefa deve ser concluída.');
      let q = db.from(table).select('id,title,status').eq('company_id', companyId).limit(2);
      q = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(term) ? q.eq('id', term) : q.ilike('title', `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const found = await q; if (found.error) throw found.error; if (!found.data?.length) fail('Tarefa não encontrada.'); if (found.data.length > 1) fail('Encontrei tarefas com títulos parecidos. Informe um título mais específico.');
      const result = await db.from(table).update({ status: 'concluido' }).eq('company_id', companyId).eq('id', found.data[0].id).select('id,title,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'reschedule_calendar_event': {
      table = 'calendar_events'; const term = clean(args.query, 255); const date = clean(args.new_date, 10); const time = clean(args.new_start_time, 5);
      if (!term || !validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('Informe compromisso, nova data válida e horário HH:mm.');
      let lookup = db.from(table).select('id,title').eq('company_id', companyId).neq('status', 'cancelado');
      lookup = args.event_id ? lookup.eq('id', args.event_id) : lookup.ilike('title', `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const found = await lookup.limit(2);
      if (found.error) throw found.error; if (!found.data?.length) throw new BusinessRuleError('Não encontrei esse compromisso na agenda da sua empresa. Informe o título ou consulte a agenda para escolher o compromisso.'); if (found.data.length > 1) throw new BusinessRuleError('Há mais de um compromisso compatível. Especifique o título para evitar alterar a reunião errada.');
      const result = await db.from(table).update({ event_date: date, start_time: time, ...(Number(args.new_duration_minutes) ? { duration_minutes: Math.min(480, Math.max(15, Number(args.new_duration_minutes))) } : {}) }).eq('company_id', companyId).eq('id', found.data[0].id).select('id,title,event_date,start_time,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'cancel_calendar_event': {
      table = 'calendar_events'; const term = clean(args.query, 255); if (!term) fail('Informe qual compromisso deve ser cancelado.');
      let lookup = db.from(table).select('id,title').eq('company_id', companyId).neq('status', 'cancelado');
      lookup = args.event_id ? lookup.eq('id', args.event_id) : lookup.ilike('title', `%${term.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      const found = await lookup.limit(2);
      if (found.error) throw found.error; if (!found.data?.length) throw new BusinessRuleError('Não encontrei esse compromisso na agenda da sua empresa. Informe o título ou consulte a agenda para escolher o compromisso.'); if (found.data.length > 1) throw new BusinessRuleError('Há mais de um compromisso compatível. Especifique o título para evitar alterar a reunião errada.');
      const result = await db.from(table).update({ status: 'cancelado' }).eq('company_id', companyId).eq('id', found.data[0].id).select('id,title,event_date,start_time,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'update_calendar_event': {
      table = 'calendar_events'; const id = clean(args.event_id || args.id, 36); if (!id) fail('Compromisso não foi identificado antes da atualização.');
      const updates: Record<string, unknown> = {};
      if (args.status && ['agendado','concluido','cancelado'].includes(String(args.status))) updates.status = args.status;
      if (args.start_time) { const time = clean(args.start_time, 5); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('Informe horário no formato HH:mm.'); updates.start_time = time; }
      if (!Object.keys(updates).length) fail('Informe um novo status ou horário.');
      const result = await db.from(table).update(updates).eq('company_id', companyId).eq('id', id).select('id,title,event_date,start_time,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'create_calendar_event': {
      table = 'calendar_events';
      const { title, date, time, description } = calendarInput(args);
      const client = args.client_name ? await findClientId(db, companyId, args.client_name) : null;
      if (args.client_name && !client) throw new BusinessRuleError(missingClientGuidance(args.client_name));
      const result = await db.from(table).insert({ company_id: companyId, user_id: userId, title, description, event_type: ['reuniao','ligacao','tarefa','compromisso','outro'].includes(String(args.event_type)) ? args.event_type : 'reuniao', event_date: date, start_time: time, duration_minutes: Math.min(480, Math.max(15, Number(args.duration_minutes) || 60)), client_id: client?.id || null, location: clean(args.location, 255) || null, status: 'agendado' }).select('id,title,event_date,start_time,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'create_financial_transaction': {
      table = 'financial_transactions'; const amount = Number(args.amount); if (!['receita','despesa'].includes(String(args.type)) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || !clean(args.description, 255) || !validDate(args.due_date)) fail('Informe tipo, descrição, valor positivo e vencimento válido.');
      const client = args.client_name ? await findClientId(db, companyId, args.client_name) : null;
      if (args.client_name && !client) throw new BusinessRuleError(missingClientGuidance(args.client_name));
      const result = await db.from(table).insert({ company_id: companyId, client_id: client?.id || null, type: args.type, description: clean(args.description, 255), amount, category: clean(args.category, 100) || 'Outros', due_date: args.due_date, status: ['pago','pendente','atrasado'].includes(String(args.status)) ? args.status : 'pendente', payment_date: args.status === 'pago' ? args.due_date : null, payment_method: null }).select('id,type,description,amount,category,due_date,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'update_financial_transaction': {
      table = 'financial_transactions'; const id = clean(args.transaction_id, 36); if (!id) fail('Lançamento não foi identificado antes da confirmação.');
      const updates: Record<string, unknown> = {};
      if (args.description !== undefined) { const value = clean(args.description, 255); if (!value) fail('A descrição não pode ficar vazia.'); updates.description = value; }
      if (args.amount !== undefined) { const amount = Number(args.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) fail('Informe um valor positivo válido.'); updates.amount = amount; }
      if (args.category !== undefined) updates.category = clean(args.category, 100) || 'Outros';
      if (args.due_date !== undefined) { if (!validDate(args.due_date)) fail('Informe o vencimento no formato YYYY-MM-DD.'); updates.due_date = args.due_date; }
      if (args.type !== undefined) { if (!['receita','despesa'].includes(String(args.type))) fail('Informe receita ou despesa.'); updates.type = args.type; }
      if (args.status !== undefined) { if (!['pago','pendente','atrasado'].includes(String(args.status))) fail('Informe um status financeiro válido.'); updates.status = args.status; updates.payment_date = args.status === 'pago' ? (args.due_date || null) : null; }
      if (!Object.keys(updates).length) fail('Informe ao menos um campo financeiro para atualizar.');
      const result = await db.from(table).update(updates).eq('company_id', companyId).eq('id', id).select('id,type,description,amount,category,due_date,status').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'delete_financial_transaction': {
      table = 'financial_transactions'; const id = clean(args.transaction_id, 36); if (!id) fail('Lançamento não foi identificado antes da confirmação.');
      const result = await db.from(table).delete().eq('company_id', companyId).eq('id', id).select('id,description,amount').single();
      if (result.error) throw result.error; data = result.data; break;
    }
    case 'delete_document': {
      table = 'documents'; const id = clean(args.document_id, 36); if (!id) fail('Documento não foi identificado antes da confirmação.');
      const existing = await db.from(table).select('id,title,file_path').eq('company_id', companyId).eq('id', id).single();
      if (existing.error) throw existing.error;
      const removed = await db.from(table).delete().eq('company_id', companyId).eq('id', id).select('id,title').single();
      if (removed.error) throw removed.error;
      const filePath = clean(existing.data?.file_path, 1000);
      if (filePath && !filePath.startsWith('/') && !filePath.includes('..')) {
        const storage = await db.storage.from('documents').remove([filePath]);
      if (storage.error) data = { ...removed.data, fileCleanupPending: true };
      }
      data = removed.data; break;
    }
  }
  const changed = writeTools.has(tool);
  const entity = tool.includes('client') ? 'client' : tool.includes('project') ? 'project' : tool.includes('task') ? 'task' : tool.includes('calendar') ? 'calendar_event' : tool.includes('financial') ? 'financial_transaction' : undefined;
  const action = ['delete_client','delete_project','delete_task','delete_financial_transaction','delete_document'].includes(tool)
    ? 'deleted'
    : ['update_client', 'update_project', 'update_task', 'update_financial_transaction', 'complete_task', 'reschedule_calendar_event', 'cancel_calendar_event', 'update_calendar_event'].includes(tool)
    ? 'updated'
    : changed ? 'created' : undefined;
  return {
    success: true,
    data,
    entity: table,
    action: changed ? 'created_or_updated' : 'read',
    message: 'Operação concluída no banco de dados.',
    actionSummary: changed ? 'Registro confirmado pelo Supabase.' : 'Consulta realizada no Supabase.',
    ...(changed && entity && action ? { changesMade: { entity, action, id: data?.id } } : {}),
  };
}

function saoPauloDate(timeZone = 'America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
const clientStatusText = (status: unknown) => ({
  ativo: 'Ativo', em_negociacao: 'Em negociação', pendente: 'Pendente', inativo: 'Inativo',
}[String(status)] || 'Inativo');

function describe(tool: ToolName, result: any) {
  if (tool === 'create_client_and_meeting') return `${result.data.client.created ? 'Cliente cadastrado' : 'Cliente existente reutilizado'}: ${result.data.client.name}. Reunião gravada em ${result.data.event.event_date} às ${result.data.event.start_time}, vinculada ao cliente.`;
  if (tool === 'delete_project') return `Projeto ${result.data?.name || ''} excluído com sucesso.`;
  if (tool === 'delete_client') return `Cliente ${result.data?.name || ''} excluído com sucesso.`;
  if (tool === 'delete_task') return `Tarefa ${result.data?.title || ''} excluída com sucesso.`;
  if (tool === 'delete_financial_transaction') return 'Lançamento financeiro excluído com sucesso.';
  if (tool === 'delete_document') return `Documento ${result.data?.title || ''} excluído com sucesso.${result.data?.fileCleanupPending ? ' O arquivo associado ainda precisa ser removido pelo administrador.' : ''}`;
  if (tool.startsWith('get_')) {
    if (tool === 'get_client' && result.data?.found === false) return result.data.guidance;
    if (tool === 'get_dashboard_summary') {
      const value = result.data;
      return `Resumo atualizado da empresa:\n• Clientes ativos: ${value.activeClients}\n• Projetos em andamento: ${value.activeProjects}\n• Tarefas pendentes: ${value.pendingTasks} (${value.overdueTasks} atrasadas)\n• Compromissos hoje: ${value.todayAppointments}\n• Receitas pagas no mês: R$ ${Number(value.monthRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• Despesas pagas no mês: R$ ${Number(value.monthExpenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${value.financialTotalsTruncated ? '\nObservação: o cálculo considera até 10.000 registros.' : ''}`;
    }
    if (tool === 'get_my_day') {
      const value = result.data;
      return `Visão de hoje:\nTarefas atrasadas ou para hoje (${value.overdueOrTodayTasks.length}): ${value.overdueOrTodayTasks.map((row: any) => row.title).join(', ') || 'nenhuma'}.\nCompromissos de hoje (${value.todaysAppointments.length}): ${value.todaysAppointments.map((row: any) => `${row.title} às ${row.start_time}`).join(', ') || 'nenhum'}.\nPendências financeiras vencidas ou para hoje (${value.dueFinancialTransactions.length}): ${value.dueFinancialTransactions.map((row: any) => `${row.description} — R$ ${Number(row.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join(', ') || 'nenhuma'}.`;
    }
    const list = Array.isArray(result.data) ? result.data : [];
    if (!list.length && tool !== 'get_financial_transactions') return 'Não encontrei registros com esses critérios.';
    if (tool === 'get_financial_transactions') {
      const rows = Array.isArray(result.data?.rows) ? result.data.rows : list;
      const total = Number(result.data?.totalAmount ?? rows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0));
      const count = Number(result.data?.count ?? rows.length);
      return `Encontrei ${count} lançamento(s), totalizando R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${result.data?.truncated ? ' (a soma considera até 10.000 registros)' : ''}.${rows.length ? `\n${rows.slice(0, 30).map((row: any) => `• ${row.type === 'receita' ? 'Receita' : 'Despesa'}: ${row.description} — R$ ${Number(row.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${row.status}, vencimento ${row.due_date})`).join('\n')}` : ''}`;
    }
    const lines = list.map((row: any) => {
      if (tool === 'get_clients') return `• ${row.name}${row.company_name ? ` — ${row.company_name}` : ''} (${clientStatusText(row.status)})${row.email ? ` • ${row.email}` : ''}`;
      if (tool === 'get_clients_needing_attention') return `• ${row.client.name}${row.client.company_name ? ` — ${row.client.company_name}` : ''} [${row.badgeText}]: ${row.reason}`;
      if (tool === 'get_client') return `• ${row.name}${row.company_name ? ` — ${row.company_name}` : ''} (${clientStatusText(row.status)})${row.email ? ` • ${row.email}` : ''}`;
      if (tool === 'get_documents') return `• ${row.title} — ${row.category}${row.file_size ? ` • ${row.file_size}` : ''} (${row.status})`;
      if (tool === 'get_projects') return `• ${row.name} — ${row.status}, ${row.progress || 0}%${row.due_date ? ` • prazo ${row.due_date}` : ''}`;
      if (tool === 'get_tasks') return `• ${row.title} — ${row.status}, prioridade ${row.priority}${row.due_date ? ` • prazo ${row.due_date}` : ''}`;
      if (tool === 'get_calendar_events') return `• ${row.title} — ${row.event_date} às ${row.start_time} (${row.status})`;
      return `• ${row.title}`;
    });
    return `Encontrei ${list.length} registro(s):\n${lines.join('\n')}`;
  }
  const item = result.data;
  if (tool === 'create_client') return `Cliente ${item?.name || ''} cadastrado com sucesso.`;
  if (tool === 'update_client') return `Dados do cliente ${item?.name || ''} atualizados com sucesso.`;
  if (tool === 'create_project') return `Projeto ${item?.name || ''} cadastrado com sucesso.`;
  if (tool === 'update_project') return `Projeto ${item?.name || ''} atualizado com sucesso.`;
  if (tool === 'create_task') return `Tarefa ${item?.title || ''} criada com sucesso.`;
  if (tool === 'update_task') return `Tarefa ${item?.title || ''} atualizada com sucesso.`;
  if (tool === 'complete_task') return `Tarefa ${item?.title || ''} concluída com sucesso.`;
  if (tool === 'create_calendar_event') return `Compromisso ${item?.title || ''} agendado para ${item?.event_date} às ${item?.start_time}.`;
  if (tool === 'reschedule_calendar_event') return `Compromisso ${item?.title || ''} reagendado para ${item?.event_date} às ${item?.start_time}.`;
  if (tool === 'update_calendar_event') return `Compromisso ${item?.title || ''} atualizado com sucesso.`;
  if (tool === 'create_financial_transaction') return `Lançamento financeiro de R$ ${Number(item?.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado com sucesso.`;
  if (tool === 'update_financial_transaction') return 'Lançamento financeiro atualizado com sucesso.';
  if (tool === 'delete_financial_transaction') return 'Lançamento financeiro excluído com sucesso.';
  return `Ação concluída com sucesso: ${item?.name || item?.title || item?.description || 'registro'}.`;
}

async function geminiCall(apiKey: string, contents: unknown[], systemInstruction: string, signal: AbortSignal, allowTools = true) {
  const selected = allowTools ? selectDeclarations(declarations, contents as any[]) : [];
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    // In AUTO mode the model decides whether to answer or call a function.
    // Gemini only accepts allowedFunctionNames with ANY or VALIDATED modes.
    body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, ...(selected.length ? { tools: [{ functionDeclarations: selected }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } } : {}), generationConfig: { maxOutputTokens: 700, ...(model === 'gemini-3.1-flash-lite' ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}) } }),
  }, {
    onRetry: (event) => console.warn('[gemini-retry]', JSON.stringify({ model, ...event })),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = response.status;
    const providerMessage = typeof payload?.error?.message === 'string'
      ? payload.error.message
        .replaceAll(apiKey, '[credencial omitida]')
        .replace(/(?:AIza|AQ\.)[A-Za-z0-9_.-]{20,}/g, '[credencial omitida]')
        .replace(/[\r\n\t]+/g, ' ')
        .slice(0, 400)
      : '';
    const providerStatus = String(payload?.error?.status || '');
    const errorType = isInvalidApiKey(status, providerStatus, providerMessage)
      ? 'INVALID_API_KEY'
      : status === 429
      ? 'RATE_LIMIT'
      : status === 403
        ? 'PROJECT_RESTRICTED'
        : status === 404
          ? 'MODEL_UNAVAILABLE'
          : status === 400 || status === 401
            ? 'INVALID_REQUEST'
            : status >= 500 ? 'UPSTREAM_UNAVAILABLE' : 'API_ERROR';
    const message = errorType === 'RATE_LIMIT'
      ? 'Limite de requisições ou cota do Gemini atingido. Aguarde ou confira a cota do projeto.'
      : errorType === 'PROJECT_RESTRICTED'
        ? `O projeto Gemini não tem acesso à API ou está restrito${providerMessage ? `: ${providerMessage}` : '. Confira o faturamento e as cotas no Google AI Studio.'}`
        : errorType === 'MODEL_UNAVAILABLE'
          ? `O modelo Gemini configurado não está disponível para este projeto${providerMessage ? `: ${providerMessage}` : '.'}`
          : errorType === 'INVALID_API_KEY'
            ? 'A chave GEMINI_API_KEY foi recusada pelo Google. Atualize o Secret com uma chave válida do projeto autorizado.'
            : errorType === 'UPSTREAM_UNAVAILABLE'
              ? `A API do Gemini está temporariamente indisponível (HTTP ${status}). Tente novamente mais tarde.`
              : `O Gemini recusou a solicitação (HTTP ${status})${providerMessage ? `: ${providerMessage}` : '.'}`;
    throw Object.assign(new Error(message), { status, providerStatus, errorType });
  }
  return payload;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headersFor(origin) });
  if (req.method !== 'POST' || (origin && !allowedOrigins.has(origin))) return json({ success: false, error: 'Origem ou método não permitido.' }, 403, origin);
  const requestStart = performance.now();
  const requestId = crypto.randomUUID();
  const timings: Record<string, number> = {};
  const respond = (body: Record<string, unknown>, status: number) => {
    timings.totalMs = Math.round(performance.now() - requestStart);
    console.info('[nexus-ai-timing]', JSON.stringify({requestId, model, status, ...timings}));
    return json(body, status, origin);
  };
  const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // Supabase now injects named publishable keys. Keep the legacy anon key as a
  // compatibility fallback for projects that have not migrated yet.
  let publishableKey = '';
  try {
    const namedKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    publishableKey = namedKeys.default || Object.values(namedKeys)[0] || '';
  } catch {
    publishableKey = '';
  }
  publishableKey ||= Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!apiKey || !supabaseUrl || !publishableKey) return json({ success: false, error: 'O serviço de IA não está configurado no servidor.' }, 503, origin);
  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ success: false, error: 'Faça login para usar o assistente.' }, 401, origin);

  try {
    if (Number(req.headers.get('content-length') || 0) > 32_000) return json({ success: false, error: 'A mensagem excede o tamanho permitido.' }, 413, origin);
    const db = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const authStart = performance.now();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return json({ success: false, error: 'Sessão inválida. Entre novamente.' }, 401, origin);
    timings.authMs = Math.round(performance.now() - authStart);
    const profileStart = performance.now();
    const user = auth.user;
    const { data: profile, error: profileError } = await db.from('profiles').select('company_id,full_name,role').eq('user_id', user.id).maybeSingle();
    if (profileError || !profile?.company_id) return json({ success: false, error: 'Não foi possível identificar a empresa deste usuário.' }, 403, origin);
    timings.profileMs = Math.round(performance.now() - profileStart);
    const body = await req.json();
    const timeZone = validTimeZone(body.timeZone);
    const signal = AbortSignal.timeout(25_000);

    if (body.action === 'analyze_report') {
      const reportData = body.reportData;
      if (!reportData || typeof reportData !== 'object' || Array.isArray(reportData)) return json({ success: false, error: 'Os dados do relatório são inválidos.' }, 400, origin);
      const serialized = JSON.stringify(reportData);
      if (serialized.length > 16_000) return json({ success: false, error: 'O resumo do relatório excede o limite permitido.' }, 413, origin);
      const now = Date.now();
      const window = chatRateWindows.get(user.id);
      if (!window || now - window.startedAt >= 60_000) chatRateWindows.set(user.id, { startedAt: now, count: 1 });
      else if (window.count >= 20) return json({ success: false, error: 'Limite temporário de análises atingido. Aguarde um minuto.' }, 429, origin);
      else window.count += 1;
      const contents = [{ role: 'user', parts: [{ text: `Analise os dados reais filtrados abaixo para gerar um resumo gerencial breve em português brasileiro. Use somente números presentes neste JSON, não estime dados ausentes, não invente causas ou comparações. Separe fatos observados de recomendações e informe quando não houver base suficiente. A análise é somente consultiva: não solicite nem execute alterações.\n\n${serialized}` }] }];
      const instruction = 'Você é o Nexus AI, assistente de Business Intelligence. Sua tarefa nesta chamada é somente analisar o resumo estruturado de indicadores fornecido pelo próprio sistema. Não há ferramentas de consulta ou escrita disponíveis; use exclusivamente os dados recebidos. Não trate receitas pendentes como caixa recebido, nem despesas pendentes como pagas. Chame o resultado de caixa, não de lucro contábil. Identifique atrasos, despesas relevantes, produtividade e recomendações apenas quando os dados sustentarem isso. Responda de forma concisa com: Resumo executivo, Análise financeira, Produtividade, Alertas e Recomendações. Se um grupo não tiver dados, diga isso explicitamente.';
      const analysisStart = performance.now();
      const response = await geminiCall(apiKey, contents, instruction, signal, false);
      timings.geminiMs = Math.round(performance.now() - analysisStart);
      const candidate = response.candidates?.[0];
      if (!candidate || candidate.finishReason === 'SAFETY') return respond({ success: false, error: 'Não foi possível gerar a análise com esses dados.' }, 422);
      const analysisText = candidate.content?.parts?.filter((part: any) => !part.thought).map((part: any) => part.text || '').join('').trim();
      if (!analysisText) return respond({ success: false, error: 'O Nexus AI não retornou uma análise utilizável.' }, 502);
      return respond({ success: true, text: analysisText, status: 'success' }, 200);
    }

    if (body.action === 'confirm' || body.action === 'cancel') {
      const token = clean(body.confirmationToken, 6000);
      const confirmation = await verifyConfirmation(token, apiKey, user.id);
      if (confirmation.companyId !== profile.company_id) return json({ success: false, error: 'Confirmação inválida para esta empresa.' }, 403, origin);
      const {data: pendingAction, error: pendingActionError} = await db.from('ai_action_logs')
        .select('tool_name,parameters')
        .eq('id', confirmation.logId)
        .eq('company_id', profile.company_id)
        .eq('user_id', user.id)
        .eq('status', 'pending_confirmation')
        .maybeSingle();
      if (pendingActionError || !pendingAction || !toolNames.includes(pendingAction.tool_name)) return json({ success: false, error: 'Esta confirmação já foi usada ou expirou.' }, 409, origin);
      const confirmedTool = pendingAction.tool_name as ToolName;
      const confirmedArgs = pendingAction.parameters as Record<string, unknown>;
      if (!writeTools.has(confirmedTool)) return json({ success: false, error: 'Confirmação inválida.' }, 403, origin);
      if (financeTools.has(confirmedTool) && !['admin', 'gerente'].includes(profile.role)) return json({ success: false, error: 'Seu perfil não tem permissão para alterar lançamentos financeiros.' }, 403, origin);
      if (body.action === 'confirm' && confirmedTool === 'create_client_and_meeting') {
        const transactionStart = performance.now();
        const {data,error} = await db.rpc('confirm_client_meeting',{p_log_id:confirmation.logId});
        if(error)throw error;
        timings.databaseMs=Math.round(performance.now()-transactionStart);
        const result={success:true,data,changesMade:{entity:'calendar_event',action:'created',id:data.event.id}};
        return respond({success:true,status:'success',text:describe(confirmedTool,result)},200);
      }
      const claimed = await db.from('ai_action_logs').update({ status: 'rejected', error_message: 'Confirmação consumida.' }).eq('id', confirmation.logId).eq('company_id', profile.company_id).eq('user_id', user.id).eq('status', 'pending_confirmation').select('id').maybeSingle();
      if (claimed.error) throw claimed.error;
      if (!claimed.data) return json({ success: false, error: 'Esta confirmação já foi usada ou expirou.' }, 409, origin);
      if (body.action === 'cancel') return json({ success: true, text: 'Operação cancelada. Nenhuma alteração foi realizada.', status: 'cancelled' }, 200, origin);
      try {
        const result = await executeTool(db, profile.company_id, user.id, confirmedTool, confirmedArgs);
        const update = await db.from('ai_action_logs').update({ status: 'success', result: result.data, error_message: null }).eq('id', confirmation.logId).eq('company_id', profile.company_id);
        if (update.error) console.error('[gemini-edge] Falha ao atualizar auditoria da ação confirmada.', { requestId });
        return json({ success: true, status: 'success', text: describe(confirmedTool, result) }, 200, origin);
      } catch (error) {
        await db.from('ai_action_logs').update({ status: 'failed', error_message: 'Falha ao executar ação.' }).eq('id', confirmation.logId).eq('company_id', profile.company_id);
        throw error;
      }
    }

    if (body.action !== 'chat' || typeof body.message !== 'string' || !body.message.trim()) return json({ success: false, error: 'Envie uma mensagem válida.' }, 400, origin);
    if (body.message.length > 4000) return json({ success: false, error: 'A mensagem excede 4.000 caracteres.' }, 413, origin);
    const now = Date.now();
    const window = chatRateWindows.get(user.id);
    if (!window || now - window.startedAt >= 60_000) chatRateWindows.set(user.id, { startedAt: now, count: 1 });
    else if (window.count >= 20) return json({ success: false, error: 'Limite temporário de mensagens atingido. Aguarde um minuto e tente novamente.' }, 429, origin);
    else window.count += 1;
    const instantReply = getInstantReply([{ role: 'user', parts: [{ text: body.message.trim() }] }]);
    if (instantReply) return respond({ success: true, text: instantReply }, 200);
    const companyResult = await db.from('companies').select('name').eq('id', profile.company_id).single();
    if (companyResult.error) throw companyResult.error;
    const safeHistory = Array.isArray(body.history) ? body.history.slice(-12).filter((m: any) => ['user','assistant'].includes(m?.sender) && typeof m.content === 'string').map((m: any) => ({ role: m.sender === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 4000) }] })) : [];
    const pageContextLabels: Record<string, string> = {
      dashboard: 'painel inicial', clients: 'clientes', projects: 'projetos', tasks: 'tarefas',
      calendar: 'agenda', finance: 'financeiro', documents: 'documentos',
      'ai-assistant': 'assistente', reports: 'relatórios', architecture: 'arquitetura', settings: 'configurações',
    };
    const pageLabel = typeof body.pageContext === 'string' ? pageContextLabels[body.pageContext] : undefined;
    const currentMessage = pageLabel
      ? `Contexto da tela atual: ${pageLabel}. Use esse contexto para priorizar a resposta e consulte ou altere apenas dados autorizados para este usuário.\n\n${body.message.trim()}`
      : body.message.trim();
    const contents = [...safeHistory.filter((m: any) => m.role === 'user' || m.role === 'model'), { role: 'user', parts: [{ text: currentMessage }] }];
    const system = buildSystemInstruction(companyResult.data.name, saoPauloDate(timeZone), timeZone);
    const geminiStart = performance.now();
    let response: any;
    try { response = await geminiCall(apiKey, contents, system, signal); }
    finally { timings.geminiMs = Math.round(performance.now() - geminiStart); }
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    if (!candidate || candidate.finishReason === 'SAFETY') return respond({ success: false, error: 'Reformule a solicitação para que eu possa ajudar.' }, 422);
    const calls = parts.map((part: any) => part.functionCall).filter(Boolean);
    if (!calls.length) {
      const text = parts.filter((part: any) => !part.thought).map((part: any) => part.text || '').join('').trim();
      if (!text) return respond({ success: false, error: 'O Gemini não retornou uma resposta utilizável.' }, 502);
      return respond({ success: true, text }, 200);
    }
    const parsedCalls = calls.map((call: any) => ({tool: call.name as ToolName, args: call.args}));
    if (parsedCalls.some(({tool,args}: any) => !toolNames.includes(tool) || !args || typeof args !== 'object' || Array.isArray(args))) return respond({success:false,error:'O assistente solicitou uma operação não autorizada.'},422);
    const requestMessage = String(body.message || '');
    const allowedTools = new Set(selectDeclarations(declarations, contents as any[]).map((item) => item.name));
    if (parsedCalls.some(({tool}: any) => !allowedTools.has(tool))) {
      return respond({ success: true, status: 'needs_clarification', text: 'Não consegui relacionar a resposta à sua solicitação atual. Reformule o pedido para eu consultar ou alterar o registro correto.' }, 200);
    }
    const writes = parsedCalls.filter(({tool}: any) => writeTools.has(tool));
    if (writes.length && isReadOnlyRequest(requestMessage)) {
      return respond({ success: true, status: 'needs_clarification', text: 'Entendi que você pediu uma consulta. Não alterei nenhum registro; tente reformular a pergunta indicando o cliente, projeto ou período.' }, 200);
    }
    const calendarClientName = extractCalendarClientName(requestMessage);
    if (calendarClientName) {
      for (const call of parsedCalls) {
        if (call.tool === 'get_calendar_events') call.args.client_name = calendarClientName;
      }
    }
    const databaseStart = performance.now();
    if (writes.length) {
      const action = combineClientMeetingCalls(parsedCalls) as {tool:ToolName;args:Record<string,unknown>} | null;
      if (!action) return respond({success:true,status:'needs_clarification',text:'Posso confirmar cadastro e reunião juntos. Para outras combinações, solicite uma operação por vez.'},200);
      const {tool,args}=action;
      if(financeTools.has(tool)&&!['admin','gerente'].includes(profile.role)) return respond({success:false,error:'Seu perfil não tem permissão para alterar lançamentos financeiros.'},403);
      await prepareCalendarAction(db,profile.company_id,tool,args,explicitlyUnlinkedMeeting(body.message));
      await prepareResolvedAction(db,profile.company_id,tool,args);
      const duplicate = await findRecentDuplicate(db,profile.company_id,user.id,tool,args);
      const returnDuplicate = (row: any) => {
        if (row.status === 'pending_confirmation') return respond({success:true,status:'needs_clarification',text:'Já recebi este mesmo pedido e existe uma ação igual pendente. Confira a mensagem anterior antes de reenviar; não criei uma segunda ação.'},200);
        if (row.status === 'failed') return respond({success:true,status:'needs_clarification',text:'A tentativa anterior teve um erro e não foi repetida para evitar duplicidade. Confira o módulo correspondente e, se a alteração não foi salva, envie o pedido novamente em alguns minutos.'},200);
        return respond({success:true,status:'duplicate',text:`Esta mesma ação já foi concluída. Não criei outro registro.\n\n${describe(tool,{data:row.result})}`},200);
      };
      if (duplicate) return returnDuplicate(duplicate);
      const idempotencyKey=await makeIdempotencyKey(profile.company_id,user.id,tool,args);
      let logId: string;
      try {
        logId=await logAction(db,{company_id:profile.company_id,user_id:user.id,tool_name:tool,parameters:args,idempotency_key:idempotencyKey,status:'pending_confirmation'});
      } catch (error: any) {
        if (error?.code === '23505') {
          const raced = await findRecentDuplicate(db,profile.company_id,user.id,tool,args);
          if (raced) return returnDuplicate(raced);
        }
        throw error;
      }
      const canAutoExecute=automaticWriteTools.has(tool) && !(tool==='update_calendar_event'&&args.status==='cancelado');
      if (canAutoExecute) {
        try {
          let result: any;
          if (tool === 'create_client_and_meeting') {
            const {data,error}=await db.rpc('confirm_client_meeting',{p_log_id:logId});
            if(error)throw error;
            result={success:true,data,changesMade:{entity:'calendar_event',action:'created',id:data.event.id}};
          } else {
            result=await executeTool(db,profile.company_id,user.id,tool,args,timeZone);
          }
          const update=await db.from('ai_action_logs').update({status:'success',result:result.data,error_message:null}).eq('id',logId).eq('company_id',profile.company_id);
          if(update.error) console.error('[gemini-edge] Falha ao finalizar auditoria da ação.',{requestId});
          timings.databaseMs=Math.round(performance.now()-databaseStart);
          return respond({success:true,status:'success',text:describe(tool,result)},200);
        } catch (error) {
          await db.from('ai_action_logs').update({status:'failed',error_message:'Falha ao executar ação.'}).eq('id',logId).eq('company_id',profile.company_id);
          throw error;
        }
      }
      const token=await signConfirmation({userId:user.id,companyId:profile.company_id,logId,expiresAt:Date.now()+5*60_000},apiKey);
      const message=confirmationMessage(tool,args);
      timings.databaseMs=Math.round(performance.now()-databaseStart);
      return respond({success:true,status:'pending_confirmation',text:message,pendingConfirmation:{id:logId,message,confirmationToken:token}},200);
    }
    // Reads already return verified database values: no second generation or tool loop.
    const results=await Promise.all(parsedCalls.map(async ({tool,args}:any)=>{
      const result=await executeTool(db,profile.company_id,user.id,tool,args,timeZone);
      await logAction(db,{company_id:profile.company_id,user_id:user.id,tool_name:tool,parameters:args,status:'success',result:result.data});
      return {tool,args,result};
    }));
    timings.databaseMs=Math.round(performance.now()-databaseStart);
    const missing=results.find(({tool,result}:any)=>tool==='get_client'&&result.data?.found===false);
    if(missing)return respond({success:true,status:'needs_clarification',text:missing.result.data.guidance},200);
    return respond({success:true,text:results.map(({tool,result}:any)=>describe(tool,result)).join('\n\n')},200);
  } catch (error: any) {
    if (error instanceof BusinessRuleError) return respond({ success: true, status: 'needs_clarification', text: error.message }, 200);
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    const transportFailure = error instanceof TypeError && !('status' in error);
    const status = Number(error?.status) || (timedOut ? 504 : transportFailure ? 502 : 400);
    const errorType = error?.errorType || (timedOut ? 'TIMEOUT' : transportFailure ? 'UPSTREAM_UNAVAILABLE' : status === 429 ? 'RATE_LIMIT' : 'API_ERROR');
    console.error('[gemini-edge] Falha ao processar solicitação.', JSON.stringify({requestId,errorType,status}));
    const publicMessage = status === 429
      ? 'Há muitas solicitações neste momento. Aguarde um pouco e tente novamente.'
      : 'Não foi possível concluir a operação. Tente novamente.';
    return respond({ success: false, error: publicMessage }, status);
  }
});

function confirmationMessage(tool: ToolName, args: Record<string, any>) {
  const detail = tool === 'create_client_and_meeting'
    ? `${args.existing_client_id ? 'usar o cliente existente' : 'cadastrar o cliente'} “${clean(args.name, 255)}” e agendar “${clean(args.title, 255)}” em ${clean(args.event_date, 10)} às ${clean(args.start_time, 5)}, com vínculo ao mesmo cliente. As duas ações serão gravadas juntas`
    : ['update_financial_transaction','delete_financial_transaction'].includes(tool)
      ? `${tool === 'delete_financial_transaction' ? 'exclusão do lançamento' : 'atualização do lançamento'} “${clean(args.query, 255)}”${args.amount !== undefined ? ` para R$ ${Number(args.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}${args.status ? `, status ${clean(args.status, 30)}` : ''}`
    : tool === 'delete_document'
      ? `exclusão do documento “${clean(args.query, 255)}” e tentativa de remover o arquivo armazenado`
    : tool === 'delete_project'
      ? `exclusão do projeto “${clean(args.query, 255)}”`
    : ['delete_client','delete_task'].includes(tool)
      ? `exclusão do registro “${clean(args.query, 255)}”`
    : tool === 'create_financial_transaction'
    ? `${args.type === 'receita' ? 'receita' : 'despesa'} de R$ ${Number(args.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${clean(args.description, 255)}, categoria ${clean(args.category, 100) || 'Outros'}, vencimento ${clean(args.due_date, 10)}${args.status === 'pago' ? ', marcado como pago' : ''}`
    : tool === 'create_calendar_event'
      ? `compromisso “${clean(args.title, 255)}” em ${clean(args.event_date, 10)} às ${clean(args.start_time, 5)}${args.client_name ? `, vinculado ao cliente “${clean(args.client_name, 255)}”` : args.participant_name ? `, com “${clean(args.participant_name, 255)}”, sem vínculo a cliente` : ', sem vínculo a cliente'}`
      : tool === 'create_task'
        ? `tarefa “${clean(args.title, 255)}” com prazo ${clean(args.due_date, 10)}`
        : tool === 'update_task'
          ? `atualização da tarefa “${clean(args.query, 255)}”${args.title ? `: título ${clean(args.title, 255)}` : ''}${args.status ? `, status ${clean(args.status, 30)}` : ''}${args.priority ? `, prioridade ${clean(args.priority, 30)}` : ''}${args.due_date ? `, prazo ${clean(args.due_date, 10)}` : ''}`
        : tool === 'create_project'
          ? `projeto “${clean(args.name, 255)}”`
          : tool === 'update_project'
            ? `atualização do projeto “${clean(args.query, 255)}”${args.status ? `, status ${clean(args.status, 30)}` : ''}${args.progress !== undefined ? `, progresso ${Number(args.progress)}%` : ''}${args.due_date ? `, prazo ${clean(args.due_date, 10)}` : ''}`
    : tool === 'complete_task'
      ? `conclusão da tarefa “${clean(args.task_id_or_title, 255)}”`
      : tool === 'reschedule_calendar_event'
        ? `reagendamento de “${clean(args.query, 255)}” para ${clean(args.new_date, 10)} às ${clean(args.new_start_time, 5)}`
        : tool === 'cancel_calendar_event'
          ? `cancelamento do compromisso “${clean(args.query, 255)}”`
          : tool === 'update_calendar_event'
            ? `atualização do compromisso ${clean(args.event_id || args.id || args.query, 255)}`
            : tool === 'update_client'
            ? `atualização do cliente “${clean(args.query, 255)}”`
            : `cadastro do cliente “${clean(args.name, 255)}”`;
  return `Confirme para gravar no sistema: ${detail}.`;
}
