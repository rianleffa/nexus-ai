// ==============================================================================
// NEXUS PDS — Serviço Reutilizável Google Gemini
// ==============================================================================
// Fornece integração com a API oficial do Google Gemini, com suporte a:
// 1. Supabase Edge Function (em produção com a chave isolada no servidor)
// 2. Chamada segura via Edge Function do Supabase
// 3. Tratamento robusto de erros com sanitização de chaves em logs e mensagens
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../supabase';
import { dataStore } from '../dataStore';
import { aiTools } from './tools';

export type GeminiErrorType =
  | 'INVALID_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'EMPTY_RESPONSE'
  | 'API_ERROR';

export interface GeminiError {
  type: GeminiErrorType;
  message: string;
  originalError?: any;
}

export interface GeminiToolCallResult {
  toolName: string;
  parameters: Record<string, any>;
  explanation?: string;
}

export interface GeminiResponse {
  success: boolean;
  text?: string;
  toolCall?: GeminiToolCallResult;
  error?: GeminiError;
  source: 'supabase_edge_function' | 'unavailable';
}

/**
 * Utilitário de segurança para mascarar e remover chaves de API de qualquer texto ou stacktrace
 */
export function sanitizeSecurityText(text: string): string {
  if (!text) return '';
  return text
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[CHAVE_PROTEGIDA]')
    .replace(/AQ\.[0-9A-Za-z-_]{30,}/g, '[CHAVE_PROTEGIDA]')
    .replace(/(?:key|token|apiKey|api_key)=([a-zA-Z0-9_\-\.]+)/gi, 'key=[CHAVE_PROTEGIDA]');
}

export class GeminiService {
  private static readonly MODEL_NAME = 'gemini-flash-latest';

