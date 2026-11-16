-- Estrutura inicial do VoltsEIT RDO.
-- O script também ajusta a tabela profiles criada pelo SQL anterior, caso ela use "role".

create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text,
  disciplina text check (disciplina is null or disciplina in ('automacao', 'instrumentacao', 'eletrica', 'civil')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if to_regclass('public.profiles') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
    )
    and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'profile'
    ) then
    alter table public.profiles rename column role to profile;
  end if;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  profile text not null default 'encarregado',
  unidade_id uuid references public.unidades(id) on delete set null,
  disciplina text check (disciplina is null or disciplina in ('automacao', 'instrumentacao', 'eletrica', 'civil')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists profile text;
alter table public.profiles add column if not exists unidade_id uuid;
alter table public.profiles add column if not exists disciplina text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

do $$
declare
  constraint_row record;
  profile_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into profile_type
  from pg_attribute a
  where a.attrelid = 'public.profiles'::regclass
    and a.attname = 'profile'
    and not a.attisdropped;

  if profile_type <> 'text' then
    alter table public.profiles alter column profile drop default;
    alter table public.profiles alter column profile type text using profile::text;
  end if;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and position('profile' in lower(pg_get_constraintdef(oid))) > 0
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

update public.profiles
set profile = case lower(coalesce(profile, 'encarregado'))
  when 'admin' then 'admin'
  when 'engenheiro' then 'engenheiro'
  when 'engineer' then 'engenheiro'
  when 'supervisor' then 'supervisor'
  when 'encarregado' then 'encarregado'
  else 'encarregado'
end,
updated_at = coalesce(updated_at, now()),
created_at = coalesce(created_at, now());

alter table public.profiles alter column profile set default 'encarregado';
alter table public.profiles alter column profile set not null;
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_profile_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_check
      check (profile in ('admin', 'engenheiro', 'supervisor', 'encarregado'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
      and exists (
        select 1 from pg_attribute
        where attrelid = 'public.profiles'::regclass
          and attname = 'id'
          and attnum = any(conkey)
      )
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'public.unidades'::regclass
      and contype = 'f'
      and exists (
        select 1 from pg_attribute
        where attrelid = 'public.profiles'::regclass
          and attname = 'unidade_id'
          and attnum = any(conkey)
      )
  ) then
    alter table public.profiles
      add constraint profiles_unidade_id_fkey
      foreign key (unidade_id) references public.unidades(id) on delete set null;
  end if;
end;
$$;

create table if not exists public.rdos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  numero text,
  data date not null,
  hh_planejado numeric(10, 2) not null default 0,
  hh_realizado numeric(10, 2),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  disciplina text check (disciplina is null or disciplina in ('automacao', 'instrumentacao', 'eletrica', 'civil')),
  engenheiro_obs text,
  coordenador_obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.materiais_rdo (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdos(id) on delete cascade,
  material text not null,
  quantidade numeric(12, 3) not null default 0,
  unidade_medida text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.evidencias_rdo (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdos(id) on delete cascade,
  tipo text not null check (tipo in ('foto', 'assinatura')),
  url text not null,
  descricao text,
  created_at timestamptz not null default now()
);

create table if not exists public.auditorias_rdo (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdos(id) on delete cascade,
  auditor_user_id uuid not null references auth.users(id) on delete restrict,
  acao text not null,
  comentario text,
  created_at timestamptz not null default now()
);

create table if not exists public.instrumentos (
  id uuid primary key default gen_random_uuid(),
  tag_name text not null unique,
  descricao text,
  unidade_id uuid references public.unidades(id) on delete set null,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  format text not null check (format in ('csv', 'xlsx', 'pdf')),
  frequency text not null check (frequency in ('diario', 'semanal', 'mensal')),
  hour smallint not null check (hour between 0 and 23),
  minute smallint not null check (minute between 0 and 59),
  day_of_week text,
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 31),
  filters jsonb,
  email_recipients text[] not null default '{}',
  is_active boolean not null default true,
  last_executed_at timestamptz,
  next_execution_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_exports_day_of_week_check
    check (day_of_week is null or day_of_week in ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'))
);

create table if not exists public.export_history (
  id uuid primary key default gen_random_uuid(),
  scheduled_export_id uuid not null references public.scheduled_exports(id) on delete cascade,
  format text not null check (format in ('csv', 'xlsx', 'pdf')),
  file_size bigint,
  status text not null check (status in ('success', 'failed', 'pending')),
  error_message text,
  executed_at timestamptz not null default now(),
  file_url text
);

create table if not exists public.cron_execution_log (
  id bigint generated by default as identity primary key,
  function_name text not null,
  status text,
  response text,
  executed_at timestamptz not null default now(),
  request_body jsonb,
  response_status integer,
  response_content jsonb,
  error_text text
);

create index if not exists rdos_user_id_idx on public.rdos(user_id);
create index if not exists rdos_unidade_data_idx on public.rdos(unidade_id, data desc);
create index if not exists rdos_status_idx on public.rdos(status);
create index if not exists materiais_rdo_rdo_id_idx on public.materiais_rdo(rdo_id);
create index if not exists evidencias_rdo_rdo_id_idx on public.evidencias_rdo(rdo_id);
create index if not exists auditorias_rdo_rdo_id_idx on public.auditorias_rdo(rdo_id, created_at desc);
create index if not exists scheduled_exports_user_id_idx on public.scheduled_exports(user_id);
create index if not exists export_history_schedule_idx on public.export_history(scheduled_export_id, executed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_profile()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.profile from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_profile() = 'admin', false)
$$;

create or replace function public.can_review_rdo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_profile() in ('admin', 'supervisor', 'engenheiro'), false)
$$;

create or replace function public.can_access_rdo(target_rdo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rdos r
    where r.id = target_rdo_id
      and (r.user_id = (select auth.uid()) or public.can_review_rdo())
  )
$$;

revoke all on function public.current_user_profile() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_review_rdo() from public, anon;
revoke all on function public.can_access_rdo(uuid) from public, anon;
grant execute on function public.current_user_profile() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_review_rdo() to authenticated;
grant execute on function public.can_access_rdo(uuid) to authenticated;

create or replace function public.get_cron_jobs()
returns table (jobid bigint, jobname text, schedule text, active boolean, command text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso permitido somente para administradores';
  end if;

  if to_regclass('cron.job') is null then
    return;
  end if;

  return query execute
    'select j.jobid::bigint, j.jobname::text, j.schedule::text, j.active, j.command::text from cron.job j order by j.jobid';
end;
$$;

revoke all on function public.get_cron_jobs() from public, anon;
grant execute on function public.get_cron_jobs() to authenticated;

do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'profiles', 'rdos', 'materiais_rdo', 'evidencias_rdo', 'auditorias_rdo',
    'unidades', 'instrumentos', 'scheduled_exports', 'export_history', 'cron_execution_log'
  ] loop
    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
    end loop;
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.rdos enable row level security;
alter table public.materiais_rdo enable row level security;
alter table public.evidencias_rdo enable row level security;
alter table public.auditorias_rdo enable row level security;
alter table public.unidades enable row level security;
alter table public.instrumentos enable row level security;
alter table public.scheduled_exports enable row level security;
alter table public.export_history enable row level security;
alter table public.cron_execution_log enable row level security;

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy profiles_admin_manage on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy rdos_select_accessible on public.rdos
  for select to authenticated using (public.can_access_rdo(id));
create policy rdos_insert_own on public.rdos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy rdos_update_accessible on public.rdos
  for update to authenticated using (user_id = (select auth.uid()) or public.can_review_rdo())
  with check (user_id = (select auth.uid()) or public.can_review_rdo());
create policy rdos_delete_admin on public.rdos
  for delete to authenticated using (public.is_admin());

create policy materiais_select_accessible on public.materiais_rdo
  for select to authenticated using (public.can_access_rdo(rdo_id));
create policy materiais_insert_accessible on public.materiais_rdo
  for insert to authenticated with check (public.can_access_rdo(rdo_id));
create policy materiais_update_accessible on public.materiais_rdo
  for update to authenticated using (public.can_access_rdo(rdo_id)) with check (public.can_access_rdo(rdo_id));
create policy materiais_delete_accessible on public.materiais_rdo
  for delete to authenticated using (public.can_access_rdo(rdo_id));

create policy evidencias_select_accessible on public.evidencias_rdo
  for select to authenticated using (public.can_access_rdo(rdo_id));
create policy evidencias_insert_accessible on public.evidencias_rdo
  for insert to authenticated with check (public.can_access_rdo(rdo_id));
create policy evidencias_delete_accessible on public.evidencias_rdo
  for delete to authenticated using (public.can_access_rdo(rdo_id));

create policy auditorias_select_accessible on public.auditorias_rdo
  for select to authenticated using (public.can_access_rdo(rdo_id));
create policy auditorias_insert_own on public.auditorias_rdo
  for insert to authenticated with check (
    auditor_user_id = (select auth.uid()) and public.can_access_rdo(rdo_id)
  );

create policy unidades_select_authenticated on public.unidades
  for select to authenticated using (true);
create policy unidades_admin_manage on public.unidades
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy instrumentos_select_authenticated on public.instrumentos
  for select to authenticated using (true);
create policy instrumentos_admin_manage on public.instrumentos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy scheduled_exports_select_own_or_admin on public.scheduled_exports
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy scheduled_exports_insert_own on public.scheduled_exports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy scheduled_exports_update_own_or_admin on public.scheduled_exports
  for update to authenticated using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
create policy scheduled_exports_delete_own_or_admin on public.scheduled_exports
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_admin());

create policy export_history_select_owner_or_admin on public.export_history
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.scheduled_exports s
      where s.id = scheduled_export_id and s.user_id = (select auth.uid())
    )
  );
