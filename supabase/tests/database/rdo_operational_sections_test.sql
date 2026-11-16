begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'rdo-ops-owner@example.test'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'rdo-ops-other@example.test'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'rdo-ops-admin@example.test');

update public.profiles
set profile = 'admin'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

insert into public.unidades (id, codigo, nome)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'OPS-RLS', 'Teste seções operacionais');

insert into public.rdos (id, user_id, unidade_id, numero, data, hh_planejado, status)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'OPS-1', current_date, 8, 'draft'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'OPS-2', current_date + 1, 8, 'draft'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'OPS-3', current_date + 2, 8, 'approved');

insert into public.funcoes (id, nome)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'Função de teste');
insert into public.equipamentos (id, nome)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'Equipamento de teste');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

select ok(
  exists(select 1 from public.funcoes where nome = 'Engenheiro(a) civil' and deleted_at is null),
  'Catálogo contém função inicial disponível ao usuário autenticado'
);
select ok(
  exists(select 1 from public.equipamentos where nome = 'Retroescavadeira' and unidade_id is null and deleted_at is null),
  'Catálogo contém equipamento global inicial disponível ao usuário autenticado'
);
select is((select count(*) from public.tipos_ocorrencia), 6::bigint, 'Usuário autenticado pode consultar o catálogo de ocorrências');
select throws_ok(
  $$insert into public.funcoes (nome) values ('Função bloqueada')$$,
  '42501',
  'Apenas administrador pode gerir funções'
);
select throws_ok(
  $$insert into public.equipamentos (nome) values ('Equipamento bloqueado')$$,
  '42501',
  'Apenas administrador pode gerir equipamentos'
);
select throws_ok(
  $$insert into public.tipos_ocorrencia (codigo, nome, ordem) values ('outro', 'Tipo indevido', 99)$$,
  '42501',
  'O catálogo de ocorrências não pode ser alterado pela aplicação'
);
select lives_ok(
  $$insert into public.rdo_efetivo (rdo_id, funcao_id, quantidade, horas_trabalhadas) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 3, 8)$$,
  'Responsável pode registrar efetivo no próprio RDO'
);
select lives_ok(
  $$insert into public.rdo_equipamentos (rdo_id, equipamento_id, horas_uso) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 4)$$,
  'Responsável pode registrar equipamento no próprio RDO'
);
select lives_ok(
  $$insert into public.rdo_ocorrencias (rdo_id, tipo, descricao, horas_impacto) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'chuva', 'Chuva forte', 2)$$,
  'Responsável pode registrar ocorrência no próprio RDO'
);
select is(
  (select count(*) from public.auditorias_rdo where rdo_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and acao in ('efetivo_adicionado', 'equipamento_adicionado', 'ocorrencia_adicionada')),
  3::bigint,
  'Alterações operacionais geram histórico de auditoria'
);
select throws_ok(
  $$insert into public.rdo_efetivo (rdo_id, funcao_id, quantidade, horas_trabalhadas) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 1, 8)$$,
  '42501',
  'Não é possível adicionar efetivo diretamente em RDO aprovado'
);

reset role;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
set local role authenticated;
select is(
  (select count(*) from public.rdo_efetivo where rdo_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
  0::bigint,
  'Usuário não consulta seções operacionais de RDO alheio'
);

reset role;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
set local role authenticated;
select lives_ok(
  $$insert into public.funcoes (nome) values ('Função criada por admin')$$,
  'Administrador pode gerir o cadastro de funções'
);

select * from finish();
rollback;
