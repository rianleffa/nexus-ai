# Auditoria do Assistente IA — NEXUS AI

Data da auditoria: 25/11/2026
Ambiente de código: branch `main`, projeto `rianleffa/nexus-ai`.

## Correções implementadas

- Após uma resposta marcada pelo backend como execução bem-sucedida, o chat agora busca novamente os dados do tenant no Supabase e atualiza o `dataStore`, cobrindo também ações automáticas que não passam por confirmação.
- A inscrição Realtime agora é específica ao `company_id` autenticado e às tabelas dos módulos (clientes, projetos, tarefas, agenda, financeiro, documentos, notificações e usuários), em vez de escutar todas as alterações públicas.
- Eventos próximos são agrupados por debounce de 150 ms, evitando recargas completas repetidas após ações com múltiplas gravações. A sincronização continua respeitando RLS; a inscrição não substitui as políticas do banco.
- O fluxo já recarregava dados após ações confirmadas; a nova atualização cobre também ações automáticas.

## Validação local

- `pnpm test`: 33 testes do backend/validação aprovados; não cobrem chamadas reais ao Gemini, autenticação ou banco de produção.
- `pnpm run lint`: executado sem erros bloqueantes. Permanecem avisos de lint no projeto.
- `pnpm run build`: TypeScript e Vite concluídos; 2.203 módulos transformados.
- `git diff --check`: sem erros de whitespace.

## Matriz de comandos reais solicitados

Os comandos abaixo foram **não testados em produção**. Não foi usada conta real no chat e nenhum registro foi criado, modificado ou excluído para este relatório. Assim, não há confirmação de leitura pós-gravação no PostgreSQL, atualização visual medida nem latência real.

| Comando/fluxo | Resultado esperado | Resultado observado nesta auditoria | Supabase/UI/tempo | Status |
|---|---|---|---|---|
| Cadastrar, consultar, editar, mudar status, buscar e excluir cliente | Ferramenta apropriada; persistência e atualização da lista | Não executado em chat autenticado | Sem confirmação de banco/interface; tempo não medido | Não testado |
| Criar, vincular, editar prazo/orçamento/status, consultar e excluir projeto | Projeto persistido e refletido no módulo | Não executado em chat autenticado | Sem confirmação de banco/interface; tempo não medido | Não testado |
| Criar/editar/concluir/consultar/excluir tarefa | Tarefa persistida e refletida no módulo | Não executado em chat autenticado | Sem confirmação de banco/interface; tempo não medido | Não testado |
| Agendar, consultar, reagendar e cancelar compromisso | Data/fuso corretos, vínculo e estado persistidos | Não executado em chat autenticado | Sem confirmação de banco/interface; tempo não medido | Não testado |
| Registrar/consultar/editar/excluir receitas e despesas | Valores e período corretos, com confirmação para ações sensíveis | Não executado em chat autenticado | Sem confirmação de banco/interface; tempo não medido | Não testado |
| Localizar documentos e consultar indicadores | Resultados reais restritos à empresa | Não executado em chat autenticado | Sem confirmação de banco/interface; tempo não medido | Não testado |
| Cliente + reunião + projeto + tarefa em um único comando | Ações ordenadas, vínculos e falhas parciais tratados | Código combina atomicamente cliente + reunião; backend não aceita em geral conjuntos de gravações diferentes e pede uma solicitação por vez | Transação multi-módulo não implementada nem verificada | Não testado |

## Cobertura do backend observada por inspeção

O Function Calling declara ferramentas de leitura e CRUD para clientes, projetos, tarefas, agenda e financeiro, além de localizar e excluir documentos e consultar indicadores. As gravações passam por validação e filtragem por empresa; exclusões, cancelamentos e escritas financeiras exigem confirmação. Há proteção contra duplicidade por empresa/usuário/argumentos e a resposta de sucesso é produzida a partir do resultado da ferramenta executada.

O fluxo composto `create_client_and_meeting` é a única combinação multi-ação transacional identificada. Combinações de projeto/tarefa/financeiro com outras gravações não são atualmente suportadas como transação única. Documentos têm busca e exclusão, sem ferramenta de upload do chat.

## Produção e limitações

- A CLI identificou o projeto Supabase ativo `aztmenorefrgpdnpedjb`; a Edge Function `gemini` está ativa na versão 16. A nova versão da função não foi publicada nesta auditoria.
- A tentativa anterior de dry-run das migrações falhou devido a versões remotas sem arquivos SQL locais e versões locais sem registro remoto. A divergência continua sem reconciliação; não houve alterações no banco, Storage ou políticas RLS.
- O frontend público da Vercel retornou HTTP 200 em verificação anterior. Isso não verifica login, chat IA, persistência ou dados privados.
- A migração de `company-logos` não foi aplicada; upload real continua sem confirmação.
- Não foram executados comandos reais pelo Assistente IA, Playwright/E2E, dispositivos Android/iOS ou Lighthouse. Nenhum resultado foi inferido a partir apenas de mensagens da IA.

## Próxima etapa para fechar a auditoria real

Reconciliar primeiro o histórico de migrações local/remoto e validar o schema de produção. Em seguida, publicar a Edge Function correspondente, autenticar um usuário de teste autorizado e executar a matriz com registros prefixados de teste, confirmando cada resultado diretamente no banco e nos módulos da interface antes de excluir apenas esses registros de teste.

## Atualização: prevenção de consulta incorreta

Foi corrigida uma colisão de intenção em `toolSelection.mjs`: perguntas que contêm “reuniões agendadas” eram classificadas antes como pedido de agendamento por causa do trecho “agendadas”. A classificação de perguntas agora ocorre primeiro e oferece apenas ferramentas de leitura. O endpoint também valida que toda ferramenta chamada está entre as permitidas para a mensagem atual, rejeita chamadas de escrita quando a mensagem é uma consulta e associa o cliente mencionado após “reunião com ...” ao filtro de `client_id` da consulta.

O teste regressivo reproduz “Quais reuniões tenho agendadas com Ricardo Almeida?” e confirma intenção somente de leitura, seleção de `get_calendar_events` e extração do cliente Ricardo Almeida. Resultado local: **34 testes aprovados, 0 reprovados**; lint sem erros bloqueantes (avisos existentes); build TypeScript/Vite aprovado. Esse teste não consulta o Gemini nem o banco de produção.
