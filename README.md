# NEXUS AI

Plataforma web de gestão empresarial para organizar clientes, projetos, tarefas, agenda, finanças e documentos em um único espaço. O assistente de IA pode interpretar solicitações e acionar ferramentas do sistema quando a Supabase Edge Function estiver configurada.

## Funcionalidades

- Dashboard com indicadores calculados a partir dos registros disponíveis.
- CRM com cadastro, edição, situação e visão relacionada do cliente.
- Projetos, tarefas com prioridade e prazo, e compromissos de agenda.
- Lançamentos de receita e despesa, distinguindo valores pagos e pendentes.
- Relatórios com filtros, exportação CSV e impressão pelo navegador.
- Upload, visualização e download de documentos usando Supabase Storage quando conectado.
- Login por e-mail e senha, cadastro e Google OAuth via Supabase Auth.
- Tema claro/escuro com preferência salva no navegador.
- Modo de demonstração local quando o Supabase não está configurado. Os registros de demonstração são fictícios e locais.

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

Em **Authentication → URL Configuration**, configure o Site URL com o domínio de produção real e inclua os retornos locais e de produção na lista de Redirect URLs. O código retorna à origem em que foi aberto (`window.location.origin/`), portanto cada origem precisa estar permitida.

Para o ambiente atual, use o domínio de produção `https://nexus-ai-rian-ce04.vercel.app/` como Site URL e permita estes retornos:

```text
http://localhost:5173/
http://127.0.0.1:5173/
https://nexus-ai-rian-ce04.vercel.app/
```

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

O ambiente local está conectado ao projeto `aztmenorefrgpdnpedjb` (`rianleffa's Project`). Esse banco já possui perfis e empresas vinculados por `user_id`; o login também aceita esse formato, buscando somente a empresa do usuário autenticado. O esquema completo do NEXUS usa `profiles.company_id` e tabelas adicionais. A compatibilidade de login não instala essas tabelas: revise uma migração específica antes de usar os demais módulos nesse banco existente. Preserve os gatilhos e as políticas do projeto durante essa revisão; não execute `schema.sql` nem substitua `handle_new_user` apenas para habilitar o login.

### Assistente Gemini

O segredo `GEMINI_API_KEY` é usado pela Edge Function em `supabase/functions/gemini`. Configure-o como segredo de servidor do Supabase Edge Functions; não use um nome com prefixo `VITE_`. O assistente depende de a função estar implantada e da chave configurada.

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
```

`npm run build` executa `tsc -b` e a compilação de produção do Vite. `npm run lint` executa Oxlint. O `package.json` ainda não define script automatizado de testes.

Para visualizar o build localmente:

```bash
npm run preview
```

## Segurança

As permissões de dados empresariais dependem das políticas RLS e das migrations aplicadas no projeto Supabase remoto. A presença de uma policy ou migration neste repositório não significa que ela já esteja ativa no banco. Audite usuários e empresas existentes antes de ativar a migration de isolamento multiempresa.

Não versione `.env`, credenciais, tokens, chaves privadas ou segredos de serviço. Use secrets do Supabase para valores usados por Edge Functions e as configurações protegidas do provedor para credenciais Google OAuth.
