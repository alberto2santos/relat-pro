-- Endurece permissões, integridade e auditoria sem reescrever a migration inicial.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to supabase_auth_admin;

create or replace function private.current_user_profile()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.profile
  from public.profiles p
  where p.id = (select auth.uid())
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_profile() = 'admin', false)
$$;

create or replace function private.can_review_rdo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_profile() in ('admin', 'supervisor', 'engenheiro'), false)
$$;

create or replace function private.can_view_rdo(target_rdo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rdos r
    where r.id = target_rdo_id
      and r.deleted_at is null
      and (r.user_id = (select auth.uid()) or private.can_review_rdo())
  )
$$;

create or replace function private.can_edit_rdo(target_rdo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rdos r
    where r.id = target_rdo_id
      and r.deleted_at is null
      and r.status in ('draft', 'rejected')
      and (r.user_id = (select auth.uid()) or private.can_review_rdo())
  )
$$;

revoke all on function private.current_user_profile() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.can_review_rdo() from public, anon, authenticated;
revoke all on function private.can_view_rdo(uuid) from public, anon, authenticated;
revoke all on function private.can_edit_rdo(uuid) from public, anon, authenticated;
grant execute on function private.current_user_profile() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_review_rdo() to authenticated;
grant execute on function private.can_view_rdo(uuid) to authenticated;
grant execute on function private.can_edit_rdo(uuid) to authenticated;

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, profile)
  values (new.id, 'encarregado')
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
grant execute on function private.create_profile_for_auth_user() to supabase_auth_admin;

drop trigger if exists create_profile_after_auth_signup on auth.users;
create trigger create_profile_after_auth_signup
  after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

-- Cria perfil básico apenas para contas que ainda não têm um; preserva cargos existentes.
insert into public.profiles (id, profile)
select u.id, 'encarregado'
from auth.users u
on conflict (id) do nothing;

do $$
declare
  table_name text;
  constraint_name text;
begin
  foreach table_name in array array['profiles', 'unidades', 'rdos'] loop
    for constraint_name in
      select conname
      from pg_constraint
      where conrelid = format('public.%I', table_name)::regclass
        and contype = 'c'
        and position('disciplina' in lower(pg_get_constraintdef(oid))) > 0
    loop
      execute format('alter table public.%I drop constraint %I', table_name, constraint_name);
    end loop;
  end loop;
end;
$$;

-- Converte rótulos antigos gravados pelas telas para os códigos aceitos pelo aplicativo.
update public.profiles
set disciplina = case lower(btrim(disciplina))
  when 'automação' then 'automacao'
  when 'automacao' then 'automacao'
  when 'instrumentação' then 'instrumentacao'
  when 'instrumentacao' then 'instrumentacao'
  when 'elétrica' then 'eletrica'
  when 'eletrica' then 'eletrica'
  when 'construção e montagem' then 'civil'
  when 'civil' then 'civil'
  else disciplina
end
where disciplina is not null;

update public.unidades
set disciplina = case lower(btrim(disciplina))
  when 'automação' then 'automacao'
  when 'automacao' then 'automacao'
  when 'instrumentação' then 'instrumentacao'
  when 'instrumentacao' then 'instrumentacao'
  when 'elétrica' then 'eletrica'
  when 'eletrica' then 'eletrica'
  when 'construção e montagem' then 'civil'
  when 'civil' then 'civil'
  else disciplina
end
where disciplina is not null;

update public.rdos
set disciplina = case lower(btrim(disciplina))
  when 'automação' then 'automacao'
  when 'automacao' then 'automacao'
  when 'instrumentação' then 'instrumentacao'
  when 'instrumentacao' then 'instrumentacao'
  when 'elétrica' then 'eletrica'
  when 'eletrica' then 'eletrica'
  when 'construção e montagem' then 'civil'
  when 'civil' then 'civil'
  else disciplina
end
where disciplina is not null;

