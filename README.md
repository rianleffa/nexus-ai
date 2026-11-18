# NEXUS AI

Plataforma web de gestão empresarial para organizar clientes, operações, tarefas, agenda, finanças e documentos em um único espaço. O assistente de IA pode interpretar solicitações e acionar ferramentas do sistema quando a Supabase Edge Function estiver configurada.

## Funcionalidades

- Dashboard com indicadores calculados a partir dos registros disponíveis.
- CRM com cadastro, edição, situação e visão relacionada do cliente.
- Operações, tarefas com prioridade e prazo, e compromissos de agenda.
- Lançamentos de receita e despesa, distinguindo valores pagos e pendentes.
- Relatórios com filtros, exportação CSV e impressão pelo navegador.
- Upload, visualização e download de documentos usando Supabase Storage quando conectado.
- Login por e-mail e senha, cadastro e Google OAuth via Supabase Auth.
- Tema claro/escuro com preferência salva no navegador.
- Modo de demonstração local quando o Supabase não está configurado. A demonstração começa vazia e mantém os registros criados apenas no navegador.

## Tecnologias

- React 19 e TypeScript 6.
- Vite 8, Tailwind CSS 3 e Lucide React.
- Supabase JS para Auth, consultas ao Postgres, Realtime, Storage e chamadas a Edge Functions.
- Supabase Edge Function (Deno) como gateway do Google Gemini.

## Requisitos

- Node.js compatível com Vite 8 (o projeto foi compilado com Node.js 22).
- npm.
- Projeto Supabase para autenticação e persistência remota. Sem essa configuração, é possível usar o modo de demonstração local.

## Instalação e execução local

```bash
npm install
cp .env.example .env
npm run dev
```

No PowerShell, a cópia do arquivo pode ser feita com `Copy-Item .env.example .env`. Configure no `.env` pelo menos a URL base do projeto Supabase e uma chave pública. O endereço local padrão do Vite é `http://localhost:5173/`; também pode ser aberto em `http://127.0.0.1:5173/`.

Para executar a Edge Function Gemini localmente, copie `supabase/functions/.env.example` para `supabase/functions/.env` e configure a chave apenas nesse arquivo. Ele é ignorado pelo Git e não é carregado no frontend Vite.

### Variáveis do frontend

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Se o projeto ainda usa a chave pública legada, `VITE_SUPABASE_ANON_KEY` é aceita como alternativa. `VITE_SUPABASE_URL` deve ser a URL base, sem `/rest/v1`. Chaves `publishable`/`anon` são públicas; nunca coloque chaves `secret` ou `service_role` em variáveis `VITE_`.

### Supabase Auth e Google

O Google OAuth usa o fluxo PKCE do Supabase. Cadastre o Client ID e Client Secret Web em **Supabase Dashboard → Authentication → Providers → Google**; não os coloque no código nem no `.env` do frontend.

Configure `VITE_NEXUS_AUTH_REDIRECT_URL` no ambiente **Production** da Vercel como `https://nexus-ai-sigma-sooty.vercel.app/`. Os fluxos de Google OAuth, confirmação de cadastro e recuperação de senha usam esse destino explícito; em desenvolvimento local, a origem atual continua sendo usada.

Em **Authentication → URL Configuration**, adicione estes destinos à lista de Redirect URLs:

```text
http://localhost:5173/
http://127.0.0.1:5173/
https://nexus-ai-sigma-sooty.vercel.app/
https://nexus-ai-sigma-sooty.vercel.app/?auth=confirmed
https://nexus-ai-sigma-sooty.vercel.app/?auth=recovery
```

O `Site URL` é um fallback global do projeto Supabase. Se ele também for usado por outro sistema, mantenha o valor desse sistema: cada aplicação deve enviar seu próprio `redirectTo`/`emailRedirectTo` explícito e ter os destinos exatos permitidos na lista acima.

Confirmação e recuperação retornam à raiz desses mesmos endereços; os parâmetros `auth=confirmed` e `auth=recovery` selecionam a tela dentro do app.

No Google Cloud Console, cadastre as origens JavaScript locais e de produção. Em Authorized redirect URIs, use o callback exibido na configuração do provedor Google no Supabase, normalmente:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

O primeiro login depende do trigger de criação do perfil/empresa no banco. A migration `010_auth_profile_provisioning.sql` atualiza o trigger para criar uma empresa isolada para cada usuário novo e preencher dados de perfil dos metadados de cadastro ou Google; ela não reatribui contas existentes. Para instalações existentes, revise o estado das migrations e as associações de empresa antes de aplicar alterações em produção. Não aplique `009_tenant_security_hardening.sql` sem auditar os vínculos atuais.

No OAuth Client Web do Google, adicione os três endereços de origem acima sem a barra final como origens JavaScript autorizadas e use o callback do Supabase deste projeto como URI de redirecionamento autorizado:

```text
https://aztmenorefrgpdnpedjb.supabase.co/auth/v1/callback
```

O ambiente local está conectado ao projeto confirmado `aztmenorefrgpdnpedjb` (`rianleffa's Project`). O banco remoto mantém um esquema legado por proprietário (`profiles`, `companies` e `clients` com `user_id`), enquanto o NEXUS trabalha com `company_id` e outras tabelas. A migration `000_legacy_company_compatibility.sql` mapeia cada registro existente para sua única empresa correspondente, adicionando colunas sem remover os campos legados e abortando se encontrar vínculos ambíguos ou ausentes. Depois dela, aplique as migrations `001` a `010` pela sequência normal; não execute `schema.sql` sobre esse banco. O histórico de migrations remoto ainda não foi encontrado, então reconcilie o estado do CLI antes de qualquer `db push`.

