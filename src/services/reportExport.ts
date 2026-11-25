import type { Client, Company, FinancialTransaction, Project, Task, User } from '../types';
import type { ReportAnalytics } from './reportAnalytics';

export type ReportSection = 'summary' | 'finance' | 'clients' | 'projects' | 'tasks' | 'receivables';
export type ReportKind = 'overview' | 'finance' | 'clients' | 'projects' | 'tasks' | 'payables';
export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  overview: 'Relatório gerencial completo', finance: 'Relatório financeiro', clients: 'Relatório de clientes',
  projects: 'Relatório de projetos', tasks: 'Relatório de tarefas e produtividade', payables: 'Relatório de contas a pagar e receber',
};
export const REPORT_SECTION_LABELS: Record<ReportSection, string> = {
  summary: 'Resumo executivo', finance: 'Análise financeira e lançamentos', clients: 'Clientes e CRM',
  projects: 'Projetos', tasks: 'Tarefas e produtividade', receivables: 'Contas a pagar e receber',
};

export type ReportExportPayload = {
  kind: ReportKind;
  sections: ReportSection[];
  company: Company | null;
  user: User | null;
  analytics: ReportAnalytics;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  analysis?: string;
};

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const date = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—';
const safeFilename = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'empresa';
export const reportFilename = (company: Company | null, kind: ReportKind, analytics: ReportAnalytics, ext: string) =>
  `${safeFilename(company?.name || 'empresa')}_${safeFilename(REPORT_KIND_LABELS[kind])}_${analytics.startDate}_${analytics.endDate}.${ext}`;

const selected = (payload: ReportExportPayload, section: ReportSection) => payload.sections.includes(section);
const transactionsForReport = (payload: ReportExportPayload): FinancialTransaction[] => {
  if (payload.kind !== 'payables') return payload.analytics.selectedTransactions;
  return [...payload.analytics.pendingReceivables, ...payload.analytics.pendingPayables, ...payload.analytics.overdue]
    .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
};
const statusPt = (value: string) => ({ pago: 'Pago/recebido', pendente: 'Pendente', atrasado: 'Em atraso', ativo: 'Ativo', em_negociacao: 'Em negociação', inativo: 'Inativo', planejamento: 'Planejamento', em_andamento: 'Em andamento', pausado: 'Pausado', concluido: 'Concluído', backlog: 'Backlog', a_fazer: 'A fazer' } as Record<string, string>)[value] || value;
const paymentMethodPt = (value?: string) => ({ pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', transferencia: 'Transferência' } as Record<string, string>)[value || ''] || value || '—';

async function logoData(url?: string) {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) return undefined;
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return undefined;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally { URL.revokeObjectURL(objectUrl); }
  } catch { return undefined; }
}

