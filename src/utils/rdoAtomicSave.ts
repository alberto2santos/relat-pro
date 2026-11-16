export interface AtomicRdoSaveInput {
  numero: string;
  data: string;
  unidade_id: string;
  hh_planejado: number;
  hh_realizado?: number | null;
  disciplina?: string | null;
  engenheiro_obs?: string | null;
  coordenador_obs?: string | null;
  clima_condicao?: string | null;
  clima_temperatura?: number | null;
  clima_origem?: string | null;
  materials: Array<{
    id?: string;
    material: string;
    quantidade: number;
    unidade_medida?: string | null;
  }>;
  workforce: Array<{
    id?: string;
    funcao_id: string;
    quantidade: number;
    horas_trabalhadas: number;
    matricula?: string | null;
    nome?: string | null;
    identificador_externo?: string | null;
  }>;
  equipment: Array<{
    id?: string;
    equipamento_id: string;
    horas_uso: number;
    observacao?: string | null;
  }>;
  occurrences: Array<{
    id?: string;
    tipo: string;
    descricao: string;
    inicio?: string | null;
    fim?: string | null;
    horas_impacto: number;
    responsavel?: string | null;
  }>;
}

export type AtomicRdoSaveResult =
  | { ok: true; version: number; idempotent: boolean }
  | {
    ok: false;
    code: string;
    message: string;
    serverVersion: number | null;
    serverSnapshot: Record<string, unknown> | null;
  };

export type RdoSyncQueueStatus = 'pending' | 'conflict' | 'intervention';

export function getAtomicRdoRpcErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === 'PGRST202') {
    return [
      'O Supabase não encontrou a função salvar_rdo_completo no schema cache.',
      'O RDO continua salvo neste dispositivo.',
      'Confirme se o projeto Supabase correto está vinculado e se as migrations foram aplicadas com "npx supabase db push --dry-run" e, após conferir o destino, "npx supabase db push".',
      "Se a migration já foi aplicada, atualize o schema cache no SQL Editor com NOTIFY pgrst, 'reload schema'. Depois, tente sincronizar novamente.",
    ].join(' ');
  }
  return error.message;
}

const MANUAL_RESOLUTION_CODES = new Set([
  'VERSION_CONFLICT',
  'STATE_NOT_EDITABLE',
  'UNIT_ARCHIVED',
  'DUPLICATE_RDO',
  'PERMISSION_DENIED',
  'INVALID_PAYLOAD',
  'INVALID_REFERENCE',
  'CHILD_ID_CONFLICT',
  'IDEMPOTENCY_KEY_REUSED',
  'REQUIRES_INTERVENTION',
]);

export function getRdoSyncQueueStatus(code?: string): RdoSyncQueueStatus {
  if (code === 'VERSION_CONFLICT') return 'conflict';
  return code && MANUAL_RESOLUTION_CODES.has(code) ? 'intervention' : 'pending';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getChildId(id: string | undefined): string {
  return id || crypto.randomUUID();
}

export function buildAtomicRdoPayload(requestId: string, values: AtomicRdoSaveInput) {
  return {
    request_id: requestId,
    numero: values.numero,
    data: values.data,
    unidade_id: values.unidade_id,
    hh_planejado: values.hh_planejado,
    hh_realizado: values.hh_realizado ?? null,
    disciplina: values.disciplina ?? null,
    engenheiro_obs: values.engenheiro_obs ?? null,
    coordenador_obs: values.coordenador_obs ?? null,
    clima_condicao: values.clima_condicao ?? null,
    clima_temperatura: values.clima_temperatura ?? null,
    clima_origem: values.clima_origem ?? null,
    materials: values.materials.map((entry) => ({ ...entry, id: getChildId(entry.id) })),
    workforce: values.workforce.map((entry) => ({ ...entry, id: getChildId(entry.id) })),
    equipment: values.equipment.map((entry) => ({ ...entry, id: getChildId(entry.id) })),
    occurrences: values.occurrences.map((entry) => ({
      ...entry,
      id: getChildId(entry.id),
      inicio: entry.inicio ? new Date(entry.inicio).toISOString() : null,
      fim: entry.fim ? new Date(entry.fim).toISOString() : null,
    })),
  };
}

export function parseAtomicRdoSaveResult(value: unknown): AtomicRdoSaveResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      code: 'SAVE_FAILED',
      message: 'O servidor não confirmou o salvamento atômico do RDO.',
      serverVersion: null,
      serverSnapshot: null,
    };
  }
  if (value.ok === true && typeof value.version === 'number') {
    return {
      ok: true,
      version: value.version,
      idempotent: value.idempotent === true,
    };
  }
  return {
    ok: false,
    code: typeof value.code === 'string' ? value.code : 'SAVE_FAILED',
    message: typeof value.message === 'string'
      ? value.message
      : 'O servidor não confirmou o salvamento atômico do RDO.',
    serverVersion: typeof value.server_version === 'number' ? value.server_version : null,
    serverSnapshot: isRecord(value.server_data) ? value.server_data : null,
  };
}
