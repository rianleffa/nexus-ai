import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportAnalytics } from './reportAnalytics.ts';

const now = new Date('2026-03-15T12:00:00');
const transactions = [
  {id:'r1',type:'receita',status:'pago',amount:1000,payment_date:'2026-03-10',due_date:'2026-03-01',client_id:'c1',project_id:'p1',client_name:'Cliente A',description:'Receita',category:'Serviços'},
  {id:'r2',type:'receita',status:'pendente',amount:500,due_date:'2026-03-20',client_id:'c1',project_id:'p1',description:'A receber',category:'Serviços'},
  {id:'e1',type:'despesa',status:'pago',amount:200,payment_date:'2026-03-09',due_date:'2026-03-02',client_id:'c1',project_id:'p1',description:'Despesa paga',category:'Marketing'},
  {id:'e2',type:'despesa',status:'pendente',amount:70,due_date:'2026-03-14',client_id:'c1',project_id:'p1',description:'Conta vencida',category:'Operacional'},
  {id:'e3',type:'despesa',status:'atrasado',amount:30,due_date:'2026-03-15',client_id:'c2',project_id:'p2',description:'Outro atraso',category:'Operacional'},
  {id:'r3',type:'receita',status:'pago',amount:400,payment_date:'2026-03-07',due_date:'2026-03-07',client_id:'c1',project_id:'p1',description:'Receita período anterior',category:'Serviços'},
  {id:'out',type:'receita',status:'pago',amount:999,payment_date:'2026-02-28',due_date:'2026-02-20',client_id:'c1',project_id:'p1',description:'Fora do mês',category:'Vendas'},
];
const clients = [
  {id:'c1',status:'ativo',created_at:'2026-01-01'},
  {id:'c2',status:'em_negociacao',created_at:'2026-02-01'},
];
const projects = [
  {id:'p1',client_id:'c1',status:'em_andamento',due_date:'2026-03-25'},
  {id:'p2',client_id:'c2',status:'concluido',due_date:'2026-03-28'},
];
const tasks = [
  {id:'t1',client_id:'c1',project_id:'p1',status:'concluido',due_date:'2026-03-04'},
  {id:'t2',client_id:'c1',project_id:'p1',status:'em_andamento',due_date:'2026-03-14'},
  {id:'t3',client_id:'c2',project_id:'p2',status:'a_fazer',due_date:'2026-02-28'},
];

const run = (extra = {}) => buildReportAnalytics({ transactions, clients, projects, tasks, filters:{period:'month',...extra}, now });

test('reports cash KPIs exclude unpaid receivables and payables', () => {
  const data = run();
  assert.equal(data.revenue, 1400);
  assert.equal(data.expenses, 200);
  assert.equal(data.cashResult, 1200);
  assert.equal(data.marginPercentage, 85.7);
  assert.equal(data.accountsReceivable, 500);
  assert.equal(data.accountsPayable, 100);
  assert.equal(data.overdueAmount, 100);
});

test('client, project, category and status filters scope the same transaction set', () => {
  const data = run({clientId:'c1',projectId:'p1',category:'Serviços'});
  assert.deepEqual(data.selectedTransactions.map((row) => row.id).sort(), ['r1','r2','r3']);
  const pending = run({clientId:'c1',projectId:'p1',status:'pendente'});
  assert.deepEqual(pending.selectedTransactions.map((row) => row.id).sort(), ['e2','r2']);
  assert.equal(pending.revenue, 0);
});

test('project, client and task breakdowns honor the selected period', () => {
  const data = run();
  assert.equal(data.activeClients, 1);
  assert.equal(data.ongoingProjects, 1);
  assert.equal(data.completedProjects, 1);
  assert.equal(data.totalTasks, 2);
  assert.equal(data.completedTasks, 1);
  assert.equal(data.taskCompletionRate, 50);
});

test('custom date bounds select payments by payment date and open accounts by due date', () => {
  const data = run({period:'custom',startDate:'2026-03-09',endDate:'2026-03-12'});
  assert.equal(data.revenue, 1000);
  assert.equal(data.expenses, 200);
  assert.equal(data.accountsReceivable, 0);
  assert.equal(data.selectedTransactions.length, 2);
  assert.equal(data.previousPeriod.revenue, 400);
  assert.equal(data.previousPeriod.startDate, '2026-03-05');
  assert.equal(data.previousPeriod.endDate, '2026-03-08');
  assert.equal(data.previousPeriod.revenueChangePercent, 150);
});