create policy cron_execution_log_admin_select on public.cron_execution_log
  for select to authenticated using (public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.rdos, public.materiais_rdo, public.evidencias_rdo,
  public.auditorias_rdo, public.unidades, public.instrumentos,
  public.scheduled_exports, public.export_history, public.cron_execution_log
to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists rdos_set_updated_at on public.rdos;
create trigger rdos_set_updated_at before update on public.rdos
  for each row execute function public.set_updated_at();
drop trigger if exists materiais_rdo_set_updated_at on public.materiais_rdo;
create trigger materiais_rdo_set_updated_at before update on public.materiais_rdo
  for each row execute function public.set_updated_at();
drop trigger if exists unidades_set_updated_at on public.unidades;
create trigger unidades_set_updated_at before update on public.unidades
  for each row execute function public.set_updated_at();
drop trigger if exists instrumentos_set_updated_at on public.instrumentos;
create trigger instrumentos_set_updated_at before update on public.instrumentos
  for each row execute function public.set_updated_at();
drop trigger if exists scheduled_exports_set_updated_at on public.scheduled_exports;
create trigger scheduled_exports_set_updated_at before update on public.scheduled_exports
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists evidencias_download_rdo_access on storage.objects;
create policy evidencias_download_rdo_access on storage.objects
  for select to authenticated using (
    bucket_id = 'evidencias'
    and public.can_access_rdo((storage.foldername(name))[1]::uuid)
  );

drop policy if exists evidencias_upload_rdo_access on storage.objects;
create policy evidencias_upload_rdo_access on storage.objects
  for insert to authenticated with check (
    bucket_id = 'evidencias'
    and public.can_access_rdo((storage.foldername(name))[1]::uuid)
  );
drop policy if exists evidencias_delete_rdo_access on storage.objects;
create policy evidencias_delete_rdo_access on storage.objects
  for delete to authenticated using (
    bucket_id = 'evidencias'
    and public.can_access_rdo((storage.foldername(name))[1]::uuid)
  );

comment on table public.profiles is 'Perfil e permissões de cada usuário autenticado.';
comment on table public.rdos is 'Relatórios diários de obra.';
comment on table public.evidencias_rdo is 'Fotos e assinaturas associadas aos RDOs.';
