insert into public.funcoes (nome)
select defaults.nome
from (values
  ('Engenheiro(a) civil'),
  ('Encarregado(a)'),
  ('Técnico(a) de segurança do trabalho'),
  ('Eletricista'),
  ('Instrumentista'),
  ('Montador(a)'),
  ('Soldador(a)'),
  ('Operador(a) de máquinas'),
  ('Motorista'),
  ('Pedreiro(a)'),
  ('Servente'),
  ('Ajudante')
) as defaults(nome)
where not exists (
  select 1
  from public.funcoes existing
  where lower(existing.nome) = lower(defaults.nome)
);

insert into public.equipamentos (nome, unidade_id)
select defaults.nome, null
from (values
  ('Retroescavadeira'),
  ('Escavadeira'),
  ('Caminhão'),
  ('Guindaste'),
  ('Plataforma elevatória'),
  ('Gerador'),
  ('Compressor'),
  ('Betoneira')
) as defaults(nome)
where not exists (
  select 1
  from public.equipamentos existing
  where existing.unidade_id is null
    and lower(existing.nome) = lower(defaults.nome)
);
