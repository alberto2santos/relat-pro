# Integração com TOTVS Protheus

O app envia RDOs aprovados a um endpoint REST configurado pelo cliente. Como o Protheus é customizável, não existe um contrato universal: valide o endpoint, a autenticação e os campos com a equipe responsável pelo ERP antes de habilitar o envio em produção. A integração não grava diretamente nas tabelas do Protheus.

## Fluxo

1. Um revisor aprova um RDO.
2. Na mesma transação, o banco cria um evento pendente em `public.rdo_erp_sync_events`.
3. A aplicação chama a Edge Function `sync-approved-rdo`, que monta o payload no servidor e envia um `POST` HTTPS.
4. O resultado, tentativas e erros ficam registrados para consulta em **Administração → Integração Protheus**. Um administrador pode reenviar eventos pendentes ou com falha.

O reenvio manual cobre eventos persistidos que não chegaram a ser enviados. Não há retentativa automática implementada nesta versão.

## Deploy e segredos

Depois de aplicar as migrations, implante a função e configure as credenciais no Supabase:

```bash
npx supabase functions deploy sync-approved-rdo
npx supabase secrets set PROTHEUS_RDO_ENDPOINT="https://servidor-erp.exemplo/api/rdo" PROTHEUS_RDO_AUTHORIZATION="VALOR_FORNECIDO_PELA_EQUIPE_ERP"
```

`PROTHEUS_RDO_ENDPOINT` deve ser HTTPS. `PROTHEUS_RDO_AUTHORIZATION` é enviado como o valor completo do cabeçalho HTTP `Authorization`; use o formato exigido pelo endpoint real. Mantenha ambos apenas nos segredos do Supabase. Nunca os coloque em variáveis `VITE_*`, no frontend, em tabelas públicas ou no repositório.

A tela administrativa informa se os segredos foram configurados e apresenta o histórico de envios.

## Contrato de exemplo

O endpoint deve aceitar JSON e responder com um status HTTP `2xx` quando processar a requisição. Os campos e valores abaixo ilustram o contrato enviado; ajuste a integração para o ERP do cliente quando necessário:

```json
{
  "eventId": "identificador único do evento",
  "event": "rdo.approved",
  "source": "voltseit-rdo",
  "schemaVersion": 2,
  "rdo": {
    "id": "identificador do RDO no Relat Pro RDO",
    "number": "número do RDO",
    "date": "2026-11-04",
    "unit": { "code": "UN01", "name": "Unidade" },
    "discipline": "eletrica",
    "plannedHours": 8,
    "performedHours": 7.5,
    "notes": { "engineer": null, "coordination": null },
    "weather": {
      "condition": "Parcialmente nublado",
      "temperatureCelsius": 26.5,
      "source": "automatico"
    },
    "materials": [
      { "description": "Cabo", "quantity": 10, "unit": "m" }
    ],
    "workforce": [
      {
        "functionId": "identificador da função",
        "functionName": "Eletricista",
        "quantity": 4,
        "hoursWorked": 8,
        "employeeId": null,
        "registrationNumber": null,
        "name": null
      }
    ],
    "equipment": [
      {
        "equipmentId": "identificador do equipamento",
        "name": "Plataforma elevatória",
        "externalId": null,
        "hoursUsed": 3.5,
        "notes": null
      }
    ],
    "occurrences": [
      {
        "type": "chuva",
        "description": "Paralisação por chuva forte",
        "start": "2026-11-04T14:00:00-03:00",
        "end": "2026-11-04T15:00:00-03:00",
        "impactHours": 1,
        "responsible": null
      }
    ]
  }
}
```

Cada chamada também inclui `Idempotency-Key: <eventId>`. O endpoint deve usar essa chave para não criar lançamentos duplicados quando um evento for reenviado. Fotos, assinaturas, URLs de evidências e credenciais não são enviados.

`schemaVersion: 2` identifica o modelo canônico ampliado. Os campos anteriores e o evento `rdo.approved` são mantidos; `weather`, `workforce`, `equipment` e `occurrences` são blocos aditivos. Clientes que ainda consomem o formato anterior podem ignorar os campos novos. O envio é feito pelo servidor a partir dos dados persistidos e só inclui registros que pertencem ao RDO aprovado.

O valor de `source` faz parte do contrato atualmente enviado ao ERP. Embora a marca da aplicação tenha mudado para Relat Pro RDO, esse campo permanece `voltseit-rdo` por compatibilidade; não o altere sem validar a mudança com a equipe responsável pelo Protheus e versionar o contrato.

## Diagnóstico

- **Endpoint ou credencial não configurados:** confira os nomes dos segredos com `npx supabase secrets list` e confirme que o endpoint começa com `https://`.
- **Resposta de erro do ERP:** confira a mensagem, o status HTTP e o histórico na tela de integração; valide autenticação, contrato e campos obrigatórios com a equipe Protheus.
- **Evento pendente ou com falha:** após corrigir a configuração ou o serviço ERP, use o reenvio administrativo. A chave de idempotência deve ser respeitada pelo endpoint.
- **Tela administrativa indisponível:** confirme que as migrations foram aplicadas e que o usuário autenticado possui perfil `admin`.

Veja também [configuração do Supabase](supabase.md).
