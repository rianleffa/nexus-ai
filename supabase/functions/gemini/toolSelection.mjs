// Reduce the schema sent to Gemini; fall back to all tools for ambiguous requests.
const normalizeIntentText = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function isReadOnlyRequest(text) {
 const normalized = normalizeIntentText(text);
 const asksForInformation = /^(?:oi|ola|bom dia|boa tarde|boa noite)?\s*(?:quais?|quem|quando|onde|como|quanto|quantos|quantas|liste|listar|mostre|mostrar|consulte|consultar|verifique|verificar|resuma|resumir|me diga|me mostre|me informe)\b/.test(normalized)
  || /\b(?:tenho|existem|esta[o]?|estao|ha|saldo|progresso)\b/.test(normalized) && /[?]|\b(?:quais?|quanto|quantos|quantas|resumo|saldo)\b/.test(normalized);
 const asksForMutation = /\b(?:cadastre|cadastrar|crie|criar|registre|registrar|lance|lancar|agende|agendar|marque|marcar|altere|alterar|atualize|atualizar|edite|editar|exclua|excluir|apague|apagar|cancele|cancelar|reagende|reagendar|remarque|remarcar|conclua|concluir)\b/.test(normalized);
 return asksForInformation && !asksForMutation;
}

export function extractCalendarClientName(text) {
 const normalized = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
 const match = normalized.match(/\b(?:reunioes?|compromissos?|eventos?)\b[^?!]*?\bcom\s+([^?!,.;]+?)(?:\s+\b(?:amanha|hoje|para\s+(?:amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado|domingo))\b)?\s*[?!.,;]*$/i);
 return match?.[1]?.trim().replace(/\s+/g, ' ') || null;
}

export function getInstantReply(contents) {
 const last = [...contents].reverse().find(c => c.role === 'user');
 const text = (last?.parts || []).map(p => p.text || '').join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
 if (/^(ola|oi|bom dia|boa tarde|boa noite)[!,.? ]*(voce esta funcionando|esta funcionando|quais funcionalidades voce possui|o que voce consegue fazer|como pode me ajudar)?[?.! ]*$/.test(text)) {
  return 'Olá! Posso ajudar com clientes, projetos, tarefas, agenda, financeiro, relatórios e documentos. Executo solicitações comuns diretamente e peço confirmação para ações sensíveis.';
 }
 return null;
}
export function selectDeclarations(declarations, contents) {
 const last = [...contents].reverse().find(c=>c.role==='user');
 const text = (last?.parts || []).map(p=>p.text||'').join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if (/^(ola|oi|bom dia|boa tarde|boa noite)[!,.? ]*(voce esta funcionando|esta funcionando|quais funcionalidades voce possui|o que voce consegue fazer|como pode me ajudar)?[?.! ]*$/.test(text)) return [];
 const asksRead = /\b(quais|liste|listar|mostre|consulte|consultar|qual|quanto|quantos|quantas|quando|onde|quem|resuma|resumo)\b/.test(text) && !/\b(cadastre|cadastrar|agende|agendar|crie|criar|registre|registrar|atualize|atualizar|cancele|cancelar|exclua|excluir|remarque|remarcar)\b/.test(text);
 if (asksRead) {
  const names = /cliente/.test(text) ? ['get_clients','get_client','get_clients_needing_attention'] : /tarefa/.test(text) ? ['get_tasks'] : /compromisso|reuni|agenda|agendad/.test(text) ? ['get_calendar_events'] : /projeto/.test(text) ? ['get_projects'] : /financeir|despesa|receita|saldo|conta a pagar|conta a receber/.test(text) ? ['get_financial_transactions','get_dashboard_summary'] : /documento|arquivo/.test(text) ? ['get_documents'] : /indicador|resumo|empresa|semana/.test(text) ? ['get_my_day','get_dashboard_summary'] : [];
  if (names.length) return declarations.filter(d=>names.includes(d.name));
 }
 if (/cadast/.test(text) && /agend|reuni|marqu/.test(text)) return declarations.filter(d=>d.name==='create_client_and_meeting');
 if (/reagend|remarc/.test(text)) return declarations.filter(d=>d.name==='reschedule_calendar_event');
 if (/cancel/.test(text) && /reuni|compromisso/.test(text)) return declarations.filter(d=>d.name==='cancel_calendar_event');
 if (/agend|marqu|marcar/.test(text) && /reuni|compromisso/.test(text)) return declarations.filter(d=>d.name==='create_calendar_event');
 const names = new Set();
 const groups = [
 [/cliente|cadast|reuni|agend|compromisso|cancel|remarc|exclu|apagu|remov|edite|atualiz/, ['get_client','get_clients','create_client','update_client','delete_client','get_calendar_events','create_calendar_event','create_client_and_meeting','reschedule_calendar_event','cancel_calendar_event']],
 [/despesa|receita|combustivel|fatur|saldo|financeir|pagamento|gastei|lancamento/, ['get_financial_transactions','get_dashboard_summary','create_financial_transaction','update_financial_transaction','delete_financial_transaction']],
 [/tarefa|pendente|prioridade|exclu|apagu|remov|edite|atualiz/, ['get_tasks','create_task','update_task','complete_task','delete_task']],
 [/operac|projeto|exclu|apagu|remov|edite|atualiz/, ['get_projects','create_project','update_project','delete_project']],
 [/documento|arquivo/, ['get_documents','delete_document']],
 [/meu dia|hoje|indicador|resumo/, ['get_my_day','get_dashboard_summary']],
 ];
 for(const [pattern,tools] of groups) if(pattern.test(text)) for(const name of tools) names.add(name);
 return names.size ? declarations.filter(d=>names.has(d.name)) : declarations;
}
export function combineClientMeetingCalls(calls) {
 const writes=calls.filter(c=>!c.tool.startsWith('get_'));
 if(writes.length===1)return writes[0];
 if(writes.length===2){
  const client=writes.find(c=>c.tool==='create_client');
  const event=writes.find(c=>c.tool==='create_calendar_event');
  if(client&&event){
   if(event.args.client_name && String(event.args.client_name).trim().toLowerCase()!==String(client.args.name).trim().toLowerCase())return null;
   return {tool:'create_client_and_meeting',args:{...event.args,...client.args}};
  }
 }
 return null;
}
