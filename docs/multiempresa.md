# Plano de isolamento multiempresa

**Status: proposta para revisão.** Este documento descreve a arquitetura e a migração recomendadas; não altera o schema nem ativa isolamento multiempresa. A implementação só deve começar após aprovação.

## Modelo de dados

- `organizacoes`: uma linha por empresa/cliente, com UUID, nome, slug opcional, estado ativo/arquivado e timestamps.
- `organizacao_membros`: vínculo N:N entre `auth.users` e organizações, com `organizacao_id`, `user_id`, `perfil`, estado do vínculo, timestamps e chave única `(organizacao_id, user_id)`. O perfil pertence ao vínculo: a mesma pessoa pode, por exemplo, ser `admin` em uma empresa e `engenheiro` em outra.
- `profiles` permanece como identidade global compatível com Auth: nome, e-mail e dados de conta. `profiles.profile` não deve ser removido na primeira etapa; passa a ser apenas um campo legado para compatibilidade temporária, não uma fonte de autorização.
- `organizacao_id` será obrigatório em `unidades`. Os RDOs obtêm sua organização pela unidade, sem coluna duplicada em `rdos` ou nas tabelas filhas. Essa herança evita estados inconsistentes (RDO e unidade em empresas diferentes) e reduz redundância; as políticas e constraints precisam validar essa relação em cada acesso/escrita.
- Catálogos `funcoes`, `equipamentos` e `tipos_ocorrencia` devem ser classificados antes da implementação: tipos de ocorrência podem permanecer globais e somente leitura; funções/equipamentos devem ganhar escopo de organização ou ser explicitamente globais, com regra de visibilidade e integridade referencial definida.

## Migração dos dados existentes

1. Criar uma organização padrão, inicialmente com nome configurável (por exemplo, “Organização padrão”), sem inventar o nome jurídico do cliente.
2. Atribuir todas as unidades existentes à organização padrão; a organização dos RDOs e seus filhos será inferida pela unidade.
3. Criar um vínculo em `organizacao_membros` para cada usuário existente, copiando `profiles.profile` para o perfil desse vínculo e mantendo `profiles` intacta.
4. Atribuir convites pendentes à organização padrão e copiar o perfil do convite para a associação futura.
5. Migrar os catálogos globais atuais para a organização padrão ou preservá-los como globais, conforme decisão de produto; não misturar os dois modelos implicitamente.
6. Validar contagens, vínculos sem unidade/membro, duplicidades e amostras de RLS antes de tornar `organizacao_id` obrigatório.
7. Implantar primeiro as colunas/tabelas e funções compatíveis; atualizar clientes e Edge Functions; só então trocar as políticas para usar membership. Manter a leitura do perfil legado durante uma janela de compatibilidade e removê-la em migration posterior.

## Autorização e políticas

Criar uma função central estável, por exemplo `private.current_organization_role(target_organization_id uuid)`, que deriva o usuário de `(select auth.uid())`, consulta `organizacao_membros`, exige membro ativo e usa `SECURITY DEFINER` somente se necessário, com `set search_path = ''`, referências qualificadas e `EXECUTE` revogado de `public`/`anon`. Para validar um RDO, uma função central equivalente deve resolver `rdos.unidade_id → unidades.organizacao_id` e chamar a checagem de membro/perfil. Todas as políticas devem usar esse caminho único, em vez de duplicar regras locais.

