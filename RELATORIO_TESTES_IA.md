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

O Function Calling declara ferramentas de leitura e CRUD para clientes, projetos, tarefas, agenda e financeiro, além de localizar e excluir documentos e consultar indicadores. As gravações passam por validação e filtragem por empresa. Criações e edições comuns são automáticas; exclusões, cancelamentos e escritas financeiras exigem confirmação. `create_client_and_meeting` também é automático no código atual, apesar de descrições anteriores da documentação. Há proteção contra duplicidade por empresa/usuário/argumentos e a resposta de sucesso é produzida a partir do resultado da ferramenta executada.

O fluxo composto `create_client_and_meeting` é a única combinação multi-ação transacional identificada. Combinações de projeto/tarefa/financeiro com outras gravações não são atualmente suportadas como transação única. Documentos têm busca e exclusão, sem ferramenta de upload do chat.

## Produção e limitações

- Na auditoria anterior, a CLI identificou o projeto Supabase ativo `aztmenorefrgpdnpedjb` e a Edge Function `gemini` versão 16.
- A tentativa anterior de dry-run das migrações falhou devido a versões remotas sem arquivos SQL locais e versões locais sem registro remoto. A divergência continua sem reconciliação; não houve alterações no banco, Storage ou políticas RLS.
- O frontend público da Vercel retornou HTTP 200 em verificação anterior. Isso não verifica login, chat IA, persistência ou dados privados.
- A migração de `company-logos` não foi aplicada; upload real continua sem confirmação.
- Não foram executados comandos reais pelo Assistente IA, Playwright/E2E, dispositivos Android/iOS ou Lighthouse. Nenhum resultado foi inferido a partir apenas de mensagens da IA.

## Próxima etapa para fechar a auditoria real

Reconciliar primeiro o histórico de migrações local/remoto e validar o schema de produção. Em seguida, publicar a Edge Function correspondente, autenticar um usuário de teste autorizado e executar a matriz com registros prefixados de teste, confirmando cada resultado diretamente no banco e nos módulos da interface antes de excluir apenas esses registros de teste.

## Atualização: prevenção de consulta incorreta

Foi corrigida uma colisão de intenção em `toolSelection.mjs`: perguntas que contêm “reuniões agendadas” eram classificadas antes como pedido de agendamento por causa do trecho “agendadas”. A classificação de perguntas agora ocorre primeiro e oferece apenas ferramentas de leitura. O endpoint também valida que toda ferramenta chamada está entre as permitidas para a mensagem atual, rejeita chamadas de escrita quando a mensagem é uma consulta e associa o cliente mencionado após “reunião com ...” ao filtro de `client_id` da consulta.

O teste regressivo reproduz “Quais reuniões tenho agendadas com Ricardo Almeida?” e confirma intenção somente de leitura, seleção de `get_calendar_events` e extração do cliente Ricardo Almeida. Resultado local: **34 testes aprovados, 0 reprovados**; lint sem erros bloqueantes (avisos existentes); build TypeScript/Vite aprovado. Esse teste não consulta o Gemini nem o banco de produção.

## Atualização da auditoria — 25 de novembro de 2026

### Chamadas reais de interpretação ao Gemini

Foi executado `node scripts/check-gemini-live.cjs`, que envia prompts ao Gemini real e verifica a função selecionada; o script não chama o Supabase e não executa as ações. A saudação foi respondida pelo atalho local em 1 ms e não entra nas métricas do modelo. Das seis chamadas reais, uma consulta ampla recebeu `status=ativo`, restringindo indevidamente “Quais clientes tenho cadastrados?” aos clientes ativos. A taxa semântica desta amostra foi **5/6 (83,3%)**. O resultado de **6/6** do verificador refere-se apenas às suas verificações programáticas mais permissivas, que para essa pergunta conferem o nome da ferramenta e não a ausência do filtro.

| Prompt | Ferramenta/resultado produzido pelo Gemini | Tempo (ms) | Avaliação de interpretação |
|---|---|---:|---|
| Quais clientes tenho cadastrados? | `get_clients(status=ativo)` | 3757 | Falha: deveria omitir status para consultar todos |
| Cadastre um cliente chamado Mariana. | `create_client(name=Mariana)` | 4449 | Passou na seleção; não gravado |
| Agende uma reunião com Mariana amanhã às 08h. | `create_calendar_event`, 26/11/2026 às 08:00, cliente Mariana | 4457 | Passou na seleção; não consultou CRM |
| Cadastre João e agende uma reunião amanhã às 10h. | `create_client_and_meeting`, 26/11/2026 às 10:00 | 890 | Passou na seleção; não gravado |
| Quais tarefas tenho pendentes? | `get_tasks(pending_only=true)` | 3403 | Passou na seleção |
| Registre uma despesa de R$ 100. | Pediu a descrição obrigatória; não chamou ferramenta | 4707 | Passou: solicitou o dado ausente |

Métricas somente das seis chamadas Gemini: média **3610,5 ms**, mediana **4103 ms**, mínimo **890 ms**, máximo **4707 ms** e P95 **4707 ms** pelo método nearest-rank. É uma amostra exploratória de interpretação, não a latência ponta a ponta do Assistente autenticado nem uma estimativa geral de acurácia. Nenhuma ação persistiu no banco.

### Ambiente, esquema remoto e segurança

- A listagem autenticada identificou apenas um projeto Supabase ativo, o projeto vinculado à produção. Os demais projetos visíveis estavam inativos; nenhum foi usado como ambiente de teste.
- A Edge Function `gemini` está **ACTIVE**, versão **17**, com `verify_jwt=true`.
- O histórico remoto confirma `000`–`010`, `20261118175210` e `20261125120000`; há versões remotas sem SQL no checkout (`20261118161316`, `20261118185539`, `20261118194331`) e SQL local sem versão remota (`20261118161200`, `20261118191200`, `20261118200000`). Nenhuma migration foi aplicada nesta auditoria.
- O DER de produção não pôde ser extraído: o catálogo PostgREST respondeu HTTP 401 à chave pública local configurada, e `supabase db dump --remote` falhou porque Docker/Podman não está instalado. O `supabase/schema.sql` local diverge de `007_finance.sql`: omite `financial_transactions.project_id`. Portanto, não trate o esquema local como DER confirmado do banco de produção.
- Não foram executados testes dinâmicos de isolamento entre empresas nem de perfis. Na fonte local, o endpoint IA bloqueia mutações financeiras a perfis diferentes de `admin`/`gerente`; em contraste, a policy financeira local restringe por `company_id`, e a página financeira grava diretamente via Supabase sem uma checagem de perfil identificada. Isso é um risco de autorização a validar em sandbox e não um resultado confirmado contra a policy remota.
- Não foram executados os 40 comandos ponta a ponta solicitados, nem feita leitura de linhas após gravação. Produção permaneceu sem escrita.

### Verificações locais repetidas

- `pnpm test`: **42 aprovados, 0 reprovados**. São regressões locais; não são 42 chamadas ao Gemini/Supabase.
- `pnpm lint`: exit code 0, **0 erros e 83 avisos**.
- `pnpm build`: sucesso; `tsc -b` e Vite concluíram. O Vite transformou 2405 módulos e finalizou em 21,77 s.
- Git: branch `main` sincronizada com `origin/main`; nenhuma alteração de código ocorreu nesta auditoria. Os arquivos de documentação foram atualizados para refletir a divergência entre código e instruções.
