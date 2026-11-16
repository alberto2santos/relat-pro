-- Verifica possíveis conflitos antes de alterar qualquer objeto ou permissão.
do $$
begin
  if exists (
    select 1
    from public.rdos
    where deleted_at is null
    group by unidade_id, data, coalesce(disciplina, '')
    having count(*) > 1
  ) then
    raise exception 'Há RDOs ativos duplicados para unidade, data e disciplina. Corrija os registros antes de aplicar esta migration.';
  end if;
end;
$$;

-- Mantém o histórico do RDO; a aplicação já usa exclusão lógica.
drop policy if exists rdos_delete_admin on public.rdos;
revoke delete on public.rdos from public, anon, authenticated;

-- O ator pode ser nulo quando uma rotina de backend altera um registro sem JWT de usuário.
alter table public.auditorias_rdo
  alter column auditor_user_id drop not null;

create or replace function private.write_rdo_creation_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
  values (new.id, new.user_id, new.status, 'RDO criado.');

  return new;
end;
$$;

revoke all on function private.write_rdo_creation_audit() from public, anon, authenticated;

create or replace function private.write_rdo_update_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  changed_fields text[];
  action_name text;
  action_comment text;
begin
  if old.status is distinct from new.status and actor_id is null then
    insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
    values (
      new.id,
      null,
      'status_alterado',
      format('Status alterado de %s para %s por uma rotina de backend.', old.status, new.status)
    );
  end if;

  select coalesce(array_agg(changes.label order by changes.label), array[]::text[])
  into changed_fields
  from (
    values
      ('Unidade', old.unidade_id is distinct from new.unidade_id),
      ('Número', old.numero is distinct from new.numero),
      ('Data', old.data is distinct from new.data),
      ('HH planejado', old.hh_planejado is distinct from new.hh_planejado),
      ('HH realizado', old.hh_realizado is distinct from new.hh_realizado),
      ('Disciplina', old.disciplina is distinct from new.disciplina),
      ('Observação do engenheiro', old.engenheiro_obs is distinct from new.engenheiro_obs),
      ('Observação da coordenação', old.coordenador_obs is distinct from new.coordenador_obs)
  ) as changes(label, changed)
  where changes.changed;

  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null then
      action_name := 'restaurado';
      action_comment := 'RDO restaurado na listagem.';
    else
      action_name := 'excluido';
      action_comment := 'RDO removido da listagem.';
    end if;
  elsif cardinality(changed_fields) > 0 then
    action_name := 'editado';
    action_comment := 'Campos alterados: ' || array_to_string(changed_fields, ', ') || '.';
  else
    return new;
  end if;

  insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
  values (new.id, actor_id, action_name, action_comment);

  return new;
end;
$$;

revoke all on function private.write_rdo_update_audit() from public, anon, authenticated;

drop trigger if exists rdos_update_audit on public.rdos;
create trigger rdos_update_audit
  after update of unidade_id, numero, data, hh_planejado, hh_realizado, disciplina,
    engenheiro_obs, coordenador_obs, deleted_at, status
  on public.rdos
  for each row execute function private.write_rdo_update_audit();

create or replace function private.write_rdo_child_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_rdo_id uuid;
  action_name text;
  action_comment text;
begin
  if tg_table_name = 'materiais_rdo' then
    if tg_op = 'DELETE' then
      target_rdo_id := old.rdo_id;
      action_name := 'material_removido';
      action_comment := 'Material removido: ' || old.material || '.';
    elsif tg_op = 'INSERT' then
      target_rdo_id := new.rdo_id;
      action_name := 'material_adicionado';
      action_comment := 'Material adicionado: ' || new.material || '.';
    else
      target_rdo_id := new.rdo_id;
      if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
        action_name := 'material_removido';
        action_comment := 'Material removido: ' || new.material || '.';
      else
        action_name := 'material_editado';
        action_comment := 'Material atualizado: ' || new.material || '.';
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    target_rdo_id := old.rdo_id;
    action_name := 'evidencia_removida';
    action_comment := 'Evidência removida (' || old.tipo || ').';
  elsif tg_op = 'INSERT' then
    target_rdo_id := new.rdo_id;
    action_name := 'evidencia_adicionada';
    action_comment := 'Evidência anexada (' || new.tipo || ').';
  else
    target_rdo_id := new.rdo_id;
    action_name := 'evidencia_atualizada';
    action_comment := 'Dados da evidência atualizados (' || new.tipo || ').';
  end if;

  insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
  values (target_rdo_id, actor_id, action_name, action_comment);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.write_rdo_child_audit() from public, anon, authenticated;

drop trigger if exists materiais_rdo_audit on public.materiais_rdo;
create trigger materiais_rdo_audit
  after insert or update or delete on public.materiais_rdo
  for each row execute function private.write_rdo_child_audit();

drop trigger if exists evidencias_rdo_audit on public.evidencias_rdo;
create trigger evidencias_rdo_audit
  after insert or update or delete on public.evidencias_rdo
  for each row execute function private.write_rdo_child_audit();

create unique index if not exists rdos_ativos_unidade_data_disciplina_uidx
  on public.rdos (unidade_id, data, coalesce(disciplina, ''))
  where deleted_at is null;

-- Fotos e assinaturas aceitam apenas formatos de imagem e até 10 MiB por arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
