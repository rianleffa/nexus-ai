import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Phone,
  Mail,
  Building,
  MoreVertical,
  Calendar,
  CheckSquare,
  FileText,
  DollarSign,
  ArrowLeft,
  Edit2,
  Trash2,
  ExternalLink,
  FolderKanban,
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ClientStatusBadge, Badge, ProjectStatusBadge, TaskPriorityBadge } from '../components/ui/Badge';
import { dataStore } from '../services/dataStore';
import { Client, ClientStatus } from '../types';
import { useNotification } from '../contexts/NotificationContext';

interface ClientsProps {
  initialClientId?: string;
  onNavigate?: (page: string, prompt?: string, params?: Record<string, any>) => void;
}

export const Clients: React.FC<ClientsProps> = ({
  initialClientId,
  onNavigate,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [clientDraft, setClientDraft] = useState({
    name: '',
    company_name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    status: 'ativo' as ClientStatus,
  });
  const { showToast } = useNotification();

  const openClientEditor = (client: Client) => {
    setSelectedClient(client);
    setClientDraft({
      name: client.name,
      company_name: client.company_name,
      document: client.document || '',
      email: client.email,
      phone: client.phone,
      address: client.address || '',
      notes: client.notes || '',
      status: client.status,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateClient = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient || !clientDraft.name.trim() || !clientDraft.company_name.trim() || !clientDraft.email.trim()) {
      showToast('Preencha nome, empresa e e-mail do cliente.', 'warning');
      return;
    }

    const updated = dataStore.updateClient(selectedClient.id, {
      ...clientDraft,
      name: clientDraft.name.trim(),
      company_name: clientDraft.company_name.trim(),
      email: clientDraft.email.trim(),
      phone: clientDraft.phone.trim(),
      document: clientDraft.document.trim(),
      address: clientDraft.address.trim(),
      notes: clientDraft.notes.trim(),
    });

    if (!updated) {
      showToast('Não foi possível atualizar este cliente.', 'error');
      return;
    }
    setSelectedClient(updated);
    setIsEditModalOpen(false);
    showToast('Dados do cliente atualizados.', 'success');
  };

  const refreshData = () => {
    const list = dataStore.getClients();
    setClients(list);
    if (initialClientId && !selectedClient) {
      const found = list.find((c) => c.id === initialClientId);
      if (found) setSelectedClient(found);
    }
  };

  useEffect(() => {
    refreshData();
    const unsub = dataStore.subscribe(refreshData);
    return unsub;
  }, [initialClientId]);

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = clients.filter((c) => c.status === 'ativo').length;
  const prospectCount = clients.filter((c) => c.status === 'prospect').length;
  const inactiveCount = clients.filter((c) => c.status === 'inativo').length;

  const handleDelete = (id: string, clientName: string) => {
    if (confirm(`Tem certeza que deseja excluir o cliente ${clientName}?`)) {
      dataStore.deleteClient(id);
      showToast(`Cliente ${clientName} excluído.`, 'info');
      if (selectedClient?.id === id) setSelectedClient(null);
    }
  };

  // Detailed client relations (360 View)
  const clientProjects = selectedClient
    ? dataStore.getProjects().filter((p) => p.client_id === selectedClient.id || p.client_name === selectedClient.name)
    : [];

  const clientTasks = selectedClient
    ? dataStore.getTasks().filter((t) => t.client_id === selectedClient.id || t.client_name === selectedClient.name)
    : [];

  const clientEvents = selectedClient
    ? dataStore.getCalendarEvents().filter((e) => e.client_id === selectedClient.id || e.client_name === selectedClient.name)
    : [];

  const clientFinancial = selectedClient
    ? dataStore.getClientFinancialSummary(selectedClient.id)
    : { totalContracted: 0, totalReceived: 0, totalPending: 0, transactions: [] };

  const clientDocuments = selectedClient
    ? dataStore.getDocuments().filter((d) => d.client_id === selectedClient.id || d.client_name === selectedClient.name)
    : [];

  return (
    <div className="space-y-6">
      {/* VISÃO 360° DO CLIENTE */}
      {selectedClient ? (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Topbar & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={() => setSelectedClient(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para lista de clientes</span>
            </button>

          </div>

          {/* Client Overview Card & Financial 360 KPIs */}
          <Card className="p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white text-2xl font-bold shadow-glow shrink-0">
                  {selectedClient.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedClient.name}
                    </h2>
                    <ClientStatusBadge status={selectedClient.status} />
                    <Button variant="outline" size="sm" onClick={() => openClientEditor(selectedClient)}>
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedClient.company_name} • CPF/CNPJ: {selectedClient.document || 'Não informado'}
                  </p>
                </div>
              </div>

              {/* 3 Financial KPIs */}
              <div className="grid grid-cols-3 gap-3 text-xs w-full lg:w-auto">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-center sm:text-left">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Total Contratado
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                    R$ {clientFinancial.totalContracted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 text-center sm:text-left">
                  <span className="text-emerald-700 dark:text-emerald-400 block text-[10px] font-bold uppercase tracking-wider">
                    Total Recebido
                  </span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    R$ {clientFinancial.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/40 text-center sm:text-left">
                  <span className="text-amber-700 dark:text-amber-400 block text-[10px] font-bold uppercase tracking-wider">
                    Pendente
                  </span>
                  <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 block">
                    R$ {clientFinancial.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Mail className="w-3.5 h-3.5" /> E-mail Profissional
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClient.email}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Phone className="w-3.5 h-3.5" /> Telefone / WhatsApp
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClient.phone}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Building className="w-3.5 h-3.5" /> Endereço Comercial
                </span>
                <p className="text-slate-800 dark:text-slate-200">{selectedClient.address || 'Não cadastrado'}</p>
              </div>
            </div>

            {selectedClient.notes && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Observações Comerciais: </span>
                <span className="text-slate-600 dark:text-slate-400">{selectedClient.notes}</span>
              </div>
            )}
          </Card>

          {/* Relational 360 Grid: Projects, Tasks, Agenda, Finance, Documents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Connected Projects */}
            <Card className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-brand-500" />
                  <span>Projetos em Andamento ({clientProjects.length})</span>
                </h3>
              </div>
              {clientProjects.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhum projeto cadastrado para este cliente.</p>
              ) : (
                <div className="space-y-2.5">
                  {clientProjects.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                        <ProjectStatusBadge status={p.status} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Orçamento: R$ {p.budget.toLocaleString('pt-BR')}</span>
                        <span>Prazo: {p.due_date}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div style={{ width: `${p.progress}%` }} className="h-full bg-brand-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 2. Connected Tasks */}
            <Card className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-brand-500" />
                  <span>Tarefas & Entregas ({clientTasks.length})</span>
                </h3>
              </div>
              {clientTasks.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhuma tarefa vinculada.</p>
              ) : (
                <div className="space-y-2">
                  {clientTasks.map((t) => (
                    <div key={t.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{t.title}</p>
                        <span className="text-[11px] text-slate-400">Prazo: {t.due_date}</span>
                      </div>
                      <Badge variant={t.status === 'concluido' ? 'success' : 'warning'}>{t.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 3. Upcoming Calendar Appointments */}
            <Card className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-500" />
                  <span>Próximos Compromissos na Agenda ({clientEvents.length})</span>
                </h3>
              </div>
              {clientEvents.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhum compromisso agendado.</p>
              ) : (
                <div className="space-y-2">
                  {clientEvents.map((e) => (
                    <div key={e.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{e.title}</p>
                        <span className="text-[11px] text-slate-400">{e.event_date} às {e.start_time} • {e.location}</span>
                      </div>
                      <Badge variant="info">{e.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 4. Financial Transactions */}
            <Card className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-brand-500" />
                  <span>Lançamentos Financeiros ({clientFinancial.transactions.length})</span>
                </h3>
              </div>
              {clientFinancial.transactions.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhum lançamento vinculado.</p>
              ) : (
                <div className="space-y-2">
                  {clientFinancial.transactions.map((tx) => (
                    <div key={tx.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{tx.description}</p>
                        <span className="text-[11px] text-slate-400">{tx.due_date} • {tx.category} • {tx.status}</span>
                      </div>
                      <span className={`font-bold ${tx.status === 'pago' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 5. Documents */}
            <Card className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-500" />
                  <span>Documentos & Contratos Anexados ({clientDocuments.length})</span>
                </h3>
              </div>
              {clientDocuments.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhum documento anexado.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {clientDocuments.map((doc) => (
                    <div key={doc.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{doc.title}</p>
                        <span className="text-[11px] text-slate-400">{doc.category} • {doc.file_size}</span>
                      </div>
                      <Button variant="ghost" size="sm" disabled={!onNavigate} onClick={() => onNavigate?.('documents')}>
                        Abrir documentos
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        /* Client List / CRM View */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Clientes & CRM
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Centralize a carteira de contatos, contratos e projetos da sua empresa
              </p>
            </div>

          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total de Clientes
              </span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                {clients.length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Clientes Ativos
              </span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {activeCount}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                Prospects
              </span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block">
                {prospectCount}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Sem Atividade
              </span>
              <span className="text-2xl font-extrabold text-slate-700 dark:text-slate-300 mt-1 block">
                {inactiveCount}
              </span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, empresa ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl self-start sm:self-auto text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('ativo')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'ativo'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Ativos
              </button>
              <button
                onClick={() => setStatusFilter('prospect')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'prospect'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Prospects
              </button>
              <button
                onClick={() => setStatusFilter('inativo')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'inativo'
                    ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Inativos
              </button>
            </div>
          </div>

          {/* Table */}
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Nome / Contato</th>
                    <th className="px-5 py-3.5">Empresa</th>
                    <th className="px-5 py-3.5">E-mail</th>
                    <th className="px-5 py-3.5">Telefone</th>
                    <th className="px-5 py-3.5">Última Interação</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-500">
                        {client.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {client.company_name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {client.email}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {client.phone}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                        {new Date(client.last_interaction).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <ClientStatusBadge status={client.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedClient(client)}
                            title="Ver visão 360"
                            className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(client.id, client.name)}
                            title="Excluir"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar cliente"
        subtitle="Atualize os dados comerciais e de contato."
        maxWidth="2xl"
      >
        <form onSubmit={handleUpdateClient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome do contato" value={clientDraft.name} onChange={(event) => setClientDraft({ ...clientDraft, name: event.target.value })} required />
            <Input label="Empresa" value={clientDraft.company_name} onChange={(event) => setClientDraft({ ...clientDraft, company_name: event.target.value })} required />
            <Input label="E-mail" type="email" value={clientDraft.email} onChange={(event) => setClientDraft({ ...clientDraft, email: event.target.value })} required />
            <Input label="Telefone / WhatsApp" value={clientDraft.phone} onChange={(event) => setClientDraft({ ...clientDraft, phone: event.target.value })} />
            <Input label="CPF / CNPJ" value={clientDraft.document} onChange={(event) => setClientDraft({ ...clientDraft, document: event.target.value })} />
            <Input label="Endereço" value={clientDraft.address} onChange={(event) => setClientDraft({ ...clientDraft, address: event.target.value })} />
            <label className="space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              Situação
              <select
                value={clientDraft.status}
                onChange={(event) => setClientDraft({ ...clientDraft, status: event.target.value as ClientStatus })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ativo">Ativo</option>
                <option value="prospect">Prospect</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            Observações comerciais
            <textarea
              value={clientDraft.notes}
              onChange={(event) => setClientDraft({ ...clientDraft, notes: event.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Salvar alterações</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
