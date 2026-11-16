# Supabase

Este documento descreve a configuração do banco, autenticação, convites e ambiente local do Relat Pro RDO.

## Projeto remoto e migrations

Configure `.env.local` com o **Project URL** e a chave pública `anon` ou `publishable` do projeto. No terminal, na raiz do repositório, vincule o CLI e revise as migrations antes de aplicá-las:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Em bancos que já tenham `public.rdos`, verifique se existem relatórios ativos duplicados por unidade, data e disciplina antes de aplicar as migrations:

```sql
select unidade_id, data, disciplina, count(*) as quantidade
from public.rdos
where deleted_at is null
group by unidade_id, data, disciplina
having count(*) > 1;
```

Resolva eventuais duplicidades manualmente antes do `db push`. As migrations não removem os registros duplicados automaticamente.

Se o app mostrar `PGRST202` para `salvar_rdo_completo`, a API do projeto conectado não encontrou a função no schema cache. Confirme que o CLI está vinculado ao projeto correto e confira o `db push --dry-run`; depois de aplicar as migrations pendentes, tente sincronizar novamente. Se a migration `20261109183000_atomic_rdo_saves.sql` já estiver aplicada, atualize o cache do PostgREST no SQL Editor:

```sql
notify pgrst, 'reload schema';
```

O RDO pendente permanece salvo no dispositivo enquanto o banco é corrigido. Não remova os dados locais nem troque o projeto Supabase sem confirmar o destino da sincronização.

## Primeiro administrador e unidades

Habilite o provedor de e-mail em **Authentication** e crie a conta inicial em **Authentication → Users**. Copie o UUID da conta e insira o perfil administrador:

```sql
insert into public.profiles (id, profile)
values ('UUID-DA-CONTA', 'admin')
on conflict (id) do update
set profile = 'admin', updated_at = now();
```

O UUID de `public.profiles.id` deve ser o mesmo de `auth.users.id`. Depois, entre no app e cadastre as unidades da obra em **Administração → Unidades da obra**. O repositório não semeia unidades, pois elas variam por projeto.

## Convites e Auth

Publique a função de convites:

```bash
npx supabase functions deploy invite-employee
```

As funções chamadas pelo navegador têm `verify_jwt = false` na configuração do gateway para que o preflight `OPTIONS` não seja barrado sem token. Isso não libera as operações: `withSupabase({ auth: 'user' })` continua validando o JWT antes de executar os handlers. Preserve essa validação ao implantar ou alterar essas funções.

Desative a criação pública de contas no projeto remoto. Em **Authentication → URL Configuration**, defina o **Site URL** com a origem principal do app e adicione o endereço completo `/aceitar-convite` às **Redirect URLs**. Para desenvolvimento local, `supabase/config.toml` já permite `http://localhost:3000/aceitar-convite` e `http://127.0.0.1:3000/aceitar-convite`.

Administradores convidam funcionários pela tela **Gestão de usuários**, informando e-mail e perfil. A pessoa define nome e senha pelo link recebido. Para produção, configure um provedor SMTP próprio em **Authentication → SMTP Settings** e confira **Authentication → Email Templates**. O envio padrão do Supabase tem limite reduzido.

O prazo do link é configurado em **Authentication → Sign In / Providers → Email → Email OTP Expiration** (o padrão do Supabase é uma hora). A tela da aplicação ainda não oferece reenvio de convite; se expirar, o administrador precisa reenviar pelo fluxo disponível em **Authentication → Users**. A aplicação impede convites duplicados enquanto houver um convite pendente para o mesmo e-mail. Veja a [documentação oficial de usuários e convites](https://supabase.com/docs/guides/auth/users).

### Recomendações de segurança

- Configure um tamanho mínimo de senha maior que o padrão inicial; 12 caracteres é uma referência adequada para este projeto.
- Habilite proteção contra senhas vazadas, se disponível no plano contratado ([Password Security](https://supabase.com/docs/guides/auth/password-security)).
- Planeje MFA para contas `admin`. O app ainda precisa implementar as telas e validações de cadastro e desafio MFA antes de tornar esse requisito efetivo ([MFA](https://supabase.com/docs/guides/auth/auth-mfa)).
- Não publique `.env` ou `.env.local`; mantenha no repositório apenas `.env.example`.
- Nunca exponha credenciais `service_role` ou `secret` no navegador.

## Evidências

Fotos e assinaturas ficam no bucket privado `evidencias`. As migrations aceitam JPEG, PNG e WebP, limitam cada arquivo a 10 MiB e definem políticas de acesso vinculadas às permissões do RDO. Os links temporários de visualização expiram em 10 minutos. **Não torne o bucket público.**

## Desenvolvimento local

Docker Desktop e Supabase CLI iniciam uma instância local, aplicam as migrations e carregam `supabase/seed.sql` na primeira inicialização e em `supabase db reset`:

```bash
npx supabase start
npx supabase status
```

O seed não cria unidades de exemplo. Use a URL local da API e somente a chave pública exibida por `supabase status` em `.env.local`; não copie `service_role` ou `secret` para o frontend. Os e-mails de autenticação são capturados pela caixa local de testes em vez de serem enviados. O comando `supabase status` informa as URLs do Studio e da caixa de e-mail.

Consulte os guias oficiais de [desenvolvimento com o CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) e [seed do banco](https://supabase.com/docs/guides/local-development/seeding-your-database).

## Testes do banco

O arquivo `supabase/tests/database/security_and_integrity_test.sql` usa pgTAP para testar políticas RLS, permissões por perfil, alterações de RDO, auditoria, duplicidade e regras do bucket de evidências.

Com Docker Desktop em execução:

```bash
npx supabase start
npx supabase test db --local
```

Os testes executam no banco local, usam transação e descartam os dados de teste ao terminar; não alteram o projeto remoto.

## CI, Dependabot e publicação

O workflow em `.github/workflows/ci.yml` roda `npm audit --audit-level=high`, lint, build e pgTAP no GitHub Actions em pull requests e em pushes para `main` e `master`. Alertas altos ou críticos interrompem a validação. `.github/dependabot.yml` verifica semanalmente atualizações de dependências npm e GitHub Actions.

Para publicar o frontend, execute `npm run build` e hospede `dist/`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no serviço de hospedagem, habilite o fallback de rotas para `index.html` e inclua a URL de produção `/aceitar-convite` nos redirecionamentos permitidos do Supabase.

## Exportações agendadas

O app permite cadastrar frequência, formato e destinatários e consultar histórico e monitoramento. Este repositório ainda não inclui o processo de execução dos agendamentos nem o envio de e-mails; até a configuração de um backend, os agendamentos ficam salvos, mas não são executados automaticamente.

Para automatizá-los, configure um processo backend que leia os agendamentos, gere arquivos, registre resultados e envie e-mails. Pode ser acionado por `pg_cron` e implementado, por exemplo, em uma Supabase Edge Function.
