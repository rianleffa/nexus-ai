import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  FileSpreadsheet,
  Filter,
  Calendar,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { dataStore } from '../services/dataStore';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { MonthlyComparisonChart, CategoryDonutChart } from '../components/common/ChartComponents';
import { getLocalDateISO } from '../utils/dates';

export const Reports: React.FC = () => {
  const { company } = useAuth();
  const { showToast } = useNotification();

  const [selectedReport, setSelectedReport] = useState<
    'overview' | 'finance' | 'clients' | 'tasks' | 'projects'
  >('overview');
  
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customStart, setCustomStart] = useState(() => getLocalDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => getLocalDateISO());

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Filtered metrics computed dynamically from dataStore
  const reportData = useMemo(() => {
    return dataStore.getFilteredReportMetrics(period, customStart, customEnd);
  }, [period, customStart, customEnd]);

  const clients = dataStore.getClients();
  const tasks = dataStore.getTasks();
  const projects = dataStore.getProjects();

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    const filename = `relatorio_${selectedReport}_${period}_${new Date().getFullYear()}.csv`;

    if (selectedReport === 'finance' || selectedReport === 'overview') {
      csvContent += 'ID,Tipo,Descricao,Valor,Categoria,Vencimento,Status\n';
      reportData.transactions.forEach((t) => {
        csvContent += `"${t.id}","${t.type}","${t.description}","${t.amount}","${t.category}","${t.due_date}","${t.status}"\n`;
      });
    } else if (selectedReport === 'clients') {
      csvContent += 'ID,Nome,Empresa,Email,Telefone,Status,Receita_Total\n';
      clients.forEach((c) => {
        csvContent += `"${c.id}","${c.name}","${c.company_name}","${c.email}","${c.phone}","${c.status}","${c.total_revenue}"\n`;
      });
    } else if (selectedReport === 'tasks') {
      csvContent += 'ID,Titulo,Prioridade,Status,Prazo,Cliente\n';
      tasks.forEach((t) => {
        csvContent += `"${t.id}","${t.title}","${t.priority}","${t.status}","${t.due_date}","${t.client_name || ''}"\n`;
      });
    } else {
      csvContent += 'ID,Nome,Orcamento,Progresso,Status,Prazo\n';
      projects.forEach((p) => {
        csvContent += `"${p.id}","${p.name}","${p.budget}","${p.progress}%","${p.status}","${p.due_date}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Relatório exportado em CSV com sucesso!`, 'success');
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-500" />
            <span>Relatórios & Business Intelligence</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sintetize métricas estratégicas, visualize gráficos em tempo real e exporte auditorias
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
          >
            Exportar CSV / Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrintPDF}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Period Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1 shrink-0">
            <Calendar className="w-3.5 h-3.5" /> Período:
          </span>
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'week', label: 'Esta Semana' },
            { id: 'month', label: 'Este Mês' },
            { id: 'quarter', label: 'Trimestre' },
            { id: 'year', label: 'Ano Vigente' },
            { id: 'custom', label: 'Personalizado' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id as any)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                period === item.id
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs if 'custom' is active */}
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-xs w-full lg:w-auto">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
            />
          </div>
        )}
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-2 border-emerald-200/60 dark:border-emerald-950">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Receita Recebida no Período</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatBRL(reportData.revenue)}
          </p>
          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
            Pagamentos confirmados
          </span>
        </Card>

        <Card className="p-4 space-y-2 border-rose-200/60 dark:border-rose-950">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Despesas Operacionais</span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-500">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatBRL(reportData.expenses)}
          </p>
          <span className="text-[11px] text-slate-400">
            Despesas pagas no período
          </span>
        </Card>

        <Card className="p-4 space-y-2 border-brand-200/60 dark:border-brand-950">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Margem Líquida</span>
            <span className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/50 text-brand-500">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-brand-600 dark:text-brand-400">
            {formatBRL(reportData.netMargin)}
          </p>
          <span className="text-[11px] text-brand-600 font-semibold">
            {reportData.marginPercentage}% de rentabilidade
          </span>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Taxa de Entrega de Tarefas</span>
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-500">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {reportData.taskCompletionRate}%
          </p>
          <span className="text-[11px] text-slate-400">
            {reportData.completedTasks} de {reportData.totalTasks} tarefas concluídas
          </span>
        </Card>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Bar/Area Chart (2 Cols) */}
        <Card className="p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Evolução Mensal de Receitas vs Despesas ({new Date().getFullYear()})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Valores reais consolidados de fluxo de caixa mensal
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Valores pagos registrados</span>
          </div>

          <MonthlyComparisonChart data={reportData.monthlySeries} />
        </Card>

        {/* Right: Donut Chart of Categories (1 Col) */}
        <Card className="p-6 space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-500" />
              <span>Distribuição de Despesas</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Custos operacionais por categoria no período
            </p>
          </div>

          <CategoryDonutChart categories={reportData.categoryTotals} />
        </Card>
      </div>

      {/* Module Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
        {[
          { id: 'overview', label: 'Visão Geral & Lançamentos', icon: DollarSign },
          { id: 'clients', label: 'Carteira de Clientes', icon: Users },
          { id: 'tasks', label: 'Quadro de Tarefas & Prazos', icon: CheckCircle2 },
          { id: 'projects', label: 'Projetos em Andamento', icon: Briefcase },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = selectedReport === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setSelectedReport(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                isSel
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Printable Report Paper Preview */}
      <Card className="p-8 bg-white dark:bg-[#0E1522] border-slate-200 dark:border-slate-800 shadow-md space-y-6">
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                {company?.name || 'Sua empresa'}
              </span>
              <span className="text-[10px] bg-brand-500/10 text-brand-500 font-bold px-2 py-0.5 rounded-full border border-brand-500/20">
                NEXUS AI Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500">
              CNPJ: {company?.cnpj || '12.345.678/0001-90'} • Período: {reportData.startDate} até {reportData.endDate}
            </p>
          </div>

          <div className="text-right text-xs">
            <span className="text-slate-400 block text-[11px]">Gerado em</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Table Content */}
        {selectedReport === 'overview' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Lançamentos Financeiros do Período ({reportData.transactions.length} registros)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Descrição</th>
                    <th className="p-2.5">Categoria</th>
                    <th className="p-2.5">Vencimento</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportData.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{t.description}</td>
                      <td className="p-2.5 text-slate-500">{t.category}</td>
                      <td className="p-2.5 text-slate-400">{t.due_date}</td>
                      <td className="p-2.5 uppercase text-[10px] font-bold text-slate-500">{t.status}</td>
                      <td className={`p-2.5 text-right font-bold ${t.type === 'receita' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {t.type === 'receita' ? '+' : '-'} {formatBRL(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedReport === 'clients' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Carteira de Clientes Ativos ({clients.length} cadastros)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5">Empresa</th>
                    <th className="p-2.5">Contato</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Volume Faturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                      <td className="p-2.5 text-slate-500">{c.company_name}</td>
                      <td className="p-2.5 text-slate-400">{c.email} • {c.phone}</td>
                      <td className="p-2.5 font-bold uppercase text-[10px] text-slate-500">{c.status}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                        {formatBRL(c.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedReport === 'tasks' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Quadro de Entregas & Prazos ({tasks.length} tarefas)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Tarefa</th>
                    <th className="p-2.5">Prioridade</th>
                    <th className="p-2.5">Prazo</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{t.title}</td>
                      <td className="p-2.5 uppercase text-[10px] font-bold text-slate-500">{t.priority}</td>
                      <td className="p-2.5 text-slate-400">{t.due_date}</td>
                      <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedReport === 'projects' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Status de Projetos Estratégicos ({projects.length} projetos)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Projeto</th>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5">Progresso</th>
                    <th className="p-2.5">Prazo</th>
                    <th className="p-2.5 text-right">Orçamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                      <td className="p-2.5 text-slate-500">{p.client_name || 'Interno'}</td>
                      <td className="p-2.5 font-bold text-brand-500">{p.progress}%</td>
                      <td className="p-2.5 text-slate-400">{p.due_date}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">{formatBRL(p.budget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
