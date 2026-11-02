import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Users,
  FolderKanban,
  CheckSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { dataStore } from '../../services/dataStore';
import { useNotification } from '../../contexts/NotificationContext';
import { TaskPriority, TransactionCategory } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { addDaysToLocalDateISO, getLocalDateISO } from '../../utils/dates';

export type QuickCreateTab =
  | 'client'
  | 'project'
  | 'task'
  | 'event'
  | 'revenue'
  | 'expense';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: QuickCreateTab;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'client',
}) => {
  const [activeTab, setActiveTab] = useState<QuickCreateTab>(defaultTab);
  const { showToast } = useNotification();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const clients = dataStore.getClients();
  const projects = dataStore.getProjects();

  // 1. Client Form
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientDoc, setClientDoc] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientStatus, setClientStatus] = useState<'ativo' | 'prospect' | 'inativo'>('ativo');

  // 2. Project Form
  const [projName, setProjName] = useState('');
  const [projClientId, setProjClientId] = useState('');
  const [projBudget, setProjBudget] = useState('');
  const [projDueDate, setProjDueDate] = useState(addDaysToLocalDateISO(30));
  const [projDescription, setProjDescription] = useState('');

  // 3. Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskClientId, setTaskClientId] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('media');
  const [taskDueDate, setTaskDueDate] = useState(addDaysToLocalDateISO(1));
  const [taskDesc, setTaskDesc] = useState('');

  // 4. Event Form
  const [eventTitle, setEventTitle] = useState('');
  const [eventClientId, setEventClientId] = useState('');
  const [eventDate, setEventDate] = useState(addDaysToLocalDateISO(1));
  const [eventTime, setEventTime] = useState('14:00');
  const [eventDuration, setEventDuration] = useState('60');
  const [eventLocation, setEventLocation] = useState('');

  // 5. Revenue Form
  const [revDesc, setRevDesc] = useState('');
  const [revClientId, setRevClientId] = useState('');
  const [revAmount, setRevAmount] = useState('');
  const [revCategory, setRevCategory] = useState<TransactionCategory>('Serviços');
  const [revDueDate, setRevDueDate] = useState(addDaysToLocalDateISO(1));
  const [revMethod, setRevMethod] = useState<'pix' | 'boleto' | 'cartao' | 'transferencia'>('pix');
  const [revStatus, setRevStatus] = useState<'pago' | 'pendente'>('pendente');

  // 6. Expense Form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<TransactionCategory>('Operacional');
  const [expDueDate, setExpDueDate] = useState(addDaysToLocalDateISO(1));
  const [expMethod, setExpMethod] = useState<'pix' | 'boleto' | 'cartao' | 'transferencia'>('pix');
  const [expStatus, setExpStatus] = useState<'pago' | 'pendente'>('pendente');

  // Handlers
  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientCompany || !clientEmail) return;
    const c = dataStore.createClient({
      name: clientName,
      company_name: clientCompany,
      email: clientEmail,
      phone: clientPhone,
      document: clientDoc,
      address: clientAddress,
      status: clientStatus,
    });
    showToast(`Cliente ${c.name} cadastrado com sucesso!`, 'success');
    setClientName('');
    setClientCompany('');
    setClientEmail('');
    setClientPhone('');
    onClose();
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName) return;
    const client = clients.find((c) => c.id === projClientId);
    const projectBudget = projBudget.trim() ? Number(projBudget) : 0;
    if (!Number.isFinite(projectBudget) || projectBudget < 0) {
      showToast('Informe um orçamento válido (zero se ainda não definido).', 'warning');
      return;
    }
    const p = dataStore.createProject({
      name: projName,
      client_id: client?.id,
      client_name: client?.name || 'Projeto interno',
      lead_user_id: user?.id,
      budget: projectBudget,
      due_date: projDueDate,
      start_date: getLocalDateISO(),
      description: projDescription || 'Escopo cadastrado via Criação Rápida',
      progress: 0,
      status: 'em_andamento',
    });
    showToast(`Projeto "${p.name}" criado com sucesso!`, 'success');
    setProjName('');
    setProjBudget('');
    setProjDescription('');
    onClose();
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;
    const client = clients.find((c) => c.id === taskClientId);
    const project = projects.find((p) => p.id === taskProjectId);

    const t = dataStore.createTask({
      title: taskTitle,
      description: taskDesc,
      priority: taskPriority,
      due_date: taskDueDate,
      status: 'a_fazer',
      client_id: client?.id,
      client_name: client?.name,
      project_id: project?.id,
      project_name: project?.name,
      assigned_to: user?.id,
      assigned_name: user?.name,
    });
    showToast(`Tarefa "${t.title}" adicionada com sucesso!`, 'success');
    setTaskTitle('');
    setTaskDesc('');
    onClose();
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle) return;
    const client = clients.find((c) => c.id === eventClientId);

    const conflict = dataStore.checkCalendarConflict(
      eventDate,
      eventTime,
      parseInt(eventDuration) || 60
    );

    if (conflict.hasConflict) {
      showToast(`O horário conflita com "${conflict.conflictingEvent?.title}". Escolha outro horário.`, 'warning');
      return;
    }

    const ev = dataStore.createCalendarEvent({
      title: eventTitle,
      event_date: eventDate,
      start_time: eventTime,
      duration_minutes: parseInt(eventDuration) || 60,
      location: eventLocation,
      client_id: client?.id,
      client_name: client?.name,
      user_id: user?.id || dataStore.getUser().id,
      user_name: user?.name || 'Usuário',
      event_type: 'reuniao',
      status: 'agendado',
    });

    showToast(`Compromisso "${ev.title}" agendado com sucesso!`, 'success');
    setEventTitle('');
    onClose();
  };

  const handleCreateRevenue = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(revAmount);
    if (!revDesc || isNaN(num) || num <= 0) return;
    const client = clients.find((c) => c.id === revClientId);

    dataStore.createFinancialTransaction({
      type: 'receita',
      description: revDesc,
      amount: num,
      category: revCategory,
      due_date: revDueDate,
      payment_date: revStatus === 'pago' ? getLocalDateISO() : undefined,
      payment_method: revMethod,
      status: revStatus,
      client_id: client?.id,
      client_name: client?.name,
    });
    showToast(`Receita de R$ ${num.toFixed(2)} registrada!`, 'success');
    setRevDesc('');
    setRevAmount('');
    onClose();
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(expAmount);
    if (!expDesc || isNaN(num) || num <= 0) return;

    dataStore.createFinancialTransaction({
      type: 'despesa',
      description: expDesc,
      amount: num,
      category: expCategory,
      due_date: expDueDate,
      payment_date: expStatus === 'pago' ? getLocalDateISO() : undefined,
      payment_method: expMethod,
      status: expStatus,
    });
    showToast(`Despesa de R$ ${num.toFixed(2)} registrada!`, 'success');
    setExpDesc('');
    setExpAmount('');
    onClose();
  };

  const tabs: { id: QuickCreateTab; label: string; icon: React.ReactNode }[] = [
    { id: 'client', label: 'Cliente', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'project', label: 'Projeto', icon: <FolderKanban className="w-3.5 h-3.5" /> },
    { id: 'task', label: 'Tarefa', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: 'event', label: 'Agenda', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'revenue', label: 'Receita', icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> },
    { id: 'expense', label: 'Despesa', icon: <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Criação Rápida no Sistema"
      subtitle="Cadastre registros conectados instantaneamente"
      maxWidth="lg"
    >
      {/* 7 Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 1. NOVO CLIENTE */}
      {activeTab === 'client' && (
        <form onSubmit={handleCreateClient} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nome Completo *" required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: João da Silva" />
            <Input label="Empresa / Razão Social *" required value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="Ex: Silva & Filhos Ltda" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="E-mail *" type="email" required value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="contato@empresa.com" />
            <Input label="Telefone / WhatsApp" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="(11) 98765-4321" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="CPF ou CNPJ" value={clientDoc} onChange={(e) => setClientDoc(e.target.value)} placeholder="12.345.678/0001-90" />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status Inicial</label>
              <select
                value={clientStatus}
                onChange={(e) => setClientStatus(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="ativo">Ativo</option>
                <option value="prospect">Prospect</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <Input label="Endereço (Opcional)" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Av. Paulista, 1000 - São Paulo/SP" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Cadastrar Cliente</Button>
          </div>
        </form>
      )}

      {/* 2. NOVO PROJETO */}
      {activeTab === 'project' && (
        <form onSubmit={handleCreateProject} className="space-y-3.5">
          <Input label="Nome do Projeto *" required value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="Ex: Sistema ERP Financeiro" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cliente Vinculado</label>
              <select
                value={projClientId}
                onChange={(e) => setProjClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Selecione um cliente (ou interno)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company_name})
                  </option>
                ))}
              </select>
            </div>
            <Input label="Orçamento Estimado (R$)" type="number" step="0.01" min="0" value={projBudget} onChange={(e) => setProjBudget(e.target.value)} placeholder="0,00" />
          </div>
          <Input label="Prazo Final de Entrega *" type="date" required value={projDueDate} onChange={(e) => setProjDueDate(e.target.value)} />
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Descrição do Escopo</label>
            <textarea
              rows={2}
              value={projDescription}
              onChange={(e) => setProjDescription(e.target.value)}
              placeholder="Objetivos e principais entregas do projeto..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Criar Projeto</Button>
          </div>
        </form>
      )}

      {/* 3. NOVA TAREFA */}
      {activeTab === 'task' && (
        <form onSubmit={handleCreateTask} className="space-y-3.5">
          <Input label="Título da Tarefa *" required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ex: Enviar proposta comercial" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cliente Vinculado</label>
              <select
                value={taskClientId}
                onChange={(e) => setTaskClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Nenhum cliente (Geral)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Projeto Vinculado</label>
              <select
                value={taskProjectId}
                onChange={(e) => {
                  const projectId = e.target.value;
                  setTaskProjectId(projectId);
                  const project = projects.find((item) => item.id === projectId);
                  if (project?.client_id) setTaskClientId(project.client_id);
                }}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Nenhum projeto (Geral)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Prioridade</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <Input label="Data Limite *" type="date" required value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Salvar Tarefa</Button>
          </div>
        </form>
      )}

      {/* 4. NOVO COMPROMISSO */}
      {activeTab === 'event' && (
        <form onSubmit={handleCreateEvent} className="space-y-3.5">
          <Input label="Título do Compromisso *" required value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Ex: Reunião de Alinhamento" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cliente</label>
              <select
                value={eventClientId}
                onChange={(e) => setEventClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Reunião Interna / Sem cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input label="Localização / Link" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Google Meet ou Endereço" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Data *" type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            <Input label="Horário *" type="time" required value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Duração</label>
              <select
                value={eventDuration}
                onChange={(e) => setEventDuration(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
                <option value="90">1h 30min</option>
                <option value="120">2 horas</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Agendar Compromisso</Button>
          </div>
        </form>
      )}

      {/* 5. NOVA RECEITA */}
      {activeTab === 'revenue' && (
        <form onSubmit={handleCreateRevenue} className="space-y-3.5">
          <Input label="Descrição do Recebimento *" required value={revDesc} onChange={(e) => setRevDesc(e.target.value)} placeholder="Ex: Mensalidade Consultoria ou Parcela 01" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Valor (R$) *" type="number" step="0.01" required value={revAmount} onChange={(e) => setRevAmount(e.target.value)} placeholder="3500.00" />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cliente</label>
              <select
                value={revClientId}
                onChange={(e) => setRevClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Selecione o cliente pagador</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Categoria</label>
              <select
                value={revCategory}
                onChange={(e) => setRevCategory(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Serviços">Serviços</option>
                <option value="Vendas">Vendas</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <Input label="Vencimento *" type="date" required value={revDueDate} onChange={(e) => setRevDueDate(e.target.value)} />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
              <select
                value={revStatus}
                onChange={(e) => setRevStatus(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="pago">Já Recebido (Pago)</option>
                <option value="pendente">Pendente (A Receber)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Salvar Receita</Button>
          </div>
        </form>
      )}

      {/* 6. NOVA DESPESA */}
      {activeTab === 'expense' && (
        <form onSubmit={handleCreateExpense} className="space-y-3.5">
          <Input label="Descrição do Pagamento *" required value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Ex: Servidores Nuvem AWS ou Folha" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Valor (R$) *" type="number" step="0.01" required value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="1250.00" />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Categoria</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Operacional">Operacional</option>
                <option value="Salários">Salários</option>
                <option value="Marketing">Marketing</option>
                <option value="Impostos">Impostos</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Vencimento *" type="date" required value={expDueDate} onChange={(e) => setExpDueDate(e.target.value)} />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
              <select
                value={expStatus}
                onChange={(e) => setExpStatus(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="pago">Pago</option>
                <option value="pendente">Pendente (A Pagar)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Salvar Despesa</Button>
          </div>
        </form>
      )}

    </Modal>
  );
};
