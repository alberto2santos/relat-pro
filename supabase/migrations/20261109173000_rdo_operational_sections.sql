alter table public.unidades
  add column latitude double precision,
  add column longitude double precision,
  add constraint unidades_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  add constraint unidades_longitude_range_check
    check (longitude is null or longitude between -180 and 180),
  add constraint unidades_coordinates_pair_check
    check ((latitude is null) = (longitude is null));

alter table public.rdos
  add column clima_condicao text,
  add column clima_temperatura numeric(5, 2),
  add column clima_origem text,
  add constraint rdos_clima_origem_check
    check (clima_origem is null or clima_origem in ('automatico', 'manual'));

create table public.funcoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade_id uuid references public.unidades(id) on delete set null,
  identificador_externo text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipamentos_unidade_nome_unique unique (unidade_id, nome)
);

create table public.tipos_ocorrencia (
  codigo text primary key check (codigo in ('chuva', 'falta_material', 'falta_acesso', 'seguranca', 'retrabalho', 'outro')),
  nome text not null unique,
  ordem smallint not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tipos_ocorrencia (codigo, nome, ordem) values
  ('chuva', 'Chuva / clima', 1),
  ('falta_material', 'Falta de material', 2),
  ('falta_acesso', 'Falta de acesso', 3),
  ('seguranca', 'Segurança', 4),
  ('retrabalho', 'Retrabalho', 5),
  ('outro', 'Outro', 6);

create table public.rdo_efetivo (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdos(id) on delete cascade,
  funcao_id uuid not null references public.funcoes(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  horas_trabalhadas numeric(10, 2) not null default 0 check (horas_trabalhadas >= 0),
  matricula text,
  nome text,
  identificador_externo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rdo_equipamentos (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdos(id) on delete cascade,
  equipamento_id uuid not null references public.equipamentos(id) on delete restrict,
  horas_uso numeric(10, 2) not null default 0 check (horas_uso >= 0),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rdo_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdos(id) on delete cascade,
  tipo text not null references public.tipos_ocorrencia(codigo) on update cascade on delete restrict,
  descricao text not null check (length(trim(descricao)) > 0),
  inicio timestamptz,
  fim timestamptz,
  horas_impacto numeric(10, 2) not null default 0 check (horas_impacto >= 0),
  responsavel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rdo_ocorrencias_periodo_check check (fim is null or inicio is null or fim >= inicio)
);

create index rdo_efetivo_rdo_id_idx on public.rdo_efetivo (rdo_id);
create index rdo_efetivo_funcao_id_idx on public.rdo_efetivo (funcao_id);
create index rdo_equipamentos_rdo_id_idx on public.rdo_equipamentos (rdo_id);
create index rdo_equipamentos_equipamento_id_idx on public.rdo_equipamentos (equipamento_id);
create index rdo_ocorrencias_rdo_id_idx on public.rdo_ocorrencias (rdo_id);
create index equipamentos_unidade_id_idx on public.equipamentos (unidade_id);

alter table public.funcoes enable row level security;
alter table public.equipamentos enable row level security;
alter table public.tipos_ocorrencia enable row level security;
alter table public.rdo_efetivo enable row level security;
alter table public.rdo_equipamentos enable row level security;
alter table public.rdo_ocorrencias enable row level security;

create policy funcoes_select_authenticated on public.funcoes
  for select to authenticated using (true);
create policy funcoes_admin_manage on public.funcoes
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy equipamentos_select_authenticated on public.equipamentos
  for select to authenticated using (true);
create policy equipamentos_admin_manage on public.equipamentos
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy tipos_ocorrencia_select_authenticated on public.tipos_ocorrencia
  for select to authenticated using (true);

create policy rdo_efetivo_select_accessible on public.rdo_efetivo
  for select to authenticated using ((select private.can_view_rdo(rdo_id)));
create policy rdo_efetivo_insert_accessible on public.rdo_efetivo
  for insert to authenticated with check ((select private.can_edit_rdo(rdo_id)));
create policy rdo_efetivo_update_accessible on public.rdo_efetivo
  for update to authenticated using ((select private.can_edit_rdo(rdo_id))) with check ((select private.can_edit_rdo(rdo_id)));
create policy rdo_efetivo_delete_accessible on public.rdo_efetivo
  for delete to authenticated using ((select private.can_edit_rdo(rdo_id)));

create policy rdo_equipamentos_select_accessible on public.rdo_equipamentos
  for select to authenticated using ((select private.can_view_rdo(rdo_id)));
create policy rdo_equipamentos_insert_accessible on public.rdo_equipamentos
  for insert to authenticated with check ((select private.can_edit_rdo(rdo_id)));
create policy rdo_equipamentos_update_accessible on public.rdo_equipamentos
  for update to authenticated using ((select private.can_edit_rdo(rdo_id))) with check ((select private.can_edit_rdo(rdo_id)));
create policy rdo_equipamentos_delete_accessible on public.rdo_equipamentos
  for delete to authenticated using ((select private.can_edit_rdo(rdo_id)));

create policy rdo_ocorrencias_select_accessible on public.rdo_ocorrencias
  for select to authenticated using ((select private.can_view_rdo(rdo_id)));
create policy rdo_ocorrencias_insert_accessible on public.rdo_ocorrencias
  for insert to authenticated with check ((select private.can_edit_rdo(rdo_id)));
create policy rdo_ocorrencias_update_accessible on public.rdo_ocorrencias
  for update to authenticated using ((select private.can_edit_rdo(rdo_id))) with check ((select private.can_edit_rdo(rdo_id)));
create policy rdo_ocorrencias_delete_accessible on public.rdo_ocorrencias
  for delete to authenticated using ((select private.can_edit_rdo(rdo_id)));

revoke all on
  public.funcoes, public.equipamentos, public.tipos_ocorrencia, public.rdo_efetivo, public.rdo_equipamentos, public.rdo_ocorrencias
from public, anon, authenticated;
grant select, insert, update, delete on
  public.funcoes, public.equipamentos, public.rdo_efetivo, public.rdo_equipamentos, public.rdo_ocorrencias
to authenticated;
grant select on public.tipos_ocorrencia to authenticated;

drop trigger if exists funcoes_set_updated_at on public.funcoes;
create trigger funcoes_set_updated_at before update on public.funcoes
  for each row execute function public.set_updated_at();
drop trigger if exists equipamentos_set_updated_at on public.equipamentos;
create trigger equipamentos_set_updated_at before update on public.equipamentos
  for each row execute function public.set_updated_at();
drop trigger if exists tipos_ocorrencia_set_updated_at on public.tipos_ocorrencia;
create trigger tipos_ocorrencia_set_updated_at before update on public.tipos_ocorrencia
  for each row execute function public.set_updated_at();
drop trigger if exists rdo_efetivo_set_updated_at on public.rdo_efetivo;
create trigger rdo_efetivo_set_updated_at before update on public.rdo_efetivo
  for each row execute function public.set_updated_at();
drop trigger if exists rdo_equipamentos_set_updated_at on public.rdo_equipamentos;
create trigger rdo_equipamentos_set_updated_at before update on public.rdo_equipamentos
  for each row execute function public.set_updated_at();
drop trigger if exists rdo_ocorrencias_set_updated_at on public.rdo_ocorrencias;
create trigger rdo_ocorrencias_set_updated_at before update on public.rdo_ocorrencias
  for each row execute function public.set_updated_at();
drop trigger if exists unidades_set_updated_at on public.unidades;
create trigger unidades_set_updated_at before update on public.unidades
  for each row execute function public.set_updated_at();
drop trigger if exists rdos_set_updated_at on public.rdos;
create trigger rdos_set_updated_at before update on public.rdos
  for each row execute function public.set_updated_at();

create or replace function private.write_rdo_operational_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_rdo_id uuid := (changed_row ->> 'rdo_id')::uuid;
  action_name text;
  description text;
begin
  action_name := case
    when tg_table_name = 'rdo_efetivo' then 'efetivo'
    when tg_table_name = 'rdo_equipamentos' then 'equipamento'
    else 'ocorrencia'
  end;
  action_name := action_name || case
    when tg_op = 'INSERT' then '_adicionado'
    when tg_op = 'UPDATE' then '_atualizado'
    else '_removido'
  end;
  description := case
    when tg_op = 'DELETE' then 'Registro removido de ' || tg_table_name || '.'
    when tg_op = 'INSERT' then 'Registro adicionado em ' || tg_table_name || '.'
    else 'Registro atualizado em ' || tg_table_name || '.'
  end;

  insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
  values (target_rdo_id, (select auth.uid()), action_name, description);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.write_rdo_operational_audit() from public, anon, authenticated;

create trigger rdo_efetivo_audit
  after insert or update or delete on public.rdo_efetivo
  for each row execute function private.write_rdo_operational_audit();
create trigger rdo_equipamentos_audit
  after insert or update or delete on public.rdo_equipamentos
  for each row execute function private.write_rdo_operational_audit();
create trigger rdo_ocorrencias_audit
  after insert or update or delete on public.rdo_ocorrencias
  for each row execute function private.write_rdo_operational_audit();

comment on table public.funcoes is 'Cadastro administrável e arquivável de funções de mão de obra.';
comment on table public.equipamentos is 'Cadastro administrável e arquivável de equipamentos, opcionalmente vinculado a uma unidade.';
comment on table public.tipos_ocorrencia is 'Catálogo dos tipos de ocorrência aceitos nos RDOs.';
comment on table public.rdo_efetivo is 'Efetivo e horas trabalhadas por função em um RDO.';
comment on table public.rdo_equipamentos is 'Equipamentos utilizados e horas de uso em um RDO.';
comment on table public.rdo_ocorrencias is 'Ocorrências, paralisações e respectivos impactos registrados em um RDO.';
