export const getLocalDateISO = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDaysToLocalDateISO = (days: number, from = new Date()): string => {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + days);
  return getLocalDateISO(date);
};

const saoPauloDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const getSaoPauloDateISO = (date = new Date()): string => {
  const parts = new Map(saoPauloDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return [parts.get('year'), parts.get('month'), parts.get('day')].join('-');
};

const saoPauloTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatDateBR = (value?: string | Date | null): string => {
  if (!value) return '—';
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return (dateOnly ? value as string : getSaoPauloDateISO(date)).split('-').reverse().join('/');
};

export const formatTimeBR = (value?: string | Date | null): string => {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) {
    return value.slice(0, 5);
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? saoPauloTimeFormatter.format(date) : '—';
};
