-- Auditoria somente de leitura para executar no SQL Editor do Supabase.
-- Rode depois do db push e confira cada conjunto de resultados.

-- Histórico de migrations registrado no banco remoto.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- Tabelas e estado de RLS.
select
  c.relname as tabela,
  c.relrowsecurity as rls_ativado,
  c.relforcerowsecurity as rls_forcado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles', 'unidades', 'rdos', 'materiais_rdo', 'evidencias_rdo',
    'auditorias_rdo', 'instrumentos', 'scheduled_exports',
    'export_history', 'cron_execution_log'
  )
order by c.relname;

-- Políticas RLS instaladas.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'unidades', 'rdos', 'materiais_rdo', 'evidencias_rdo',
    'auditorias_rdo', 'instrumentos', 'scheduled_exports',
    'export_history', 'cron_execution_log'
  )
order by tablename, policyname;

-- Colunas, tipos, valores padrão e nulabilidade.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles', 'unidades', 'rdos', 'materiais_rdo', 'evidencias_rdo',
    'auditorias_rdo', 'instrumentos', 'scheduled_exports',
    'export_history', 'cron_execution_log'
  )
order by table_name, ordinal_position;

-- Permissões de tabela concedidas a cada papel.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'profiles', 'unidades', 'rdos', 'materiais_rdo', 'evidencias_rdo',
    'auditorias_rdo', 'instrumentos', 'scheduled_exports',
    'export_history', 'cron_execution_log'
  )
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- Chaves estrangeiras e regras de exclusão.
select
  conrelid::regclass as tabela,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
order by conrelid::regclass::text, conname;

-- Índices existentes nas tabelas do aplicativo.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles', 'unidades', 'rdos', 'materiais_rdo', 'evidencias_rdo',
    'auditorias_rdo', 'instrumentos', 'scheduled_exports',
    'export_history', 'cron_execution_log'
  )
order by tablename, indexname;

-- Funções expostas e funções internas, incluindo modo de execução e configuração.
select
  n.nspname as esquema,
  p.proname as funcao,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  p.prosecdef as security_definer,
  p.proconfig as configuracao
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname in (
    'current_user_profile', 'is_admin', 'can_review_rdo', 'can_view_rdo',
    'can_edit_rdo', 'transition_rdo_status', 'get_cron_jobs'
  )
order by n.nspname, p.proname;

-- Constraints de negócio.
select
  conrelid::regclass as tabela,
  conname as constraint_name,
  convalidated as validada,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where connamespace = 'public'::regnamespace
  and contype in ('c', 'u', 'p')
  and conrelid::regclass::text in (
    'public.profiles', 'public.unidades', 'public.rdos',
    'public.materiais_rdo', 'public.evidencias_rdo',
    'public.auditorias_rdo', 'public.instrumentos',
    'public.scheduled_exports', 'public.export_history',
    'public.cron_execution_log'
  )
order by conrelid::regclass::text, conname;

-- Bucket privado e políticas de acesso a evidências.
select id, name, public
from storage.buckets
where id = 'evidencias';

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- Contas sem perfil associado e dados que precisam ser corrigidos antes de validar checks.
select count(*) as usuarios_sem_perfil
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select id, hh_planejado, hh_realizado
from public.rdos
where hh_planejado <= 0 or hh_realizado < 0;

select id, quantidade
from public.materiais_rdo
where quantidade <= 0;

select id, codigo from public.unidades where length(btrim(codigo)) = 0;
select id, material from public.materiais_rdo where length(btrim(material)) = 0;
select id, name, email_recipients
from public.scheduled_exports
where length(btrim(name)) = 0 or cardinality(email_recipients) = 0;
select id, file_size from public.export_history where file_size < 0;

select 'profiles' as tabela, id, disciplina
from public.profiles
where disciplina is not null
  and disciplina not in ('automacao', 'instrumentacao', 'eletrica', 'civil')
union all
select 'unidades', id, disciplina
from public.unidades
where disciplina is not null
  and disciplina not in ('automacao', 'instrumentacao', 'eletrica', 'civil')
union all
select 'rdos', id, disciplina
from public.rdos
where disciplina is not null
  and disciplina not in ('automacao', 'instrumentacao', 'eletrica', 'civil');

select id, frequency, day_of_week, day_of_month
from public.scheduled_exports
where not (
  (frequency = 'diario' and day_of_week is null and day_of_month is null)
  or (frequency = 'semanal' and day_of_week is not null and day_of_month is null)
  or (frequency = 'mensal' and day_of_week is null and day_of_month is not null)
);

select id, scheduled_export_id, user_id
from public.export_history
where user_id is null;