export async function buildReportPdf(payload: ReportExportPayload) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait', compress: false });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const orange = '#E87532';
  const ink = '#202938';
  let y = margin;
  let page = 1;
  const logo = await logoData(payload.company?.logo_url);
  const emittedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());

  const header = () => {
    pdf.setFillColor(orange); pdf.rect(0, 0, pageWidth, 3, 'F');
    if (logo && page === 1) { try { pdf.addImage(logo, 'PNG', margin, 9, 22, 17, undefined, 'FAST'); } catch { /* PDF segue sem o logo */ } }
    const left = logo && page === 1 ? margin + 27 : margin;
    pdf.setTextColor(ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
    pdf.text(payload.company?.name || 'Relatório empresarial', left, 14, { maxWidth: pageWidth - left - margin });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(90, 99, 111);
    const address = [payload.company?.cnpj && `CNPJ ${payload.company.cnpj}`, payload.company?.address,
      [payload.company?.city, payload.company?.state].filter(Boolean).join('/'), payload.company?.phone, payload.company?.email].filter(Boolean).join(' • ');
    if (address) pdf.text(address, left, 19, { maxWidth: pageWidth - left - margin });
    pdf.setDrawColor(orange); pdf.setLineWidth(0.7); pdf.line(margin, 29, pageWidth - margin, 29);
    y = page === 1 ? 37 : 35;
  };
  const newPage = () => { pdf.addPage(); page += 1; header(); };
  const ensureSpace = (height: number) => { if (y + height > pageHeight - 17) newPage(); };
  const sectionTitle = (title: string) => {
    ensureSpace(11); pdf.setTextColor(orange); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5);
    pdf.text(title, margin, y); y += 6.5;
  };
  const line = (label: string, value: string) => {
    const labelLines = pdf.splitTextToSize(label, 48);
    const valueLines = pdf.splitTextToSize(value, contentWidth - 53);
    const h = Math.max(5.5, labelLines.length * 4, valueLines.length * 4);
    ensureSpace(h); pdf.setFontSize(8); pdf.setTextColor(ink); pdf.setFont('helvetica', 'bold'); pdf.text(labelLines, margin, y);
    pdf.setFont('helvetica', 'normal'); pdf.text(valueLines, margin + 52, y, { maxWidth: contentWidth - 53 });
    y += h;
  };
  const drawTable = (title: string, headers: string[], rows: string[][], widths: number[]) => {
    sectionTitle(title);
    const row = (cells: string[], isHeader: boolean, index = 0) => {
      const lines = cells.map((cell, i) => pdf.splitTextToSize(String(cell ?? '—'), widths[i] - 3));
      const h = Math.max(7, ...lines.map((items) => items.length * 3.4 + 3));
      if (y + h > pageHeight - 17) { newPage(); drawHeaderRow(); }
      const fill = isHeader ? [242, 244, 247] : index % 2 ? [255, 255, 255] : [250, 250, 250];
      pdf.setFillColor(fill[0], fill[1], fill[2]);
      pdf.rect(margin, y - 3.2, contentWidth, h, 'F');
      let x = margin;
      cells.forEach((cell, i) => {
        pdf.setFont('helvetica', isHeader ? 'bold' : 'normal'); pdf.setFontSize(isHeader ? 6.3 : 6.7);
        const textColor = isHeader ? [54, 64, 77] : [37, 45, 56];
        pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
        pdf.text(lines[i], x + 1.5, y, { maxWidth: widths[i] - 3 }); x += widths[i];
      });
      y += h;
    };
    const drawHeaderRow = () => row(headers, true);
    drawHeaderRow(); rows.forEach((cells, index) => row(cells, false, index));
    y += 4;
  };
  const drawBars = (title: string, values: Array<{ label: string; value: number }>) => {
    sectionTitle(title);
    if (!values.length || values.every((item) => !item.value)) { line('Dados', 'Sem valores no período selecionado.'); y += 2; return; }
    const max = Math.max(1, ...values.map((item) => item.value));
    for (const item of values.slice(0, 12)) {
      ensureSpace(8);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(ink);
      pdf.text(pdf.splitTextToSize(item.label, 42)[0], margin, y + 3.5);
      const barX = margin + 45; const barWidth = contentWidth - 76;
      pdf.setFillColor(238, 240, 243); pdf.roundedRect(barX, y, barWidth, 4.2, 1.5, 1.5, 'F');
      pdf.setFillColor(232, 117, 50); pdf.roundedRect(barX, y, Math.max(1, barWidth * item.value / max), 4.2, 1.5, 1.5, 'F');
      pdf.text(brl(item.value), pageWidth - margin, y + 3.5, { align: 'right' }); y += 7;
    }
    y += 2;
  };

  header();
  pdf.setTextColor(ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
  pdf.text(REPORT_KIND_LABELS[payload.kind], margin, y); y += 7;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(90, 99, 111);
  pdf.text(`Período: ${date(payload.analytics.startDate)} a ${date(payload.analytics.endDate)}  •  Emitido em ${emittedAt}`, margin, y);
  if (payload.user?.full_name || payload.user?.name) { y += 4; pdf.text(`Responsável: ${payload.user.full_name || payload.user.name}`, margin, y); }
  y += 9;

  if (selected(payload, 'summary')) {
    sectionTitle('Resumo executivo • fluxo de caixa');
    line('Receitas recebidas', brl(payload.analytics.revenue));
    line('Despesas pagas', brl(payload.analytics.expenses));
    line('Resultado de caixa', `${brl(payload.analytics.cashResult)} • margem de caixa ${payload.analytics.marginPercentage.toFixed(1)}%`);
    line('A receber / a pagar', `${brl(payload.analytics.accountsReceivable)} / ${brl(payload.analytics.accountsPayable)}`);
    line('Em atraso', brl(payload.analytics.overdueAmount));
    line('Clientes ativos / projetos em andamento / concluídos', `${payload.analytics.activeClients} / ${payload.analytics.ongoingProjects} / ${payload.analytics.completedProjects}`);
    line('Conclusão de tarefas', `${payload.analytics.completedTasks} de ${payload.analytics.totalTasks} (${payload.analytics.taskCompletionRate.toFixed(1)}%)`);
    const previous = payload.analytics.previousPeriod;
    if (previous.revenue || previous.expenses) {
      sectionTitle('Comparação com o período anterior');
      line('Período anterior', `${date(previous.startDate)} a ${date(previous.endDate)}`);
      line('Variação das receitas', previous.revenueChangePercent === undefined ? 'Sem base anterior' : `${previous.revenueChangePercent > 0 ? '+' : ''}${previous.revenueChangePercent}%`);
      line('Variação das despesas', previous.expenseChangePercent === undefined ? 'Sem base anterior' : `${previous.expenseChangePercent > 0 ? '+' : ''}${previous.expenseChangePercent}%`);
      line('Resultado de caixa anterior', brl(previous.cashResult));
    } else line('Comparação anterior', 'Sem movimentações pagas no período comparável.');
    y += 4;
  }
  if (selected(payload, 'finance')) {
    drawBars('Evolução mensal • recebimentos e pagamentos', payload.analytics.monthlySeries.flatMap((item) => [
      { label: `${item.month}/${item.year} • Receitas`, value: item.revenue }, { label: `${item.month}/${item.year} • Despesas`, value: item.expenses },
    ]).filter((item) => item.value > 0));
    drawBars('Despesas pagas por categoria', Object.entries(payload.analytics.categoryTotals).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value));
    const reportTransactions = transactionsForReport(payload);
    const transactionRows = reportTransactions.map((item) => [item.description, item.type === 'receita' ? 'Receita' : 'Despesa', item.client_name || '—', item.project_name || '—', item.category, date(item.due_date), date(item.payment_date), paymentMethodPt(item.payment_method), `${statusPt(item.status)} • ${brl(item.amount)}`]);
    const revenueTotal = reportTransactions.filter((item) => item.type === 'receita').reduce((total, item) => total + Number(item.amount || 0), 0);
    const expenseTotal = reportTransactions.filter((item) => item.type === 'despesa').reduce((total, item) => total + Number(item.amount || 0), 0);
    transactionRows.push(['Total receitas', '', '', '', '', '', '', '', brl(revenueTotal)], ['Total despesas', '', '', '', '', '', '', '', brl(expenseTotal)]);
    drawTable('Lançamentos financeiros', ['Descrição', 'Tipo', 'Cliente', 'Projeto', 'Categoria', 'Vencimento', 'Pagamento', 'Forma', 'Status / valor'], transactionRows,
      [31, 13, 20, 20, 18, 17, 17, 18, contentWidth - 154]);
  }
  if (selected(payload, 'receivables')) {
    const rows = [...payload.analytics.pendingReceivables, ...payload.analytics.pendingPayables, ...payload.analytics.overdue]
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
      .map((item) => [item.type === 'receita' ? 'A receber' : 'A pagar', item.description, item.client_name || '—', date(item.due_date), statusPt(item.status), brl(item.amount)]);
    drawTable('Posição de contas por vencimento', ['Grupo', 'Descrição', 'Cliente', 'Vencimento', 'Situação', 'Valor'], rows,
      [23, 47, 31, 25, 27, contentWidth - 153]);
  }
  if (selected(payload, 'clients')) {
    line('Clientes ativos', String(payload.analytics.activeClients));
    line('Distribuição da carteira', Object.entries(payload.analytics.clientStatusTotals).map(([key, count]) => `${statusPt(key)}: ${count}`).join(' • ') || 'Sem clientes no filtro');
    drawTable('Carteira de clientes', ['Cliente', 'Empresa', 'E-mail', 'Telefone', 'Status', 'Receita registrada'], payload.clients.map((item) => [item.name, item.company_name || '—', item.email || '—', item.phone || '—', statusPt(item.status), brl(item.total_revenue)]),
      [30, 34, 39, 25, 24, contentWidth - 152]);
  }
  if (selected(payload, 'projects')) {
    drawTable('Projetos', ['Projeto', 'Cliente', 'Orçamento', 'Prazo', 'Situação', 'Progresso'], payload.projects.map((item) => [item.name, item.client_name || '—', brl(item.budget), date(item.due_date), statusPt(item.status), `${item.progress || 0}%`]),
      [43, 32, 25, 25, 31, contentWidth - 156]);
  }
  if (selected(payload, 'tasks')) {
    line('Tarefas concluídas', `${payload.analytics.completedTasks} de ${payload.analytics.totalTasks} (${payload.analytics.taskCompletionRate.toFixed(1)}%)`);
    line('Situação das tarefas', Object.entries(payload.analytics.taskStatusTotals).map(([key, count]) => `${statusPt(key)}: ${count}`).join(' • ') || 'Sem tarefas no período');
    drawTable('Tarefas e produtividade', ['Tarefa', 'Projeto', 'Prioridade', 'Prazo', 'Situação'], payload.tasks.map((item) => [item.title, item.project_name || '—', statusPt(item.priority), date(item.due_date), statusPt(item.status)]),
      [56, 39, 27, 25, contentWidth - 147]);
  }
  if (payload.analysis) {
    sectionTitle('Análise do Nexus AI');
    const paragraphs = payload.analysis.split(/\n+/).filter(Boolean);
    paragraphs.forEach((paragraph) => {
      const lines = pdf.splitTextToSize(paragraph.replace(/^[-•*# ]+/, ''), contentWidth);
      const height = lines.length * 4.2 + 2; ensureSpace(height);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(ink); pdf.setFontSize(8); pdf.text(lines, margin, y); y += height;
    });
  }
  const totalPages = pdf.getNumberOfPages();
  for (let current = 1; current <= totalPages; current += 1) {
    pdf.setPage(current); pdf.setDrawColor(225, 228, 233); pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    pdf.setFontSize(7); pdf.setTextColor(110, 117, 126);
    pdf.text('NEXUS AI • Relatório empresarial', margin, pageHeight - 8);
    pdf.text(`Emitido em ${emittedAt}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    pdf.text(`Página ${current} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
  return pdf;
}

export async function exportReportPdf(payload: ReportExportPayload) {
  const pdf = await buildReportPdf(payload);
  pdf.save(reportFilename(payload.company, payload.kind, payload.analytics, 'pdf'));
}

export async function buildReportWorkbook(payload: ReportExportPayload) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const addSheet = (name: string, rows: Array<Record<string, string | number>>) => {
    if (rows.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  };
  if (selected(payload, 'summary')) addSheet('Resumo executivo', [
    { Indicador: 'Receitas recebidas', Valor: payload.analytics.revenue }, { Indicador: 'Despesas pagas', Valor: payload.analytics.expenses },
    { Indicador: 'Resultado de caixa', Valor: payload.analytics.cashResult }, { Indicador: 'Margem de caixa (%)', Valor: payload.analytics.marginPercentage },
    { Indicador: 'Contas a receber', Valor: payload.analytics.accountsReceivable }, { Indicador: 'Contas a pagar', Valor: payload.analytics.accountsPayable },
    { Indicador: 'Valores em atraso', Valor: payload.analytics.overdueAmount }, { Indicador: 'Clientes ativos', Valor: payload.analytics.activeClients },
    { Indicador: 'Projetos em andamento', Valor: payload.analytics.ongoingProjects }, { Indicador: 'Projetos concluídos', Valor: payload.analytics.completedProjects },
    { Indicador: 'Taxa de conclusão das tarefas (%)', Valor: payload.analytics.taskCompletionRate },
    { Indicador: 'Receitas no período anterior', Valor: payload.analytics.previousPeriod.revenue },
    { Indicador: 'Despesas no período anterior', Valor: payload.analytics.previousPeriod.expenses },
    { Indicador: 'Resultado de caixa no período anterior', Valor: payload.analytics.previousPeriod.cashResult },
  ]);
  if (selected(payload, 'finance')) addSheet('Lançamentos financeiros', transactionsForReport(payload).map((row) => ({
    Descrição: row.description, Tipo: row.type, Cliente: row.client_name || '', Projeto: row.project_name || '', Categoria: row.category,
    Vencimento: date(row.due_date), 'Data de pagamento': date(row.payment_date),
    Status: statusPt(row.status), 'Forma de pagamento': paymentMethodPt(row.payment_method), Valor: row.amount,
  })));
  if (selected(payload, 'receivables')) addSheet('Contas a pagar e receber', [...payload.analytics.pendingReceivables, ...payload.analytics.pendingPayables, ...payload.analytics.overdue]
    .filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index)
    .map((row) => ({ Grupo: row.type === 'receita' ? 'A receber' : 'A pagar', Descrição: row.description, Cliente: row.client_name || '',
      Projeto: row.project_name || '', Vencimento: date(row.due_date), Status: statusPt(row.status), Valor: row.amount })));
  if (selected(payload, 'clients')) addSheet('Clientes', payload.clients.map((row) => ({ Nome: row.name, Empresa: row.company_name, 'E-mail': row.email, Telefone: row.phone, Status: statusPt(row.status), 'Receita registrada': row.total_revenue })));
  if (selected(payload, 'projects')) addSheet('Projetos', payload.projects.map((row) => ({ Projeto: row.name, Cliente: row.client_name || '', Orçamento: row.budget, 'Prazo de entrega': date(row.due_date), 'Situação': statusPt(row.status), Progresso: `${row.progress || 0}%` })));
  if (selected(payload, 'tasks')) addSheet('Tarefas', payload.tasks.map((row) => ({ Tarefa: row.title, Projeto: row.project_name || '', Cliente: row.client_name || '', Prioridade: statusPt(row.priority), Prazo: date(row.due_date), Situação: statusPt(row.status) })));
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer | Uint8Array;
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

export async function exportReportExcel(payload: ReportExportPayload) {
  const bytes = await buildReportWorkbook(payload);
  const downloadBytes = new Uint8Array(bytes.byteLength); downloadBytes.set(bytes);
  const url = URL.createObjectURL(new Blob([downloadBytes.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = reportFilename(payload.company, payload.kind, payload.analytics, 'xlsx'); link.click(); URL.revokeObjectURL(url);
}

export function buildReportCsv(payload: ReportExportPayload) {
  const rows: Array<Array<string | number>> = [['Tipo', 'Descrição', 'Cliente', 'Projeto', 'Categoria', 'Vencimento', 'Pagamento', 'Forma de pagamento', 'Status', 'Valor']];
  transactionsForReport(payload).forEach((row) => rows.push([row.type, row.description, row.client_name || '', row.project_name || '', row.category, date(row.due_date), date(row.payment_date), paymentMethodPt(row.payment_method), statusPt(row.status), row.amount]));
  if (rows.length === 1 && selected(payload, 'clients')) payload.clients.forEach((row) => rows.push(['Cliente', row.name, row.company_name, '', '', '', '', row.phone, statusPt(row.status), row.total_revenue]));
  if (rows.length === 1 && selected(payload, 'projects')) payload.projects.forEach((row) => rows.push(['Projeto', row.name, row.client_name || '', '', '', date(row.due_date), '', '', statusPt(row.status), row.budget]));
  if (rows.length === 1 && selected(payload, 'tasks')) payload.tasks.forEach((row) => rows.push(['Tarefa', row.title, row.client_name || '', row.project_name || '', row.priority, date(row.due_date), '', '', statusPt(row.status), '']));
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
  return csv;
}

export function exportReportCsv(payload: ReportExportPayload) {
  const csv = buildReportCsv(payload);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = reportFilename(payload.company, payload.kind, payload.analytics, 'csv'); link.click(); URL.revokeObjectURL(url);
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function openReportPreview(payload: ReportExportPayload, print = false) {
  const popup = window.open('', '_blank', 'width=920,height=740');
  if (!popup) return false;
  popup.opener = null;
  const previewTransactions = transactionsForReport(payload);
  const rows = selected(payload, 'finance') ? previewTransactions.map((row) => `<tr><td>${escapeHtml(row.description)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.client_name || '—')}</td><td>${escapeHtml(row.project_name || '—')}</td><td>${escapeHtml(row.category)}</td><td>${date(row.due_date)}</td><td>${date(row.payment_date)}</td><td>${escapeHtml(paymentMethodPt(row.payment_method))}</td><td>${escapeHtml(statusPt(row.status))}</td><td class="money">${brl(row.amount)}</td></tr>`).join('') : '';
  const totalRevenue = previewTransactions.filter((row) => row.type === 'receita').reduce((total, row) => total + Number(row.amount || 0), 0);
  const totalExpenses = previewTransactions.filter((row) => row.type === 'despesa').reduce((total, row) => total + Number(row.amount || 0), 0);
  const financialTotals = `<tr class="total"><td colspan="9">Total receitas</td><td class="money">${brl(totalRevenue)}</td></tr><tr class="total"><td colspan="9">Total despesas</td><td class="money">${brl(totalExpenses)}</td></tr>`;
  const headline = selected(payload, 'summary') ? `<section><h2>Resumo executivo</h2><div class="metrics"><div>Receitas recebidas<strong>${brl(payload.analytics.revenue)}</strong></div><div>Despesas pagas<strong>${brl(payload.analytics.expenses)}</strong></div><div>Resultado de caixa<strong>${brl(payload.analytics.cashResult)}</strong></div><div>Margem de caixa<strong>${payload.analytics.marginPercentage.toFixed(1)}%</strong></div><div>A receber<strong>${brl(payload.analytics.accountsReceivable)}</strong></div><div>A pagar<strong>${brl(payload.analytics.accountsPayable)}</strong></div><div>Em atraso<strong>${brl(payload.analytics.overdueAmount)}</strong></div><div>Tarefas concluídas<strong>${payload.analytics.taskCompletionRate.toFixed(1)}%</strong></div></div></section>` : '';
  const logo = payload.company?.logo_url ? `<img class="logo" src="${escapeHtml(payload.company.logo_url)}" alt="Logotipo">` : '';
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(REPORT_KIND_LABELS[payload.kind])}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eef0f3;color:#202938;font:12px Arial,sans-serif}.toolbar{position:sticky;top:0;background:#202938;padding:12px;text-align:right}.toolbar button{border:0;border-radius:6px;background:#e87532;color:white;padding:9px 14px;margin-left:8px;font-weight:bold;cursor:pointer}.page{width:210mm;min-height:297mm;margin:18px auto;background:white;padding:15mm;box-shadow:0 8px 30px #16203322;border-top:4px solid #e87532}.head{display:flex;align-items:center;gap:14px;border-bottom:1px solid #ddd;padding-bottom:14px}.logo{width:54px;height:44px;object-fit:contain}.head h1{font-size:18px;margin:0 0 5px}.muted{color:#667085;font-size:10px;line-height:1.6}h2{font-size:13px;color:#c65b20;border-bottom:1px solid #eee;padding-bottom:7px;margin:20px 0 10px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.metrics div{border:1px solid #e6e8eb;border-radius:6px;padding:10px;color:#667085}.metrics strong{display:block;font-size:12px;color:#202938;margin-top:6px}table{border-collapse:collapse;width:100%;font-size:8px}th,td{padding:4px;border-bottom:1px solid #e5e7eb;text-align:left}th{background:#f2f4f7}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}.money{text-align:right;font-weight:bold}.total{font-weight:bold;background:#f2f4f7}.foot{margin-top:22px;border-top:1px solid #ddd;padding-top:8px;color:#667085;font-size:9px}.analysis{white-space:pre-wrap;line-height:1.6}@page{size:A4;margin:0}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;width:210mm;min-height:297mm;page-break-after:always}.page:last-child{page-break-after:auto}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir</button></div><main class="page"><header class="head">${logo}<div><h1>${escapeHtml(payload.company?.name || 'Relatório empresarial')}</h1><div class="muted">${escapeHtml([payload.company?.cnpj, payload.company?.address, payload.company?.city, payload.company?.state, payload.company?.phone, payload.company?.email].filter(Boolean).join(' • ') || 'NEXUS AI')}</div></div></header><h1 style="font-size:18px;margin:18px 0 6px">${escapeHtml(REPORT_KIND_LABELS[payload.kind])}</h1><p class="muted">Período: ${date(payload.analytics.startDate)} a ${date(payload.analytics.endDate)} • Emitido em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())} • Responsável: ${escapeHtml(payload.user?.full_name || payload.user?.name || '—')}</p>${headline}${selected(payload, 'finance') ? `<section><h2>Lançamentos financeiros</h2><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Cliente</th><th>Projeto</th><th>Categoria</th><th>Vencimento</th><th>Pagamento</th><th>Forma</th><th>Status</th><th>Valor</th></tr></thead><tbody>${rows}</tbody><tfoot>${financialTotals}</tfoot></table></section>` : ''}${selected(payload, 'clients') ? `<section><h2>Clientes (${payload.clients.length})</h2><table><thead><tr><th>Nome</th><th>Empresa</th><th>Contato</th><th>Status</th><th>Receita registrada</th></tr></thead><tbody>${payload.clients.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.company_name)}</td><td>${escapeHtml(row.email)} • ${escapeHtml(row.phone)}</td><td>${escapeHtml(statusPt(row.status))}</td><td class="money">${brl(row.total_revenue)}</td></tr>`).join('')}</tbody></table></section>` : ''}${selected(payload, 'projects') ? `<section><h2>Projetos (${payload.projects.length})</h2><table><thead><tr><th>Projeto</th><th>Cliente</th><th>Orçamento</th><th>Prazo</th><th>Situação</th><th>Progresso</th></tr></thead><tbody>${payload.projects.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.client_name || '—')}</td><td>${brl(row.budget)}</td><td>${date(row.due_date)}</td><td>${escapeHtml(statusPt(row.status))}</td><td>${row.progress || 0}%</td></tr>`).join('')}</tbody></table></section>` : ''}${selected(payload, 'tasks') ? `<section><h2>Tarefas e produtividade (${payload.tasks.length})</h2><table><thead><tr><th>Tarefa</th><th>Projeto</th><th>Prioridade</th><th>Prazo</th><th>Status</th></tr></thead><tbody>${payload.tasks.map((row) => `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.project_name || '—')}</td><td>${escapeHtml(statusPt(row.priority))}</td><td>${date(row.due_date)}</td><td>${escapeHtml(statusPt(row.status))}</td></tr>`).join('')}</tbody></table></section>` : ''}${payload.analysis ? `<section><h2>Análise do Nexus AI</h2><div class="analysis">${escapeHtml(payload.analysis)}</div></section>` : ''}<footer class="foot">NEXUS AI • ${escapeHtml(REPORT_KIND_LABELS[payload.kind])} • Página 1</footer></main></body></html>`);
  popup.document.close();
  if (print) window.setTimeout(() => { popup.focus(); popup.print(); }, 400);
  return true;
}

export type { FinancialTransaction };


