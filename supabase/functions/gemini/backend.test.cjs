// Isolated database adapters for regression testing. No Gemini responses are mocked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const backend = (async()=>{
  globalThis.Deno={env:{get:()=>undefined}};
  let source=(await fs.readFile(path.join(__dirname,'index.ts'),'utf8')).split('\nDeno.serve')[0];
  source=source.replace(/from 'npm:@supabase\/supabase-js@2'/,'from '+JSON.stringify(pathToFileURL(path.join(root,'node_modules/@supabase/supabase-js/dist/index.mjs')).href));
  source=source.replace(/from '\.\/(\w+\.mjs)'/g,(_,name)=>'from '+JSON.stringify(pathToFileURL(path.join(__dirname,name)).href));
  source+='\nexport {executeTool,prepareCalendarAction,prepareResolvedAction,findRecentDuplicate,makeIdempotencyKey,describe,explicitlyUnlinkedMeeting,declarations,automaticWriteTools};';
  const file=path.join(os.tmpdir(),'nexus-gemini-backend-regression.mjs');
  await fs.writeFile(file,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
  return import(pathToFileURL(file).href+'?t='+Date.now());
})();
function readOnlyDb(rows){
  const calls=[];
  const db={calls,from(table){calls.push(['from',table]);const chain={};
    for(const method of ['select','eq','neq','ilike','limit'])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};
    chain.then=(resolve,reject)=>Promise.resolve({data:rows,error:null}).then(resolve,reject);
    for(const method of ['insert','update','delete'])chain[method]=()=>assert.fail('Preflight must not mutate business data');
    return chain;
  }};return db;
}
test('a missing client returns a structured result and keeps the tenant filter',async()=>{
  const {executeTool}=await backend;const db=readOnlyDb([]);
  const result=await executeTool(db,'tenant-a','user-a','get_client',{query:'João'});
  assert.equal(result.data.found,false);assert.match(result.data.guidance,/sem vínculo/);
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='company_id'&&c[2]==='tenant-a'));
});
test('missing CRM link blocks the calendar preflight before any write',async()=>{
  const {prepareCalendarAction}=await backend;
  await assert.rejects(prepareCalendarAction(readOnlyDb([]),'tenant-a','create_calendar_event',{title:'Reunião',event_date:'2026-11-19',start_time:'14:00',client_name:'João'}),/cadastrar.*sem vínculo/);
});
test('ambiguous client names require clarification',async()=>{
  const {prepareCalendarAction}=await backend;
  await assert.rejects(prepareCalendarAction(readOnlyDb([{id:'one'},{id:'two'}]),'tenant-a','create_calendar_event',{title:'Reunião',event_date:'2026-11-19',start_time:'14:00',client_name:'João'}),/mais de um cliente/);
});
test('an explicitly unlinked meeting needs no client lookup',async()=>{
  const {prepareCalendarAction}=await backend;const db=readOnlyDb([]);
  await prepareCalendarAction(db,'tenant-a','create_calendar_event',{title:'Reunião com João',event_date:'2026-11-19',start_time:'14:00',participant_name:'João'},true);
  assert.deepEqual(db.calls,[]);
});
test('rescheduling pins a single company-scoped event ID before confirmation',async()=>{
  const {prepareCalendarAction}=await backend;const db=readOnlyDb([{id:'event-one',title:'Reunião com João'}]);
  const args={query:'João',new_date:'2026-11-20',new_start_time:'16:00'};
  await prepareCalendarAction(db,'tenant-a','reschedule_calendar_event',args);
  assert.equal(args.event_id,'event-one');assert.equal(args.query,'Reunião com João');
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='company_id'&&c[2]==='tenant-a'));
});
test('canceling never guesses between multiple meetings',async()=>{
  const {prepareCalendarAction}=await backend;
  await assert.rejects(prepareCalendarAction(readOnlyDb([{id:'one'},{id:'two'}]),'tenant-a','cancel_calendar_event',{query:'João'}),/mais de um compromisso/);
});

test('a participant defaults to a company-scoped CRM lookup',async()=>{
  const {prepareCalendarAction}=await backend;const db=readOnlyDb([{id:'client-one',name:'Mariana'}]);
  const args={title:'Reunião com Mariana',event_date:'2026-11-19',start_time:'08:00',participant_name:'Mariana'};
  await prepareCalendarAction(db,'tenant-a','create_calendar_event',args);
  assert.equal(args.client_name,'Mariana');assert.equal(args.participant_name,undefined);
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='company_id'&&c[2]==='tenant-a'));
});
test('an unknown participant triggers clarification before confirmation',async()=>{
  const {prepareCalendarAction}=await backend;
  await assert.rejects(prepareCalendarAction(readOnlyDb([]),'tenant-a','create_calendar_event',{title:'Reunião com Mariana',event_date:'2026-11-19',start_time:'08:00',participant_name:'Mariana'}),/cadastrar.*sem vínculo/);
});
test('only an explicit no-link request skips the CRM lookup',async()=>{
  const {explicitlyUnlinkedMeeting}=await backend;
  assert.equal(explicitlyUnlinkedMeeting('Agende sem vínculo com cliente.'),true);
  assert.equal(explicitlyUnlinkedMeeting('Agende uma reunião com Mariana.'),false);
});

