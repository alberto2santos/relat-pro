# Arquitetura e regras de negócio

## Tecnologias

- **Frontend:** React 19, TypeScript, Vite 7 e React Router 6.
- **Estilos e acessibilidade:** Tailwind CSS 3, Geist Variable, tokens CSS, componentes compartilhados e navegação responsiva.
- **Dados:** Supabase Auth, Postgres, Storage e TanStack Query 5.
- **Validação de formulários:** React Hook Form e Zod.
- **Gráficos:** Recharts.
- **Exportação:** ExcelJS (XLSX), serviço próprio (CSV) e jsPDF (PDF).
- **PWA:** `vite-plugin-pwa` e Workbox.
- **Backend e banco:** Supabase Edge Functions (Deno), PostgreSQL e pgTAP.

## Estrutura

```text
src/
├── components/       # Interface, formulários, gráficos e navegação
│   ├── layout/       # Cabeçalho, navegação, rodapé e estrutura das páginas
│   └── ui/           # Componentes visuais compartilhados
├── contexts/         # Contextos compartilhados
├── hooks/            # Autenticação, RDOs e exportações
├── lib/              # Cliente Supabase e utilitários
├── pages/            # Páginas e áreas administrativas
├── services/         # Geração de arquivos e serviços de domínio
├── styles/           # Tokens e estilos globais
├── types/            # Tipos da aplicação e do banco
└── utils/            # Funções auxiliares
supabase/
├── diagnostics/      # Consultas de diagnóstico
├── functions/        # invite-employee e sync-approved-rdo
├── migrations/       # Estrutura do banco, políticas e ajustes
├── tests/database/   # Testes pgTAP
├── config.toml       # Configuração do Supabase local
└── seed.sql          # Seed sem unidades específicas de uma obra
.github/
├── workflows/        # CI
└── dependabot.yml    # Atualizações automatizadas
docs/                 # Documentação de operação e arquitetura
```

## Perfis e permissões

Os perfis são `admin`, `supervisor`, `engenheiro` e `encarregado`. A interface e as políticas RLS do Supabase aplicam as permissões em conjunto.

| Ação | Perfis |
| --- | --- |
| Consultar todos os RDOs ativos | `admin`, `supervisor`, `engenheiro` |
| Consultar apenas os próprios RDOs | `encarregado` |
| Criar RDO em nome próprio | Todos |
| Editar RDO em rascunho ou rejeitado | Responsável pelo RDO, `admin`, `supervisor`, `engenheiro` |
| Enviar o próprio RDO para revisão | Todos |
| Aprovar ou rejeitar RDO enviado | `admin`, `supervisor`, `engenheiro` |
| Painel executivo, gestão de usuários, automações e integração ERP | `admin` |
| Agendamentos e histórico de exportações | `admin`, `supervisor` |

**RDO aprovado é imutável na aplicação:** nenhum perfil pode editar ou reabrir um relatório aprovado. O app não oferece fluxo de retificação nem reversão de aprovação; correções devem seguir o procedimento formal definido para a obra.

## Ciclo do RDO e evidências

O fluxo de status é `draft` (rascunho) → `submitted` (enviado) → `approved` (aprovado) ou `rejected` (rejeitado). Um RDO rejeitado pode ser corrigido por quem tem permissão e enviado novamente. Aprovação e rejeição são ações de revisão controladas no banco; rejeição pode incluir comentário. Fotos podem ser anexadas por quem tem acesso ao RDO enquanto estiver em rascunho, rejeitado ou enviado para revisão; o anexo é registrado no histórico. RDOs aprovados não aceitam novos anexos.

Fotos e assinaturas ficam no bucket privado `evidencias`. Os formatos aceitos são JPEG, PNG e WebP, com limite de 10 MiB por arquivo. Os links temporários para exibição expiram em 10 minutos.

## Uso offline e dados locais

Após autenticar e carregar as unidades ao menos uma vez online, o formulário pode usar o perfil, unidades e cadastros de funções/equipamentos em cache e salvar rascunhos, fotos, assinaturas e envios pendentes no IndexedDB do navegador. Rascunhos e envios são associados ao ID do usuário; os dados locais não são apagados ao sair da conta e não são criptografados pela aplicação. Em aparelho compartilhado, a próxima pessoa deve encerrar a sessão antes de usar sua própria conta. Não há aviso nem bloqueio de logout por envios pendentes.

