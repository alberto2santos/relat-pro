import { z } from 'zod';

export const OCCURRENCE_TYPE_OPTIONS = [
  { codigo: 'chuva', nome: 'Chuva / clima' },
  { codigo: 'falta_material', nome: 'Falta de material' },
  { codigo: 'falta_acesso', nome: 'Falta de acesso' },
  { codigo: 'seguranca', nome: 'Segurança' },
  { codigo: 'retrabalho', nome: 'Retrabalho' },
  { codigo: 'outro', nome: 'Outro' },
] as const;

export const workforceEntrySchema = z.object({
  funcao_id: z.string().uuid('Selecione uma função.'),
  quantidade: z.number().int().min(1, 'Informe ao menos uma pessoa.'),
  horas_trabalhadas: z.number().min(0, 'As horas não podem ser negativas.'),
  matricula: z.string().max(80).optional(),
  nome: z.string().max(160).optional(),
  identificador_externo: z.string().max(120).optional(),
});

export const equipmentEntrySchema = z.object({
  equipamento_id: z.string().uuid('Selecione um equipamento.'),
  horas_uso: z.number().min(0, 'As horas de uso não podem ser negativas.'),
  observacao: z.string().max(500).optional(),
});

export const occurrenceEntrySchema = z.object({
  tipo: z.enum(['chuva', 'falta_material', 'falta_acesso', 'seguranca', 'retrabalho', 'outro']),
  descricao: z.string().trim().min(1, 'Descreva a ocorrência.').max(1000),
  inicio: z.string().optional(),
  fim: z.string().optional(),
  horas_impacto: z.number().min(0, 'O impacto não pode ser negativo.'),
  responsavel: z.string().max(160).optional(),
}).superRefine((occurrence, context) => {
  const startTime = occurrence.inicio ? new Date(occurrence.inicio).getTime() : null;
  const endTime = occurrence.fim ? new Date(occurrence.fim).getTime() : null;
  if (startTime !== null && !Number.isFinite(startTime)) {
    context.addIssue({ code: 'custom', path: ['inicio'], message: 'Informe uma data e hora válidas.' });
  }
  if (endTime !== null && !Number.isFinite(endTime)) {
    context.addIssue({ code: 'custom', path: ['fim'], message: 'Informe uma data e hora válidas.' });
  }
  if (startTime !== null && endTime !== null && endTime < startTime) {
    context.addIssue({
      code: 'custom',
      path: ['fim'],
      message: 'O fim não pode ser anterior ao início.',
    });
  }
});

export type WorkforceEntry = z.infer<typeof workforceEntrySchema>;
export type EquipmentEntry = z.infer<typeof equipmentEntrySchema>;
export type OccurrenceEntry = z.infer<typeof occurrenceEntrySchema>;

export const calculateHoursBetween = (start: string, end: string): number | null => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.round(((endMs - startMs) / 3_600_000) * 100) / 100;
};

export const calculateLostHours = (occurrences: Array<Pick<OccurrenceEntry, 'horas_impacto'>>): number =>
  Math.round(occurrences.reduce((total, occurrence) => total + occurrence.horas_impacto, 0) * 100) / 100;

export const getOperationalCatalogErrorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? error.message
    : undefined;
  const missingCatalog = code === 'PGRST205'
    || code === '42P01'
    || (typeof message === 'string' && /schema cache|does not exist/i.test(message));

  if (missingCatalog) {
    return 'O banco Supabase conectado pode estar sem a migration operacional. Confira `npx supabase db push --dry-run` e, no projeto correto, aplique com `npx supabase db push`.';
  }

  return 'Verifique a conexão e as permissões do Supabase e tente novamente.';
};