| Tabela / recurso | Leitura proposta | Escrita proposta |
|---|---|---|
| `organizacoes` | Membros ativos da organização | Admin da própria organização; alterações de estado com proteção adicional |
| `organizacao_membros` | Próprio vínculo e membros da mesma organização, segundo necessidade do produto | Admin da organização; impedir autoelevação e remoção do último admin |
| `profiles` | Próprio perfil; dados mínimos de colegas somente quando necessário | Próprio nome/dados permitidos; perfil nunca mais alterado por cliente |
| `unidades`, `instrumentos` | Membros ativos da organização associada | Admin da organização |
| `rdos` | Dono dentro da organização; revisão por perfil autorizado **na mesma organização** | Dono/editors permitidos em estado editável e membros da mesma organização |
| `materiais_rdo`, `evidencias_rdo`, `auditorias_rdo`, `rdo_efetivo`, `rdo_equipamentos`, `rdo_ocorrencias` | Herdar autorização do RDO pai | Herdar permissão de escrita do RDO pai; auditoria permanece append-only |
| `funcoes`, `equipamentos`, `tipos_ocorrencia` | Membros da organização proprietária ou todos, se catálogo explicitamente global | Admin da organização; tipos globais alterados somente por migração/serviço privilegiado |
| `scheduled_exports`, `export_history` | Membro e organização da agenda; escopo global de administrador removido | Dono autorizado ou admin da mesma organização |
| `rdo_erp_sync_events` | Admin/operador ERP da organização do RDO | Somente trigger/serviço de backend |
| `employee_invitations` | Somente fluxo administrativo da organização | Edge Function/serviço; sem escrita direta do cliente |
| `cron_execution_log` | Apenas administradores da organização ou monitor operacional sem payload sensível | Somente serviço |

Qualquer view deve usar `security_invoker = true` ou uma função com autorização equivalente. RPCs precisam validar a associação e o perfil no servidor, inclusive as que usam `SECURITY DEFINER`; não confiar em `user_metadata` nem em `organizacao_id` fornecido sem checagem.

## Storage

Padronizar novos objetos como `<organizacao_id>/<rdo_id>/<arquivo-id>.<extensão>`. Atualizar, em conjunto, upload, download, assinatura de URL, exclusão e leitura dos caminhos já salvos. As policies devem validar o primeiro segmento como UUID da organização e o segundo como RDO pertencente àquela organização, além do papel e estado do RDO. A migração precisa mover objetos existentes do caminho `<rdo_id>/...` para o caminho prefixado e atualizar `evidencias_rdo.url`; preservar uma tabela de correspondência/reexecução até validar contagens e downloads. Não tornar o bucket público.

## Convites e associação

O convite deve carregar `organizacao_id` e `perfil` do vínculo, e o criador deve ser admin dessa organização. A Edge Function valida o vínculo do emissor no servidor, impede escolher outra organização via payload sem autorização e grava a associação pendente na mesma operação lógica do convite. No aceite, a associação é criada/transicionada e o usuário não escolhe nem altera o próprio perfil. Usuários existentes podem pertencer a várias organizações; a seleção de organização ativa no app é contexto de navegação, nunca uma autorização.

## Integração ERP

Adicionar `organizacao_id` ao evento de integração (ou resolver a organização pelo RDO e armazená-la como snapshot imutável do evento). Configuração e segredos devem ser selecionados por organização no backend; credenciais continuam em Secrets/Vault, nunca em tabela legível pelo cliente. A Edge Function deve consultar o evento autorizado no servidor, confirmar organização/perfil, selecionar endpoint e segredo correspondentes e impedir que IDs ou payload enviados pelo navegador escolham uma empresa. Preservar `eventId` e idempotência. Versionar o contrato antes de acrescentar identificador de empresa ao payload Protheus; não alterar `source` sem coordenação com o ERP.

## Exportações e modo offline

- Exportações, filtros, agendas e histórico devem ser limitados aos RDOs/unidades da organização do membro; revalidar filtros recebidos pelo backend, não só a lista carregada no navegador.
- A fila offline deve armazenar `organizacao_id` junto ao usuário, unidade e RDO, e ao sincronizar verificar membership vigente e correspondência entre unidade e organização. Se o membro foi removido ou a unidade mudou de escopo, manter o pacote local, exibir conflito/erro e não tentar migrar dados automaticamente.
- IndexedDB deve particionar rascunhos, catálogos e fila por usuário e organização. Logout, troca de usuário ou troca de organização não deve expor nem excluir silenciosamente dados pendentes.
- Cache de catálogo e queries React Query devem incluir o ID da organização nas chaves; limpar caches no logout/troca de associação.

