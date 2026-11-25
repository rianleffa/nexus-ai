import type { ChatMessage } from '../../types';
import { supabase, isSupabaseConfigured } from '../supabase';

type AssistantResponse = {
  success: boolean;
  text?: string;
  error?: string;
  status?: 'pending_confirmation' | 'success' | 'cancelled' | 'needs_clarification';
  pendingConfirmation?: ChatMessage['pendingConfirmation'];
};

const timestamp = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

async function invokeAssistant(body: Record<string, unknown>): Promise<AssistantResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Não foi possível conectar ao assistente. Tente novamente.');
  const { data, error } = await supabase.functions.invoke('gemini', { body, signal: AbortSignal.timeout(35_000) });
  if (error) {
    throw new Error('Não foi possível conectar ao assistente. Tente novamente.');
  }
  if (!data?.success) throw new Error('Não foi possível concluir a operação. Tente novamente.');
  return data as AssistantResponse;
}

export class AIService {
  public static async processMessage(userText: string, history: ChatMessage[] = [], pageContext?: string): Promise<ChatMessage> {
    const text = userText.trim();
    if (!text) throw new Error('Digite uma mensagem para continuar.');
    const priorHistory = history.at(-1)?.sender === 'user' && history.at(-1)?.content === text
      ? history.slice(0, -1)
      : history;
    const response = await invokeAssistant({
      action: 'chat',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      message: text,
      pageContext,
      history: priorHistory.slice(-12).map(({ sender, content }) => ({ sender, content })),
    });
    if (!response.text) throw new Error('O Gemini retornou uma resposta vazia. Tente novamente.');
    return {
      id: `ai-${crypto.randomUUID()}`,
      sender: 'assistant',
      timestamp: timestamp(),
      content: response.text,
      pendingConfirmation: response.pendingConfirmation,
      feedback: response.status === 'success' ? 'success' : undefined,
    };
  }

  public static async executeConfirmed(confirmationToken: string): Promise<{ message: string }> {
    const response = await invokeAssistant({ action: 'confirm', confirmationToken });
    if (response.status === 'needs_clarification') throw new Error('Não foi possível concluir a operação. Tente novamente.');
    if (!response.text) throw new Error('Não foi possível concluir a operação. Tente novamente.');
    return { message: response.text };
  }

  public static async cancelConfirmation(confirmationToken: string): Promise<void> {
    await invokeAssistant({ action: 'cancel', confirmationToken });
  }
}
