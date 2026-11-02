import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  Calendar,
  CreditCard,
  Building,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TransactionStatusBadge } from '../components/ui/Badge';
import { dataStore } from '../services/dataStore';
import {
  FinancialTransaction,
} from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { getLocalDateISO } from '../utils/dates';

interface FinancialProps {
  initialType?: 'all' | 'receita' | 'despesa';
  onNavigate?: (page: string, prompt?: string, params?: Record<string, any>) => void;
}

export const Financial: React.FC<FinancialProps> = ({
  initialType = 'all',
  onNavigate,
}) => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'receita' | 'despesa'>(initialType);
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useNotification();


  const refresh = () => setTransactions(dataStore.getFinancialTransactions());

  useEffect(() => {
    refresh();
    const unsub = dataStore.subscribe(refresh);
    return unsub;
  }, []);

  useEffect(() => {
    if (initialType) {
      setTypeFilter(initialType);
    }
  }, [initialType]);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Cash received and paid during the current month.
  const today = getLocalDateISO();
  const now = new Date();
  const monthStart = getLocalDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = getLocalDateISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const paidThisMonth = transactions.filter((transaction) => {
    if (transaction.status !== 'pago') return false;
    const paidDate = transaction.payment_date || transaction.due_date;
    return paidDate >= monthStart && paidDate <= monthEnd;
  });

  const totalReceitasPagas = paidThisMonth
    .filter((t) => t.type === 'receita')
    .reduce((acc, c) => acc + c.amount, 0);

  const totalDespesasPagas = paidThisMonth
    .filter((t) => t.type === 'despesa')
    .reduce((acc, c) => acc + c.amount, 0);

  const saldoAtual = transactions
    .filter((t) => t.status === 'pago')
    .reduce((acc, t) => acc + (t.type === 'receita' ? t.amount : -t.amount), 0);

  const contasAReceber = transactions
    .filter((t) => t.type === 'receita' && t.status !== 'pago')
    .reduce((acc, c) => acc + c.amount, 0);

  const contasAPagar = transactions
    .filter((t) => t.type === 'despesa' && t.status !== 'pago')
    .reduce((acc, c) => acc + c.amount, 0);

  const filteredTransactions = transactions.filter((t) => {
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.client_name && t.client_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Gestão Financeira
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Controle de fluxo de caixa, contas a pagar, a receber e conciliação financeira
          </p>
        </div>

      </div>

      {/* Financial KPIs 5 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Receitas do Mês</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totalReceitasPagas)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Realizado em caixa</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Despesas do Mês</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
            {formatBRL(totalDespesasPagas)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Custos operacionais</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-brand-500/30 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Saldo Acumulado</span>
            <Wallet className="w-4 h-4 text-brand-500" />
          </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white break-words [overflow-wrap:anywhere]">
            {formatBRL(saldoAtual)}
          </span>
          <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold block mt-1">
            Acumulado em lançamentos pagos
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>A Receber</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 break-words [overflow-wrap:anywhere]">
            {formatBRL(contasAReceber)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Pendentes e vencidas em aberto</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>A Pagar</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-xl font-bold text-amber-600 dark:text-amber-400 break-words [overflow-wrap:anywhere]">
            {formatBRL(contasAPagar)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Pendentes e vencidas em aberto</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar lançamentos ou categorias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl self-start sm:self-auto text-xs">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              typeFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Todos ({transactions.length})
          </button>
          <button
            onClick={() => setTypeFilter('receita')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              typeFilter === 'receita'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Receitas
          </button>
          <button
            onClick={() => setTypeFilter('despesa')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              typeFilter === 'despesa'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Despesas
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Tipo</th>
                <th className="px-5 py-3.5">Descrição</th>
                <th className="px-5 py-3.5">Categoria</th>
                <th className="px-5 py-3.5">Cliente / Origem</th>
                <th className="px-5 py-3.5">Vencimento</th>
                <th className="px-5 py-3.5">Pago / recebido em</th>
                <th className="px-5 py-3.5">Método</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredTransactions.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                  {transactions.length === 0 ? 'Nenhum lançamento registrado. Crie sua primeira receita ou despesa para iniciar o controle financeiro.' : 'Nenhum lançamento corresponde à busca e ao filtro selecionados.'}
                </td></tr>
              ) : filteredTransactions.map((tx) => {
                const matchedClient = tx.client_id
                  ? dataStore.getClient(tx.client_id)
                  : tx.client_name
                  ? dataStore.findClientByName(tx.client_name)
                  : undefined;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      {tx.type === 'receita' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                          <ArrowUpRight className="w-3 h-3" /> Receita
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800/50">
                          <ArrowDownRight className="w-3 h-3" /> Despesa
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      {tx.description}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {tx.category}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {matchedClient && onNavigate ? (
                        <button
                          onClick={() => onNavigate('clients', undefined, { clientId: matchedClient.id })}
                          className="font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{tx.client_name || matchedClient.name}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span>{tx.client_name || 'Geral'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                      {tx.due_date}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                      {tx.status === 'pago' ? tx.payment_date || tx.due_date : '—'}
                    </td>
                    <td className="px-5 py-3.5 uppercase text-[10px] font-mono text-slate-500">
                      {tx.payment_method}
                    </td>
                    <td className="px-5 py-3.5">
                      <TransactionStatusBadge status={tx.status === 'pendente' && tx.due_date < today ? 'atrasado' : tx.status} />
                    </td>
                    <td className={`px-5 py-3.5 text-right font-bold ${
                      tx.type === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {tx.type === 'receita' ? '+' : '-'} {formatBRL(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
};
