import type {
  EquipamentosRow,
  FuncoesRow,
  ProfilesRow,
  UnidadesRow,
} from '@/types/database';

export interface OfflineImage {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

export interface OfflineRdoValues {
  numero: string;
  data: string;
  unidade_id: string;
  hh_planejado: number;
  hh_realizado?: number | null;
  disciplina?: 'automacao' | 'instrumentacao' | 'eletrica' | 'civil' | null;
  engenheiro_obs?: string | null;
  coordenador_obs?: string | null;
  clima_condicao?: string | null;
  clima_temperatura?: number | null;
  clima_origem?: 'automatico' | 'manual' | null;
  efetivo: Array<{
    funcao_id: string;
    quantidade: number;
    horas_trabalhadas: number;
    matricula?: string;
    nome?: string;
    identificador_externo?: string;
  }>;
  equipamentos: Array<{
    equipamento_id: string;
    horas_uso: number;
    observacao?: string;
  }>;
  ocorrencias: Array<{
    tipo: 'chuva' | 'falta_material' | 'falta_acesso' | 'seguranca' | 'retrabalho' | 'outro';
    descricao: string;
    inicio?: string;
    fim?: string;
    horas_impacto: number;
    responsavel?: string;
  }>;
  materiais: Array<{
    material: string;
    quantidade: number;
    unidade_medida?: string | null;
  }>;
  assinatura: string;
  imagens: OfflineImage[];
}

export interface OfflineRdoDraft {
  userId: string;
  values: OfflineRdoValues;
  updatedAt: number;
}

export interface OfflineRdoSubmission {
  id: string;
  rdoId: string;
  userId: string;
  baseVersion: number;
  values: OfflineRdoValues;
  materialIds: string[];
  workforceIds: string[];
  equipmentIds: string[];
  occurrenceIds: string[];
  signatureId: string;
  queuedAt: number;
  status: 'pending' | 'syncing' | 'conflict' | 'intervention';
  lastError: string | null;
  serverVersion?: number | null;
  serverSnapshot?: Record<string, unknown> | null;
  mediaStatus: Array<{
    id: string;
    label: string;
    status: 'pending' | 'uploaded' | 'failed';
    error: string | null;
  }>;
}

interface UnitCache {
  userId: string;
  units: UnidadesRow[];
  updatedAt: number;
}

interface ProfileCache {
  userId: string;
  profile: ProfilesRow;
  updatedAt: number;
}

interface CatalogCache<T> {
  userId: string;
  rows: T[];
  updatedAt: number;
}

const DATABASE_NAME = 'relat-pro-rdo-offline';
const DATABASE_VERSION = 2;
const STORE_NAMES = {
  drafts: 'drafts',
  submissions: 'submissions',
  units: 'units',
  profiles: 'profiles',
  functions: 'functions',
  equipment: 'equipment',
} as const;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Este navegador não oferece armazenamento offline.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAMES.drafts)) {
          database.createObjectStore(STORE_NAMES.drafts, { keyPath: 'userId' });
        }
        if (!database.objectStoreNames.contains(STORE_NAMES.submissions)) {
          const submissions = database.createObjectStore(STORE_NAMES.submissions, { keyPath: 'id' });
          submissions.createIndex('userId', 'userId', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_NAMES.units)) {
          database.createObjectStore(STORE_NAMES.units, { keyPath: 'userId' });
        }
        if (!database.objectStoreNames.contains(STORE_NAMES.profiles)) {
          database.createObjectStore(STORE_NAMES.profiles, { keyPath: 'userId' });
        }
        if (!database.objectStoreNames.contains(STORE_NAMES.functions)) {
          database.createObjectStore(STORE_NAMES.functions, { keyPath: 'userId' });
        }
        if (!database.objectStoreNames.contains(STORE_NAMES.equipment)) {
          database.createObjectStore(STORE_NAMES.equipment, { keyPath: 'userId' });
        }
      };

      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento offline.'));
      request.onblocked = () => reject(new Error('Feche outras abas do Relat Pro RDO para atualizar o armazenamento offline.'));
    }).catch((error: unknown): never => {
      databasePromise = null;
      throw error;
    });
  }

  const openedDatabase = databasePromise;
  if (!openedDatabase) {
    return Promise.reject(new Error('Não foi possível inicializar o armazenamento offline.'));
  }
  return openedDatabase;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar o armazenamento offline.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('A gravação offline foi cancelada.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao gravar os dados offline.'));
  });
}

