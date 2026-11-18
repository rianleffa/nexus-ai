// Real Gemini calls using the production request builder. No database writes.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
(async () => {
  const root = path.resolve(__dirname, '..');
  const dir = path.join(root, 'supabase/functions/gemini');
  const env = await fs.readFile(path.join(root, 'supabase/functions/.env'), 'utf8');
  const key = env.match(/^GEMINI_API_KEY\s*=\s*(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  const configuredModel = process.env.NEXUS_TEST_MODEL?.trim() || env.match(/^GEMINI_MODEL\s*=\s*(.*)$/m)?.[1]?.trim();
  const model = !configuredModel || configuredModel === 'gemini-3.1-flash-lite' ? 'gemini-3.5-flash-lite' : configuredModel;
  if (!key) throw new Error('Configure GEMINI_API_KEY no backend local.');
  globalThis.Deno = { env: { get: name => name === 'GEMINI_MODEL' ? model : undefined } };
  let source = (await fs.readFile(path.join(dir, 'index.ts'), 'utf8')).split('\nDeno.serve')[0];
  source = source.replace(/from 'npm:@supabase\/supabase-js@2'/, 'from ' + JSON.stringify(pathToFileURL(path.join(root,'node_modules/@supabase/supabase-js/dist/index.mjs')).href));
  source = source.replace(/from '\.\/(\w+\.mjs)'/g, (_, name) => 'from ' + JSON.stringify(pathToFileURL(path.join(dir,name)).href));
  source += '\nexport { declarations, geminiCall, prepareCalendarAction, executeTool, buildSystemInstruction, saoPauloDate };';
  const file = path.join(os.tmpdir(), 'nexus-gemini-production-check.mjs');
  const transpiled = ts.transpileModule(source, {reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
  if (transpiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error)) throw new Error('Erro de sintaxe na Edge Function.');
  await fs.writeFile(file, transpiled.outputText);
  const backend = await import(pathToFileURL(file).href+'?t='+Date.now());
  const { getInstantReply } = await import(pathToFileURL(path.join(dir,'toolSelection.mjs')).href);
  const today = backend.saoPauloDate();
  const prompts = ['Olá, você está funcionando?','Quais clientes tenho cadastrados?','Cadastre um cliente chamado Mariana.','Agende uma reunião com Mariana amanhã às 08h.','Cadastre João e agende uma reunião amanhã às 10h.','Quais tarefas tenho pendentes?','Registre uma despesa de R$ 100.'];
  const selected = process.argv.length > 2 ? process.argv.slice(2) : prompts;
  const results = []; for (const prompt of selected) {
    const started = performance.now();
    const instantReply = getInstantReply([{role:'user',parts:[{text:prompt}]}]);
    if (instantReply) { results.push({prompt,model,today,latencyMs:Math.round(performance.now()-started),success:true,source:'production-fast-path',text:instantReply,calls:[]}); continue; }
    try {
      const response = await backend.geminiCall(key,[{role:'user',parts:[{text:prompt}]}],backend.buildSystemInstruction('Ambiente de verificação',today),AbortSignal.timeout(25000));
      const parts = response.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter(p=>p.functionCall).map(p=>({name:p.functionCall.name,args:p.functionCall.args}));
      const text = parts.map(p=>p.text||'').join('');
      const tomorrow = new Date(today+'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
      const expectedDate = tomorrow.toISOString().slice(0,10);
      let interpretationPassed = Boolean(text || calls.length);
      if (prompt === prompts[1]) interpretationPassed = calls.some(c=>c.name==='get_clients');
      if (prompt === prompts[2]) interpretationPassed = calls.some(c=>c.name==='create_client' && c.args.name==='Mariana');
      if (prompt === prompts[3]) interpretationPassed = calls.some(c=>c.name==='create_calendar_event' && c.args.event_date===expectedDate && c.args.start_time==='08:00' && /Mariana/i.test(c.args.client_name || c.args.participant_name || ''));
      if (prompt === prompts[4]) interpretationPassed = calls.some(c=>c.name==='create_client_and_meeting' && c.args.name==='João' && c.args.event_date===expectedDate && c.args.start_time==='10:00');
      if (prompt === prompts[5]) interpretationPassed = calls.some(c=>c.name==='get_tasks' && c.args.pending_only===true && !c.args.status);
      if (prompt === prompts[6]) interpretationPassed = calls.some(c=>c.name==='create_financial_transaction' && c.args.type==='despesa' && c.args.amount===100 && c.args.due_date===today && c.args.status==='pendente') || (!calls.length && /descri[cç][aã]o|categoria/i.test(text));
      results.push({prompt,model,today,latencyMs:Math.round(performance.now()-started),success:interpretationPassed,text,calls});
    } catch(error) { results.push({prompt,model,latencyMs:Math.round(performance.now()-started),success:false,error:error.message.replaceAll(key,'[omitido]')}); }
  }
  console.log(JSON.stringify(results,null,2));
  if(results.some(r=>!r.success)) process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
