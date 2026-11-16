import { describe, expect, it } from 'vitest';
import {
  buildAtomicRdoPayload,
  getAtomicRdoRpcErrorMessage,
  getRdoSyncQueueStatus,
  parseAtomicRdoSaveResult,
} from './rdoAtomicSave';

const values = {
  numero: 'RDO-TESTE',
  data: '2026-11-12',
  unidade_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  hh_planejado: 8,
  hh_realizado: 7,
  disciplina: 'eletrica',
  materials: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', material: 'Cabo', quantidade: 10 }],
  workforce: [],
  equipment: [],
  occurrences: [{
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    tipo: 'chuva',
    descricao: 'Chuva',
    inicio: '2026-11-12T08:00',
    fim: null,
    horas_impacto: 1,
  }],
};

describe('rdoAtomicSave', () => {
  it('preserves stable request and child identifiers while normalizing occurrence dates', () => {
    const payload = buildAtomicRdoPayload('dddddddd-dddd-4ddd-8ddd-dddddddddddd', values);

    expect(payload.request_id).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    expect(payload.disciplina).toBe('eletrica');
    expect(payload.materials[0].id).toBe(values.materials[0].id);
    expect(payload.occurrences[0].id).toBe(values.occurrences[0].id);
    expect(payload.occurrences[0].inicio).toBe(new Date(values.occurrences[0].inicio).toISOString());
  });

  it('parses version conflicts with the server snapshot and preserves the local failure code', () => {
    expect(parseAtomicRdoSaveResult({
      ok: false,
      code: 'VERSION_CONFLICT',
      message: 'Conflito',
      server_version: 3,
      server_data: { id: 'rdo-id', materials: [] },
    })).toEqual({
      ok: false,
      code: 'VERSION_CONFLICT',
      message: 'Conflito',
      serverVersion: 3,
      serverSnapshot: { id: 'rdo-id', materials: [] },
    });
  });

  it('reports an invalid response as a failed save instead of treating it as success', () => {
    expect(parseAtomicRdoSaveResult(null)).toMatchObject({
      ok: false,
      code: 'SAVE_FAILED',
    });
  });

  it('blocks automatic retries for conflicts and permanent server errors', () => {
    expect(getRdoSyncQueueStatus('VERSION_CONFLICT')).toBe('conflict');
    expect(getRdoSyncQueueStatus('DUPLICATE_RDO')).toBe('intervention');
    expect(getRdoSyncQueueStatus('NETWORK_ERROR')).toBe('pending');
  });

  it('explains how to resolve a missing atomic-save RPC without hiding other errors', () => {
    const message = getAtomicRdoRpcErrorMessage({
      code: 'PGRST202',
      message: 'Could not find the function in the schema cache',
    });

    expect(message).toContain('O RDO continua salvo neste dispositivo');
    expect(message).toContain('npx supabase db push --dry-run');
    expect(message).toContain("NOTIFY pgrst, 'reload schema'");
    expect(getAtomicRdoRpcErrorMessage({ code: '42501', message: 'Sem permissão' }))
      .toBe('Sem permissão');
  });
});
