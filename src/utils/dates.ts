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
