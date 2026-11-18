import test from 'node:test';
import assert from 'node:assert/strict';
import { isInvalidApiKey, validDate } from './validation.mjs';

test('accepts valid ISO dates including leap days', () => {
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-11-16'), true);
});

test('recognizes invalid API keys from Gemini error status or message', () => {
  assert.equal(isInvalidApiKey(400, 'API_KEY_INVALID', ''), true);
  assert.equal(isInvalidApiKey(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.'), true);
  assert.equal(isInvalidApiKey(403, 'PERMISSION_DENIED', 'API key not valid.'), false);
  assert.equal(isInvalidApiKey(400, 'INVALID_ARGUMENT', 'Invalid date.'), false);
});

test('rejects malformed and impossible dates', () => {
  for (const value of ['2025-02-29', '2026-13-01', '2026-04-31', '16/11/2026', '', null, 20261116]) {
    assert.equal(validDate(value), false, `expected ${String(value)} to be rejected`);
  }
});

import { fetchWithRetry } from './retry.mjs';

 test('retries transient Gemini failures with bounded backoff', async () => {
  let calls = 0;
  const delays = [];
  const retries = [];
  const options = { method: 'POST', body: 'same request', signal: new AbortController().signal };
  const response = await fetchWithRetry('https://example.test', options, {
    fetchImpl: async (_url, received) => {
      assert.equal(received.method, options.method);
      assert.equal(received.body, options.body);
      calls += 1;
      return new Response('{}', { status: calls < 3 ? 503 : 200 });
    },
    wait: async (delay) => { delays.push(delay); },
    onRetry: (event) => { retries.push(event); },
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [400, 800]);
  assert.deepEqual(retries.map(({reason}) => reason), ['HTTP_503', 'HTTP_503']);
});

test('returns the final response after three fast server errors', async () => {
  let calls = 0;
  const response = await fetchWithRetry('https://example.test', { signal: new AbortController().signal }, {
    fetchImpl: async () => { calls += 1; return new Response('{}', { status: 503 }); },
    wait: async () => {},
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 3);
  assert.equal(await response.text(), '{}');
});
test('does not retry authentication, invalid requests, or quota errors', async () => {
  for (const status of [400, 401, 403, 404, 429]) {
    let calls = 0;
    const response = await fetchWithRetry('https://example.test', { signal: new AbortController().signal }, {
      fetchImpl: async () => { calls += 1; return new Response('{}', { status }); },
      wait: async () => { assert.fail('must not wait'); },
    });
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});

test('respects the shared deadline before retrying', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fetchWithRetry('https://example.test', { signal: controller.signal }, {
    fetchImpl: async () => { calls += 1; return new Response('{}', { status: 503 }); },
    wait: async () => { controller.abort(new Error('deadline exceeded')); },
  }), /deadline exceeded/);
  assert.equal(calls, 1);
});

test('aborts the backoff wait without issuing another request', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fetchWithRetry('https://example.test', { signal: controller.signal }, {
    fetchImpl: async () => {
      calls += 1;
      setTimeout(() => controller.abort(new Error('deadline exceeded')), 5);
      return new Response('{}', { status: 503 });
    },
  }), /deadline exceeded/);
  assert.equal(calls, 1);
});

import { BusinessRuleError, calendarInput, missingClientGuidance } from './business.mjs';

test('allows meetings without a CRM link and preserves the participant', () => {
  const input = calendarInput({ title: 'Reunião com João', event_date: '2026-11-19', start_time: '14:00', participant_name: 'João' });
  assert.equal(input.date, '2026-11-19');
  assert.equal(input.time, '14:00');
  assert.match(input.description, /João/);
  assert.match(input.description, /sem vínculo/);
});

test('invalid dates and times require clarification instead of accepting a truncated value', () => {
  for (const patch of [{event_date:'2026-02-29'}, {event_date:'2026-11-19extra'}, {start_time:'25:00'}, {start_time:'14:00extra'}, {title:''}]) {
    assert.throws(() => calendarInput({title:'Reunião',event_date:'2026-11-19',start_time:'14:00',...patch}), BusinessRuleError);
  }
});

test('missing clients explain both choices without claiming a write', () => {
  const message = missingClientGuidance('João');
  assert.match(message, /João/);
  assert.match(message, /cadastrar/);
  assert.match(message, /sem vínculo/);
  assert.match(message, /Nenhum cadastro ou agendamento foi realizado/);
});

import { selectDeclarations, combineClientMeetingCalls, getInstantReply } from './toolSelection.mjs';
import { validTimeZone } from './business.mjs';
test('greetings omit schemas and focused queries use a smaller tool set',()=>{
 const declarations=['get_clients','create_client_and_meeting','get_tasks','get_documents'].map(name=>({name}));
 assert.deepEqual(selectDeclarations(declarations,[{role:'user',parts:[{text:'Olá, quais funcionalidades você possui?'}]}]),[]);
 assert.deepEqual(selectDeclarations(declarations,[{role:'user',parts:[{text:'Quais tarefas estão pendentes?'}]}]).map(t=>t.name),['get_tasks']);
});
test('compatible client and meeting calls become one atomic action',()=>{
 const action=combineClientMeetingCalls([{tool:'create_client',args:{name:'Maria'}},{tool:'create_calendar_event',args:{client_name:'Maria',event_date:'2026-11-19',start_time:'15:00'}}]);
 assert.equal(action.tool,'create_client_and_meeting');assert.equal(action.args.name,'Maria');assert.equal(action.args.start_time,'15:00');
 assert.equal(combineClientMeetingCalls([{tool:'create_client',args:{name:'Maria'}},{tool:'create_calendar_event',args:{client_name:'João'}}]),null);
});
test('validates user time zones with a safe fallback',()=>{
 assert.equal(validTimeZone('America/Sao_Paulo'),'America/Sao_Paulo');assert.equal(validTimeZone('Europe/Lisbon'),'Europe/Lisbon');assert.equal(validTimeZone('invalid'),'America/Sao_Paulo');
});
test('transient attempt timeouts have a bounded retry and do not replay mutations',async()=>{
 let calls=0;
 const response=await fetchWithRetry('https://example.test',{signal:new AbortController().signal},{fetchImpl:async()=>{calls++;if(calls===1)throw new DOMException('timeout','TimeoutError');return new Response('{}',{status:200});},wait:async()=>{}});
 assert.equal(response.status,200);assert.equal(calls,2);
});

test('answers greetings instantly without requesting Gemini', () => {
 const reply = getInstantReply([{role:'user',parts:[{text:'Olá, quais funcionalidades você possui?'}]}]);
 assert.match(reply, /clientes/);
 assert.match(reply, /confirmação/);
 assert.match(getInstantReply([{role:'user',parts:[{text:'Olá, você está funcionando?'}]}]), /Olá!/);
 assert.equal(getInstantReply([{role:'user',parts:[{text:'Quais clientes tenho cadastrados?'}]}]), null);
});
test('slow Gemini attempts receive only one timeout retry',async()=>{
 let calls=0;const delays=[];
 await assert.rejects(fetchWithRetry('https://example.test',{signal:new AbortController().signal},{fetchImpl:async()=>{calls++;throw new DOMException('timeout','TimeoutError');},wait:async delay=>{delays.push(delay);}}),/timeout/);
 assert.equal(calls,2);assert.deepEqual(delays,[400]);
});