-- Mantém os registros de execução e seu proprietário mesmo se o agendamento for removido.
alter table public.export_history
  add column if not exists user_id uuid references auth.users(id) on delete set null;

update public.export_history h
set user_id = s.user_id
from public.scheduled_exports s
where h.scheduled_export_id = s.id and h.user_id is null;

alter table public.export_history
  alter column scheduled_export_id drop not null;

alter table public.export_history
  drop constraint if exists export_history_scheduled_export_id_fkey;
alter table public.export_history
  add constraint export_history_scheduled_export_id_fkey
  foreign key (scheduled_export_id)
  references public.scheduled_exports(id)
  on delete set null;

create or replace function private.write_rdo_creation_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
  values (new.id, new.user_id, 'draft', 'RDO criado');

  return new;
end;
$$;

revoke all on function private.write_rdo_creation_audit() from public, anon, authenticated;
grant execute on function private.write_rdo_creation_audit() to authenticated;

drop trigger if exists rdos_creation_audit on public.rdos;
create trigger rdos_creation_audit
  after insert on public.rdos
  for each row execute function private.write_rdo_creation_audit();

create or replace function private.transition_rdo_status_impl(
  p_rdo_id uuid,
  p_status text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  owner_id uuid;
  current_status text;
  clean_comment text := nullif(btrim(p_comment), '');
begin
  if actor_id is null then
    raise exception 'É necessário estar autenticado para alterar o status.' using errcode = '42501';
  end if;

  if p_status not in ('submitted', 'approved', 'rejected') then
    raise exception 'Status solicitado inválido.' using errcode = '22023';
  end if;

  if clean_comment is not null and length(clean_comment) > 2000 then
    raise exception 'O comentário pode ter no máximo 2000 caracteres.' using errcode = '22023';
  end if;

  select r.user_id, r.status
  into owner_id, current_status
  from public.rdos r
  where r.id = p_rdo_id
    and r.deleted_at is null
  for update;

  if not found then
    raise exception 'RDO não encontrado.' using errcode = 'P0002';
  end if;

  if p_status = 'submitted' then
    if current_status not in ('draft', 'rejected')
      or (owner_id <> actor_id and not private.can_review_rdo()) then
      raise exception 'Este RDO não pode ser enviado por este usuário.' using errcode = '42501';
    end if;
  elsif current_status <> 'submitted' or not private.can_review_rdo() then
    raise exception 'Somente um revisor pode aprovar ou rejeitar um RDO enviado.' using errcode = '42501';
  end if;

  update public.rdos
  set status = p_status,
      updated_at = now()
  where id = p_rdo_id;

  insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
  values (p_rdo_id, actor_id, p_status, clean_comment);
end;
$$;

revoke all on function private.transition_rdo_status_impl(uuid, text, text) from public, anon, authenticated;
grant execute on function private.transition_rdo_status_impl(uuid, text, text) to authenticated;

create or replace function public.transition_rdo_status(
  p_rdo_id uuid,
  p_status text,
  p_comment text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.transition_rdo_status_impl(p_rdo_id, p_status, p_comment);
end;
$$;

revoke all on function public.transition_rdo_status(uuid, text, text) from public, anon;
grant execute on function public.transition_rdo_status(uuid, text, text) to authenticated;

-- Mantém o RPC usado pela tela administrativa, agora apontado para a função privada.
create or replace function private.get_cron_jobs_impl()
returns table (jobid bigint, jobname text, schedule text, active boolean, command text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Acesso permitido somente para administradores' using errcode = '42501';
  end if;

  if to_regclass('cron.job') is null then
    return;
  end if;

  return query execute
    'select j.jobid::bigint, j.jobname::text, j.schedule::text, j.active, j.command::text from cron.job j order by j.jobid';
end;
$$;

revoke all on function private.get_cron_jobs_impl() from public, anon, authenticated;
grant execute on function private.get_cron_jobs_impl() to authenticated;

create or replace function public.get_cron_jobs()
returns table (jobid bigint, jobname text, schedule text, active boolean, command text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_cron_jobs_impl()
$$;

revoke all on function public.get_cron_jobs() from public, anon;
grant execute on function public.get_cron_jobs() to authenticated;

-- Remove políticas antigas para não deixar permissões permissivas somadas às novas.
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
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
    end loop;
  end loop;
end;
$$;

drop policy if exists evidencias_download_rdo_access on storage.objects;
drop policy if exists evidencias_upload_rdo_access on storage.objects;
drop policy if exists evidencias_delete_rdo_access on storage.objects;

-- Evita que permissões antigas de tabela ou sequência contornem as políticas RLS.
revoke all privileges on table
  public.profiles, public.rdos, public.materiais_rdo, public.evidencias_rdo,
  public.auditorias_rdo, public.unidades, public.instrumentos,
  public.scheduled_exports, public.export_history, public.cron_execution_log
from public, anon, authenticated;

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
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy rdos_select_accessible on public.rdos
  for select to authenticated
  using ((select private.can_view_rdo(id)));
create policy rdos_insert_own_draft on public.rdos
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'draft');
create policy rdos_update_editable on public.rdos
  for update to authenticated
  using ((select private.can_edit_rdo(id)))
  with check ((select private.can_edit_rdo(id)));
create policy rdos_delete_admin on public.rdos
  for delete to authenticated
  using ((select private.is_admin()));

create policy materiais_select_accessible on public.materiais_rdo
  for select to authenticated
  using ((select private.can_view_rdo(rdo_id)));
create policy materiais_insert_editable on public.materiais_rdo
  for insert to authenticated
  with check ((select private.can_edit_rdo(rdo_id)));
create policy materiais_update_editable on public.materiais_rdo
  for update to authenticated
  using ((select private.can_edit_rdo(rdo_id)))
  with check ((select private.can_edit_rdo(rdo_id)));

create policy evidencias_select_accessible on public.evidencias_rdo
  for select to authenticated
  using ((select private.can_view_rdo(rdo_id)));
create policy evidencias_insert_editable on public.evidencias_rdo
  for insert to authenticated
  with check ((select private.can_edit_rdo(rdo_id)));

create policy auditorias_select_accessible on public.auditorias_rdo
  for select to authenticated
  using ((select private.can_view_rdo(rdo_id)));

create policy unidades_select_authenticated on public.unidades
  for select to authenticated using (true);
create policy unidades_admin_manage on public.unidades
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy instrumentos_select_authenticated on public.instrumentos
  for select to authenticated using (true);
create policy instrumentos_admin_manage on public.instrumentos
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy scheduled_exports_select_own_or_admin on public.scheduled_exports
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy scheduled_exports_insert_own on public.scheduled_exports
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy scheduled_exports_update_own_or_admin on public.scheduled_exports
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy scheduled_exports_delete_own_or_admin on public.scheduled_exports
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy export_history_select_owner_or_admin on public.export_history
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy cron_execution_log_admin_select on public.cron_execution_log
  for select to authenticated
  using ((select private.is_admin()));

grant usage on schema public to authenticated;
grant select, delete on public.profiles to authenticated;
grant update (profile, unidade_id, disciplina, updated_at) on public.profiles to authenticated;

grant select, delete on public.rdos to authenticated;
grant insert (
  user_id, unidade_id, numero, data, hh_planejado, hh_realizado,
  status, disciplina, engenheiro_obs, coordenador_obs
) on public.rdos to authenticated;
grant update (
  unidade_id, numero, data, hh_planejado, hh_realizado, disciplina,
  engenheiro_obs, coordenador_obs, deleted_at, updated_at
) on public.rdos to authenticated;

grant select on public.materiais_rdo to authenticated;
grant insert (rdo_id, material, quantidade, unidade_medida)
  on public.materiais_rdo to authenticated;
grant update (material, quantidade, unidade_medida, deleted_at, updated_at)
  on public.materiais_rdo to authenticated;

grant select on public.evidencias_rdo to authenticated;
grant insert (rdo_id, tipo, url, descricao) on public.evidencias_rdo to authenticated;
grant select on public.auditorias_rdo to authenticated;
grant select, insert, update, delete on public.unidades to authenticated;
grant select, insert, update, delete on public.instrumentos to authenticated;

grant select, delete on public.scheduled_exports to authenticated;
grant insert (
  user_id, name, description, format, frequency, hour, minute, day_of_week,
  day_of_month, filters, email_recipients, is_active
) on public.scheduled_exports to authenticated;
grant update (
  name, description, format, frequency, hour, minute, day_of_week,
  day_of_month, filters, email_recipients, is_active, updated_at
) on public.scheduled_exports to authenticated;

grant select on public.export_history, public.cron_execution_log to authenticated;
revoke all privileges on sequence public.cron_execution_log_id_seq from public, anon, authenticated;

create index if not exists profiles_unidade_id_idx on public.profiles(unidade_id);
create index if not exists instrumentos_unidade_id_idx on public.instrumentos(unidade_id);
create index if not exists auditorias_rdo_auditor_user_id_idx on public.auditorias_rdo(auditor_user_id);
create index if not exists cron_execution_log_executed_at_idx on public.cron_execution_log(executed_at desc);
create index if not exists scheduled_exports_due_idx
  on public.scheduled_exports(next_execution_at)
  where is_active and next_execution_at is not null;
create index if not exists rdos_user_live_created_at_idx
  on public.rdos(user_id, created_at desc)
  where deleted_at is null;
create index if not exists export_history_user_executed_idx
  on public.export_history(user_id, executed_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rdos'::regclass and conname = 'rdos_hh_positive_check'
  ) then
    alter table public.rdos
      add constraint rdos_hh_positive_check
      check (hh_planejado > 0 and (hh_realizado is null or hh_realizado >= 0)) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.materiais_rdo'::regclass and conname = 'materiais_rdo_quantidade_positive_check'
  ) then
    alter table public.materiais_rdo
      add constraint materiais_rdo_quantidade_positive_check
      check (quantidade > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scheduled_exports'::regclass and conname = 'scheduled_exports_frequency_days_check'
  ) then
    alter table public.scheduled_exports
      add constraint scheduled_exports_frequency_days_check
      check (
        (frequency = 'diario' and day_of_week is null and day_of_month is null)
        or (frequency = 'semanal' and day_of_week is not null and day_of_month is null)
        or (frequency = 'mensal' and day_of_week is null and day_of_month is not null)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_disciplina_check'
  ) then
    alter table public.profiles
      add constraint profiles_disciplina_check
      check (disciplina is null or disciplina in ('automacao', 'instrumentacao', 'eletrica', 'civil')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.unidades'::regclass and conname = 'unidades_disciplina_check'
  ) then
    alter table public.unidades
      add constraint unidades_disciplina_check
      check (disciplina is null or disciplina in ('automacao', 'instrumentacao', 'eletrica', 'civil')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rdos'::regclass and conname = 'rdos_disciplina_check'
  ) then
    alter table public.rdos
      add constraint rdos_disciplina_check
      check (disciplina is null or disciplina in ('automacao', 'instrumentacao', 'eletrica', 'civil')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.unidades'::regclass and conname = 'unidades_codigo_nonempty_check'
  ) then
    alter table public.unidades
      add constraint unidades_codigo_nonempty_check
      check (length(btrim(codigo)) > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.materiais_rdo'::regclass and conname = 'materiais_rdo_material_nonempty_check'
  ) then
    alter table public.materiais_rdo
      add constraint materiais_rdo_material_nonempty_check
      check (length(btrim(material)) > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scheduled_exports'::regclass and conname = 'scheduled_exports_name_nonempty_check'
  ) then
    alter table public.scheduled_exports
      add constraint scheduled_exports_name_nonempty_check
      check (length(btrim(name)) > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scheduled_exports'::regclass and conname = 'scheduled_exports_recipients_nonempty_check'
  ) then
    alter table public.scheduled_exports
      add constraint scheduled_exports_recipients_nonempty_check
      check (cardinality(email_recipients) > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.export_history'::regclass and conname = 'export_history_file_size_nonnegative_check'
  ) then
    alter table public.export_history
      add constraint export_history_file_size_nonnegative_check
      check (file_size is null or file_size >= 0) not valid;
  end if;
end;
$$;

alter table public.rdos alter column hh_planejado drop default;
alter table public.materiais_rdo alter column quantidade drop default;

do $$
begin
  if not exists (
    select 1 from public.rdos
    where hh_planejado <= 0 or hh_realizado < 0
  ) then
    alter table public.rdos validate constraint rdos_hh_positive_check;
  end if;

  if not exists (select 1 from public.materiais_rdo where quantidade <= 0) then
    alter table public.materiais_rdo validate constraint materiais_rdo_quantidade_positive_check;
  end if;

  if not exists (
    select 1 from public.scheduled_exports
    where not (
      (frequency = 'diario' and day_of_week is null and day_of_month is null)
      or (frequency = 'semanal' and day_of_week is not null and day_of_month is null)
      or (frequency = 'mensal' and day_of_week is null and day_of_month is not null)
    )
  ) then
    alter table public.scheduled_exports validate constraint scheduled_exports_frequency_days_check;
  end if;

  if not exists (
    select 1 from public.profiles
    where disciplina is not null
      and disciplina not in ('automacao', 'instrumentacao', 'eletrica', 'civil')
  ) then
    alter table public.profiles validate constraint profiles_disciplina_check;
  end if;

  if not exists (
    select 1 from public.unidades
    where disciplina is not null
      and disciplina not in ('automacao', 'instrumentacao', 'eletrica', 'civil')
  ) then
    alter table public.unidades validate constraint unidades_disciplina_check;
  end if;

  if not exists (
    select 1 from public.rdos
    where disciplina is not null
      and disciplina not in ('automacao', 'instrumentacao', 'eletrica', 'civil')
  ) then
    alter table public.rdos validate constraint rdos_disciplina_check;
  end if;

  if not exists (select 1 from public.unidades where length(btrim(codigo)) = 0) then
    alter table public.unidades validate constraint unidades_codigo_nonempty_check;
  end if;

  if not exists (select 1 from public.materiais_rdo where length(btrim(material)) = 0) then
    alter table public.materiais_rdo validate constraint materiais_rdo_material_nonempty_check;
  end if;

  if not exists (select 1 from public.scheduled_exports where length(btrim(name)) = 0) then
    alter table public.scheduled_exports validate constraint scheduled_exports_name_nonempty_check;
  end if;

  if not exists (select 1 from public.scheduled_exports where cardinality(email_recipients) = 0) then
    alter table public.scheduled_exports validate constraint scheduled_exports_recipients_nonempty_check;
  end if;

  if not exists (select 1 from public.export_history where file_size < 0) then
    alter table public.export_history validate constraint export_history_file_size_nonnegative_check;
  end if;
end;
$$;

-- Políticas de Storage usam sempre o primeiro diretório como UUID do RDO.
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do update set public = false;

create policy evidencias_download_rdo_access on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (select private.can_view_rdo(((storage.foldername(name))[1])::uuid))
      else false
    end
  );

create policy evidencias_upload_rdo_access on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (select private.can_edit_rdo(((storage.foldername(name))[1])::uuid))
      else false
    end
  );

create policy evidencias_delete_rdo_access on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (select private.can_edit_rdo(((storage.foldername(name))[1])::uuid))
      else false
    end
  );

drop function if exists public.can_access_rdo(uuid);
drop function if exists public.can_review_rdo();
drop function if exists public.is_admin();
drop function if exists public.current_user_profile();
