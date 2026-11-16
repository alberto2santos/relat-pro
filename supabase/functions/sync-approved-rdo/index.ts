import { withSupabase } from 'npm:@supabase/server@1';

const reviewers = ['admin', 'supervisor', 'engenheiro'];
const staleProcessingMinutes = 10;

interface SyncRequest {
  action?: unknown;
  eventId?: unknown;
  retry?: unknown;
}

interface RdoRow {
  id: string;
  numero: string | null;
  data: string;
  hh_planejado: number;
  hh_realizado: number | null;
  disciplina: string | null;
  engenheiro_obs: string | null;
  coordenador_obs: string | null;
  clima_condicao: string | null;
  clima_temperatura: number | null;
  clima_origem: 'automatico' | 'manual' | null;
  unidades: { codigo: string; nome: string | null } | null;
}

interface RdoMaterial {
  material: string;
  quantidade: number;
  unidade_medida: string | null;
}

interface RdoWorkforce {
  funcao_id: string;
  quantidade: number;
  horas_trabalhadas: number;
  matricula: string | null;
  nome: string | null;
  identificador_externo: string | null;
  funcoes: { nome: string } | null;
}

interface RdoEquipment {
  equipamento_id: string;
  horas_uso: number;
  observacao: string | null;
  equipamentos: { nome: string; identificador_externo: string | null } | null;
}

interface RdoOccurrence {
  tipo: string;
  descricao: string;
  inicio: string | null;
  fim: string | null;
  horas_impacto: number;
  responsavel: string | null;
}

const isRdoRow = (value: unknown): value is RdoRow => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const unit = row.unidades;
  const hasValidUnit = unit === null || (
    typeof unit === 'object'
    && !Array.isArray(unit)
    && typeof (unit as Record<string, unknown>).codigo === 'string'
    && ((unit as Record<string, unknown>).nome === null || typeof (unit as Record<string, unknown>).nome === 'string')
  );

  return typeof row.id === 'string'
    && (row.numero === null || typeof row.numero === 'string')
    && typeof row.data === 'string'
    && typeof row.hh_planejado === 'number'
    && (row.hh_realizado === null || typeof row.hh_realizado === 'number')
    && (row.disciplina === null || typeof row.disciplina === 'string')
    && (row.engenheiro_obs === null || typeof row.engenheiro_obs === 'string')
    && (row.coordenador_obs === null || typeof row.coordenador_obs === 'string')
    && (row.clima_condicao === null || typeof row.clima_condicao === 'string')
    && (row.clima_temperatura === null || typeof row.clima_temperatura === 'number')
    && (row.clima_origem === null || row.clima_origem === 'automatico' || row.clima_origem === 'manual')
    && hasValidUnit;
};

const isRdoMaterial = (value: unknown): value is RdoMaterial => {
  if (!value || typeof value !== 'object') return false;
  const material = value as Record<string, unknown>;
  return typeof material.material === 'string'
    && typeof material.quantidade === 'number'
    && (material.unidade_medida === null || typeof material.unidade_medida === 'string');
};

const isRdoWorkforce = (value: unknown): value is RdoWorkforce =>
  !!value && typeof value === 'object'
  && typeof (value as Record<string, unknown>).funcao_id === 'string'
  && typeof (value as Record<string, unknown>).quantidade === 'number'
  && typeof (value as Record<string, unknown>).horas_trabalhadas === 'number';

const isRdoEquipment = (value: unknown): value is RdoEquipment =>
  !!value && typeof value === 'object'
  && typeof (value as Record<string, unknown>).equipamento_id === 'string'
  && typeof (value as Record<string, unknown>).horas_uso === 'number';

const isRdoOccurrence = (value: unknown): value is RdoOccurrence =>
  !!value && typeof value === 'object'
  && typeof (value as Record<string, unknown>).tipo === 'string'
  && typeof (value as Record<string, unknown>).descricao === 'string'
  && typeof (value as Record<string, unknown>).horas_impacto === 'number';

const syncConfiguration = () => ({
  endpoint: Deno.env.get('PROTHEUS_RDO_ENDPOINT')?.trim() ?? '',
  authorization: Deno.env.get('PROTHEUS_RDO_AUTHORIZATION')?.trim() ?? '',
});

