alter table public.rdos
  add column version integer not null default 1 check (version > 0);

alter table public.materiais_rdo
  add column version integer not null default 1 check (version > 0);

alter table public.rdo_efetivo
  add column version integer not null default 1 check (version > 0);

alter table public.rdo_equipamentos
  add column version integer not null default 1 check (version > 0);

alter table public.rdo_ocorrencias
  add column version integer not null default 1 check (version > 0);

create table private.rdo_save_requests (
  id uuid primary key,
  rdo_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  request_payload jsonb not null,
  resulting_version integer not null,
  created_at timestamptz not null default now()
);

revoke all on private.rdo_save_requests from public, anon, authenticated;

create or replace function private.bump_rdo_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger rdos_increment_version
  before update on public.rdos
  for each row execute function private.bump_rdo_version();

create or replace function private.bump_rdo_child_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_rdo_id uuid;
begin
  if tg_op = 'DELETE' then
    target_rdo_id := old.rdo_id;
  else
    new.version := case when tg_op = 'INSERT' then 1 else old.version + 1 end;
    target_rdo_id := new.rdo_id;
  end if;

  if current_setting('app.atomic_rdo_save', true) is distinct from 'on' then
    update public.rdos set version = version + 1 where id = target_rdo_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.bump_rdo_child_version() from public, anon, authenticated;

create trigger materiais_rdo_increment_version
  before insert or update or delete on public.materiais_rdo
  for each row execute function private.bump_rdo_child_version();
create trigger rdo_efetivo_increment_version
  before insert or update or delete on public.rdo_efetivo
  for each row execute function private.bump_rdo_child_version();
create trigger rdo_equipamentos_increment_version
  before insert or update or delete on public.rdo_equipamentos
  for each row execute function private.bump_rdo_child_version();
create trigger rdo_ocorrencias_increment_version
  before insert or update or delete on public.rdo_ocorrencias
  for each row execute function private.bump_rdo_child_version();

