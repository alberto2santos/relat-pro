import type { Disciplina } from '@/types/database';

export const DISCIPLINE_LABELS: Record<Disciplina, string> = {
  automacao: 'Automação',
  instrumentacao: 'Instrumentação',
  eletrica: 'Elétrica',
  civil: 'Construção e Montagem',
};

/** Rótulo de exibição da disciplina; valores desconhecidos voltam como vieram e vazios viram ''. */
export const getDisciplineLabel = (disciplina?: string | null): string =>
  disciplina ? DISCIPLINE_LABELS[disciplina as Disciplina] ?? disciplina : '';
