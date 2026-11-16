import { describe, expect, it } from 'vitest';
import { getDisciplineLabel } from './disciplines';

describe('getDisciplineLabel', () => {
  it('traduz os valores internos para os rótulos exibidos no app', () => {
    expect(getDisciplineLabel('civil')).toBe('Construção e Montagem');
    expect(getDisciplineLabel('automacao')).toBe('Automação');
    expect(getDisciplineLabel('instrumentacao')).toBe('Instrumentação');
    expect(getDisciplineLabel('eletrica')).toBe('Elétrica');
  });

  it('mantém valores desconhecidos e devolve vazio sem disciplina', () => {
    expect(getDisciplineLabel('outra')).toBe('outra');
    expect(getDisciplineLabel(null)).toBe('');
    expect(getDisciplineLabel(undefined)).toBe('');
  });
});
