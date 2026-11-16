import { describe, expect, it } from 'vitest';
import {
  calculateHoursBetween,
  calculateLostHours,
  equipmentEntrySchema,
  getOperationalCatalogErrorMessage,
  occurrenceEntrySchema,
  workforceEntrySchema,
} from './rdoOperational';
import { neutralizeSpreadsheetFormula } from './spreadsheetSafety';

describe('cálculos operacionais do RDO', () => {
  it('orienta aplicar a migration quando o catálogo ainda não existe no Supabase', () => {
    expect(getOperationalCatalogErrorMessage({ code: 'PGRST205' })).toContain('npx supabase db push');
    expect(getOperationalCatalogErrorMessage({ code: '42P01', message: 'relation does not exist' })).toContain('migration operacional');
  });

  it('orienta verificar conexão e permissões em outros erros do catálogo', () => {
    expect(getOperationalCatalogErrorMessage({ code: '42501' })).toContain('conexão e as permissões');
  });

  it('calcula horas transcorridas com duas casas decimais', () => {
    expect(calculateHoursBetween('2026-11-09T08:00', '2026-11-09T10:30')).toBe(2.5);
  });

  describe('segurança de exportação tabular', () => {
    it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)', '  =1+1'])(
      'neutraliza texto iniciado por fórmula: %s',
      (value) => {
        expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
      },
    );

    it('preserva texto que não começa com um marcador de fórmula', () => {
      expect(neutralizeSpreadsheetFormula('RDO aprovado')).toBe('RDO aprovado');
    });
  });

  it('retorna null para intervalos invertidos ou inválidos', () => {
    expect(calculateHoursBetween('2026-11-09T10:00', '2026-11-09T08:00')).toBeNull();
    expect(calculateHoursBetween('invalid', '2026-11-09T08:00')).toBeNull();
  });

  it('soma horas de impacto sem acumular erro de ponto flutuante', () => {
    expect(calculateLostHours([{ horas_impacto: 1.1 }, { horas_impacto: 2.2 }])).toBe(3.3);
  });

  it('rejeita ocorrência sem descrição ou com período invertido', () => {
    const baseOccurrence = {
      tipo: 'chuva' as const,
      descricao: 'Chuva forte',
      inicio: '2026-11-09T10:00',
      fim: '2026-11-09T09:00',
      horas_impacto: 1,
    };
    expect(occurrenceEntrySchema.safeParse(baseOccurrence).success).toBe(false);
    expect(occurrenceEntrySchema.safeParse({ ...baseOccurrence, descricao: ' ' }).success).toBe(false);
    expect(occurrenceEntrySchema.safeParse({ ...baseOccurrence, inicio: 'not-a-date' }).success).toBe(false);
  });

  it('valida quantidade e horas do efetivo e dos equipamentos', () => {
    const invalidWorkforce = { funcao_id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', quantidade: 0, horas_trabalhadas: -1 };
    const invalidEquipment = { equipamento_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', horas_uso: -0.5 };
    expect(workforceEntrySchema.safeParse(invalidWorkforce).success).toBe(false);
    expect(equipmentEntrySchema.safeParse(invalidEquipment).success).toBe(false);
  });
});