## Plano de testes pgTAP

Criar pelo menos duas organizações, cada uma com admin, técnico, revisor, unidade, RDO e registros em todas as tabelas filhas. Verificar:

1. leitura/escrita permitida dentro da organização conforme perfil e status;
2. bloqueio cruzado entre organizações em `profiles`, unidades, instrumentos, RDOs, materiais, evidências, auditorias, catálogos, efetivo, equipamentos, ocorrências, agendas/exportações, fila ERP e logs;
3. isolamento de views e RPCs, incluindo chamadas `SECURITY DEFINER` com IDs de outra organização e tentativas de trocar organização/perfil;
4. convites: admin não convida para organização alheia, perfil não pode ser elevado e aceite cria vínculo correto;
5. Storage: upload/download/delete permitidos no prefixo correto e negados com organização/RDO incompatíveis, inclusive em caminho legado;
6. membros com múltiplas organizações e perfis distintos; remoção/arquivamento de membership invalida acesso imediatamente;
7. migração: todas as unidades/RDOs legados resolvem para a organização padrão, sem órfãos;
8. rollback em banco clonado e verificação de contagens antes/depois.

Complementar pgTAP com testes das Edge Functions para convites e integração ERP; não basta testar apenas policies SQL quando a função usa credenciais `service_role`.

## Riscos e decisões pendentes

- Definir se uma conta pode atuar em várias empresas simultaneamente e como seleciona a empresa ativa.
- Confirmar nome/identidade da organização padrão e quem será seu primeiro administrador.
- Definir se catálogos são globais ou independentes por empresa e como preservar histórico ao arquivar itens.
- Um perfil `admin` global em código, RPC ou Edge Function pode quebrar o isolamento mesmo com RLS correta. Buscar e atualizar toda verificação de perfil, não apenas policies.
- Credenciais ERP por organização aumentam risco de seleção indevida; a resolução deve ocorrer exclusivamente no backend e ter testes de não vazamento.
- A migração dos objetos Storage pode falhar parcialmente ou encontrar objetos fora do inventário; registrar progresso e permitir retomada.
- O offline pode tentar enviar depois de revogação de acesso; preservar os dados locais e oferecer resolução explícita é necessário.
- Exportações históricas e logs podem conter dados de mais de uma empresa; decidir retenção, acesso e eventual particionamento.
- Uma única organização padrão preserva os dados atuais, mas não representa automaticamente a estrutura jurídica de clientes futuros.

## Rollback

1. Testar tudo em clone/homologação e guardar backup restaurável do banco e inventário de objetos Storage.
2. Fazer migração em fases aditivas: novas tabelas/colunas, backfill, validação, cliente compatível e, por último, ativação das policies estritas.
3. Manter `profiles.profile`, IDs e caminhos antigos durante o período de observação; não apagar ou renomear esses dados na ativação.
4. Se houver falha antes da ativação das novas policies, interromper o rollout e reverter apenas mudanças aditivas após confirmar que nenhum cliente passou a depender delas.
5. Se o isolamento já estiver ativo, priorizar correção/feature flag de acesso e restauração de backup sobre rollback destrutivo. Reverter policies sem controle pode expor dados entre empresas.
6. Restaurar caminhos Storage e valores `evidencias_rdo.url` a partir do mapa de migração, validar leitura, então remover estruturas temporárias em uma migration posterior.

## Ordem de implementação após aprovação

1. Aprovar decisões de organização padrão, multi-associação e escopo dos catálogos.
2. Implementar schema e backfill, executar relatório de integridade e testes pgTAP.
3. Introduzir helpers centralizados e atualizar RLS, RPCs e Edge Functions.
4. Migrar Storage, convites, integração ERP, exportações e cliente/offline.
5. Validar com dois tenants em homologação e executar revisão de segurança antes de ativar em produção.
