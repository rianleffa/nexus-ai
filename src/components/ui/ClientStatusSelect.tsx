import React from 'react';
import { ChevronDown } from 'lucide-react';
import { ClientStatus } from '../../types';

const statusOptions: Array<{ value: ClientStatus; label: string; tone: string }> = [
  { value: 'ativo', label: 'Ativo', tone: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' },
  { value: 'em_negociacao', label: 'Em negociação', tone: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200' },
  { value: 'pendente', label: 'Pendente', tone: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200' },
  { value: 'inativo', label: 'Inativo', tone: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200' },
];

interface ClientStatusSelectProps {
  value: ClientStatus;
  onChange: (value: ClientStatus) => void;
  className?: string;
}

export const ClientStatusSelect: React.FC<ClientStatusSelectProps> = ({ value, onChange, className = '' }) => {
  const selected = statusOptions.find((option) => option.value === value) || statusOptions[0];

  return (
    <div className={`relative ${className}`}>
      <select
        aria-label="Status do cliente"
        value={value}
        onChange={(event) => onChange(event.target.value as ClientStatus)}
        className={`w-full appearance-none rounded-xl border px-3.5 py-2.5 pr-9 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${selected.tone}`}
      >
        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70" />
    </div>
  );
};
