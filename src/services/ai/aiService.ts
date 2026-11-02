import {
  ChatMessage,
  ChatStep,
  AIExecutionContext,
  AIToolExecutionResult,
} from '../../types';
import { aiTools } from './tools';
import { dataStore, defaultCompany, defaultUser } from '../dataStore';
import { GeminiService } from './geminiService';

export class AIService {
  private static context: AIExecutionContext = {
    user: defaultUser,
    company: defaultCompany,
  };

  public static setContext(context: AIExecutionContext) {
    this.context = context;
  }

  // --------------------------------------------------------------------------
  // Process User Input through Natural Language and Function Calling Pipeline
  // --------------------------------------------------------------------------
  public static async processMessage(
    userText: string,
    history?: ChatMessage[],
    onProgressUpdate?: (partialMessage: Partial<ChatMessage>) => void
  ): Promise<ChatMessage> {
    const rawText = userText.trim();
    const messageId = `msg-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 1. Verificação de Segurança e Comandos Destrutivos (Barreira de Proteção)
    const lower = rawText.toLowerCase();
    if (
      lower.includes('apague todos') ||
      lower.includes('deletar todos') ||
      lower.includes('excluir todos') ||
      lower.includes('drop table') ||
      lower.includes('delete from') ||
      lower.includes('truncate')
    ) {
      dataStore.logAIAction(
        'security_barrier',
        { command: rawText },
        'rejected',
        null,
        'Tentativa de exclusão em massa ou injeção rejeitada pelo protocolo de segurança.'
      );

      return {
        id: messageId,
        sender: 'assistant',
        timestamp,
        content:
          '⚠️ **Operação Bloqueada por Segurança**\n\nA exclusão em massa de dados e comandos diretos de banco de dados são estritamente proibidos pela arquitetura de proteção do **NEXUS AI**. Cada registro deve ser gerenciado individualmente dentro das regras de negócio.',
      };
    }

    // 2. Processamento via Google Gemini (com Function Calling e Histórico)
    try {
      const geminiResult = await GeminiService.parseIntentWithTools(rawText, history);

      // Caso o Gemini tenha identificado uma ferramenta (Function Calling)
      if (geminiResult.success && geminiResult.toolCall && geminiResult.toolCall.toolName) {
        const { toolName, parameters } = geminiResult.toolCall;
        const tool = aiTools[toolName];

        if (tool) {
          const steps: ChatStep[] = [
            {
              label: 'Google Gemini 2.5 Flash',
              status: 'success',
              detail: `Intenção processada via ${geminiResult.source === 'supabase_edge_function' ? 'Supabase Edge Function' : 'API Oficial do Gemini'}`,
            },
            {
              label: `Identificada Tool: ${toolName}`,
              status: 'success',
            },
          ];

          // 2.1 Verificação de Ações Sensíveis (Confirmação Necessária)
          if (tool.requiresConfirmation) {
            const confirmMsg = tool.confirmationMessage
              ? tool.confirmationMessage(parameters)
              : `Deseja confirmar a execução da ferramenta "${toolName}"?`;

            dataStore.logAIAction(toolName, parameters, 'pending_confirmation');

            return {
              id: messageId,
              sender: 'assistant',
              timestamp,
              content: confirmMsg,
              toolCall: {
                toolName,
                parameters,
                steps: [
                  ...steps,
                  { label: 'Ação sensível identificada', status: 'warning', detail: 'Aguardando confirmação do usuário' },
                ],
                status: 'pending_confirmation',
              },
              pendingConfirmation: {
                id: `conf-${Date.now()}`,
                toolName,
                parameters,
                message: confirmMsg,
              },
            };
          }

          // 2.2 Execução Segura da Ferramenta
          steps.push({ label: `Executando ${toolName}`, status: 'pending' });
          await new Promise((resolve) => setTimeout(resolve, 300));

          const result = await tool.execute(parameters, this.context);

          steps[steps.length - 1] = {
            label: `Tool: ${toolName}`,
            status: result.success ? 'success' : 'error',
            detail: result.actionSummary,
          };

          dataStore.logAIAction(
            toolName,
            parameters,
            result.success ? 'success' : 'failed',
            result.data,
            result.success ? undefined : result.message
          );

          return {
            id: messageId,
            sender: 'assistant',
            timestamp,
            content: geminiResult.text || result.message,
            toolCall: {
              toolName,
              parameters,
              steps: [
                ...steps,
                { label: result.success ? 'Operação concluída' : 'Falha na execução', status: result.success ? 'success' : 'error' },
              ],
              result,
              status: result.success ? 'success' : 'error',
            },
          };
        }
      }

      // Caso o Gemini tenha retornado uma resposta conversacional direta
      if (geminiResult.success && geminiResult.text && geminiResult.text.trim()) {
        return {
          id: messageId,
          sender: 'assistant',
          timestamp,
          content: geminiResult.text,
        };
      }

      return {
        id: messageId,
        sender: 'assistant',
        timestamp,
        content: geminiResult.error?.message || 'O serviço de IA não retornou uma resposta utilizável.',
      };
    } catch (e) {
      console.warn('[AIService] Falha ao consultar o serviço de IA.', e);
      return {
        id: messageId,
        sender: 'assistant',
        timestamp,
        content: 'O serviço de IA está indisponível no momento. Verifique a integração do servidor e tente novamente.',
      };
    }

  }

  // Executar Ação Confirmada pelo Usuário (Callback de Botão [Confirmar])
  // --------------------------------------------------------------------------
  public static async executeConfirmed(
    toolName: string,
    parameters: Record<string, any>
  ): Promise<{ message: string; result: AIToolExecutionResult }> {
    const tool = aiTools[toolName];
    if (!tool) {
      throw new Error(`Ferramenta ${toolName} não encontrada.`);
    }

    const result = await tool.execute(parameters, this.context);
    dataStore.logAIAction(
      toolName,
      parameters,
      result.success ? 'success' : 'failed',
      result.data,
      result.success ? undefined : result.message
    );

    return {
      message: result.message,
      result,
    };
  }

  // --------------------------------------------------------------------------

}
