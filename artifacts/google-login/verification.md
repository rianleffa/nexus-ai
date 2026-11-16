# Verificação do login Google — NEXUS AI

Data: 2 de novembro de 2026, America/Sao_Paulo.

Ambiente testado: http://127.0.0.1:5173/.

Projeto escolhido pelo usuário: `aztmenorefrgpdnpedjb` (`rianleffa's Project`).

## Problemas corrigidos

1. O `.env` apontava para um domínio Supabase inexistente. O navegador retornava `DNS_PROBE_FINISHED_NXDOMAIN` antes de chegar ao Google. A URL e a chave pública foram atualizadas para o projeto escolhido.
2. O projeto existente relaciona empresas ao proprietário por `companies.user_id`, enquanto o NEXUS esperava `profiles.company_id`. A leitura de autenticação agora aceita os dois formatos. A busca pelo proprietário usa o ID da sessão autenticada e a consulta continua sujeita às políticas RLS existentes.

O formato do documento da empresa e o nome do perfil existente também são aceitos na leitura da sessão.

## Resultado dos testes

| Etapa | Resultado | Evidência |
| --- | --- | --- |
| App → Supabase | Passou | Projeto correto alcançável e provedor Google habilitado. |
| Supabase → Google | Passou | Seleção de conta Google apresentada no navegador. |
| Google → app local | Passou | Retorno ao app, troca do código OAuth e remoção do código da URL. |
| Sessão → perfil e empresa | Passou | Dashboard exibiu o usuário e sua empresa cadastrada. |
| Sair | Passou | Retorno à tela de login. |
| Entrar novamente | Passou | Novo ciclo OAuth abriu o dashboard. |
| Recarregar | Passou | Sessão restaurada e dashboard autenticado. |
| Build | Passou | `npm run build`, código de saída 0; aviso de tamanho do bundle. |
| Lint | Passou com avisos | `npm run lint`, código de saída 0. |

Captura após restaurar a sessão: [dashboard-authenticated.png](dashboard-authenticated.png).

## Limites do resultado

A correção foi aplicada ao ambiente local. O login foi validado com uma conta Google existente, já conectada no navegador.

O banco escolhido também atende outro aplicativo e tem um esquema diferente do NEXUS. A sincronização dos módulos continua retornando aviso de falha: por exemplo, faltam `public.users`, `profiles.company_id` e as tabelas de projetos, tarefas e finanças. Esses módulos precisam de uma adaptação ou migração específica; o dashboard vazio não comprova ausência de dados no projeto remoto.

As tabelas, os gatilhos e as políticas do banco remoto foram apenas consultados. Uma migração completa do banco e a configuração de produção ficam fora desta correção de login local.

Referências de configuração: [Google OAuth no Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) e [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls).
