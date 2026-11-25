import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportAnalytics } from './reportAnalytics.ts';
import { buildReportCsv, buildReportPdf, buildReportWorkbook, reportFilename } from './reportExport.ts';

const analytics = buildReportAnalytics({transactions:[
  {id:'a',type:'receita',status:'pago',amount:1250,due_date:'2026-03-12',payment_date:'2026-03-12',category:'Serviços',description:'Projeto teste',client_name:'Cliente A'},
  {id:'b',type:'despesa',status:'pendente',amount:180,due_date:'2026-03-28',category:'Operacional',description:'Conta pendente'},
],clients:[],projects:[],tasks:[],filters:{period:'month'},now:new Date('2026-03-15T12:00:00')});
const payload={kind:'overview',sections:['summary','finance','receivables'],company:{id:'c',name:'Empresa Teste',plan:'starter',created_at:'2026-01-01'},user:{name:'Pessoa Teste',full_name:'Pessoa Teste'},analytics,clients:[],projects:[],tasks:[]};

test('PDF exporter creates a real A4 PDF with multiple selectable-text sections',async()=>{
  const pdf=await buildReportPdf(payload);
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth()-210)<0.01);
  assert.ok(Math.abs(pdf.internal.pageSize.getHeight()-297)<0.01);
  const bytes=pdf.output('arraybuffer');
  assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'%PDF');
  const text=pdf.output();
  assert.match(text,/Resumo executivo/);
  assert.match(text,/Lançamentos financeiros/);
  assert.match(text,/Total receitas/);
  assert.match(text,/Total despesas/);
});

test('Excel exporter creates an XLSX workbook and safe company-period filename',async()=>{
  const bytes=await buildReportWorkbook(payload);
  assert.equal(bytes[0],0x50);
  assert.equal(bytes[1],0x4b);
  const XLSX=await import('xlsx');
  const workbook=XLSX.read(bytes,{type:'array'});
  assert.deepEqual(workbook.SheetNames,['Resumo executivo','Lançamentos financeiros','Contas a pagar e receber']);
  assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets['Resumo executivo'])[0].Indicador,'Receitas recebidas');
  assert.match(reportFilename(payload.company,payload.kind,analytics,'pdf'),/^empresa-teste_relatorio-gerencial-completo_2026-03-01_2026-03-31\.pdf$/);
});

test('CSV export uses UTF-8 BOM, Brazilian separators and current filtered records',()=>{
  const csv=buildReportCsv(payload);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/"Vencimento";"Pagamento"/);
  assert.match(csv,/"Projeto teste"/);
  assert.match(csv,/"1250"/);
});

test('payables report excludes transactions already paid or received',async()=>{
  const payables={...payload,kind:'payables'};
  const csv=buildReportCsv(payables);
  assert.doesNotMatch(csv,/Projeto teste/);
  assert.match(csv,/Conta pendente/);
  const bytes=await buildReportWorkbook(payables);
  const XLSX=await import('xlsx');
  const workbook=XLSX.read(bytes,{type:'array'});
  const records=XLSX.utils.sheet_to_json(workbook.Sheets['Lançamentos financeiros']);
  assert.equal(records.length,1);
  assert.equal(records[0].Descrição,'Conta pendente');
});
