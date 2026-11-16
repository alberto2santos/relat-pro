begin;

create extension if not exists pgtap with schema extensions;

select plan(59);

-- Contas descartáveis criadas dentro desta transação de teste.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'rls-encarregado@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rls-outro-encarregado@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'rls-supervisor@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'rls-engenheiro@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'rls-admin@example.test');

insert into public.profiles (id, profile) values
  ('11111111-1111-4111-8111-111111111111', 'encarregado'),
  ('22222222-2222-4222-8222-222222222222', 'encarregado'),
  ('33333333-3333-4333-8333-333333333333', 'supervisor'),
  ('44444444-4444-4444-8444-444444444444', 'engenheiro'),
  ('55555555-5555-4555-8555-555555555555', 'admin');

insert into public.unidades (id, codigo, nome, disciplina)
values ('66666666-6666-4666-8666-666666666666', 'RLS-TESTE', 'Unidade de teste RLS', 'civil');

update public.profiles set profile = 'supervisor'
where id = '33333333-3333-4333-8333-333333333333';
update public.profiles set profile = 'engenheiro'
where id = '44444444-4444-4444-8444-444444444444';
update public.profiles set profile = 'admin'
where id = '55555555-5555-4555-8555-555555555555';

insert into public.rdos (id, user_id, unidade_id, numero, data, disciplina, status, hh_planejado)
values
  ('77777777-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'RLS-1', '2026-10-01', 'civil', 'draft', 0),
  ('77777777-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'RLS-2', '2026-10-02', 'civil', 'submitted', 0),
  ('77777777-7777-4777-8777-777777777773', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'RLS-3', '2026-10-03', 'civil', 'approved', 0),
  ('77777777-7777-4777-8777-777777777774', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'RLS-4', '2026-10-04', 'civil', 'draft', 0),
  ('77777777-7777-4777-8777-777777777775', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'RLS-5', '2026-10-05', 'civil', 'submitted', 0);

insert into public.materiais_rdo (rdo_id, material, quantidade, unidade_medida)
values ('77777777-7777-4777-8777-777777777774', 'Material de outro usuário', 1, 'un');
insert into public.evidencias_rdo (rdo_id, tipo, url, descricao)
values ('77777777-7777-4777-8777-777777777774', 'foto', 'rls-test/outra-foto.png', 'Evidência de outro usuário');
insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao, comentario)
values ('77777777-7777-4777-8777-777777777774', '22222222-2222-4222-8222-222222222222', 'draft', 'Histórico de outro usuário');

insert into public.instrumentos (tag_name, descricao, unidade_id)
values ('RLS-TESTE-INSTRUMENTO', 'Instrumento de teste', '66666666-6666-4666-8666-666666666666');

insert into public.scheduled_exports (id, user_id, name, format, frequency, hour, minute, email_recipients)
values
  ('88888888-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111', 'Agendamento próprio', 'csv', 'diario', 8, 0, array['proprio@example.test']),
  ('88888888-8888-4888-8888-888888888882', '22222222-2222-4222-8222-222222222222', 'Agendamento alheio', 'xlsx', 'diario', 9, 0, array['outro@example.test']);

insert into public.export_history (id, scheduled_export_id, user_id, format, status)
values
  ('99999999-9999-4999-8999-999999999991', '88888888-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111', 'csv', 'success'),
  ('99999999-9999-4999-8999-999999999992', '88888888-8888-4888-8888-888888888882', '22222222-2222-4222-8222-222222222222', 'xlsx', 'failed');

insert into public.cron_execution_log (function_name, status)
values ('rls-test-job', 'success');

-- Encarregado: consulta apenas os próprios dados e não consegue promover a própria conta.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is(
  (select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Encarregado consegue consultar o próprio perfil'
);
select is_empty(
  $$select id from public.profiles where id = '55555555-5555-4555-8555-555555555555'$$,
  'Encarregado não consulta o perfil de outra pessoa'
);
select is_empty(
  $$update public.profiles set profile = 'admin' where id = '11111111-1111-4111-8111-111111111111' returning id$$,
  'Encarregado não consegue alterar o próprio perfil para admin'
);
select is(
  (select profile from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'encarregado',
  'Perfil continua encarregado depois da tentativa de escalonamento'
);
select is(
  (select count(*) from public.rdos),
  3::bigint,
  'Encarregado consulta os próprios RDOs'
);
select is_empty(
  $$select id from public.rdos where id = '77777777-7777-4777-8777-777777777774'$$,
  'Encarregado não consulta RDO de outra pessoa'
);
select throws_ok(
  $$update public.rdos set status = 'approved' where id = '77777777-7777-4777-8777-777777777771'$$,
  '42501',
  'Encarregado não altera status diretamente pela tabela'
);
select results_eq(
  $$update public.rdos set engenheiro_obs = 'Ajuste de teste' where id = '77777777-7777-4777-8777-777777777771' returning engenheiro_obs$$,
  $$select 'Ajuste de teste'::text$$,
  'Encarregado pode editar o próprio RDO em rascunho'
);
select is_empty(
  $$update public.rdos set engenheiro_obs = 'Alteração bloqueada' where id = '77777777-7777-4777-8777-777777777773' returning id$$,
  'RDO aprovado não pode ser editado pelo responsável'
);
select is(
  (select count(*) from public.auditorias_rdo where rdo_id = '77777777-7777-4777-8777-777777777771' and acao = 'editado'),
  1::bigint,
  'Edição do RDO é registrada no banco'
);
select lives_ok(
  $$insert into public.materiais_rdo (rdo_id, material, quantidade, unidade_medida) values ('77777777-7777-4777-8777-777777777771', 'Cabo de teste', 2, 'm')$$,
  'Encarregado consegue registrar material no próprio RDO em rascunho'
);
select is(
  (select count(*) from public.auditorias_rdo where rdo_id = '77777777-7777-4777-8777-777777777771' and acao = 'material_adicionado'),
  1::bigint,
  'Inclusão de material gera auditoria pelo trigger'
);
select lives_ok(
  $$insert into public.evidencias_rdo (rdo_id, tipo, url, descricao) values ('77777777-7777-4777-8777-777777777771', 'foto', 'rls-test/foto.png', 'Foto de teste')$$,
  'Encarregado consegue anexar evidência ao próprio RDO em rascunho'
);
select lives_ok(
  $$insert into public.evidencias_rdo (rdo_id, tipo, url, descricao) values ('77777777-7777-4777-8777-777777777772', 'foto', 'rls-test/foto-pos-envio.png', 'Foto adicionada após envio')$$,
  'Responsável consegue anexar foto ao RDO enviado para revisão'
);
select throws_ok(
  $$insert into public.evidencias_rdo (rdo_id, tipo, url, descricao) values ('77777777-7777-4777-8777-777777777772', 'assinatura', 'rls-test/assinatura-pos-envio.png', 'Assinatura não permitida após envio')$$,
  '42501',
  'new row violates row-level security policy for table "evidencias_rdo"',
  'Responsável não consegue substituir assinatura após envio'
);
select throws_ok(
  $$insert into public.evidencias_rdo (rdo_id, tipo, url, descricao) values ('77777777-7777-4777-8777-777777777773', 'foto', 'rls-test/foto-aprovada.png', 'Foto não permitida após aprovação')$$,
  '42501',
  'new row violates row-level security policy for table "evidencias_rdo"',
  'RDO aprovado permanece imutável para novas fotos'
);
select is(
  (select count(*) from public.auditorias_rdo where rdo_id = '77777777-7777-4777-8777-777777777771' and acao = 'evidencia_adicionada'),
  1::bigint,
  'Inclusão de evidência gera auditoria pelo trigger'
);
select is(
  (select count(*) from public.materiais_rdo where rdo_id = '77777777-7777-4777-8777-777777777771'),
  1::bigint,
  'Encarregado consulta material do próprio RDO'
);
select is_empty(
  $$select id from public.materiais_rdo where rdo_id = '77777777-7777-4777-8777-777777777774'$$,
  'Encarregado não consulta material de RDO alheio'
);
select is_empty(
  $$select id from public.evidencias_rdo where rdo_id = '77777777-7777-4777-8777-777777777774'$$,
  'Encarregado não consulta evidência de RDO alheio'
);
select is_empty(
  $$select id from public.auditorias_rdo where rdo_id = '77777777-7777-4777-8777-777777777774'$$,
  'Encarregado não consulta auditoria de RDO alheio'
);
select throws_ok(
  $$insert into public.materiais_rdo (rdo_id, material, quantidade) values ('77777777-7777-4777-8777-777777777774', 'Material bloqueado', 1)$$,
  '42501',
  'Encarregado não inclui material em RDO alheio'
);
select throws_ok(
  $$insert into public.evidencias_rdo (rdo_id, tipo, url) values ('77777777-7777-4777-8777-777777777774', 'foto', 'rls-test/bloqueada.png')$$,
  '42501',
  'Encarregado não inclui evidência em RDO alheio'
);
select throws_ok(
  $$delete from public.auditorias_rdo where rdo_id = '77777777-7777-4777-8777-777777777771'$$,
  '42501',
  'Histórico não pode ser apagado pela API'
);
select is(
  (select count(*) from public.scheduled_exports where user_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Usuário consulta o próprio agendamento'
);
select is_empty(
  $$select id from public.scheduled_exports where id = '88888888-8888-4888-8888-888888888882'$$,
  'Usuário não consulta agendamento de outra pessoa'
);
select is_empty(
  $$update public.scheduled_exports set name = 'Alteração bloqueada' where id = '88888888-8888-4888-8888-888888888882' returning id$$,
  'Usuário não altera agendamento de outra pessoa'
);
select is(
  (select count(*) from public.export_history where user_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Usuário consulta o próprio histórico de exportações'
);
select is_empty(
  $$select id from public.export_history where id = '99999999-9999-4999-8999-999999999992'$$,
  'Usuário não consulta histórico de outra pessoa'
);
select is(
  (select count(*) from public.cron_execution_log),
  0::bigint,
  'Usuário comum não consulta os logs de automação'
);
select is(
  (select count(*) from public.unidades where id = '66666666-6666-4666-8666-666666666666'),
  1::bigint,
  'Usuário autenticado pode consultar unidades'
);
select is(
  (select count(*) from public.instrumentos where tag_name = 'RLS-TESTE-INSTRUMENTO'),
  1::bigint,
  'Usuário autenticado pode consultar instrumentos'
);
select throws_ok(
  $$insert into public.unidades (codigo, nome) values ('RLS-NAO-ADMIN', 'Unidade bloqueada')$$,
  '42501',
  'Somente administrador pode cadastrar unidade'
);
select throws_ok(
  $$insert into public.export_history (scheduled_export_id, user_id, format, status) values ('88888888-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111', 'csv', 'pending')$$,
  '42501',
  'Histórico de exportação só pode ser gravado pelo serviço de backend'
);
select throws_ok(
  $$insert into public.auditorias_rdo (rdo_id, auditor_user_id, acao) values ('77777777-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111', 'manual')$$,
  '42501',
  'Histórico de RDO só pode ser gravado pelas rotinas do banco'
);

-- Supervisor: consulta e aprova RDOs enviados, mas não altera RDO aprovado.
reset role;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local role authenticated;

select is(
  (select count(*) from public.rdos),
  5::bigint,
  'Supervisor consegue consultar os RDOs visíveis aos revisores'
);
select lives_ok(
  $$select public.transition_rdo_status('77777777-7777-4777-8777-777777777772', 'approved', 'Revisado no teste')$$,
  'Supervisor aprova um RDO enviado pelo fluxo autorizado'
);
select is(
  (select status from public.rdos where id = '77777777-7777-4777-8777-777777777772'),
  'approved',
  'A aprovação atualiza o status do RDO'
);
select is(
  (select count(*) from public.auditorias_rdo where rdo_id = '77777777-7777-4777-8777-777777777772' and acao = 'approved' and comentario = 'Revisado no teste'),
  1::bigint,
  'A aprovação e o comentário ficam registrados no histórico'
);
select is(
  (select count(*) from public.rdo_erp_sync_events where rdo_id = '77777777-7777-4777-8777-777777777772' and status = 'pending'),
  0::bigint,
  'A fila de integração não fica visível para um supervisor'
);
reset role;
set local role postgres;
select is(
  (select count(*) from public.rdo_erp_sync_events where rdo_id = '77777777-7777-4777-8777-777777777772' and status = 'pending'),
  1::bigint,
  'O evento da fila é persistido apesar de a leitura ser restrita a administradores'
);
reset role;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local role authenticated;
select is_empty(
  $$update public.rdos set engenheiro_obs = 'Alteração bloqueada' where id = '77777777-7777-4777-8777-777777777772' returning id$$,
  'Supervisor também não altera RDO aprovado'
);

-- Engenheiro: também pode revisar e aprovar um RDO enviado.
reset role;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
set local role authenticated;

select is(
  (select count(*) from public.rdos),
  5::bigint,
  'Engenheiro consegue consultar os RDOs visíveis aos revisores'
);
select lives_ok(
  $$select public.transition_rdo_status('77777777-7777-4777-8777-777777777775', 'approved', 'Aprovado pelo engenheiro no teste')$$,
  'Engenheiro aprova um RDO enviado pelo fluxo autorizado'
);
select is(
  (select count(*) from public.auditorias_rdo where rdo_id = '77777777-7777-4777-8777-777777777775' and acao = 'approved'),
  1::bigint,
  'A aprovação do engenheiro também fica registrada'
);

-- A mesma unidade, data e disciplina não podem ter dois RDOs ativos.
reset role;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local role authenticated;

select is_empty(
  $$update public.rdos set engenheiro_obs = 'Alteração bloqueada' where id = '77777777-7777-4777-8777-777777777772' returning id$$,
  'Responsável não altera o RDO depois da aprovação'
);
select throws_ok(
  $$insert into public.rdos (id, user_id, unidade_id, numero, data, disciplina, status) values ('77777777-7777-4777-8777-777777777776', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'RLS-DUP', '2026-10-01', 'civil', 'draft')$$,
  '23505',
  'Banco rejeita RDO ativo duplicado para unidade, data e disciplina'
);

-- Administrador: pode gerir perfis, mas não altera nem apaga fisicamente RDO aprovado.
reset role;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local role authenticated;

select is(
  (select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Administrador consulta o perfil de outra pessoa'
);
select results_eq(
  $$update public.profiles set profile = 'supervisor' where id = '11111111-1111-4111-8111-111111111111' returning profile$$,
  $$select 'supervisor'::text$$,
  'Administrador pode alterar o perfil de outra pessoa'
);
select is_empty(
  $$update public.rdos set engenheiro_obs = 'Alteração bloqueada' where id = '77777777-7777-4777-8777-777777777773' returning id$$,
  'Administrador não altera RDO aprovado'
);
select throws_ok(
  $$delete from public.rdos where id = '77777777-7777-4777-8777-777777777773'$$,
  '42501',
  'API não apaga RDO fisicamente e preserva o histórico'
);
select is(
  (select count(*) from public.scheduled_exports),
  2::bigint,
  'Administrador consulta todos os agendamentos'
);
select is(
  (select count(*) from public.export_history),
  2::bigint,
  'Administrador consulta todo o histórico de exportações'
);
select is(
  (select count(*) from public.cron_execution_log),
  1::bigint,
  'Administrador consulta os logs de automação'
);
select results_eq(
  $$update public.scheduled_exports set name = 'Atualizado pelo admin' where id = '88888888-8888-4888-8888-888888888882' returning name$$,
  $$select 'Atualizado pelo admin'::text$$,
  'Administrador pode gerir agendamento de outra pessoa'
);
select lives_ok(
  $$insert into public.unidades (codigo, nome) values ('RLS-CRIADA-PELO-ADMIN', 'Unidade criada pelo admin')$$,
  'Administrador consegue cadastrar unidade'
);

reset role;

select ok(
  (select not public from storage.buckets where id = 'evidencias'),
  'Bucket de evidências permanece privado'
);
select is(
  (select file_size_limit from storage.buckets where id = 'evidencias'),
  10485760::bigint,
  'Bucket limita cada arquivo a 10 MiB'
);
select ok(
  (select array['image/jpeg', 'image/png', 'image/webp']::text[] <@ allowed_mime_types from storage.buckets where id = 'evidencias'),
  'Bucket aceita apenas os formatos de imagem configurados'
);

select * from finish();
rollback;
