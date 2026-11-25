import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  RotateCcw,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AIConfirmationCard } from '../components/ai/AIConfirmationCard';
import { AIService } from '../services/ai/aiService';
import { ChatMessage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { isSupabaseConfigured } from '../services/supabase';
import { supabaseSync } from '../services/supabaseSync';
import { dataStore } from '../services/dataStore';

interface AIAssistantProps {
  initialPrompt?: string;
  initialContextPage?: string;
  onNavigate: (page: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  initialPrompt,
  initialContextPage,
  onNavigate,
}) => {
  const { user, company } = useAuth();
  const { showToast } = useNotification();
  const [inputPrompt, setInputPrompt] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const busyRef = useRef(false);
  const conversationKey = `nexus_chat:${company?.id}:${user?.id}`;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(conversationKey) || 'null');
      if (Array.isArray(saved) && saved.length) return saved
        .filter(m => ['user','assistant'].includes(m.sender))
        .map(({ id, sender, content, timestamp, feedback, pendingConfirmation }) => ({
          id,
          sender,
          content,
          timestamp,
          feedback,
          ...(pendingConfirmation?.confirmationToken ? {
            pendingConfirmation: {
              id: pendingConfirmation.id,
              message: pendingConfirmation.message,
              confirmationToken: pendingConfirmation.confirmationToken,
            },
          } : {}),
        }))
        .slice(-40);
    } catch {}
    return [
    {
      id: 'seed-01',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      content:
        `Olá, **${user?.name.split(' ')[0] || 'bem-vindo(a)'}**! Sou o gestor virtual do **NEXUS AI** para **${company?.name || 'sua empresa'}**.\n\n` +
        `Posso consultar e atualizar informações da empresa, além de executar cadastros e alterações simples pelo chat. Para exclusões, operações financeiras e outras ações sensíveis, vou pedir sua confirmação.`,
    },
    ];
  });

  useEffect(() => {
    try {
      const safeMessages = messages.slice(-40).map(({ id, sender, content, timestamp, feedback, pendingConfirmation }) => ({
        id, sender, content, timestamp, feedback,
        ...(pendingConfirmation ? { pendingConfirmation } : {}),
      }));
      sessionStorage.setItem(conversationKey, JSON.stringify(safeMessages));
    } catch {}
  }, [conversationKey, messages]);

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
    if (!textToSend.trim() || busyRef.current) return;
    busyRef.current = true;

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
      const response = await AIService.processMessage(textToSend, [...messages, userMsg], initialContextPage);
      if (response.feedback === 'success' && company?.id) {
        const remoteData = await supabaseSync.fetchRemoteData(company.id);
        if (remoteData) dataStore.syncFromRemote(remoteData);
        else showToast('A ação foi concluída, mas a atualização dos módulos está atrasada.', 'warning');
      }
      setMessages((prev) => [...prev, response]);

      if (response.feedback === 'success') {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
        });
        showToast('Tudo certo!', 'success');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          content: 'Não foi possível concluir a operação. Tente novamente.',
          feedback: 'error',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      busyRef.current = false;
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (confId: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setActiveAction(confId);
    try {
      const pending = messages.find((msg) => msg.pendingConfirmation?.id === confId)?.pendingConfirmation;
      if (!pending?.confirmationToken) throw new Error('Confirmação inválida ou expirada. Envie a solicitação novamente.');
      const { message } = await AIService.executeConfirmed(pending.confirmationToken);
      
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      showToast('Operação concluída.', 'success');
      try {
        const remoteData = await supabaseSync.fetchRemoteData(company?.id);
        if (remoteData) dataStore.syncFromRemote(remoteData);
      } catch {
        showToast('A ação foi gravada. Atualize a página para recarregar os dados.', 'warning');
      }

      // Update the message in chat
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.pendingConfirmation?.id === confId) {
            return {
              ...msg,
              content: message,
              pendingConfirmation: undefined,
              feedback: 'success',
            };
          }
          return msg;
        })
      );
    } catch {
      showToast('Não foi possível concluir a operação. Tente novamente.', 'error');
      setMessages((prev) => prev.map((msg) => msg.pendingConfirmation?.id === confId
        ? {
            ...msg,
            content: 'Não foi possível concluir a operação. Tente novamente.',
            feedback: 'error',
            // The server consumes confirmation tokens before executing the write.
            // Do not leave a retry button that could replay a partially completed request.
            pendingConfirmation: undefined,
          }
        : msg));
      throw new Error('Não foi possível concluir a operação. Tente novamente.');
    } finally {
      busyRef.current = false;
      setActiveAction(null);
    }
  };

  const handleCancelAction = async (confId: string) => {
    const pending = messages.find((msg) => msg.pendingConfirmation?.id === confId)?.pendingConfirmation;
    if (!pending?.confirmationToken) throw new Error('Confirmação indisponível.');
    if (busyRef.current) throw new Error('Aguarde a operação em andamento.');
    busyRef.current = true;
    setActiveAction(confId);
    try {
      await AIService.cancelConfirmation(pending.confirmationToken);
      setMessages((prev) => prev.map((msg) => msg.pendingConfirmation?.id === confId
        ? { ...msg, content: 'Operação cancelada. Nenhuma alteração foi realizada.', pendingConfirmation: undefined }
        : msg));
    } catch {
      showToast('Não foi possível concluir a operação. Tente novamente.', 'error');
      setMessages((prev) => prev.map((msg) => msg.pendingConfirmation?.id === confId
        ? { ...msg, content: 'Não foi possível concluir a operação. Tente novamente.', feedback: 'error', pendingConfirmation: undefined }
        : msg));
      throw new Error('Não foi possível concluir a operação. Tente novamente.');
    } finally {
      busyRef.current = false;
      setActiveAction(null);
    }
  };

  const handleClearConversation = async () => {
    if (busyRef.current) return;
    const pending = messages.flatMap((msg) => msg.pendingConfirmation ? [msg.pendingConfirmation] : []);
    try {
      await Promise.all(pending.map((item) => AIService.cancelConfirmation(item.confirmationToken)));
      setMessages([{
        id: `new-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        content: 'Histórico reiniciado. Como posso ajudar com a gestão da empresa agora?',
      }]);
    } catch {
      showToast('Não foi possível limpar a conversa. Tente novamente.', 'error');
    }
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
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Seu assistente inteligente para gestão empresarial orientada por linguagem natural
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleClearConversation()}
            disabled={isLoading || Boolean(activeAction)}
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
                  : 'bg-brand-600 text-white shadow-card'
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
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-none'
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
                {msg.feedback === 'success' && <CheckCircle2 aria-label="Concluído" className="inline w-3.5 h-3.5 mr-1.5 text-emerald-500 align-[-2px]" />}
                {msg.feedback === 'error' && <AlertTriangle aria-label="Erro" className="inline w-3.5 h-3.5 mr-1.5 text-rose-500 align-[-2px]" />}
                {msg.content}
              </div>

              {/* Sensitive Action Confirmation Card */}
              {msg.pendingConfirmation && (
                <AIConfirmationCard
                  message={msg.pendingConfirmation.message}
                  onConfirm={() => handleConfirmAction(msg.pendingConfirmation!.id)}
                  disabled={isLoading || Boolean(activeAction)}
                  onCancel={() => handleCancelAction(msg.pendingConfirmation!.id)}
                />
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 text-xs leading-relaxed max-w-xl animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-card">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-slate-500 rounded-tl-none flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] ml-1 font-medium text-slate-400">
                Estou preparando uma resposta...
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
              disabled={isLoading || Boolean(activeAction)}
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
          disabled={isLoading || Boolean(activeAction)}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Digite o que você precisa em linguagem natural... (ex: 'Agende uma reunião com João amanhã às 14h')"
          className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 pr-24 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm resize-none"
        />

        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSendMessage()}
            isLoading={isLoading}
            disabled={!inputPrompt.trim() || Boolean(activeAction)}
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
