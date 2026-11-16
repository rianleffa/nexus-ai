import type { AIToolExecutionResult, ChatMessage } from '../../types';
import { supabase, isSupabaseConfigured } from '../supabase';

type AssistantResponse = {
  success: boolean;
  text?: string;
  error?: string;
  status?: 'pending_confirmation' | 'success' | 'cancelled';
  pendingConfirmation?: ChatMessage['pendingConfirmation'];
  toolCall?: {
    toolName: string;
    parameters: Record<string, unknown>;
    result?: AIToolExecutionResult;
    status: 'success' | 'error' | 'pending_confirmation';
  };
};

const timestamp = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

async function invokeAssistant(body: Record<string, unknown>): Promise<AssistantResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error('O assistente requer uma sessão Supabase configurada.');
  const { data, error } = await supabase.functions.invoke('gemini', { body });
  if (error) {
    const context = (error as any).context;
    const details = context instanceof Response ? await context.clone().json().catch(() => null) : context;
    const serverMessage = details?.body?.error || details?.error || error.message;
    throw new Error(serverMessage || 'Não foi possível conectar ao assistente.');
  }
  if (!data?.success) throw new Error(data?.error || 'O assistente não conseguiu concluir a solicitação.');
  return data as AssistantResponse;
}

export class AIService {
  public static async processMessage(userText: string, history: ChatMessage[] = []): Promise<ChatMessage> {
    const text = userText.trim();
    if (!text) throw new Error('Digite uma mensagem para continuar.');
    const priorHistory = history.at(-1)?.sender === 'user' && history.at(-1)?.content === text
      ? history.slice(0, -1)
      : history;
    const response = await invokeAssistant({
      action: 'chat',
      message: text,
      history: priorHistory.slice(-12).map(({ sender, content }) => ({ sender, content })),
    });
    return {
      id: `ai-${crypto.randomUUID()}`,
      sender: 'assistant',
      timestamp: timestamp(),
      content: response.text || 'Não recebi uma resposta utilizável. Tente novamente.',
      pendingConfirmation: response.pendingConfirmation,
      toolCall: response.toolCall ? {
        ...response.toolCall,
        steps: [
          { label: 'Solicitação validada no servidor', status: 'success' },
          { label: response.status === 'pending_confirmation' ? 'Aguardando sua confirmação' : 'Operação concluída pelo Supabase', status: response.status === 'pending_confirmation' ? 'warning' : 'success' },
        ],
      } : undefined,
    };
  }

  public static async executeConfirmed(confirmationToken: string): Promise<{ message: string; result?: AIToolExecutionResult }> {
    const response = await invokeAssistant({ action: 'confirm', confirmationToken });
    return { message: response.text || 'A operação foi concluída.', result: response.toolCall?.result };
  }

  public static async cancelConfirmation(confirmationToken: string): Promise<void> {
    await invokeAssistant({ action: 'cancel', confirmationToken });
  }
}