  /**
   * Converte a lista de ferramentas cadastradas (aiTools) em declarações de ferramentas
   * para o protocolo de Function Calling do Gemini.
   */
  public static getToolDeclarations() {
    return Object.values(aiTools).map((tool) => {
      const properties: Record<string, any> = {};
      const required: string[] = tool.parameters.required || [];

      for (const [key, param] of Object.entries(tool.parameters.properties)) {
        properties[key] = {
          type: param.type.toUpperCase(),
          description: param.description || '',
          ...(param.enum ? { enum: param.enum } : {}),
        };
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'OBJECT',
          properties,
          required,
        },
      };
    });
  }

  /**
   * Envia um prompt genérico ao Google Gemini e retorna a resposta de texto
   */
  public static async sendPrompt(
    prompt: string,
    systemInstruction?: string
  ): Promise<GeminiResponse> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return {
        success: false,
        error: {
          type: 'EMPTY_RESPONSE',
          message: 'O prompt enviado está vazio.',
        },
        source: 'unavailable',
      };
    }

    // 1. Tentar via Supabase Edge Function se o Supabase estiver configurado
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('gemini', {
          body: {
            prompt: trimmed,
            systemInstruction,
            model: this.MODEL_NAME,
          },
        });

        if (!error && data?.success) {
          return {
            success: true,
            text: data.text || '',
            source: 'supabase_edge_function',
          };
        }

        if (error || (data && !data.success)) {
          const errType: GeminiErrorType = data?.errorType || 'API_ERROR';
          const errMsg = data?.error || error?.message || 'Falha na Edge Function do Supabase.';
          console.warn('[GeminiService] Supabase Edge Function falhou:', sanitizeSecurityText(errMsg));
          return {
            success: false,
            error: { type: errType, message: sanitizeSecurityText(errMsg) },
            source: 'unavailable',
          };
        }
      } catch (err: any) {
        console.warn('[GeminiService] Erro ao invocar Supabase Edge Function:', sanitizeSecurityText(err?.message));
        return {
          success: false,
          error: { type: 'NETWORK_ERROR', message: 'Não foi possível conectar ao serviço de IA.' },
          source: 'unavailable',
        };
      }
    }

    return {
      success: false,
      error: { type: 'API_ERROR', message: 'O serviço de IA não está configurado no servidor.' },
      source: 'unavailable',
    };
  }

  /**
   * Constrói as instruções de sistema dinâmicas com data atual real, fuso horário, dia da semana,
   * clientes cadastrados e regras de negócio para garantir precisão temporal e ausência de alucinações.
   */
  public static buildDynamicSystemPrompt(customContext?: string): string {
    const now = new Date();
    const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const currentDayName = daysOfWeek[now.getDay()];
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    // Day after tomorrow
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterISO = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;

    // Next Friday
    const nextFriday = new Date(now);
    const diffToFriday = (5 - now.getDay() + 7) % 7 || 7;
    nextFriday.setDate(now.getDate() + diffToFriday);
    const nextFridayISO = `${nextFriday.getFullYear()}-${String(nextFriday.getMonth() + 1).padStart(2, '0')}-${String(nextFriday.getDate()).padStart(2, '0')}`;

    // Known active clients from dataStore
    let clients = '';
    try {
      clients = dataStore.getClients().map((c: any) => `${c.name} (${c.company_name}) - Status: ${c.status}`).join(', ');
    } catch (e) {}

    // Projects in progress
    let projects = '';
    try {
      projects = dataStore.getProjects().map((p: any) => `"${p.name}" (Cliente: ${p.client_name || 'Geral'}, Progresso: ${p.progress}%, Orçamento: R$ ${p.budget})`).join('; ');
    } catch (e) {}

    // Upcoming meetings
    let upcoming = '';
    try {
      upcoming = dataStore
        .getCalendarEvents()
        .filter((e: any) => e.status !== 'cancelado')
        .slice(0, 6)
        .map((e: any) => `[${e.event_date} às ${e.start_time}: "${e.title}" com ${e.client_name || 'Geral'}]`)
        .join('; ');
    } catch (e) {}

    // Overdue or pending tasks
    let pendingTasks = '';
    try {
      pendingTasks = dataStore
        .getTasks()
        .filter((t: any) => t.status !== 'concluido')
        .slice(0, 6)
        .map((t: any) => `[Vence ${t.due_date}: "${t.title}" (${t.priority.toUpperCase()}) - ${t.client_name || 'Geral'}]`)
        .join('; ');
    } catch (e) {}

    return `Você é o assistente operacional do sistema de gestão empresarial ${dataStore.getCompany().name}.
Você executa comandos e responde dúvidas conectando Clientes, Projetos, Tarefas, Agenda, Financeiro e Documentos através de Function Calling seguro.

=== CONTEXTO TEMPORAL EM TEMPO REAL ===
- Data de Hoje: ${todayISO} (${currentDayName})
- Data de Amanhã: ${tomorrowISO}
- Data de Depois de Amanhã: ${dayAfterISO}
- Próxima Sexta-feira: ${nextFridayISO}
- Horário atual: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

=== DIRETRIZES DE RECONHECIMENTO DE DATAS E HORÁRIOS ===
1. Quando o usuário disser "hoje", use a data: ${todayISO}.
2. Quando o usuário disser "amanhã", use a data: ${tomorrowISO}.
3. Quando o usuário disser "depois de amanhã", use a data: ${dayAfterISO}.
4. Quando o usuário citar um dia da semana (ex: "sexta", "segunda"), calcule a data correta no formato YYYY-MM-DD.
5. Quando o usuário falar horários:
   - "14h", "14 horas", "às 2 da tarde", "às 14:00" -> Converta para "14:00" (formato 24h HH:mm).
   - "9h", "às 9", "9 da manhã" -> Converta para "09:00".
   - "10 e meia", "10h30" -> Converta para "10:30".
6. Nunca confunda 14h (tarde) com 02:00 (madrugada).

=== MAPEAMENTO DE INTENÇÃO OPERACIONAL ===
- "O que tenho para fazer hoje?", "Meu dia", "Minha rotina de hoje" -> Chame 'get_my_day'.
- "Quais clientes precisam de atenção?", "Clientes em alerta" -> Chame 'get_clients_needing_attention'.
- "Quais tarefas estão atrasadas?" -> Chame 'get_tasks' com overdue_only=true.
- "Mostre os projetos em andamento", "Como estão os projetos?" -> Chame 'get_projects' com status='em_andamento'.
- "Cadastre [Nome] como cliente" -> Chame 'create_client'.
- "Crie um projeto [Nome] para o cliente [X]" -> Chame 'create_project'.
- "Marque uma reunião com [Nome] [Data/Hora]" -> Chame 'create_calendar_event'.
- "Crie uma tarefa [Título] para amanhã" -> Chame 'create_task'.
- "Quanto tenho para receber?", "Quanto recebi?" -> Chame 'get_financial_transactions' ou 'get_dashboard_summary'.

=== DADOS REAIS DO SISTEMA ===
- Clientes Cadastrados: ${clients || 'Nenhum cliente cadastrado.'}
- Projetos da Empresa: ${projects || 'Nenhum projeto cadastrado'}
- Próximos Compromissos na Agenda: ${upcoming || 'Nenhum compromisso agendado'}
- Tarefas Pendentes/Atrasadas: ${pendingTasks || 'Nenhuma tarefa pendente'}

=== DIRETRIZES GERAIS ===
- Seja sempre objetivo, profissional, assertivo e natural em português do Brasil.
- Não invente informações fictícias de clientes ou finanças que não existam.
- Se uma solicitação for ambígua ou faltarem dados essenciais, faça uma pergunta breve para confirmar.
${customContext ? `\nContexto Adicional:\n${customContext}` : ''}`;
  }

  /**
   * Executa a extração de intenção e Tool Calling do Gemini com base no catálogo de ferramentas
   */
  public static async parseIntentWithTools(
    prompt: string,
    history?: any[],
    systemContext?: string
  ): Promise<GeminiResponse> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return {
        success: false,
        error: {
          type: 'EMPTY_RESPONSE',
          message: 'O prompt fornecido está vazio.',
        },
        source: 'unavailable',
      };
    }

    const toolDeclarations = this.getToolDeclarations();
    const systemPrompt = this.buildDynamicSystemPrompt(systemContext);

    // 1. Tentar via Supabase Edge Function
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('gemini', {
          body: {
            prompt: trimmed,
            history: Array.isArray(history) ? history.slice(-12) : [],
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: toolDeclarations }],
            model: this.MODEL_NAME,
          },
        });

        if (!error && data?.success) {
          if (data.functionCall) {
            return {
              success: true,
              toolCall: {
                toolName: data.functionCall.name,
                parameters: data.functionCall.args || {},
              },
              text: data.text,
              source: 'supabase_edge_function',
            };
          }
          return {
            success: true,
            text: data.text || '',
            source: 'supabase_edge_function',
          };
        }
        if (error || (data && !data.success)) {
          const message = sanitizeSecurityText(data?.error || error?.message || 'Falha na função de IA do servidor.');
          return {
            success: false,
            error: { type: data?.errorType || 'API_ERROR', message },
            source: 'unavailable',
          };
        }
      } catch (e: any) {
        console.warn('[GeminiService] Supabase Edge Function indisponível para Tool Calling.', sanitizeSecurityText(e?.message || ''));
        return {
          success: false,
          error: { type: 'NETWORK_ERROR', message: 'Não foi possível conectar ao serviço de IA.' },
          source: 'unavailable',
        };
      }
    }

    return {
      success: false,
      error: { type: 'API_ERROR', message: 'O serviço de IA não está configurado no servidor.' },
      source: 'unavailable',
    };
  }
}
