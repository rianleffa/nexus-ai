import React, { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  Database,
  Server,
  Layers,
  Bot,
  User,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { dataStore } from '../services/dataStore';

export const Architecture: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const actionLogs = dataStore.getAIActionLogs();

  const standardFlow = [
    { title: 'Usuário', desc: 'Interface de Operação Web SaaS', icon: User, color: 'border-blue-500 text-blue-500' },
    { title: 'React + TypeScript', desc: 'Camada de Apresentação e Estado Reativo', icon: Layers, color: 'border-cyan-500 text-cyan-500' },
    { title: 'Backend / API Server', desc: 'Controle de Autenticação e Regras de Negócio', icon: Server, color: 'border-emerald-500 text-emerald-500' },
    { title: 'Supabase + PostgreSQL', desc: 'Banco de Dados com Row Level Security (RLS)', icon: Database, color: 'border-brand-500 text-brand-500' },
  ];

  const aiFlow = [
    { id: 1, title: 'Usuário', desc: 'Comando em Linguagem Natural', icon: User, tag: 'Input' },
    { id: 2, title: 'NEXUS AI Assistant', desc: 'Camada de Orquestração e Contexto de Negócio', icon: Bot, tag: 'NLU' },
    { id: 3, title: 'Google Gemini 2.5', desc: 'Extração Semântica e Function Calling via API Oficial / Edge Function', icon: Cpu, tag: 'Gemini' },
    { id: 4, title: 'Function / Tool Calling', desc: 'Mapeamento para Ferramentas Registradas no ToolRegistry', icon: Layers, tag: 'Registry' },
    { id: 5, title: 'Barreira de Validação & Permissão', desc: 'Checagem de Parâmetros e Confirmação de Ações Sensíveis', icon: ShieldCheck, tag: 'Security' },
    { id: 6, title: 'Backend / Execução Segura', desc: 'Execução das Regras de Negócio e Auditoria em Log', icon: Server, tag: 'Execution' },
    { id: 7, title: 'PostgreSQL / Supabase', desc: 'Persistência Garantida com Isolamento Multi-tenant', icon: Database, tag: 'Storage' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
            Defesa de TCC • Ciência da Computação
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Arquitetura de Software & Segurança
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Arquitetura do Sistema & Pipeline de IA
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Demonstração do modelo de menor privilégio, desacoplamento e isolamento estrito entre a Inteligência Artificial e a camada de persistência.
        </p>
      </div>

      {/* Security Principle Callout */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-brand-500/30 text-white shadow-xl space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/40">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Princípio Fundamental: Menor Privilégio & Sem Acesso SQL Direto
            </h3>
            <p className="text-xs text-slate-300">
              A IA não possui permissão para gerar ou executar código SQL direto contra o banco de dados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2.5 text-rose-300">
            <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span><strong>Proibido:</strong> LLM ➔ Conexão Direta ➔ Banco de Dados (Risco de Injeção e Destruição de Dados)</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span><strong>Adotado:</strong> LLM ➔ Tool Calling ➔ Validação & Segurança ➔ Backend ➔ Banco</span>
          </div>
        </div>
      </div>

      {/* Pipeline Visual 1: Fluxo Tradicional do Sistema */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>1. Fluxo Tradicional da Aplicação Web</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {standardFlow.map((node, i) => {
            const Icon = node.icon;
            return (
              <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs relative">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`p-2 rounded-lg border ${node.color} bg-slate-50 dark:bg-slate-800/60`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {node.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {node.desc}
                </p>
                {i < 3 && (
                  <ArrowRight className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10 bg-white dark:bg-[#090D14] rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Visual 2: Pipeline de Function Calling do NEXUS AI */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>2. Pipeline de Inteligência Artificial & Tool Calling</span>
          </h2>
          <span className="text-xs text-brand-500 font-semibold">
            Clique em um estágio para ver os detalhes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {aiFlow.map((step) => {
            const Icon = step.icon;
            const isSelected = activeStep === step.id;

            return (
              <div
                key={step.id}
                onClick={() => setActiveStep(isSelected ? null : step.id)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/40 shadow-glow'
                    : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-brand-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {step.tag}
                    </span>
                    <Icon className="w-4 h-4 text-brand-500" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {step.title}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 line-clamp-3">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Log Viewer for Defense Presentation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Trilha de Auditoria em Tempo Real (`ai_action_logs`)</span>
          </h2>
          <span className="text-xs text-slate-400">
            {actionLogs.length} eventos auditados
          </span>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Ferramenta Executada</th>
                  <th className="px-4 py-3">Parâmetros Validados</th>
                  <th className="px-4 py-3">Status de Auditoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                {actionLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-400">
                      {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-brand-500">
                      {log.tool_name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                      {JSON.stringify(log.parameters)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          log.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : log.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