create or replace function public.salvar_rdo_completo(
  rdo_id uuid,
  versao_base integer,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_id uuid;
  saved_request private.rdo_save_requests%rowtype;
  current_rdo public.rdos%rowtype;
  target_unit_id uuid;
  current_version integer;
  actor_profile text;
  server_snapshot jsonb;
  violated_constraint text;
begin
  if actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'PERMISSION_DENIED', 'message', 'Autenticação necessária.');
  end if;

  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or jsonb_typeof(payload -> 'materials') <> 'array'
    or jsonb_typeof(payload -> 'workforce') <> 'array'
    or jsonb_typeof(payload -> 'equipment') <> 'array'
    or jsonb_typeof(payload -> 'occurrences') <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'message', 'O conteúdo completo do RDO é obrigatório.');
  end if;

  begin
    request_id := (payload ->> 'request_id')::uuid;
    target_unit_id := (payload ->> 'unidade_id')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'message', 'Identificador de envio ou unidade inválido.');
  end;
  if request_id is null or target_unit_id is null or versao_base is null or versao_base < 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'message', 'Identificador de envio, unidade ou versão inválida.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select * into saved_request
  from private.rdo_save_requests
  where id = request_id;

  if found then
    if saved_request.created_by <> actor_id then
      return jsonb_build_object('ok', false, 'code', 'PERMISSION_DENIED', 'message', 'Este identificador de envio pertence a outro usuário.');
    end if;
    if saved_request.rdo_id <> salvar_rdo_completo.rdo_id
      or saved_request.request_payload <> payload then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSED', 'message', 'O identificador do envio já foi usado com outros dados.');
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'version', saved_request.resulting_version);
  end if;

  select p.profile into actor_profile
  from public.profiles p
  where p.id = actor_id;
  if actor_profile is null or actor_profile not in ('admin', 'supervisor', 'engenheiro', 'encarregado') then
    return jsonb_build_object('ok', false, 'code', 'PERMISSION_DENIED', 'message', 'Seu perfil não pode salvar RDOs.');
  end if;

  select * into current_rdo
  from public.rdos r
  where r.id = salvar_rdo_completo.rdo_id
    and r.deleted_at is null
  for update;

  if found then
    if current_rdo.user_id <> actor_id and not private.can_review_rdo() then
      return jsonb_build_object('ok', false, 'code', 'PERMISSION_DENIED', 'message', 'Você não tem permissão para editar este RDO.');
    end if;
    if current_rdo.version <> versao_base then
      select to_jsonb(r) || jsonb_build_object(
        'materials', coalesce((
          select jsonb_agg(to_jsonb(m) order by m.created_at)
          from public.materiais_rdo m
          where m.rdo_id = r.id and m.deleted_at is null
        ), '[]'::jsonb),
        'workforce', coalesce((
          select jsonb_agg(to_jsonb(w) order by w.created_at)
          from public.rdo_efetivo w where w.rdo_id = r.id
        ), '[]'::jsonb),
        'equipment', coalesce((
          select jsonb_agg(to_jsonb(e) order by e.created_at)
          from public.rdo_equipamentos e where e.rdo_id = r.id
        ), '[]'::jsonb),
        'occurrences', coalesce((
          select jsonb_agg(to_jsonb(o) order by o.created_at)
          from public.rdo_ocorrencias o where o.rdo_id = r.id
        ), '[]'::jsonb)
      )
      into server_snapshot
      from public.rdos r
      where r.id = current_rdo.id;
      return jsonb_build_object(
        'ok', false, 'code', 'VERSION_CONFLICT',
        'message', 'O RDO foi alterado por outra pessoa.',
        'server_version', current_rdo.version,
        'server_data', server_snapshot
      );
    end if;
    if current_rdo.status not in ('draft', 'rejected') then
      return jsonb_build_object('ok', false, 'code', 'STATE_NOT_EDITABLE', 'message', 'O estado atual do RDO não permite edição.');
    end if;
    if not private.can_edit_rdo(current_rdo.id) then
      return jsonb_build_object('ok', false, 'code', 'PERMISSION_DENIED', 'message', 'Você não tem permissão para editar este RDO.');
    end if;
  elsif versao_base <> 0 then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'message', 'O RDO não existe mais no servidor.', 'server_version', null);
  elsif actor_profile not in ('admin', 'supervisor', 'engenheiro', 'encarregado') then
    return jsonb_build_object('ok', false, 'code', 'PERMISSION_DENIED', 'message', 'Seu perfil não pode criar RDOs.');
  end if;

  if not exists (
    select 1 from public.unidades u
    where u.id = target_unit_id and u.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'UNIT_ARCHIVED', 'message', 'A unidade não existe ou foi arquivada.');
  end if;

  if exists (
    select 1 from public.rdos r
    where r.id <> salvar_rdo_completo.rdo_id
      and r.unidade_id = target_unit_id
      and r.data = (payload ->> 'data')::date
      and coalesce(r.disciplina, '') = coalesce(payload ->> 'disciplina', '')
      and r.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_RDO', 'message', 'Já existe um RDO ativo para esta unidade, data e disciplina.');
  end if;

  if exists (select 1 from jsonb_array_elements(payload -> 'materials') e where e ->> 'id' is null)
    or exists (select 1 from jsonb_array_elements(payload -> 'workforce') e where e ->> 'id' is null)
    or exists (select 1 from jsonb_array_elements(payload -> 'equipment') e where e ->> 'id' is null)
    or exists (select 1 from jsonb_array_elements(payload -> 'occurrences') e where e ->> 'id' is null) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'message', 'Cada item filho precisa de um identificador estável.');
  end if;

  if exists (
    select 1
    from public.materiais_rdo existing
    join jsonb_array_elements(payload -> 'materials') incoming on incoming ->> 'id' = existing.id::text
    where existing.rdo_id <> salvar_rdo_completo.rdo_id
  ) or exists (
    select 1
    from public.rdo_efetivo existing
    join jsonb_array_elements(payload -> 'workforce') incoming on incoming ->> 'id' = existing.id::text
    where existing.rdo_id <> salvar_rdo_completo.rdo_id
  ) or exists (
    select 1
    from public.rdo_equipamentos existing
    join jsonb_array_elements(payload -> 'equipment') incoming on incoming ->> 'id' = existing.id::text
    where existing.rdo_id <> salvar_rdo_completo.rdo_id
  ) or exists (
    select 1
    from public.rdo_ocorrencias existing
    join jsonb_array_elements(payload -> 'occurrences') incoming on incoming ->> 'id' = existing.id::text
    where existing.rdo_id <> salvar_rdo_completo.rdo_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'CHILD_ID_CONFLICT', 'message', 'Um identificador filho já pertence a outro RDO.');
  end if;

  perform set_config('app.atomic_rdo_save', 'on', true);

  if current_rdo.id is null then
    insert into public.rdos (
      id, user_id, unidade_id, numero, data, hh_planejado, hh_realizado, disciplina,
      engenheiro_obs, coordenador_obs, clima_condicao, clima_temperatura, clima_origem, status, version
    ) values (
      salvar_rdo_completo.rdo_id, actor_id, target_unit_id, payload ->> 'numero',
      (payload ->> 'data')::date, (payload ->> 'hh_planejado')::numeric,
      nullif(payload ->> 'hh_realizado', '')::numeric, nullif(payload ->> 'disciplina', ''),
      payload ->> 'engenheiro_obs', payload ->> 'coordenador_obs', payload ->> 'clima_condicao',
      nullif(payload ->> 'clima_temperatura', '')::numeric, nullif(payload ->> 'clima_origem', ''),
      'draft', 1
    );
    current_version := 1;
  else
    update public.rdos set
      unidade_id = target_unit_id,
      numero = payload ->> 'numero',
      data = (payload ->> 'data')::date,
      hh_planejado = (payload ->> 'hh_planejado')::numeric,
      hh_realizado = nullif(payload ->> 'hh_realizado', '')::numeric,
      disciplina = nullif(payload ->> 'disciplina', ''),
      engenheiro_obs = payload ->> 'engenheiro_obs',
      coordenador_obs = payload ->> 'coordenador_obs',
      clima_condicao = payload ->> 'clima_condicao',
      clima_temperatura = nullif(payload ->> 'clima_temperatura', '')::numeric,
      clima_origem = nullif(payload ->> 'clima_origem', '')
    where id = salvar_rdo_completo.rdo_id
    returning version into current_version;
  end if;

  update public.materiais_rdo m
  set deleted_at = now()
  where m.rdo_id = salvar_rdo_completo.rdo_id
    and m.deleted_at is null
    and not exists (select 1 from jsonb_array_elements(payload -> 'materials') e where e ->> 'id' = m.id::text);
  insert into public.materiais_rdo (id, rdo_id, material, quantidade, unidade_medida)
  select x.id, salvar_rdo_completo.rdo_id, x.material, x.quantidade, x.unidade_medida
  from jsonb_to_recordset(payload -> 'materials') as x(id uuid, material text, quantidade numeric, unidade_medida text)
  on conflict (id) do update set
    material = excluded.material, quantidade = excluded.quantidade, unidade_medida = excluded.unidade_medida,
    deleted_at = null
  where public.materiais_rdo.rdo_id = salvar_rdo_completo.rdo_id;

  delete from public.rdo_efetivo e
  where e.rdo_id = salvar_rdo_completo.rdo_id
    and not exists (select 1 from jsonb_array_elements(payload -> 'workforce') x where x ->> 'id' = e.id::text);
  insert into public.rdo_efetivo (id, rdo_id, funcao_id, quantidade, horas_trabalhadas, matricula, nome, identificador_externo)
  select x.id, salvar_rdo_completo.rdo_id, x.funcao_id, x.quantidade, x.horas_trabalhadas, x.matricula, x.nome, x.identificador_externo
  from jsonb_to_recordset(payload -> 'workforce') as x(id uuid, funcao_id uuid, quantidade integer, horas_trabalhadas numeric, matricula text, nome text, identificador_externo text)
  on conflict (id) do update set
    funcao_id = excluded.funcao_id, quantidade = excluded.quantidade, horas_trabalhadas = excluded.horas_trabalhadas,
    matricula = excluded.matricula, nome = excluded.nome, identificador_externo = excluded.identificador_externo
  where public.rdo_efetivo.rdo_id = salvar_rdo_completo.rdo_id;

  delete from public.rdo_equipamentos e
  where e.rdo_id = salvar_rdo_completo.rdo_id
    and not exists (select 1 from jsonb_array_elements(payload -> 'equipment') x where x ->> 'id' = e.id::text);
  insert into public.rdo_equipamentos (id, rdo_id, equipamento_id, horas_uso, observacao)
  select x.id, salvar_rdo_completo.rdo_id, x.equipamento_id, x.horas_uso, x.observacao
  from jsonb_to_recordset(payload -> 'equipment') as x(id uuid, equipamento_id uuid, horas_uso numeric, observacao text)
  on conflict (id) do update set
    equipamento_id = excluded.equipamento_id, horas_uso = excluded.horas_uso, observacao = excluded.observacao
  where public.rdo_equipamentos.rdo_id = salvar_rdo_completo.rdo_id;

  delete from public.rdo_ocorrencias o
  where o.rdo_id = salvar_rdo_completo.rdo_id
    and not exists (select 1 from jsonb_array_elements(payload -> 'occurrences') x where x ->> 'id' = o.id::text);
  insert into public.rdo_ocorrencias (id, rdo_id, tipo, descricao, inicio, fim, horas_impacto, responsavel)
  select x.id, salvar_rdo_completo.rdo_id, x.tipo, x.descricao, x.inicio, x.fim, x.horas_impacto, x.responsavel
  from jsonb_to_recordset(payload -> 'occurrences') as x(id uuid, tipo text, descricao text, inicio timestamptz, fim timestamptz, horas_impacto numeric, responsavel text)
  on conflict (id) do update set
    tipo = excluded.tipo, descricao = excluded.descricao, inicio = excluded.inicio, fim = excluded.fim,
    horas_impacto = excluded.horas_impacto, responsavel = excluded.responsavel
  where public.rdo_ocorrencias.rdo_id = salvar_rdo_completo.rdo_id;

  insert into private.rdo_save_requests (id, rdo_id, created_by, request_payload, resulting_version)
  values (request_id, salvar_rdo_completo.rdo_id, actor_id, payload, current_version);

  perform set_config('app.atomic_rdo_save', 'off', true);
  return jsonb_build_object('ok', true, 'idempotent', false, 'version', current_version);
exception
  when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint = 'rdos_ativos_unidade_data_disciplina_uidx' then
      return jsonb_build_object('ok', false, 'code', 'DUPLICATE_RDO', 'message', 'Já existe um RDO ativo para esta unidade, data e disciplina.');
    end if;
    return jsonb_build_object('ok', false, 'code', 'CHILD_ID_CONFLICT', 'message', 'Um identificador já está sendo usado por outro registro.');
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'message', 'Um ou mais campos do RDO têm formato inválido.');
  when foreign_key_violation or check_violation or not_null_violation then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REFERENCE', 'message', 'Um item informado não existe ou viola uma regra de validação.');
end;
$$;

revoke all on function public.salvar_rdo_completo(uuid, integer, jsonb) from public, anon;
grant execute on function public.salvar_rdo_completo(uuid, integer, jsonb) to authenticated;

comment on function public.salvar_rdo_completo(uuid, integer, jsonb) is
  'Salva atomicamente um RDO e suas seções com controle otimista de versão e chave de idempotência.';
