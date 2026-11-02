import React from 'react';
import {
  Sparkles,
  Calendar,
  BarChart3,
  FileText,
  ShieldCheck,
  ArrowRight,
  Users,
  Clock,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Ambient Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-brand-600/15 via-emerald-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[800px] -left-48 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[1600px] -right-48 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white font-black text-xl flex items-center justify-center shadow-glow">
              N
            </div>
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1">
              <span>NEXUS</span>
              <span className="text-brand-400">AI</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#ia-gemini" className="hover:text-white transition-colors">Assistente IA</a>
            <a href="#agenda" className="hover:text-white transition-colors">Agenda</a>
            <a href="#relatorios" className="hover:text-white transition-colors">Relatórios</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoginClick}
              className="text-xs text-slate-300 hover:text-white"
            >
              Entrar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onRegisterClick}
              className="text-xs shadow-glow"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-28 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-bold animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span>Gestão integrada para pequenas e médias empresas</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.1]">
          O Sistema Operacional Inteligente para a sua{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-emerald-300 to-teal-400">
            Empresa Decolar
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Organize clientes, projetos, tarefas, agenda e financeiro em uma plataforma. Cada indicador acompanha os registros da sua empresa.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={onRegisterClick}
            className="w-full sm:w-auto shadow-glow px-8 py-3.5 text-sm font-bold"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Criar conta
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onLoginClick}
            className="w-full sm:w-auto border-slate-700 hover:bg-slate-900 text-slate-300 px-8 py-3.5 text-sm"
          >
            Entrar na plataforma
          </Button>
        </div>

        <div className="pt-10 max-w-3xl mx-auto">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-left">
            <h2 className="text-sm font-bold text-white">Módulos do NEXUS Business OS</h2>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Dashboard</span>
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Clientes e CRM</span>
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Projetos e tarefas</span>
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Agenda</span>
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Financeiro</span>
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Relatórios</span>
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Documentos</span>
              <span className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">Assistente IA*</span>
            </div>
            <p className="mt-4 text-[11px] text-slate-500">* O assistente depende da configuração da função de IA no servidor.</p>
          </div>
        </div>      </section>

      {/* FEATURES GRID SECTION */}
      <section id="recursos" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-xs uppercase font-bold tracking-widest text-brand-400">
            Recursos de Alta Performance
          </h2>
          <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Tudo o que sua empresa precisa em um único lugar
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Desenvolvido com arquitetura moderna para garantir velocidade, segurança e usabilidade intuitiva.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">IA Operacional com Gemini</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Interpreta datas relativas como "amanhã às 14h", agenda reuniões, cadastra clientes e consulta métricas financeiras através de comandos simples em linguagem natural.
            </p>
          </div>

          <div id="agenda" className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Agenda Anti-Conflito</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calendário dinâmico com alerta de sobreposição de horários e visualizações em Mês, Semana e Lista.
            </p>
          </div>

          <div id="relatorios" className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Relatórios & Gráficos em Tempo Real</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Indicadores baseados nos registros da empresa, filtros por período, comparação de receitas e despesas e exportação para CSV e PDF.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Gestão de Documentos</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload e organização de arquivos por categoria. No modo conectado, os arquivos usam um bucket privado do Supabase; as políticas de acesso precisam ser aplicadas no projeto.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">CRM & Gestão de Clientes</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cadastro de contatos e situação comercial, com tarefas, projetos, agenda e movimentações financeiras vinculadas.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Segurança & Menor Privilégio</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              A migração de segurança prepara políticas RLS por empresa e validações de relações no PostgreSQL. Ela precisa ser aplicada e os vínculos existentes auditados antes do uso empresarial.
            </p>
          </div>
        </div>
      </section>

      <section id="ia-gemini" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Assistente IA</span>
          <h3 className="text-3xl font-black text-white">Ajuda contextual para as rotinas da empresa</h3>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            O assistente usa uma função segura no servidor para responder perguntas e solicitar ações nos módulos. A integração só fica disponível quando o projeto Supabase e a chave do provedor estiverem configurados.
          </p>
        </div>
      </section>
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-xs uppercase font-bold tracking-widest text-brand-400">Perguntas frequentes</h2>
          <h3 className="text-3xl font-black text-white">Antes de começar</h3>
        </div>
        <div className="grid gap-4 text-sm">
          <article className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
            <h4 className="font-bold text-white">O que posso gerenciar?</h4>
            <p className="mt-2 text-slate-400">Clientes, projetos, tarefas, agenda, lançamentos financeiros, documentos e relatórios em um só espaço.</p>
          </article>
          <article className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
            <h4 className="font-bold text-white">O assistente de IA já está disponível?</h4>
            <p className="mt-2 text-slate-400">O recurso exige a configuração do Supabase Auth, da função de servidor e da chave Gemini. A tela informa quando a integração não estiver disponível.</p>
          </article>
          <article className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
            <h4 className="font-bold text-white">Quais são os planos e preços?</h4>
            <p className="mt-2 text-slate-400">Os planos e preços comerciais ainda não foram definidos.</p>
          </article>
          <article className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
            <h4 className="font-bold text-white">Como entro em contato com a equipe?</h4>
            <p className="mt-2 text-slate-400">O canal de atendimento comercial ainda não foi configurado.</p>
          </article>
        </div>
        <div className="text-center pt-2">
          <Button variant="primary" size="md" onClick={onRegisterClick}>Criar conta</Button>
        </div>
      </section>
      {/* FINAL CALL TO ACTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-brand-950/40 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h3 className="text-3xl sm:text-4xl font-black text-white">
            Pronto para transformar a gestão da sua empresa?
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Crie uma conta para acessar o sistema.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={onRegisterClick}
              className="w-full sm:w-auto shadow-glow px-8"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Criar Conta
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onLoginClick}
              className="w-full sm:w-auto border-slate-700 hover:bg-slate-900"
            >
              Entrar no Sistema
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-slate-900 text-center text-xs text-slate-400 space-y-2">
        <p>© {new Date().getFullYear()} NEXUS Business OS.</p>
      </footer>
    </div>
  );
};
