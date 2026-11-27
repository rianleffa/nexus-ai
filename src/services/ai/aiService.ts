import { formatTimeBR } from '../../utils/dates';
import type { ChatMessage } from '../../types';
import { supabase, isSupabaseConfigured } from '../supabase';

type AssistantResponse = {
  success: boolean;
  text?: string;
  error?: string;
  status?: 'pending_confirmation' | 'success' | 'cancelled' | 'needs_clarification';
  pendingConfirmation?: ChatMessage['pendingConfirmation'];
};

const timestamp = () => formatTimeBR(new Date());

async function invokeAssistant(body: Record<string, unknown>): Promise<AssistantResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Não foi possível conectar ao assistente. Tente novamente.');
  const signal = AbortSignal.timeout(35_000);
  const { data, error } = await supabase.functions.invoke('gemini', { body, signal });
  if (signal.aborted) throw new Error('O assistente demorou para responder. Se você pediu uma alteração, confira os registros antes de tentar de novo.');
  if (error) {
    throw new Error('Não foi possível conectar ao assistente. Tente novamente.');
  }
  if (!data?.success) throw new Error('Não foi possível concluir a operação. Tente novamente.');
  return data as AssistantResponse;
}

export class AIService {
  public static async analyzeReport(reportData: Record<string, unknown>): Promise<string> {
    const response = await invokeAssistant({ action: 'analyze_report', reportData });
    if (!response.text) throw new Error('O Nexus AI não retornou uma análise utilizável. Tente novamente.');
    return response.text;
  }

  public static async processMessage(userText: string, history: ChatMessage[] = [], pageContext?: string): Promise<ChatMessage> {
    const text = userText.trim();
    if (!text) throw new Error('Digite uma mensagem para continuar.');
    const priorHistory = history.at(-1)?.sender === 'user' && history.at(-1)?.content === text
      ? history.slice(0, -1)
      : history;
    const response = await invokeAssistant({
      action: 'chat',
      timeZone: 'America/Sao_Paulo',
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
