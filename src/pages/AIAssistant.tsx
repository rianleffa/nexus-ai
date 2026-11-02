import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  ShieldCheck,
  Wrench,
  CornerDownLeft,
  RotateCcw,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AIToolExecutionCard } from '../components/ai/AIToolExecutionCard';
import { AIConfirmationCard } from '../components/ai/AIConfirmationCard';
import { AIService } from '../services/ai/aiService';
import { ChatMessage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { isSupabaseConfigured } from '../services/supabase';

interface AIAssistantProps {
  initialPrompt?: string;
  onNavigate: (page: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  initialPrompt,
  onNavigate,
}) => {
  const { user, company } = useAuth();
  const { showToast } = useNotification();
  const [inputPrompt, setInputPrompt] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'seed-01',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      content:
        `Olá, **${user?.name.split(' ')[0] || 'bem-vindo(a)'}**! Sou o assistente do **NEXUS Business OS** para **${company?.name || 'sua empresa'}**.\n\n` +
        `Posso responder perguntas e solicitar ações nos módulos quando a integração de IA no servidor estiver disponível. Ações sensíveis aguardam sua confirmação.`,
    },
  ]);

  // If navigated with an initial prompt, fill it in
  useEffect(() => {
    if (initialPrompt) {
      setInputPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputPrompt;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await AIService.processMessage(textToSend, [...messages, userMsg]);
      setMessages((prev) => [...prev, response]);

      if (response.toolCall?.status === 'success') {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
        });
        showToast('Ação executada com sucesso pelo Assistente IA!', 'success');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          content: `Falha no processamento da solicitação: ${err?.message || 'Erro inesperado'}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (confId: string, toolName: string, parameters: Record<string, any>) => {
    try {
      const { message, result } = await AIService.executeConfirmed(toolName, parameters);
      
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      showToast('Ação autorizada e executada com sucesso!', 'success');

      // Update the message in chat
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.pendingConfirmation?.id === confId) {
            return {
              ...msg,
              content: message,
              pendingConfirmation: undefined,
              toolCall: {
                toolName,
                parameters,
                steps: [
                  { label: 'Autorização recebida do usuário', status: 'success' },
                  { label: `Execução da ferramenta: ${toolName}`, status: 'success' },
                  { label: 'Alteração persistida no banco de dados', status: 'success' },
                ],
                result,
                status: 'success',
              },
            };
          }
          return msg;
        })
      );
    } catch (e: any) {
      showToast(`Erro ao confirmar: ${e.message}`, 'error');
    }
  };

  const handleCancelAction = (confId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.pendingConfirmation?.id === confId) {
          return {
            ...msg,
            content: 'Operação cancelada pelo usuário. Nenhuma alteração foi realizada.',
            pendingConfirmation: undefined,
          };
        }
        return msg;
      })
    );
  };

  if (!isSupabaseConfigured) {
    return <Card className="p-8 text-center space-y-3">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Assistente de IA indisponível</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Configure o Supabase Auth e a função Gemini no servidor para habilitar este módulo.</p>
      <Button variant="outline" onClick={() => onNavigate('settings')}>Ver configurações</Button>
    </Card>;
  }

  const sampleSuggestions = [
    { label: '📅 Agendar com João amanhã às 14h', prompt: 'Marque uma reunião amanhã às 14h com João.' },
    { label: '🔍 O que tenho amanhã?', prompt: 'O que tenho agendado para amanhã?' },
    { label: '⏱️ Reagendar para sexta às 16h', prompt: 'Mude a reunião com João para sexta às 16h.' },
    { label: '❌ Cancelar reunião', prompt: 'Cancele minha reunião com João.' },
    { label: '💸 Registrar despesa (R$ 5.000)', prompt: 'Registre uma despesa de R$ 5.000 referente à infraestrutura de servidores.' },
    { label: '👤 Cadastrar cliente Mariana', prompt: 'Cadastre o cliente Mariana Souza da Silva.' },
    { label: '📊 Resumo do faturamento', prompt: 'Quanto faturamos este mês e qual o saldo atual?' },
  ];

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-500 animate-pulse" />
              <span>NEXUS AI</span>
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Tool Calling Engine v2.4
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Seu assistente inteligente para gestão empresarial orientada por linguagem natural
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('architecture')}
            className="text-xs"
          >
            Ver Fluxo de Segurança
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([
                {
                  id: `new-${Date.now()}`,
                  sender: 'assistant',
                  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                  content: 'Histórico reiniciado. Como posso ajudar com a gestão da empresa agora?',
                },
              ]);
            }}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Limpar
          </Button>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs leading-relaxed max-w-3xl ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-slate-800 text-white dark:bg-slate-700'
                  : 'bg-gradient-to-tr from-brand-600 to-emerald-400 text-white shadow-glow'
              }`}
            >
              {msg.sender === 'user' ? (
                <UserIcon className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`flex-1 p-4 rounded-2xl shadow-sm border ${
                msg.sender === 'user'
                  ? 'bg-brand-600 text-white border-brand-500 rounded-tr-none'
                  : 'bg-white dark:bg-[#111827] border-slate-200/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-none'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/5 dark:border-white/5 text-[10px] opacity-70">
                <span className="font-semibold">
                  {msg.sender === 'user' ? user?.name || 'Você' : 'NEXUS AI Assistant'}
                </span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Message Content formatted */}
              <div className="whitespace-pre-line text-xs font-normal leading-relaxed">
                {msg.content}
              </div>

              {/* Tool Calling Step Card */}
              {msg.toolCall && (
                <AIToolExecutionCard
                  toolName={msg.toolCall.toolName}
                  parameters={msg.toolCall.parameters}
                  steps={msg.toolCall.steps}
                  result={msg.toolCall.result}
                  status={msg.toolCall.status}
                />
              )}

              {/* Sensitive Action Confirmation Card */}
              {msg.pendingConfirmation && (
                <AIConfirmationCard
                  confirmationId={msg.pendingConfirmation.id}
                  toolName={msg.pendingConfirmation.toolName}
                  parameters={msg.pendingConfirmation.parameters}
                  message={msg.pendingConfirmation.message}
                  onConfirm={() =>
                    handleConfirmAction(
                      msg.pendingConfirmation!.id,
                      msg.pendingConfirmation!.toolName,
                      msg.pendingConfirmation!.parameters
                    )
                  }
                  onCancel={() => handleCancelAction(msg.pendingConfirmation!.id)}
                />
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 text-xs leading-relaxed max-w-xl animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white flex items-center justify-center shadow-glow">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 text-slate-500 rounded-tl-none flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] ml-1 font-medium text-slate-400">
                Interpretando intenção e validando parâmetros de segurança...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Chips Bar */}
      <div className="pt-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] scrollbar-none">
          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-amber-500" /> Sugestões:
          </span>
          {sampleSuggestions.map((item, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(item.prompt)}
              className="shrink-0 bg-slate-100 dark:bg-slate-800/80 hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="relative">
        <textarea
          rows={2}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Digite o que você precisa em linguagem natural... (ex: 'Agende uma reunião com João amanhã às 14h')"
          className="w-full rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-3.5 pr-24 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm resize-none"
        />

        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSendMessage()}
            isLoading={isLoading}
            disabled={!inputPrompt.trim()}
            rightIcon={<Send className="w-3.5 h-3.5" />}
            className="shadow-glow"
          >
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
};
