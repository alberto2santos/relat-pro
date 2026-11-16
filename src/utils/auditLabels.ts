import type { StatusRdo } from '@/types/database';

const STATUS_LABELS: Record<StatusRdo, string> = {
  draft: 'Rascunho',
  submitted: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

/** Ações gravadas pelas trilhas de auditoria do banco (RDO, materiais, evidências e seções operacionais). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  editado: 'Editado',
  excluido: 'Removido da listagem',
  restaurado: 'Restaurado',
  status_alterado: 'Status alterado',
  material_adicionado: 'Material adicionado',
  material_editado: 'Material atualizado',
  material_removido: 'Material removido',
  evidencia_adicionada: 'Evidência anexada',
  evidencia_atualizada: 'Evidência atualizada',
  evidencia_removida: 'Evidência removida',
  efetivo_adicionado: 'Efetivo adicionado',
  efetivo_atualizado: 'Efetivo atualizado',
  efetivo_removido: 'Efetivo removido',
  equipamento_adicionado: 'Equipamento adicionado',
  equipamento_atualizado: 'Equipamento atualizado',
  equipamento_removido: 'Equipamento removido',
  ocorrencia_adicionado: 'Ocorrência adicionada',
  ocorrencia_atualizado: 'Ocorrência atualizada',
  ocorrencia_removido: 'Ocorrência removida',
};

/** Rótulo em português de uma ação de auditoria (status do RDO ou alteração registrada). */
export const getAuditActionLabel = (acao: string): string =>
  STATUS_LABELS[acao as StatusRdo] ?? AUDIT_ACTION_LABELS[acao] ?? acao;