O salvamento do RDO e das seções operacionais usa a RPC transacional `salvar_rdo_completo`, com controle otimista pela coluna `version` e chave de idempotência. Uma versão-base desatualizada não sobrescreve o servidor: a edição exibe a versão local e a do servidor e permite escolher cada campo/seção, preservar o local como novo RDO ou aceitar a versão do servidor, sempre com confirmação antes de descartar dados locais.

Fotos e assinatura permanecem em uma fila separada, com IDs e caminhos estáveis; o estado de cada arquivo é guardado localmente. O RDO só transita para `submitted` depois que a gravação operacional, os uploads e os registros de evidência forem concluídos. Falhas mantêm o envio e o motivo no dispositivo; conflitos e erros permanentes (por exemplo, permissão, unidade arquivada ou duplicidade) ficam bloqueados para nova tentativa automática e exigem resolução ou reenvio manual. Falhas recuperáveis de conexão podem ser tentadas novamente ao recuperar a conexão, com o app aberto ou na próxima abertura. Não há execução com o navegador totalmente fechado nem painel central para consultar todas as pendências.

O payload do rascunho e da fila fica em armazenamento local sem criptografia pela aplicação e não possui prazo automático de expiração. Após sincronização bem-sucedida, a entrada da fila é removida e o rascunho correspondente é excluído se não tiver sido alterado depois do envio. Limpar os dados do navegador ou a remoção de armazenamento pelo sistema operacional pode apagar dados que ainda não foram sincronizados. Cache de perfil, unidades e cadastros operacionais permanece até ser atualizado ou removido ao limpar os dados do navegador.

O service worker pré-armazena os arquivos estáticos da aplicação para permitir abrir o shell do PWA; não configura cache de respostas autenticadas da API Supabase. O cache estático é compartilhado como conteúdo da aplicação e não é apagado no logout. Os dados por usuário ficam no IndexedDB, não nesse cache.

## Funcionalidades e limitações conhecidas

- O formulário permite duplicar dados estruturais do RDO anterior mais recente da mesma unidade e disciplina: HH planejado, materiais, funções/efetivo e equipamentos. Horas realizadas e de uso são zeradas; ocorrências, clima, número, data, fotos e assinatura não são copiados. Os dados copiados ficam destacados para conferência.
- Efetivo, equipamentos e ocorrências são salvos em tabelas próprias com RLS e trilha de auditoria. Apenas RDOs em rascunho ou rejeitados podem receber alterações operacionais.
- O RDO e suas seções operacionais são gravados atomicamente; as alterações diretas nas linhas filhas também incrementam a versão do agregado. A migration adiciona testes pgTAP para concorrência, permissões, duplicidade e rollback.
- O clima pode ser consultado na Open-Meteo sem chave, conforme as coordenadas da unidade; falhas da API não bloqueiam o preenchimento e permitem entrada manual. O catálogo de tipos de ocorrência é fornecido pelo banco.
- CSV e XLSX neutralizam células textuais que começam por `=`, `+`, `-` ou `@`; as exportações incluem o clima e as novas seções operacionais.
- Unidades de obra são específicas de cada projeto, não existem unidades de exemplo no seed e podem ser gerenciadas por administradores.
- Unidades de medida dos materiais são pré-definidas; valores legados não padronizados são preservados.
- O tema claro/escuro é persistente no navegador; status usam ícone e texto além de cor. Os gráficos executivos usam cores da paleta Okabe-Ito.
- Não há teste automatizado de ponta a ponta que simule perda e retorno de conexão durante o preenchimento e a sincronização offline.
- Exportações agendadas podem ser cadastradas, porém a execução e o envio de e-mails requerem um backend adicional.
- A integração Protheus envia eventos de RDO aprovado ao endpoint REST configurado. Não há contrato universal nem retentativa automática.

Para configuração operacional, veja [Supabase](supabase.md) e [integração Protheus](integracao-protheus.md).
