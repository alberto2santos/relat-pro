import { supabase } from '@/lib/supabase';
import type {
  EvidenciasRdoInsert,
  Json,
} from '@/types/database';
import {
  deleteDraftIfNotNewer,
  getPendingSubmissions,
  removeSubmission,
  updateSubmission,
} from '@/services/offlineRdoStorage';
import type { OfflineRdoSubmission } from '@/services/offlineRdoStorage';
import {
  buildAtomicRdoPayload,
  getAtomicRdoRpcErrorMessage,
  getRdoSyncQueueStatus,
  parseAtomicRdoSaveResult,
} from '@/utils/rdoAtomicSave';
import { dataUrlToBlob } from '@/utils/dataUrlToBlob';

export interface OfflineSyncResult {
  synced: Array<{ id: string; rdoId: string }>;
  failed: Array<{
    id: string;
    message: string;
    code?: string;
    serverVersion?: number | null;
    serverSnapshot?: Record<string, unknown> | null;
  }>;
}

const syncByUser = new Map<string, Promise<OfflineSyncResult>>();

class OfflineSyncError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly serverVersion?: number | null,
    readonly serverSnapshot?: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = 'OfflineSyncError';
  }
}

function throwOnError(error: { message: string; code?: string; statusCode?: string | number } | null): void {
  if (!error) return;
  const isForbidden = error.code === '42501'
    || error.statusCode === 401
    || error.statusCode === 403
    || error.statusCode === '401'
    || error.statusCode === '403';
  const code = error.code === 'PGRST202'
    ? 'REQUIRES_INTERVENTION'
    : isForbidden ? 'PERMISSION_DENIED' : undefined;
  const message = getAtomicRdoRpcErrorMessage(error);
  if (code) throw new OfflineSyncError(message, code);
  throw new Error(message);
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
}

async function ensureStorageObject(path: string, file: Blob, contentType: string): Promise<void> {
  const separatorIndex = path.lastIndexOf('/');
  const folder = path.slice(0, separatorIndex);
  const fileName = path.slice(separatorIndex + 1);
  const storage = supabase.storage.from('evidencias');
  const { data: objects, error: listError } = await storage.list(folder, {
    search: fileName,
    limit: 100,
  });
  if (listError) {
    throwOnError({ ...listError, message: `Não foi possível verificar o arquivo no Storage: ${listError.message}` });
  }
  if ((objects || []).some((object) => object.name === fileName)) return;

  const { error: uploadError } = await storage.upload(path, file, {
    upsert: false,
    contentType,
  });
  if (uploadError) {
    throwOnError({ ...uploadError, message: `Não foi possível enviar o arquivo ao Storage: ${uploadError.message}` });
  }
}

async function ensureEvidenceRecord(evidence: EvidenciasRdoInsert): Promise<void> {
  if (!evidence.id) {
    throw new Error('A evidência não tem um identificador estável para sincronização.');
  }
  const { data: existing, error: selectError } = await supabase
    .from('evidencias_rdo')
    .select('rdo_id, tipo, url')
    .eq('id', evidence.id)
    .maybeSingle();
  if (selectError) {
    throwOnError({ ...selectError, message: `Não foi possível verificar o registro da evidência: ${selectError.message}` });
  }
  if (existing) {
    if (existing.rdo_id !== evidence.rdo_id || existing.tipo !== evidence.tipo || existing.url !== evidence.url) {
      throw new Error('O identificador do arquivo já está associado a outra evidência.');
    }
    return;
  }

  const { error: insertError } = await supabase.from('evidencias_rdo').insert(evidence);
  if (!insertError) return;

  if (insertError.code === '23505') {
    const { data: concurrentEvidence, error: retrySelectError } = await supabase
      .from('evidencias_rdo')
      .select('rdo_id, tipo, url')
      .eq('id', evidence.id)
      .maybeSingle();
    if (retrySelectError) {
      throwOnError({ ...retrySelectError, message: `Não foi possível confirmar o registro da evidência: ${retrySelectError.message}` });
    }
    if (
      concurrentEvidence
      && concurrentEvidence.rdo_id === evidence.rdo_id
      && concurrentEvidence.tipo === evidence.tipo
      && concurrentEvidence.url === evidence.url
    ) return;
  }

  throwOnError({ ...insertError, message: `Não foi possível registrar a evidência do tipo "${evidence.tipo}": ${insertError.message}` });
}

