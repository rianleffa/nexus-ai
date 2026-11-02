import React from 'react';
import { ClientStatus, ProjectStatus, TaskPriority, TaskStatus, TransactionStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    danger: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    purple: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
    purple: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-full ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

// Specialized Status Badges
export const ClientStatusBadge: React.FC<{ status: ClientStatus }> = ({ status }) => {
  switch (status) {
    case 'ativo':
      return <Badge variant="success" dot>Ativo</Badge>;
    case 'inativo':
      return <Badge variant="default" dot>Inativo</Badge>;
    case 'prospect':
      return <Badge variant="info" dot>Prospect</Badge>;
  }
};

export const TaskPriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  switch (priority) {
    case 'urgente':
      return <Badge variant="danger">Urgente</Badge>;
    case 'alta':
      return <Badge variant="warning">Alta</Badge>;
    case 'media':
      return <Badge variant="info">Média</Badge>;
    case 'baixa':
      return <Badge variant="default">Baixa</Badge>;
  }
};

export const TaskStatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  switch (status) {
    case 'concluido':
      return <Badge variant="success">Concluído</Badge>;
    case 'em_andamento':
      return <Badge variant="info">Em Andamento</Badge>;
    case 'a_fazer':
      return <Badge variant="warning">A Fazer</Badge>;
    case 'backlog':
      return <Badge variant="default">Backlog</Badge>;
  }
};

export const ProjectStatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  switch (status) {
    case 'concluido':
      return <Badge variant="success">Concluído</Badge>;
    case 'em_andamento':
      return <Badge variant="info">Em Andamento</Badge>;
    case 'planejamento':
      return <Badge variant="warning">Planejamento</Badge>;
    case 'pausado':
      return <Badge variant="default">Pausado</Badge>;
  }
};

export const TransactionStatusBadge: React.FC<{ status: TransactionStatus }> = ({ status }) => {
  switch (status) {
    case 'pago':
      return <Badge variant="success">Pago</Badge>;
    case 'pendente':
      return <Badge variant="warning">Pendente</Badge>;
    case 'atrasado':
      return <Badge variant="danger">Atrasado</Badge>;
  }
};
