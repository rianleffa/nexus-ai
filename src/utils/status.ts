const labels: Readonly<Record<string, string>> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pendente: 'Pendente',
  backlog: 'Backlog',
  pausado: 'Pausado',
  inativo: 'Inativo',
  ativo: 'Ativo',
  em_negociacao: 'Em negociação',
  planejamento: 'Planejamento',
  pago: 'Pago',
  recebido: 'Recebido',
  atrasado: 'Atrasado',
  agendado: 'Agendado',
  cancelado: 'Cancelado',
};

export const formatStatus = (value: string): string => {
  if (Object.hasOwn(labels, value)) return labels[value];
  const words = value.replaceAll('_', ' ');
  return words.charAt(0).toLocaleUpperCase('pt-BR') + words.slice(1);
};