async function getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const complete = transactionComplete(transaction);
  const result = await requestResult(transaction.objectStore(storeName).get(key)) as T | undefined;
  await complete;
  return result;
}

async function putRecord(storeName: string, value: object): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const complete = transactionComplete(transaction);
  await requestResult(transaction.objectStore(storeName).put(value));
  await complete;
}

async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const complete = transactionComplete(transaction);
  await requestResult(transaction.objectStore(storeName).delete(key));
  await complete;
}

export async function cacheProfile(userId: string, profile: ProfilesRow): Promise<void> {
  await putRecord(STORE_NAMES.profiles, { userId, profile, updatedAt: Date.now() } satisfies ProfileCache);
}

export async function getCachedProfile(userId: string): Promise<ProfilesRow | null> {
  return (await getRecord<ProfileCache>(STORE_NAMES.profiles, userId))?.profile ?? null;
}

export async function cacheUnits(userId: string, units: UnidadesRow[]): Promise<void> {
  await putRecord(STORE_NAMES.units, { userId, units, updatedAt: Date.now() } satisfies UnitCache);
}

export async function getCachedUnits(userId: string): Promise<UnidadesRow[] | null> {
  return (await getRecord<UnitCache>(STORE_NAMES.units, userId))?.units ?? null;
}

export async function cacheFunctions(userId: string, rows: FuncoesRow[]): Promise<void> {
  await putRecord(STORE_NAMES.functions, { userId, rows, updatedAt: Date.now() } satisfies CatalogCache<FuncoesRow>);
}

export async function getCachedFunctions(userId: string): Promise<FuncoesRow[] | null> {
  return (await getRecord<CatalogCache<FuncoesRow>>(STORE_NAMES.functions, userId))?.rows ?? null;
}

export async function cacheEquipment(userId: string, rows: EquipamentosRow[]): Promise<void> {
  await putRecord(STORE_NAMES.equipment, { userId, rows, updatedAt: Date.now() } satisfies CatalogCache<EquipamentosRow>);
}

export async function getCachedEquipment(userId: string): Promise<EquipamentosRow[] | null> {
  return (await getRecord<CatalogCache<EquipamentosRow>>(STORE_NAMES.equipment, userId))?.rows ?? null;
}

export function serializeImages(files: File[]): OfflineImage[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    blob: file,
  }));
}

export function restoreImages(images: OfflineImage[]): File[] {
  return images.map((image) => new File([image.blob], image.name, {
    type: image.type,
    lastModified: image.lastModified,
  }));
}

export async function saveDraft(userId: string, values: Omit<OfflineRdoValues, 'imagens'> & { imagens: File[] }): Promise<void> {
  await putRecord(STORE_NAMES.drafts, {
    userId,
    values: { ...values, imagens: serializeImages(values.imagens) },
    updatedAt: Date.now(),
  } satisfies OfflineRdoDraft);
}

export async function getDraft(userId: string): Promise<OfflineRdoDraft | null> {
  return (await getRecord<OfflineRdoDraft>(STORE_NAMES.drafts, userId)) ?? null;
}

export async function deleteDraft(userId: string): Promise<void> {
  await deleteRecord(STORE_NAMES.drafts, userId);
}

export async function deleteDraftIfNotNewer(userId: string, queuedAt: number): Promise<void> {
  const draft = await getDraft(userId);
  if (draft && draft.updatedAt <= queuedAt) {
    await deleteDraft(userId);
  }
}