async function saveOperationalData(submission: OfflineRdoSubmission): Promise<void> {
  const { values } = submission;
  const payload: Json = buildAtomicRdoPayload(submission.id, {
    numero: values.numero,
    data: values.data,
    unidade_id: values.unidade_id,
    hh_planejado: values.hh_planejado,
    hh_realizado: values.hh_realizado,
    disciplina: values.disciplina,
    engenheiro_obs: values.engenheiro_obs,
    coordenador_obs: values.coordenador_obs,
    clima_condicao: values.clima_condicao,
    clima_temperatura: values.clima_temperatura,
    clima_origem: values.clima_origem,
    materials: values.materiais.map((entry, index) => ({
      id: submission.materialIds[index],
      material: entry.material,
      quantidade: entry.quantidade,
      unidade_medida: entry.unidade_medida ?? null,
    })),
    workforce: values.efetivo.map((entry, index) => ({
      id: submission.workforceIds[index],
      ...entry,
    })),
    equipment: values.equipamentos.map((entry, index) => ({
      id: submission.equipmentIds[index],
      ...entry,
    })),
    occurrences: values.ocorrencias.map((entry, index) => ({
      id: submission.occurrenceIds[index],
      ...entry,
      inicio: entry.inicio ? new Date(entry.inicio).toISOString() : null,
      fim: entry.fim ? new Date(entry.fim).toISOString() : null,
    })),
  });
  const { data, error } = await supabase.rpc('salvar_rdo_completo', {
    rdo_id: submission.rdoId,
    versao_base: submission.baseVersion,
    payload,
  });
  throwOnError(error);
  const result = parseAtomicRdoSaveResult(data);
  if (!result.ok) {
    throw new OfflineSyncError(result.message, result.code, result.serverVersion, result.serverSnapshot);
  }
}

async function uploadMediaFile(
  submission: OfflineRdoSubmission,
  fileId: string,
  upload: () => Promise<void>,
): Promise<void> {
  const entry = submission.mediaStatus.find((media) => media.id === fileId);
  if (!entry || entry.status === 'uploaded') return;
  entry.status = 'pending';
  entry.error = null;
  await updateSubmission(submission);
  try {
    await upload();
    entry.status = 'uploaded';
    await updateSubmission(submission);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha ao enviar o arquivo.';
    entry.status = 'failed';
    entry.error = message;
    await updateSubmission(submission);
    throw cause;
  }
}

