import { describe, expect, it } from 'vitest';
import { getAuditActionLabel } from './auditLabels';

describe('getAuditActionLabel', () => {
  it('traduz status e ações gravadas pelo banco', () => {
    expect(getAuditActionLabel('approved')).toBe('Aprovado');
    expect(getAuditActionLabel('draft')).toBe('Rascunho');
    expect(getAuditActionLabel('evidencia_adicionada')).toBe('Evidência anexada');
    expect(getAuditActionLabel('efetivo_adicionado')).toBe('Efetivo adicionado');
    expect(getAuditActionLabel('ocorrencia_removido')).toBe('Ocorrência removida');
  });

  it('mantém ações desconhecidas como vieram', () => {
    expect(getAuditActionLabel('acao_nova')).toBe('acao_nova');
  });
});