const isValidHttpsEndpoint = (endpoint: string): boolean => {
  try {
    return new URL(endpoint).protocol === 'https:';
  } catch {
    return false;
  }
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Método não permitido.' }, { status: 405 });
    }

    const userId = context.userClaims?.id;
    if (!userId) return Response.json({ error: 'Sessão inválida.' }, { status: 401 });

    const { data: profile, error: profileError } = await context.supabaseAdmin
      .from('profiles')
      .select('profile')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[sync-approved-rdo] Falha ao consultar o perfil:', profileError.message);
      return Response.json({ error: 'Não foi possível validar as permissões do usuário.' }, { status: 500 });
    }

    if (!profile?.profile || !reviewers.includes(profile.profile)) {
      return Response.json({ error: 'Apenas revisores podem acessar a integração.' }, { status: 403 });
    }

    let body: SyncRequest;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'A solicitação está inválida.' }, { status: 400 });
    }

    if (body.action === 'status') {
      if (profile.profile !== 'admin') {
        return Response.json({ error: 'Apenas administradores podem consultar a integração.' }, { status: 403 });
      }

      const { endpoint, authorization } = syncConfiguration();
      return Response.json({ configured: isValidHttpsEndpoint(endpoint) && Boolean(authorization) });
    }

    if (body.action !== 'sync' || typeof body.eventId !== 'string') {
      return Response.json({ error: 'Informe uma ação e um evento de integração válidos.' }, { status: 400 });
    }

    const retry = body.retry === true;
    if (retry && profile.profile !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem reenviar uma integração.' }, { status: 403 });
    }

    const { endpoint, authorization } = syncConfiguration();
    let endpointUrl: URL;
    try {
      endpointUrl = new URL(endpoint);
    } catch {
      return Response.json({ error: 'A integração do Protheus ainda não está configurada no servidor.' }, { status: 503 });
    }

    if (endpointUrl.protocol !== 'https:' || !authorization) {
      return Response.json({ error: 'Configure um endpoint HTTPS e a credencial do Protheus nos segredos do Supabase.' }, { status: 503 });
    }

    const { data: event, error: eventError } = await context.supabaseAdmin
      .from('rdo_erp_sync_events')
      .select('id, rdo_id, status, attempts, updated_at')
      .eq('id', body.eventId)
      .maybeSingle();

    if (eventError) {
      return Response.json({ error: 'Não foi possível consultar a fila de integração.' }, { status: 500 });
    }
    if (!event) return Response.json({ error: 'Evento de integração não encontrado.' }, { status: 404 });

    const processingIsStale = event.status === 'processing'
      && Date.now() - new Date(event.updated_at).getTime() > staleProcessingMinutes * 60_000;
    const canClaim = event.status === 'pending'
      || (retry && (event.status === 'failed' || processingIsStale));

    if (!canClaim) {
      return Response.json({ error: 'Este evento já foi processado ou está em andamento.' }, { status: 409 });
    }

    const { data: claimedEvent, error: claimError } = await context.supabaseAdmin
      .from('rdo_erp_sync_events')
      .update({
        status: 'processing',
        attempts: event.attempts + 1,
        error_message: null,
        response_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id)
      .eq('status', event.status)
      .eq('updated_at', event.updated_at)
      .select('id, rdo_id')
      .maybeSingle();

    if (claimError || !claimedEvent) {
      return Response.json({ error: 'Outro processo já está tratando este evento.' }, { status: 409 });
    }

    const finishEvent = async (values: {
      status: 'succeeded' | 'failed';
      response_status: number | null;
      erp_reference?: string | null;
      error_message?: string | null;
      synced_at: string | null;
    }): Promise<boolean> => {
      const { error } = await context.supabaseAdmin
        .from('rdo_erp_sync_events')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', claimedEvent.id)
        .eq('status', 'processing');
      if (error) console.error('[sync-approved-rdo] Falha ao atualizar o evento:', error.message);
      return !error;
    };

    const { data: rdo, error: rdoError } = await context.supabaseAdmin
      .from('rdos')
      .select('id, numero, data, hh_planejado, hh_realizado, disciplina, engenheiro_obs, coordenador_obs, clima_condicao, clima_temperatura, clima_origem, unidades(codigo, nome)')
      .eq('id', claimedEvent.rdo_id)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .maybeSingle();

    if (rdoError || !isRdoRow(rdo)) {
      const message = 'O RDO aprovado não está disponível para sincronização.';
      const saved = await finishEvent({
        status: 'failed',
        response_status: null,
        error_message: message,
        synced_at: null,
      });
      if (!saved) return Response.json({ error: 'Não foi possível registrar a falha de sincronização.' }, { status: 500 });
      return Response.json({ error: message }, { status: 409 });
    }

    const { data: materials, error: materialsError } = await context.supabaseAdmin
      .from('materiais_rdo')
      .select('material, quantidade, unidade_medida')
      .eq('rdo_id', claimedEvent.rdo_id)
      .is('deleted_at', null);

    if (materialsError || !Array.isArray(materials) || !materials.every(isRdoMaterial)) {
      const message = 'Não foi possível carregar os materiais do RDO aprovado.';
      const saved = await finishEvent({
        status: 'failed',
        response_status: null,
        error_message: message,
        synced_at: null,
      });
      if (!saved) return Response.json({ error: 'Não foi possível registrar a falha de sincronização.' }, { status: 500 });
      return Response.json({ error: message }, { status: 500 });
    }

    const [workforceResult, equipmentResult, occurrencesResult] = await Promise.all([
      context.supabaseAdmin.from('rdo_efetivo').select('funcao_id, quantidade, horas_trabalhadas, matricula, nome, identificador_externo, funcoes(nome)').eq('rdo_id', claimedEvent.rdo_id),
      context.supabaseAdmin.from('rdo_equipamentos').select('equipamento_id, horas_uso, observacao, equipamentos(nome, identificador_externo)').eq('rdo_id', claimedEvent.rdo_id),
      context.supabaseAdmin.from('rdo_ocorrencias').select('tipo, descricao, inicio, fim, horas_impacto, responsavel').eq('rdo_id', claimedEvent.rdo_id),
    ]);

    if (
      workforceResult.error || equipmentResult.error || occurrencesResult.error
      || !Array.isArray(workforceResult.data) || !workforceResult.data.every(isRdoWorkforce)
      || !Array.isArray(equipmentResult.data) || !equipmentResult.data.every(isRdoEquipment)
      || !Array.isArray(occurrencesResult.data) || !occurrencesResult.data.every(isRdoOccurrence)
    ) {
      const message = 'Não foi possível carregar as seções operacionais do RDO aprovado.';
      const saved = await finishEvent({
        status: 'failed',
        response_status: null,
        error_message: message,
        synced_at: null,
      });
      if (!saved) return Response.json({ error: 'Não foi possível registrar a falha de sincronização.' }, { status: 500 });
      return Response.json({ error: message }, { status: 500 });
    }

    const approvedRdo = rdo;
    const payload = {
      schemaVersion: 2,
      eventId: claimedEvent.id,
      event: 'rdo.approved',
      source: 'voltseit-rdo',
      rdo: {
        id: approvedRdo.id,
        number: approvedRdo.numero,
        date: approvedRdo.data,
        unit: approvedRdo.unidades
          ? { code: approvedRdo.unidades.codigo, name: approvedRdo.unidades.nome }
          : null,
        discipline: approvedRdo.disciplina,
        plannedHours: approvedRdo.hh_planejado,
        performedHours: approvedRdo.hh_realizado,
        notes: {
          engineer: approvedRdo.engenheiro_obs,
          coordination: approvedRdo.coordenador_obs,
        },
        weather: {
          condition: approvedRdo.clima_condicao,
          temperatureCelsius: approvedRdo.clima_temperatura,
          source: approvedRdo.clima_origem,
        },
        materials: materials.map((material) => ({
          description: material.material,
          quantity: material.quantidade,
          unit: material.unidade_medida,
        })),
        workforce: workforceResult.data.map((entry) => ({
          functionId: entry.funcao_id,
          functionName: entry.funcoes?.nome ?? null,
          quantity: entry.quantidade,
          hoursWorked: entry.horas_trabalhadas,
          employeeId: entry.identificador_externo,
          registrationNumber: entry.matricula,
          name: entry.nome,
        })),
        equipment: equipmentResult.data.map((entry) => ({
          equipmentId: entry.equipamento_id,
          name: entry.equipamentos?.nome ?? null,
          externalId: entry.equipamentos?.identificador_externo ?? null,
          hoursUsed: entry.horas_uso,
          notes: entry.observacao,
        })),
        occurrences: occurrencesResult.data.map((entry) => ({
          type: entry.tipo,
          description: entry.descricao,
          start: entry.inicio,
          end: entry.fim,
          impactHours: entry.horas_impacto,
          responsible: entry.responsavel,
        })),
      },
    };

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
          'Idempotency-Key': claimedEvent.id,
        },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        const message = `O Protheus respondeu com HTTP ${response.status}.`;
        const saved = await finishEvent({
          status: 'failed',
          response_status: response.status,
          error_message: message,
          synced_at: null,
        });
        if (!saved) return Response.json({ error: 'Não foi possível registrar a resposta do Protheus.' }, { status: 500 });
        return Response.json({ error: message }, { status: 502 });
      }

      let erpReference: string | null = null;
      try {
        const responseBody: unknown = await response.json();
        if (responseBody && typeof responseBody === 'object' && 'id' in responseBody) {
          const value = responseBody.id;
          if (typeof value === 'string' || typeof value === 'number') {
            erpReference = String(value).slice(0, 200);
          }
        }
      } catch {
        // A API pode confirmar a gravação sem retornar um corpo JSON.
      }

      const syncedAt = new Date().toISOString();
      const saved = await finishEvent({
        status: 'succeeded',
        response_status: response.status,
        erp_reference: erpReference,
        error_message: null,
        synced_at: syncedAt,
      });
      if (!saved) return Response.json({ error: 'O Protheus recebeu o RDO, mas não foi possível registrar a confirmação.' }, { status: 500 });
      return Response.json({ status: 'succeeded', syncedAt, erpReference });
    } catch (error) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? 'Tempo limite excedido ao conectar ao Protheus.'
        : 'Não foi possível conectar ao endpoint do Protheus.';
      const saved = await finishEvent({
        status: 'failed',
        response_status: null,
        error_message: message,
        synced_at: null,
      });
      if (!saved) return Response.json({ error: 'A conexão falhou e também não foi possível registrar a falha.' }, { status: 500 });
      console.error('[sync-approved-rdo] Falha na chamada ao ERP:', error);
      return Response.json({ error: message }, { status: 502 });
    }
  }),
};