async function syncSubmission(
  submission: OfflineRdoSubmission,
  onProgress?: (submissionId: string, progress: number) => void,
): Promise<void> {
  const { values, rdoId } = submission;
  await saveOperationalData(submission);
  onProgress?.(submission.id, 10);

  for (let index = 0; index < values.imagens.length; index += 1) {
    const image = values.imagens[index];
    const path = `${rdoId}/${image.id}.${getFileExtension(image.name)}`;
    await uploadMediaFile(submission, image.id, async () => {
      await ensureStorageObject(path, image.blob, image.type);
      const evidence: EvidenciasRdoInsert = {
        id: image.id,
        rdo_id: rdoId,
        tipo: 'foto',
        url: path,
        descricao: `Foto ${index + 1}`,
      };
      await ensureEvidenceRecord(evidence);
    });
    onProgress?.(submission.id, 10 + Math.round(((index + 1) / Math.max(values.imagens.length, 1)) * 35));
  }
  onProgress?.(submission.id, 60);

  if (values.assinatura) {
    const signatureBlob = dataUrlToBlob(values.assinatura);
    if (signatureBlob.type !== 'image/png') {
      throw new Error('A assinatura salva não está em um formato PNG válido.');
    }
    const path = `${rdoId}/${submission.signatureId}.png`;
    await uploadMediaFile(submission, submission.signatureId, async () => {
      await ensureStorageObject(path, signatureBlob, 'image/png');
      const signature: EvidenciasRdoInsert = {
        id: submission.signatureId,
        rdo_id: rdoId,
        tipo: 'assinatura',
        url: path,
        descricao: 'Assinatura Digital',
      };
      await ensureEvidenceRecord(signature);
    });
  }
  onProgress?.(submission.id, 85);

  const { data: currentRdo, error: statusError } = await supabase
    .from('rdos')
    .select('status')
    .eq('id', rdoId)
    .single();
  throwOnError(statusError);
  if (!currentRdo) throw new Error('O servidor não retornou o status atual do RDO.');
  if (currentRdo.status === 'draft') {
    const { error: transitionError } = await supabase.rpc('transition_rdo_status', {
      p_rdo_id: rdoId,
      p_status: 'submitted',
      p_comment: null,
    });
    throwOnError(transitionError);
  } else if (currentRdo.status !== 'submitted' && currentRdo.status !== 'approved') {
    throw new OfflineSyncError(
      'O status do RDO mudou no servidor; revise o relatório antes de reenviá-lo.',
      'STATE_NOT_EDITABLE',
    );
  }
  onProgress?.(submission.id, 100);
}

async function syncUserQueue(
  userId: string,
  onProgress?: (submissionId: string, progress: number) => void,
): Promise<OfflineSyncResult> {
  const result: OfflineSyncResult = { synced: [], failed: [] };
  if (!navigator.onLine) return result;

  const submissions = await getPendingSubmissions(userId);
  for (const submission of submissions) {
    if (!navigator.onLine) break;
    if (submission.status === 'conflict' || submission.status === 'intervention') {
      result.failed.push({
        id: submission.id,
        message: submission.lastError || 'O RDO precisa de resolução manual antes de sincronizar.',
        code: submission.status === 'conflict' ? 'VERSION_CONFLICT' : 'REQUIRES_INTERVENTION',
        serverVersion: submission.serverVersion,
        serverSnapshot: submission.serverSnapshot,
      });
      continue;
    }
    const activeSubmission = {
      ...submission,
      mediaStatus: submission.mediaStatus || [],
      status: 'syncing' as const,
      lastError: null,
    };
    await updateSubmission(activeSubmission);

    try {
      await syncSubmission(activeSubmission, onProgress);
      await deleteDraftIfNotNewer(userId, activeSubmission.queuedAt);
      await removeSubmission(activeSubmission.id);
      result.synced.push({ id: activeSubmission.id, rdoId: activeSubmission.rdoId });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha inesperada ao sincronizar o RDO.';
      console.error('[offlineRdoSync] Falha ao sincronizar RDO:', activeSubmission.rdoId, cause);
      const syncError = cause instanceof OfflineSyncError ? cause : null;
      const status = getRdoSyncQueueStatus(syncError?.code);
      await updateSubmission({
        ...activeSubmission,
        status,
        lastError: message,
        serverVersion: syncError?.serverVersion ?? null,
        serverSnapshot: syncError?.serverSnapshot ?? null,
      });
      result.failed.push({
        id: activeSubmission.id,
        message,
        code: syncError?.code,
        serverVersion: syncError?.serverVersion,
        serverSnapshot: syncError?.serverSnapshot,
      });
    }
  }
  return result;
}

export function syncPendingRdos(
  userId: string,
  onProgress?: (submissionId: string, progress: number) => void,
): Promise<OfflineSyncResult> {
  const existingSync = syncByUser.get(userId);
  if (existingSync) return existingSync;

  const runSync = () => syncUserQueue(userId, onProgress);
  const syncOperation = navigator.locks
    ? navigator.locks.request(`relat-pro-rdo-sync-${userId}`, { mode: 'exclusive' }, runSync)
    : runSync();
  const syncPromise = syncOperation.finally(() => {
    syncByUser.delete(userId);
  });
  syncByUser.set(userId, syncPromise);
  return syncPromise;
}
