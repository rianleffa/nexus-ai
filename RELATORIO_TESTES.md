# Relatório de auditoria do NEXUS AI

Data: 25/11/2026

## Escopo verificado

- Repositório `rianleffa/nexus-ai`, branch `main`; HEAD local e `origin/main` estavam sincronizados na auditoria (`4ee0e07`).
- Build, testes automatizados e lint executados no checkout.
- Projeto Supabase ativo e vinculado via CLI: `aztmenorefrgpdnpedjb` (produção). O host configurado no projeto corresponde a esse ref.
- Projeto Vercel existente `rian-ce04/nexus-ai`, sem criação de projeto ou domínio novo.
- Deployment Vercel mais recente consultado: estado `READY`; alias principal `nexus-ai-sigma-sooty.vercel.app`. A página respondeu HTTP 200 e título “NEXUS AI — Gestão Inteligente para Empresas”.

## Resultados locais

- `pnpm test`: 33 testes aprovados, nenhum reprovado.
- `pnpm run lint`: concluído sem erros bloqueantes; há avisos de lint, inclusive avisos preexistentes de imports/hooks/pureza.
- `pnpm run build`: concluído com TypeScript (`tsc -b`) e Vite; 2203 módulos transformados.

## Supabase e causa provável do upload

O código usa o bucket `company-logos`. A migração local `20261125120000_client_statuses_company_profile.sql` cria esse bucket, limita arquivos de imagem a 5 MB e define políticas de acesso por empresa. A mesma migração adiciona `logo_url` e `postal_code` e converte status legado de cliente.

O dry-run de `supabase db push` **não aplicou alterações** e falhou porque o histórico remoto contém três versões sem arquivos SQL correspondentes no repositório (`20261118161316`, `20261118185539`, `20261118194331`). Há também migrações locais não registradas no banco (`20261118161200`, `20261118191200`, `20261118200000`, além da migração acima). Assim, não foi possível confirmar a existência do bucket remoto nem corrigir o erro “Bucket not found” em produção com segurança. Nenhuma migração, política RLS ou configuração de Storage foi alterada remotamente nesta auditoria.

## Supabase Edge Functions

A CLI listou `gemini` como ativa na versão 16 e `nexus-integration-check` como ativa na versão 2. Não foram publicadas novas versões durante esta auditoria.

## Verificações ainda não executadas

- Login Google, tempos de autenticação, restauração de sessão, CRUD real e upload no Storage exigem sessão de usuário real e não foram simulados.
- Não foi realizado teste ponta a ponta autenticado; não foram criados ou modificados registros reais.
- PageSpeed/Lighthouse não foi executado nesta auditoria. Os números de 25/11/2026 mencionados no pedido são referência fornecida pelo solicitante, não uma medição independente deste relatório.
- A responsividade em dispositivos/resoluções, acessibilidade manual, download/exportação e comandos reais do Gemini não foram verificados dispositivo a dispositivo.
- A implantação Vercel foi consultada como `READY`, mas não foi iniciada manualmente nesta auditoria. O HTTP 200 confirma disponibilidade da página pública, não a integridade de fluxos autenticados.

## Próxima ação necessária

Reconciliar os arquivos e versões de migração divergentes com o estado real do banco. Não marcar versões como aplicadas/revertidas sem recuperar e revisar seu conteúdo. Após a reconciliação, executar novo dry-run, revisar o SQL, aplicar a migração, publicar a Edge Function `gemini` se necessário e validar upload e fluxos autenticados antes de declarar a correção concluída.
