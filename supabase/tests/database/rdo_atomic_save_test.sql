begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'rdo-atomic-owner@example.test'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', 'rdo-atomic-other@example.test');

insert into public.unidades (id, codigo, nome)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'ATOMIC', 'Teste RPC atômica');

insert into public.funcoes (id, nome)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddb1', 'Função teste RPC');
insert into public.equipamentos (id, nome)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'Equipamento teste RPC');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';

select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb1',
    0,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff1',
      'numero', 'ATOMIC-1',
      'data', (current_date + 20)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'hh_realizado', 6,
      'disciplina', 'eletrica',
      'materials', jsonb_build_array(jsonb_build_object(
        'id', '11111111-1111-4111-8111-1111111111b1',
        'material', 'Cabo',
        'quantidade', 10,
        'unidade_medida', 'm'
      )),
      'workforce', jsonb_build_array(jsonb_build_object(
        'id', '22222222-2222-4222-8222-2222222222b1',
        'funcao_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddb1',
        'quantidade', 2,
        'horas_trabalhadas', 8
      )),
      'equipment', jsonb_build_array(jsonb_build_object(
        'id', '33333333-3333-4333-8333-3333333333b1',
        'equipamento_id', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
        'horas_uso', 4
      )),
      'occurrences', jsonb_build_array(jsonb_build_object(
        'id', '44444444-4444-4444-8444-4444444444b1',
        'tipo', 'chuva',
        'descricao', 'Chuva intensa',
        'horas_impacto', 1
      ))
    )
  ) ->> 'ok'),
  'true',
  'A RPC cria o RDO e todas as seções operacionais numa operação'
);
select is(
  (select version from public.rdos where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1'),
  1,
  'A primeira gravação inicia a versão do agregado em 1'
);
select is(
  (select count(*) from public.materiais_rdo where rdo_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1')
  + (select count(*) from public.rdo_efetivo where rdo_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1')
  + (select count(*) from public.rdo_equipamentos where rdo_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1')
  + (select count(*) from public.rdo_ocorrencias where rdo_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1'),
  4::bigint,
  'A gravação cria registros filhos em todas as seções'
);

select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb1',
    1,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff2',
      'numero', 'ATOMIC-1',
      'data', (current_date + 20)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'hh_realizado', 7,
      'disciplina', 'eletrica',
      'materials', jsonb_build_array(jsonb_build_object(
        'id', '11111111-1111-4111-8111-1111111111b1',
        'material', 'Cabo atualizado',
        'quantidade', 12,
        'unidade_medida', 'm'
      )),
      'workforce', jsonb_build_array(jsonb_build_object(
        'id', '22222222-2222-4222-8222-2222222222b1',
        'funcao_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddb1',
        'quantidade', 2,
        'horas_trabalhadas', 8
      )),
      'equipment', jsonb_build_array(jsonb_build_object(
        'id', '33333333-3333-4333-8333-3333333333b1',
        'equipamento_id', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
        'horas_uso', 4
      )),
      'occurrences', jsonb_build_array(jsonb_build_object(
        'id', '44444444-4444-4444-8444-4444444444b1',
        'tipo', 'chuva',
        'descricao', 'Chuva intensa',
        'horas_impacto', 1
      ))
    )
  ) ->> 'version'),
  '2',
  'A gravação com a versão-base correta atualiza o agregado'
);
select is(
  (select version from public.rdo_efetivo where id = '22222222-2222-4222-8222-2222222222b1'),
  2,
  'A versão da linha filha é incrementada na atualização atômica'
);
update public.rdo_efetivo
set horas_trabalhadas = 7
where id = '22222222-2222-4222-8222-2222222222b1';
select is(
  (select version from public.rdos where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1'),
  3,
  'Alteração direta de filha incrementa a versão do agregado'
);
select is(
  (select version from public.rdo_efetivo where id = '22222222-2222-4222-8222-2222222222b1'),
  3,
  'Alteração direta incrementa a versão da própria filha'
);
select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb1',
    1,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff3',
      'numero', 'ATOMIC-1',
      'data', (current_date + 20)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'materials', '[]'::jsonb,
      'workforce', '[]'::jsonb,
      'equipment', '[]'::jsonb,
      'occurrences', '[]'::jsonb
    )
  ) ->> 'code'),
  'VERSION_CONFLICT',
  'Versão-base antiga retorna conflito sem sobrescrever dados'
);
select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb1',
    3,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff4',
      'numero', 'ATOMIC-1',
      'data', (current_date + 20)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'materials', '[]'::jsonb,
      'workforce', jsonb_build_array(jsonb_build_object(
        'id', '55555555-5555-4555-8555-5555555555b1',
        'funcao_id', 'ffffffff-ffff-4fff-8fff-fffffffffff9',
        'quantidade', 1,
        'horas_trabalhadas', 8
      )),
      'equipment', '[]'::jsonb,
      'occurrences', '[]'::jsonb
    )
  ) ->> 'code'),
  'INVALID_REFERENCE',
  'Referência inválida retorna erro explícito e reverte a operação inteira'
);
select is(
  (select version from public.rdos where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1'),
  2,
  'Falha ao salvar uma filha não altera a versão nem parte do agregado'
);
reset role;
update public.rdos set status = 'approved'
where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccb1';
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';
set local role authenticated;
select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb1',
    4,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff7',
      'numero', 'ATOMIC-1',
      'data', (current_date + 20)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'materials', '[]'::jsonb,
      'workforce', '[]'::jsonb,
      'equipment', '[]'::jsonb,
      'occurrences', '[]'::jsonb
    )
  ) ->> 'code'),
  'STATE_NOT_EDITABLE',
  'RDO aprovado não pode ser alterado por esta RPC'
);
select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb2',
    0,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff5',
      'numero', 'ATOMIC-2',
      'data', (current_date + 20)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'disciplina', 'eletrica',
      'materials', '[]'::jsonb,
      'workforce', '[]'::jsonb,
      'equipment', '[]'::jsonb,
      'occurrences', '[]'::jsonb
    )
  ) ->> 'code'),
  'DUPLICATE_RDO',
  'A restrição de unicidade unidade/data/disciplina é comunicada claramente'
);
reset role;
update public.unidades set deleted_at = now()
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';
set local role authenticated;
select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb3',
    0,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff8',
      'numero', 'ATOMIC-3',
      'data', (current_date + 21)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'materials', '[]'::jsonb,
      'workforce', '[]'::jsonb,
      'equipment', '[]'::jsonb,
      'occurrences', '[]'::jsonb
    )
  ) ->> 'code'),
  'UNIT_ARCHIVED',
  'A RPC bloqueia gravação em unidade arquivada'
);

reset role;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2';
set local role authenticated;
select is(
  (public.salvar_rdo_completo(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccb1',
    4,
    jsonb_build_object(
      'request_id', 'ffffffff-ffff-4fff-8fff-fffffffffff6',
      'numero', 'ATOMIC-1',
      'data', (current_date + 20)::text,
      'unidade_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'hh_planejado', 8,
      'materials', '[]'::jsonb,
      'workforce', '[]'::jsonb,
      'equipment', '[]'::jsonb,
      'occurrences', '[]'::jsonb
    )
  ) ->> 'code'),
  'PERMISSION_DENIED',
  'Usuário sem permissão não consegue alterar RDO de outra pessoa'
);

select * from finish();
rollback;