export async function enqueueSubmission(
  userId: string,
  values: Omit<OfflineRdoValues, 'imagens'> & { imagens: File[] },
): Promise<OfflineRdoSubmission> {
  const queuedAt = Date.now();
  const offlineImages = serializeImages(values.imagens);
  const submission: OfflineRdoSubmission = {
    id: crypto.randomUUID(),
    rdoId: crypto.randomUUID(),
    userId,
    baseVersion: 0,
    values: { ...values, imagens: offlineImages },
    materialIds: values.materiais.map(() => crypto.randomUUID()),
    workforceIds: values.efetivo.map(() => crypto.randomUUID()),
    equipmentIds: values.equipamentos.map(() => crypto.randomUUID()),
    occurrenceIds: values.ocorrencias.map(() => crypto.randomUUID()),
    signatureId: crypto.randomUUID(),
    queuedAt,
    status: 'pending',
    lastError: null,
    serverVersion: null,
    serverSnapshot: null,
    mediaStatus: [
      ...offlineImages.map((image, index) => ({
        id: image.id,
        label: `Foto ${index + 1}`,
        status: 'pending' as const,
        error: null,
      })),
      ...(values.assinatura ? [{
        id: crypto.randomUUID(),
        label: 'Assinatura',
        status: 'pending' as const,
        error: null,
      }] : []),
    ],
  };
  if (submission.values.assinatura) {
    submission.signatureId = submission.mediaStatus[submission.mediaStatus.length - 1].id;
  }
  await putRecord(STORE_NAMES.submissions, submission);
  await deleteDraftIfNotNewer(userId, queuedAt);
  return submission;
}

export async function getPendingSubmissions(userId: string): Promise<OfflineRdoSubmission[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAMES.submissions, 'readonly');
  const complete = transactionComplete(transaction);
  const result = await requestResult(
    transaction.objectStore(STORE_NAMES.submissions).index('userId').getAll(userId),
  ) as OfflineRdoSubmission[];
  await complete;
  return result.map((submission) => {
    const signatureId = submission.signatureId || crypto.randomUUID();
    const mediaStatus = submission.mediaStatus || [];
    const knownMediaIds = new Set(mediaStatus.map(({ id }) => id));
    const normalizedMediaStatus = [
      ...mediaStatus,
      ...submission.values.imagens
        .filter((image) => !knownMediaIds.has(image.id))
        .map((image, index) => ({
          id: image.id,
          label: `Foto ${index + 1}`,
          status: 'pending' as const,
          error: null,
        })),
      ...(submission.values.assinatura && !knownMediaIds.has(signatureId)
        ? [{ id: signatureId, label: 'Assinatura', status: 'pending' as const, error: null }]
        : []),
    ];
    const status: OfflineRdoSubmission['status'] =
      submission.status === 'conflict' || submission.status === 'intervention'
        ? submission.status
        : 'pending';
    return {
      ...submission,
      baseVersion: submission.baseVersion ?? 0,
      materialIds: submission.materialIds || submission.values.materiais.map(() => crypto.randomUUID()),
      workforceIds: submission.workforceIds || submission.values.efetivo.map(() => crypto.randomUUID()),
      equipmentIds: submission.equipmentIds || submission.values.equipamentos.map(() => crypto.randomUUID()),
      occurrenceIds: submission.occurrenceIds || submission.values.ocorrencias.map(() => crypto.randomUUID()),
      signatureId,
      status,
      lastError: submission.lastError ?? null,
      serverVersion: submission.serverVersion ?? null,
      serverSnapshot: submission.serverSnapshot ?? null,
      mediaStatus: normalizedMediaStatus,
    };
  }).sort((left, right) => left.queuedAt - right.queuedAt);
}

export async function updateSubmission(submission: OfflineRdoSubmission): Promise<void> {
  await putRecord(STORE_NAMES.submissions, submission);
}

export async function removeSubmission(submissionId: string): Promise<void> {
  await deleteRecord(STORE_NAMES.submissions, submissionId);
}