test('new CRUD tools are available and every mutating tool requires confirmation',async()=>{
  const {declarations}=await backend;
  const names=new Set(declarations.map(item=>item.name));
  for(const name of ['delete_client','delete_project','delete_task','update_financial_transaction','delete_financial_transaction','delete_document']) assert.ok(names.has(name),`${name} declaration exists`);
  const source=await fs.readFile(path.join(__dirname,'index.ts'),'utf8');
  const writeBlock=source.match(/const writeTools = new Set<ToolName>\(\[([\s\S]*?)\]\);/)?.[1]||'';
  for(const name of ['delete_client','delete_project','delete_task','update_financial_transaction','delete_financial_transaction','delete_document']) assert.ok(writeBlock.includes(`'${name}'`),`${name} requires confirmation`);
});

test('common create/edit operations are automatic while destructive and financial writes stay protected',async()=>{
  const {automaticWriteTools}=await backend;
  for(const name of ['create_client','update_client','create_project','update_project','create_task','update_task','complete_task','create_calendar_event','reschedule_calendar_event','update_calendar_event','create_client_and_meeting']) assert.ok(automaticWriteTools.has(name),`${name} is permitted to run automatically`);
  for(const name of ['delete_client','delete_project','delete_task','delete_document','create_financial_transaction','update_financial_transaction','delete_financial_transaction','cancel_calendar_event']) assert.equal(automaticWriteTools.has(name),false,`${name} keeps confirmation`);
});

test('destructive action preflight pins one tenant-scoped record and rejects ambiguity',async()=>{
  const {prepareResolvedAction}=await backend;
  const db=readOnlyDb([{id:'doc-one',title:'Contrato Mariana'}]);
  const args={query:'Contrato Mariana'};
  await prepareResolvedAction(db,'tenant-a','delete_document',args);
  assert.equal(args.document_id,'doc-one');
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='company_id'&&c[2]==='tenant-a'));
  await assert.rejects(prepareResolvedAction(readOnlyDb([{id:'a',title:'Contrato'},{id:'b',title:'Contrato aditivo'}]),'tenant-a','delete_document',{query:'Contrato'}),/mais de um registro/);
});

test('recent identical actions are detected within the tenant and user scope',async()=>{
  const {findRecentDuplicate}=await backend;const calls=[];const row={id:'action-1',status:'success',result:{id:'client-1'}};
  const db={from(table){calls.push(['from',table]);const q={};for(const name of ['select','eq','contains','in','gte','order','limit'])q[name]=(...args)=>{calls.push([name,...args]);return q;};q.maybeSingle=async()=>({data:row,error:null});return q;}};
  assert.equal((await findRecentDuplicate(db,'company-a','user-a','create_client',{name:'João'})).id,'action-1');
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='company_id'&&c[2]==='company-a'));
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='user-a'));
  assert.ok(calls.some(c=>c[0]==='contains'&&c[1]==='parameters'));
});

test('idempotency keys are stable for the same tenant, user, tool, and arguments',async()=>{
  const {makeIdempotencyKey}=await backend;
  const argsA={name:'Lucas',email:'lucas@example.com'};
  const argsB={email:'lucas@example.com',name:'Lucas'};
  assert.equal(await makeIdempotencyKey('company-a','user-a','create_client',argsA),await makeIdempotencyKey('company-a','user-a','create_client',argsB));
  assert.notEqual(await makeIdempotencyKey('company-b','user-a','create_client',argsA),await makeIdempotencyKey('company-a','user-a','create_client',argsA));
});

test('user-facing success text omits internal IDs and tool JSON',async()=>{
  const {describe}=await backend;
  const text=describe('create_client',{data:{id:'internal-id',name:'Lucas'}});
  assert.equal(text,'Cliente Lucas cadastrado com sucesso.');
  assert.doesNotMatch(text,/internal-id|JSON|tool/i);
});
test('financial category remains optional because the backend defaults it',async()=>{
  const {declarations}=await backend;const tool=declarations.find(item=>item.name==='create_financial_transaction');
  assert.deepEqual(tool.parameters.required,['type','description','amount','due_date']);
  assert.match(tool.parameters.properties.category.description,/Opcional/);
});