### Assistente Gemini

O assistente usa `gemini-3.5-flash-lite` por padrão (configurável pelo segredo `GEMINI_MODEL` no backend), validado com geração real e function calling pela API oficial do Google, exclusivamente na Edge Function `gemini`. Configure `GEMINI_API_KEY` em **Supabase Dashboard → Edge Functions → Secrets**. Nunca use prefixo `VITE_`, não coloque a chave em `.env` do frontend e não a versione. A chave que apareceu na conversa deve ser revogada no Google AI Studio e substituída por uma nova antes de habilitar o serviço.

Para publicar, vincule a CLI ao projeto Supabase confirmado e execute `supabase functions deploy gemini --project-ref <PROJECT_REF>`. O gateway JWT permanece habilitado e o handler também valida cada token com `auth.getUser` antes de consultar ou alterar dados. Usa uma chave Supabase publishable (ou a anon legada) junto ao token do usuário para manter RLS. Leituras e gravações têm filtro explícito por empresa; mutações são registradas em `ai_action_logs` e exigem confirmação assinada com validade de cinco minutos. O perfil colaborador não pode lançar transações financeiras.

O ambiente local pode usar `supabase functions serve gemini --env-file supabase/functions/.env`, com a chave preenchida apenas no arquivo ignorado pelo Git. A lista de origens CORS de produção e desenvolvimento está no início da função; atualize-a se o domínio oficial do NEXUS mudar.

Antes de habilitar a função, confirme que as migrations aditivas criaram as tabelas e políticas RLS de `profiles`, `companies`, `clients`, `projects`, `tasks`, `calendar_events`, `financial_transactions` e `ai_action_logs`. O projeto configurado no checkout é `aztmenorefrgpdnpedjb`; a revisão remota confirmou que o esquema NEXUS ainda não está instalado. A migration de compatibilidade não remove linhas nem desativa RLS.

Em produção, configure `VITE_SUPABASE_URL` e a chave pública `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente Production da Vercel e faça um novo deploy. Configure `GEMINI_API_KEY` como segredo das Edge Functions do Supabase; não armazene a chave Gemini em variáveis `VITE_` da Vercel.

## Banco de dados e dados de demonstração

- `supabase/schema.sql` contém o esquema consolidado para uma instalação nova.
- `supabase/migrations/` contém migrations incrementais para evolução do banco.
- `supabase/seed_demo.sql` contém registros fictícios opcionais para demonstração. Não execute esse seed em produção.

Escolha o procedimento adequado ao estado do seu banco; não execute o schema completo sobre uma instalação existente sem revisar as tabelas e migrations já aplicadas.

## Build, lint e testes

```bash
npm run build
npm run lint
npm test
```

`npm run build` executa `tsc -b` e a compilação de produção do Vite. `npm run lint` executa Oxlint. `npm test` verifica datas, identificação de chave inválida e novas tentativas limitadas para falhas temporárias do Gemini.

Para visualizar o build localmente:

```bash
npm run preview
```

## Segurança

As permissões de dados empresariais dependem das políticas RLS e das migrations aplicadas no projeto Supabase remoto. A presença de uma policy ou migration neste repositório não significa que ela já esteja ativa no banco. Audite usuários e empresas existentes antes de ativar a migration de isolamento multiempresa.

Não versione `.env`, credenciais, tokens, chaves privadas ou segredos de serviço. Use secrets do Supabase para valores usados por Edge Functions e as configurações protegidas do provedor para credenciais Google OAuth.

### Agendamentos e verificação real do Gemini

O vínculo com cliente é opcional na agenda. Se o nome consultado não estiver no CRM, o assistente pede para escolher entre cadastrar a pessoa e agendar sem vínculo. Após a escolha, prepara uma ação com confirmação obrigatória; não cria clientes automaticamente. Reagendamentos e cancelamentos validam o título e vinculam a confirmação ao ID encontrado na empresa.

`node scripts/check-gemini-live.cjs` envia as cinco mensagens de verificação à API real do Google usando o construtor de requisições da Edge Function. Lê a chave apenas de `supabase/functions/.env`, não grava dados e não substitui o teste autenticado na aplicação. `npm test` executa regressões isoladas, sem respostas de IA simuladas.

### Ações compostas e latência

`create_client_and_meeting` prepara uma única confirmação. A RPC `confirm_client_meeting` executa com SECURITY INVOKER e RLS, bloqueia a confirmação durante a transação, reutiliza o cliente e grava a reunião vinculada. Repetir a mesma confirmação devolve o resultado salvo; falhas desfazem as gravações da transação. Não há chamadas Gemini durante a confirmação.

Cada turno usa no máximo uma geração do Gemini, com schemas selecionados por assunto. Consultas formatam os valores reais do banco sem uma segunda geração. Existem no máximo duas tentativas transitórias de 9 segundos, dentro do limite global de 25 segundos. Erros de chave, permissão e cota não são repetidos automaticamente. Logs `nexus-ai-timing` registram somente ID da requisição, modelo, status e duração das etapas, sem mensagens, chaves ou dados pessoais.
