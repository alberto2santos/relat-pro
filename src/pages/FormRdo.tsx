import React, { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Loader2, Plus, Trash2, CloudSun } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import HelpTooltip from '@/components/ui/HelpTooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ImageUpload from '@/components/form/ImageUpload';
import SignaturePad from '@/components/form/SignaturePad';
import SearchableCombobox from '@/components/form/SearchableCombobox';
import type {
  UnidadesRow,
} from '@/types/database';
import { isMeasurementUnit, MEASUREMENT_UNITS } from '@/utils/measurementUnits';
import {
  cacheUnits,
  cacheEquipment,
  cacheFunctions,
  enqueueSubmission,
  getPendingSubmissions,
  getCachedEquipment,
  getCachedFunctions,
  getCachedUnits,
  getDraft,
  restoreImages,
  removeSubmission,
  saveDraft,
  updateSubmission,
} from '@/services/offlineRdoStorage';
import { syncPendingRdos } from '@/services/offlineRdoSync';
import { fetchWeatherForDate } from '@/services/weatherService';
import { getRdoSyncQueueStatus } from '@/utils/rdoAtomicSave';
import {
  OCCURRENCE_TYPE_OPTIONS,
  equipmentEntrySchema,
  occurrenceEntrySchema,
  workforceEntrySchema,
  calculateHoursBetween,
  getOperationalCatalogErrorMessage,
} from '@/utils/rdoOperational';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const MaterialSchema = z.object({
  material: z
    .string()
    .min(1, { message: 'Nome do material é obrigatório' })
    .trim(),
  quantidade: z
    .number()
    .min(0.01, { message: 'Quantidade deve ser maior que 0' }),
  unidade_medida: z
    .string()
    .max(20)
    .optional()
    .nullable(),
});

const RdoFormSchema = z.object({
  numero: z
    .string()
    .min(1, { message: 'Número RDO é obrigatório' })
    .trim(),
  data: z
    .string()
    .min(1, { message: 'Data é obrigatória' }),
  unidade_id: z
    .string()
    .uuid({ message: 'Unidade inválida' }),
  hh_planejado: z
    .number()
    .min(0.5, { message: 'Mínimo 0.5 horas' }),
  hh_realizado: z
    .number()
    .min(0, { message: 'Não pode ser negativo' })
    .nullable()
    .optional(),
  disciplina: z
    .enum(['automacao', 'instrumentacao', 'eletrica', 'civil'] as const)
    .optional()
    .nullable(),
  engenheiro_obs: z
    .string()
    .max(500, { message: 'Máximo 500 caracteres' })
    .optional()
    .nullable(),
  coordenador_obs: z
    .string()
    .max(500, { message: 'Máximo 500 caracteres' })
    .optional()
    .nullable(),
  materiais: z
    .array(MaterialSchema)
    .min(1, { message: 'Pelo menos um material é obrigatório' }),
  assinatura: z
    .string()
    .min(1, { message: 'Assinatura digital é obrigatória' }),
  imagens: z
    .array(z.instanceof(File))
    .max(10, { message: 'Máximo 10 imagens' }),
  clima_condicao: z.string().max(120).nullable().optional(),
  clima_temperatura: z.number().min(-100).max(100).nullable().optional(),
  clima_origem: z.enum(['automatico', 'manual']).nullable().optional(),
  efetivo: z.array(workforceEntrySchema),
  equipamentos: z.array(equipmentEntrySchema),
  ocorrencias: z.array(occurrenceEntrySchema),
});

type RdoFormData = z.infer<typeof RdoFormSchema>;

const isNetworkFailure = (cause: unknown): boolean =>
  cause instanceof TypeError
  || (cause instanceof Error && /failed to fetch|fetch failed|networkerror|network request/i.test(cause.message));

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const FormRdo: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [offlineMode, setOfflineMode] = useState(!navigator.onLine);
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [queuedSubmission, setQueuedSubmission] = useState<{
    id: string;
    rdoId: string;
    message: string;
    status: 'pending' | 'conflict' | 'intervention';
    baseVersion: number;
    serverVersion: number | null;
    serverSnapshot: Record<string, unknown> | null;
    mediaStatus: Array<{ id: string; label: string; status: 'pending' | 'uploaded' | 'failed'; error: string | null }>;
  } | null>(null);
  const draftSaveTimer = useRef<number | null>(null);
  const draftSavePromise = useRef<Promise<void> | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedOperationalData, setCopiedOperationalData] = useState(false);
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    void getPendingSubmissions(user.id)
      .then((submissions) => {
        if (!active || submissions.length === 0) return;
        const submission = submissions[0];
        setQueuedSubmission((current) => current ?? {
          id: submission.id,
          rdoId: submission.rdoId,
          message: submission.lastError || (submission.status === 'conflict'
            ? 'Este RDO tem um conflito de versão e precisa de resolução antes de sincronizar.'
            : 'Há um RDO aguardando sincronização neste dispositivo.'),
          status: submission.status === 'conflict' || submission.status === 'intervention'
            ? submission.status
            : 'pending',
          baseVersion: submission.baseVersion,
          serverVersion: submission.serverVersion ?? null,
          serverSnapshot: submission.serverSnapshot ?? null,
          mediaStatus: submission.mediaStatus || [],
        });
      })
      .catch((cause: unknown) => {
        console.error('[FormRdo] Não foi possível recuperar a fila local:', cause);
        if (active) setSubmitError('Não foi possível recuperar a fila de sincronização deste dispositivo.');
      });
    return () => { active = false; };
  }, [user?.id]);

  // Buscar unidades
  const { data: unidades = [], isLoading: loadingUnidades, error: unidadesError, refetch: refetchUnidades } = useQuery<UnidadesRow[]>({
    queryKey: ['unidades', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('É necessário estar autenticado para carregar as unidades.');
      let cachedUnits: UnidadesRow[] | null = null;
      try {
        cachedUnits = await getCachedUnits(user.id);
      } catch (cacheError) {
        console.warn('[FormRdo] Não foi possível ler unidades salvas offline:', cacheError);
      }

      if (!navigator.onLine) {
        if (cachedUnits) return cachedUnits;
        throw new Error('Nenhuma unidade foi salva neste dispositivo. Conecte-se à internet para carregar as unidades.');
      }

      try {
        const { data, error } = await supabase
          .from('unidades')
          .select('*')
          .is('deleted_at', null)
          .order('nome', { ascending: true });

        if (error) throw error;
        const units = data || [];
        try {
          await cacheUnits(user.id, units);
        } catch (cacheError) {
          console.warn('[FormRdo] Não foi possível atualizar o cache offline de unidades:', cacheError);
        }
        return units;
      } catch (cause) {
        if (isNetworkFailure(cause) && cachedUnits) {
          console.warn('[FormRdo] Falha de rede; usando as unidades salvas neste dispositivo.', cause);
          return cachedUnits;
        }
        console.error('[FormRdo] Erro ao buscar unidades:', cause);
        throw cause;
      }
    },
    enabled: !!user?.id,
  });

  const { data: funcoes = [], error: functionsError, refetch: refetchFunctions } = useQuery({
    queryKey: ['funcoes-rdo', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('É necessário estar autenticado para carregar as funções.');
      const cached = await getCachedFunctions(user.id).catch(() => null);
      if (!navigator.onLine) return cached || [];
      const { data, error } = await supabase.from('funcoes').select('*').order('nome');
      if (error) {
        if (cached) {
          console.warn('[FormRdo] Falha ao atualizar funções; usando o catálogo em cache.', error);
          return cached;
        }
        throw error;
      }
      await cacheFunctions(user.id, data || []);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: equipamentosDisponiveis = [], error: equipmentCatalogError, refetch: refetchEquipment } = useQuery({
    queryKey: ['equipamentos-rdo', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('É necessário estar autenticado para carregar os equipamentos.');
      const cached = await getCachedEquipment(user.id).catch(() => null);
      if (!navigator.onLine) return cached || [];
      const { data, error } = await supabase.from('equipamentos').select('*').order('nome');
      if (error) {
        if (cached) {
          console.warn('[FormRdo] Falha ao atualizar equipamentos; usando o catálogo em cache.', error);
          return cached;
        }
        throw error;
      }
      await cacheEquipment(user.id, data || []);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: occurrenceTypes = OCCURRENCE_TYPE_OPTIONS, error: occurrenceTypesError, refetch: refetchOccurrenceTypes } = useQuery({
    queryKey: ['rdo-occurrence-types'],
    queryFn: async () => {
      if (!navigator.onLine) return OCCURRENCE_TYPE_OPTIONS;
      const { data, error } = await supabase.from('tipos_ocorrencia').select('codigo, nome, ordem').order('ordem');
      if (error) throw error;
      return data;
    },
  });

  // React Hook Form
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
    getValues,
    watch,
    setValue,
    reset,
  } = useForm<RdoFormData>({
    resolver: zodResolver(RdoFormSchema),
    mode: 'onBlur',
    defaultValues: {
      numero: '',
      data: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10),
      unidade_id: profile?.unidade_id || '',
      hh_planejado: 8,
      hh_realizado: 0,
      disciplina: profile?.disciplina || undefined,
      engenheiro_obs: '',
      coordenador_obs: '',
      materiais: [{ material: '', quantidade: 1, unidade_medida: '' }],
      clima_condicao: null,
      clima_temperatura: null,
      clima_origem: null,
      efetivo: [],
      equipamentos: [],
      ocorrencias: [],
      assinatura: '',
      imagens: [],
    },
  });

  const allFormValues = watch();

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setIsRestoringDraft(false);
      return;
    }

    setIsRestoringDraft(true);
    void getDraft(user.id)
      .then((draft) => {
        if (active && draft) {
          reset({
            ...draft.values,
            efetivo: draft.values.efetivo || [],
            equipamentos: draft.values.equipamentos || [],
            ocorrencias: draft.values.ocorrencias || [],
            imagens: restoreImages(draft.values.imagens),
          });
          setDraftSaved(true);
        }
      })
      .catch((cause: unknown) => {
        console.error('[FormRdo] Não foi possível restaurar o rascunho offline:', cause);
        if (active) setDraftSaveError('Não foi possível restaurar o rascunho salvo neste dispositivo.');
      })
      .finally(() => {
        if (active) setIsRestoringDraft(false);
      });

    return () => {
      active = false;
    };
  }, [reset, user?.id]);

  useEffect(() => {
    if (!user?.id || isRestoringDraft || !isDirty || queuedSubmission) return;
    if (draftSaveTimer.current !== null) window.clearTimeout(draftSaveTimer.current);
    setDraftSaved(false);

    draftSaveTimer.current = window.setTimeout(() => {
      const currentSave = saveDraft(user.id, allFormValues);
      draftSavePromise.current = currentSave;
      void currentSave
        .then(() => {
          setDraftSaveError(null);
          setDraftSaved(true);
        })
        .catch((cause: unknown) => {
          console.error('[FormRdo] Não foi possível salvar o rascunho offline:', cause);
          setDraftSaveError('Não foi possível salvar o rascunho neste dispositivo. Verifique o espaço disponível.');
        })
        .finally(() => {
          if (draftSavePromise.current === currentSave) {
            draftSavePromise.current = null;
          }
        });
    }, 700);

    return () => {
      if (draftSaveTimer.current !== null) {
        window.clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = null;
      }
    };
  }, [allFormValues, isDirty, isRestoringDraft, queuedSubmission, user?.id]);

  useEffect(() => {
    if (profile?.unidade_id && !getValues('unidade_id')) {
      setValue('unidade_id', profile.unidade_id, { shouldValidate: true });
    }
  }, [getValues, profile?.unidade_id, setValue]);

  useEffect(() => {
    if (loadingUnidades || unidadesError) return;
    const selectedUnitId = getValues('unidade_id');
    if (selectedUnitId && !unidades.some((unidade) => unidade.id === selectedUnitId)) {
      setValue('unidade_id', '', { shouldValidate: false });
    }
  }, [getValues, loadingUnidades, setValue, unidades, unidadesError]);

  // Field Array para materiais
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'materiais',
  });
  const { fields: workforceFields, append: appendWorkforce, remove: removeWorkforce, replace: replaceWorkforce } = useFieldArray({
    control,
    name: 'efetivo',
  });
  const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment, replace: replaceEquipment } = useFieldArray({
    control,
    name: 'equipamentos',
  });
  const { fields: occurrenceFields, append: appendOccurrence, remove: removeOccurrence } = useFieldArray({
    control,
    name: 'ocorrencias',
  });

  // Watchers
  const watchImagens = watch('imagens');
  const watchAssinatura = watch('assinatura');
  const watchHhPlanejado = watch('hh_planejado');
  const watchHhRealizado = watch('hh_realizado');
  const watchUnidadeId = watch('unidade_id');
  const watchDisciplina = watch('disciplina');
  const watchData = watch('data');
  const watchWeatherCondition = watch('clima_condicao');
  const watchWeatherTemperature = watch('clima_temperatura');

  useEffect(() => {
    const unit = unidades.find((candidate) => candidate.id === watchUnidadeId);
    if (!unit || unit.latitude === null || unit.longitude === null || !watchData || watch('clima_origem') === 'manual') return;

    const controller = new AbortController();
    setWeatherMessage('Consultando o clima da unidade...');
    void fetchWeatherForDate(unit.latitude, unit.longitude, watchData, controller.signal)
      .then((reading) => {
        setValue('clima_condicao', reading.condition, { shouldDirty: true });
        setValue('clima_temperatura', reading.temperature, { shouldDirty: true });
        setValue('clima_origem', 'automatico', { shouldDirty: true });
        setWeatherMessage('Clima preenchido automaticamente. Você pode ajustar os valores.');
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('[FormRdo] Não foi possível consultar o clima automaticamente:', cause);
        setWeatherMessage('Clima automático indisponível. Você pode preencher os dados manualmente.');
      });
    return () => controller.abort();
  }, [setValue, unidades, watch, watchData, watchUnidadeId]);

  const handleDuplicatePrevious = async () => {
    if (!watchUnidadeId || !watchData) {
      setDuplicateMessage({ type: 'error', text: 'Selecione a unidade e a data antes de buscar um RDO anterior.' });
      return;
    }

    if ((isDirty || watchAssinatura || watchImagens.length > 0) && !window.confirm('Os dados preenchidos serão substituídos. A data e o número atuais serão mantidos; fotos, assinatura, horas realizadas, ocorrências e clima não serão copiados. Continuar?')) {
      return;
    }

    setIsDuplicating(true);
    setDuplicateMessage(null);

    try {
      let previousQuery = supabase
        .from('rdos')
        .select('id, data, hh_planejado, hh_realizado, engenheiro_obs, coordenador_obs')
        .eq('unidade_id', watchUnidadeId)
        .lt('data', watchData)
        .is('deleted_at', null)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: previousRdo, error: previousError } = watchDisciplina
        ? await previousQuery.eq('disciplina', watchDisciplina).maybeSingle()
        : await previousQuery.is('disciplina', null).maybeSingle();
      if (previousError) throw previousError;

      if (!previousRdo) {
        setDuplicateMessage({ type: 'error', text: 'Não encontramos um RDO anterior para essa unidade, disciplina e data.' });
        return;
      }

      const { data: previousMaterials, error: materialsError } = await supabase
        .from('materiais_rdo')
        .select('material, quantidade, unidade_medida')
        .eq('rdo_id', previousRdo.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (materialsError) throw materialsError;
      const [previousWorkforceResult, previousEquipmentResult] = await Promise.all([
        supabase.from('rdo_efetivo').select('funcao_id, quantidade, matricula, nome, identificador_externo').eq('rdo_id', previousRdo.id),
        supabase.from('rdo_equipamentos').select('equipamento_id, observacao').eq('rdo_id', previousRdo.id),
      ]);
      if (previousWorkforceResult.error) throw previousWorkforceResult.error;
      if (previousEquipmentResult.error) throw previousEquipmentResult.error;

      setValue('hh_planejado', previousRdo.hh_planejado, { shouldDirty: true, shouldValidate: true });
      setValue('hh_realizado', 0, { shouldDirty: true, shouldValidate: true });
      replace(previousMaterials?.length
        ? previousMaterials.map(({ material, quantidade, unidade_medida }) => ({ material, quantidade, unidade_medida }))
        : [{ material: '', quantidade: 1, unidade_medida: '' }]);
      replaceWorkforce((previousWorkforceResult.data || []).map((entry) => ({
        ...entry,
        matricula: entry.matricula || '',
        nome: entry.nome || '',
        identificador_externo: entry.identificador_externo || '',
        horas_trabalhadas: 0,
      })));
      replaceEquipment((previousEquipmentResult.data || []).map((entry) => ({
        ...entry,
        observacao: entry.observacao || '',
        horas_uso: 0,
      })));
      setValue('ocorrencias', [], { shouldDirty: true });
      // O clima é do dia atual (sugerido pela unidade e data) e não vem do RDO anterior: fica como está.
      // Assinatura e fotos são limpas sem validar, para não exibir erro antes de a pessoa assinar.
      setValue('assinatura', '', { shouldDirty: true });
      setValue('imagens', [], { shouldDirty: true });
      setCopiedOperationalData(true);
      setDuplicateMessage({ type: 'success', text: `Dados do RDO de ${new Date(`${previousRdo.data}T12:00:00`).toLocaleDateString('pt-BR')} copiados. Revise as informações antes de salvar.` });
    } catch (cause) {
      setDuplicateMessage({
        type: 'error',
        text: cause instanceof Error ? cause.message : 'Não foi possível carregar o RDO anterior.',
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  // Handlers
  const handleAddMaterial = () => {
    append({ material: '', quantidade: 1, unidade_medida: '' });
  };

  const handleWeatherManualChange = () => {
    setValue('clima_origem', 'manual', { shouldDirty: true });
  };

  const updateOccurrenceDuration = (index: number, start: string, end: string) => {
    const hours = calculateHoursBetween(start, end);
    if (hours !== null) setValue(`ocorrencias.${index}.horas_impacto`, hours, { shouldDirty: true, shouldValidate: true });
  };

  const handleImageSelect = (file: File) => {
    setValue('imagens', [...watchImagens, file], { shouldDirty: true, shouldValidate: true });
  };

  const handleRemoveImage = (index: number) => {
    setValue(
      'imagens',
      watchImagens.filter((_, i) => i !== index),
      { shouldDirty: true, shouldValidate: true }
    );
  };

  const handleSignatureCapture = (dataUrl: string) => {
    setValue('assinatura', dataUrl, { shouldDirty: true, shouldValidate: true });
  };

  const handleInvalidSubmit = () => {
    setSubmitError('Revise os campos destacados e preencha os itens obrigatórios, incluindo a assinatura digital.');
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const onSubmit = async (data: RdoFormData) => {
    if (!user || !profile) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setUploadProgress(0);

    try {
      if (draftSaveTimer.current !== null) {
        window.clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = null;
      }
      if (draftSavePromise.current) await draftSavePromise.current;
      const submission = await enqueueSubmission(user.id, data);
      setQueuedSubmission({
        id: submission.id,
        rdoId: submission.rdoId,
        message: navigator.onLine
          ? 'RDO preparado para sincronização. Aguarde enquanto enviamos os dados.'
          : 'RDO e fotos salvos neste dispositivo. O envio para revisão começará automaticamente quando a conexão voltar.',
        status: 'pending',
        baseVersion: submission.baseVersion,
        serverVersion: null,
        serverSnapshot: null,
        mediaStatus: submission.mediaStatus,
      });

      if (!navigator.onLine) return;

      const result = await syncPendingRdos(user.id, (_submissionId, progress) => {
        setUploadProgress(progress);
      });
      if (result.synced.some(({ id }) => id === submission.id)) {
        setQueuedSubmission(null);
        setSubmitSuccess(true);
        reset();
        window.setTimeout(() => navigate(`/rdo/${submission.rdoId}`), 2000);
      } else {
        const failure = result.failed.find(({ id }) => id === submission.id);
        const savedSubmission = (await getPendingSubmissions(user.id))
          .find(({ id }) => id === submission.id);
        setQueuedSubmission({
          id: submission.id,
          rdoId: submission.rdoId,
          message: failure
            ? `O RDO continua salvo neste dispositivo e será reenviado quando houver conexão. ${failure.message}`
            : 'RDO salvo na fila deste dispositivo e será enviado automaticamente quando a conexão estiver disponível.',
          status: getRdoSyncQueueStatus(failure?.code),
          baseVersion: savedSubmission?.baseVersion ?? submission.baseVersion,
          serverVersion: failure?.serverVersion ?? null,
          serverSnapshot: failure?.serverSnapshot ?? null,
          mediaStatus: savedSubmission?.mediaStatus || submission.mediaStatus,
        });
      }
    } catch (cause) {
      console.error('[FormRdo] Erro ao preparar envio offline:', cause);
      setSubmitError(cause instanceof Error
        ? cause.message
        : 'Não foi possível salvar o RDO neste dispositivo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryQueuedSubmission = async () => {
    if (!user || !queuedSubmission || !navigator.onLine) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (queuedSubmission.status === 'intervention') {
        const submission = (await getPendingSubmissions(user.id))
          .find(({ id }) => id === queuedSubmission.id);
        if (!submission) throw new Error('O envio local não foi encontrado.');
        await updateSubmission({ ...submission, status: 'pending', lastError: null });
        setQueuedSubmission({ ...queuedSubmission, status: 'pending', message: 'Tentativa manual iniciada.' });
      }
      const result = await syncPendingRdos(user.id, (_submissionId, progress) => {
        setUploadProgress(progress);
      });
      if (result.synced.some(({ id }) => id === queuedSubmission.id)) {
        setQueuedSubmission(null);
        setSubmitSuccess(true);
        reset();
        window.setTimeout(() => navigate(`/rdo/${queuedSubmission.rdoId}`), 2000);
        return;
      }

      const failure = result.failed.find(({ id }) => id === queuedSubmission.id);
      if (failure) {
        const savedSubmission = (await getPendingSubmissions(user.id))
          .find(({ id }) => id === queuedSubmission.id);
        setQueuedSubmission({
          ...queuedSubmission,
          message: failure.message,
          status: getRdoSyncQueueStatus(failure.code),
          baseVersion: savedSubmission?.baseVersion ?? queuedSubmission.baseVersion,
          serverVersion: failure.serverVersion ?? null,
          serverSnapshot: failure.serverSnapshot ?? null,
          mediaStatus: savedSubmission?.mediaStatus || queuedSubmission.mediaStatus,
        });
      }
    } catch (cause) {
      console.error('[FormRdo] Falha ao tentar sincronizar novamente:', cause);
      setSubmitError(cause instanceof Error ? cause.message : 'Não foi possível sincronizar o RDO.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeepQueuedLocal = async () => {
    if (!user || !queuedSubmission || queuedSubmission.status === 'pending') return;
    if (!window.confirm('Manter os dados locais como rascunho neste dispositivo? O RDO atual do servidor será preservado.')) return;
    try {
      const submission = (await getPendingSubmissions(user.id))
        .find(({ id }) => id === queuedSubmission.id);
      if (!submission) throw new Error('O envio local não foi encontrado.');
      const restored = { ...submission.values, imagens: restoreImages(submission.values.imagens) };
      await saveDraft(user.id, restored);
      await removeSubmission(submission.id);
      reset(restored);
      setQueuedSubmission(null);
      setSubmitError(null);
    } catch (cause) {
      console.error('[FormRdo] Não foi possível manter o conflito como rascunho:', cause);
      setSubmitError(cause instanceof Error ? cause.message : 'Não foi possível preservar o rascunho local.');
    }
  };

  const handleAcceptQueuedServer = async () => {
    if (!user || !queuedSubmission || !queuedSubmission.serverSnapshot) return;
    if (!window.confirm('Aceitar os dados do servidor e remover a cópia local deste envio? Esta ação não pode ser desfeita.')) return;
    try {
      await removeSubmission(queuedSubmission.id);
      setQueuedSubmission(null);
      navigate(`/rdo/${queuedSubmission.rdoId}`);
    } catch (cause) {
      console.error('[FormRdo] Não foi possível remover o envio local aceito:', cause);
      setSubmitError(cause instanceof Error ? cause.message : 'Não foi possível aceitar a versão do servidor.');
    }
  };

  // Detectar mudanças de conectividade
  useEffect(() => {
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleSubmissionSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; rdoId: string }>).detail;
      if (!queuedSubmission || detail.id !== queuedSubmission.id) return;
      setQueuedSubmission(null);
      setSubmitSuccess(true);
      reset();
      window.setTimeout(() => navigate(`/rdo/${detail.rdoId}`), 2000);
    };

    window.addEventListener('offline-rdo-synced', handleSubmissionSynced);
    return () => window.removeEventListener('offline-rdo-synced', handleSubmissionSynced);
  }, [navigate, queuedSubmission, reset]);

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Novo Relatório Diário</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">Preencha os dados do RDO para sua unidade</p>
          </div>
          {offlineMode && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
              Sem conexão
            </Badge>
          )}
        </div>

        {offlineMode && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Modo offline: seus dados, assinatura e fotos ficam salvos neste dispositivo. O RDO será enviado para revisão automaticamente quando a conexão voltar, com o app aberto ou na próxima vez que você o abrir.
          </div>
        )}

        {/* Mensagens de Sucesso/Erro */}
        {isRestoringDraft && (
          <div role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Recuperando o rascunho salvo neste dispositivo...
          </div>
        )}

        {!isRestoringDraft && isDirty && !draftSaveError && (
          <div role="status" className="text-sm text-muted-foreground">
            {draftSaved ? 'Rascunho salvo neste dispositivo.' : 'Salvando rascunho neste dispositivo...'}
          </div>
        )}

        {draftSaveError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {draftSaveError}
          </div>
        )}

        {queuedSubmission && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{queuedSubmission.message}</p>
            {queuedSubmission.status === 'conflict' && queuedSubmission.serverVersion !== null && (
              <p className="mt-1">Versão local: {queuedSubmission.baseVersion}; versão do servidor: {queuedSubmission.serverVersion}. Seus dados locais continuam armazenados.</p>
            )}
            {queuedSubmission.mediaStatus.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {queuedSubmission.mediaStatus.map((media) => (
                  <li key={media.id}>
                    {media.label}: {media.status === 'uploaded' ? 'enviado' : media.status === 'failed' ? 'falhou' : 'aguardando'}
                    {media.error ? ` — ${media.error}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {offlineMode && <p className="mt-1">Mantenha a sessão autenticada; a fila é armazenada localmente por conta.</p>}
            {queuedSubmission.status !== 'pending' && (
              <div className="mt-2 flex flex-wrap gap-3">
                {queuedSubmission.status === 'intervention' && !offlineMode && (
                  <button
                    type="button"
                    className="font-semibold underline"
                    disabled={isSubmitting}
                    onClick={() => void handleRetryQueuedSubmission()}
                  >
                    {isSubmitting ? 'Sincronizando...' : 'Tentar novamente'}
                  </button>
                )}
                <button type="button" className="font-semibold underline" onClick={() => void handleKeepQueuedLocal()}>
                  Manter local como rascunho
                </button>
                {queuedSubmission.serverSnapshot && (
                  <button type="button" className="font-semibold underline" onClick={() => void handleAcceptQueuedServer()}>
                    Aceitar versão do servidor
                  </button>
                )}
              </div>
            )}
            {!offlineMode && queuedSubmission.status === 'pending' && (
              <button
                type="button"
                className="mt-2 font-semibold underline"
                disabled={isSubmitting}
                onClick={() => void handleRetryQueuedSubmission()}
              >
                {isSubmitting ? 'Sincronizando...' : 'Tentar sincronizar agora'}
              </button>
            )}
          </div>
        )}

        {submitSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-green-800 font-medium">
              RDO enviado para revisão com sucesso! Redirecionando...
            </span>
          </div>
        )}

        {unidadesError && unidades.length === 0 && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {offlineMode
              ? 'Nenhuma unidade salva foi encontrada neste dispositivo. Conecte-se à internet para carregar a lista antes de continuar.'
              : 'Não foi possível carregar as unidades. Verifique sua conexão e tente novamente.'}
            <button type="button" className="ml-2 font-semibold underline" onClick={() => void refetchUnidades()}>
              Tentar novamente
            </button>
          </div>
        )}

        {submitError && (
          <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-red-800 font-medium">{submitError}</span>
          </div>
        )}

        {/* Formulário */}
        <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <form
              onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}
              noValidate
              aria-busy={isRestoringDraft}
            >
              <fieldset
                disabled={isRestoringDraft || !!queuedSubmission}
                className="flex min-w-0 flex-col gap-10"
              >
              {/* Seção 1: Identificação */}
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <svg
                    className="h-5 w-5 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 4a2 2 0 012-2h6a2 2 0 012 2v12a1 1 0 110 2h-6a1 1 0 110-2h6V4H6v12a1 1 0 110 2H4a2 2 0 01-2-2V4z" />
                  </svg>
                  Identificação do Relatório
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,1.35fr)]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label htmlFor="numero">Número do RDO</Label><HelpTooltip label="Número do RDO" content="Use a identificação adotada pela equipe para localizar este relatório." /></div>
                    <Input
                      id="numero"
                      {...register('numero')}
                      placeholder="RDO-001"
                      className="bg-background"
                      aria-invalid={!!errors.numero}
                    />
                    {errors.numero && (
                      <p className="text-xs text-red-500">{errors.numero.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label htmlFor="data">Data</Label><HelpTooltip label="Data do RDO" content="Informe o dia em que os serviços descritos neste relatório foram executados." /></div>
                    <Input
                      id="data"
                      type="date"
                      {...register('data')}
                      className="bg-background"
                      aria-invalid={!!errors.data}
                    />
                    {errors.data && (
                      <p className="text-xs text-red-500">{errors.data.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label id="unidade-label" htmlFor="unidade_id">Unidade</Label><HelpTooltip label="Unidade" content="Selecione a unidade ou frente de trabalho a que este relatório pertence." /></div>
                    <Controller
                      name="unidade_id"
                      control={control}
                      render={({ field }) => (
                        <SearchableCombobox
                          id="unidade_id"
                          labelId="unidade-label"
                          value={field.value || ''}
                          options={unidades.map((unit) => ({
                            value: unit.id,
                            label: `${unit.codigo} — ${unit.nome || 'Unidade sem nome'}`,
                          }))}
                          loading={loadingUnidades}
                          hasError={!!unidadesError}
                          invalid={!!errors.unidade_id}
                          onRetry={() => void refetchUnidades()}
                          onEmptyAction={profile?.profile === 'admin' ? () => navigate('/admin/unidades') : undefined}
                          emptyActionLabel={profile?.profile === 'admin' ? 'Cadastrar unidades' : 'Fale com o administrador'}
                          emptyMessage={profile?.profile === 'admin'
                            ? 'Cadastre as unidades da obra para liberar o preenchimento do RDO.'
                            : 'Nenhuma unidade foi configurada. Solicite ao administrador que cadastre as unidades da obra.'}
                          searchPlaceholder="Digite o código ou nome..."
                          loadingMessage="Carregando unidades..."
                          onBlur={field.onBlur}
                          onChange={(value) => {
                            field.onChange(value);
                            setSubmitError(null);
                          }}
                        />
                      )}
                    />
                    {errors.unidade_id && (
                      <p className="text-xs text-red-500">{errors.unidade_id.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção 2: Horas de Trabalho */}
              <div className="space-y-4 rounded-xl border bg-muted/40 p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <svg
                    className="h-5 w-5 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Controle de Horas
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label htmlFor="hh_planejado">HH Planejado</Label><HelpTooltip label="Horas-homem planejadas" content="Informe o total de horas-homem previsto para o serviço neste RDO." /></div>
                    <Input
                      id="hh_planejado"
                      type="number"
                      step="0.5"
                      {...register('hh_planejado', { valueAsNumber: true })}
                      className="bg-background"
                      aria-invalid={!!errors.hh_planejado}
                    />
                    {errors.hh_planejado && (
                      <p className="text-xs text-red-500">{errors.hh_planejado.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label htmlFor="hh_realizado">HH Realizado</Label><HelpTooltip label="Horas-homem realizadas" content="Informe o total de horas-homem efetivamente trabalhado. O sistema calcula o desvio em relação ao planejado." /></div>
                    <Input
                      id="hh_realizado"
                      type="number"
                      step="0.5"
                      {...register('hh_realizado', { valueAsNumber: true })}
                      className="bg-background"
                      aria-invalid={!!errors.hh_realizado}
                    />
                    {errors.hh_realizado && (
                      <p className="text-xs text-red-500">{errors.hh_realizado.message}</p>
                    )}
                  </div>
                </div>

                {watchHhPlanejado > 0 && (
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-sm font-bold text-foreground">
                      Desvio Calculado:{' '}
                      <span
                        className={
                          ((watchHhRealizado || 0) - watchHhPlanejado) / watchHhPlanejado > 0
                            ? 'text-red-600'
                            : 'text-green-600'
                        }
                      >
                        {(
                          (((watchHhRealizado || 0) - watchHhPlanejado) / watchHhPlanejado) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Seção 3: Disciplina e Observações */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-foreground">Informações Adicionais</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label>Disciplina</Label><HelpTooltip label="Disciplina" content="Escolha a área principal dos serviços registrados, se aplicável." /></div>
                    <Controller
                      name="disciplina"
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={(value) => field.onChange(value === 'nenhuma' ? undefined : value)}
                          value={field.value || 'nenhuma'}
                        >
                          <SelectTrigger className="w-full bg-background">
                            <SelectValue placeholder="Selecione a disciplina" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhuma">Nenhuma</SelectItem>
                            <SelectItem value="automacao">Automação</SelectItem>
                            <SelectItem value="instrumentacao">Instrumentação</SelectItem>
                            <SelectItem value="eletrica">Elétrica</SelectItem>
                            <SelectItem value="civil">Construção e Montagem</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="engenheiro_obs">Observações do Engenheiro</Label><HelpTooltip label="Observações do engenheiro" content="Registre informações técnicas, decisões e pontos de atenção relacionados ao serviço." /></div>
                  <Textarea
                    id="engenheiro_obs"
                    {...register('engenheiro_obs')}
                    placeholder="Adicione observações técnicas..."
                    rows={3}
                    className="bg-background"
                  />
                  {errors.engenheiro_obs && (
                    <p className="text-xs text-red-500">{errors.engenheiro_obs.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="coordenador_obs">Observações do Coordenador</Label><HelpTooltip label="Observações do coordenador" content="Registre orientações de coordenação e informações relevantes para a equipe." /></div>
                  <Textarea
                    id="coordenador_obs"
                    {...register('coordenador_obs')}
                    placeholder="Adicione observações de coordenação..."
                    rows={3}
                    className="bg-background"
                  />
                  {errors.coordenador_obs && (
                    <p className="text-xs text-red-500">{errors.coordenador_obs.message}</p>
                  )}
                </div>
              </div>

              <details open className="rdo-operational-section group space-y-4 rounded-xl border bg-card p-4 sm:p-5">
                <summary className="cursor-pointer text-lg font-bold text-foreground">Clima</summary>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CloudSun className="size-4 shrink-0" />
                  <p>{weatherMessage || 'O clima é consultado pelas coordenadas cadastradas na unidade; a consulta nunca bloqueia o salvamento.'}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clima-condicao">Condição</Label>
                    <Input
                      id="clima-condicao"
                      value={watchWeatherCondition || ''}
                      onChange={(event) => {
                        setValue('clima_condicao', event.target.value, { shouldDirty: true, shouldValidate: true });
                        handleWeatherManualChange();
                      }}
                      placeholder="Ex.: parcialmente nublado"
                    />
                    {errors.clima_condicao && <p className="text-sm text-destructive">{errors.clima_condicao.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clima-temperatura">Temperatura (°C)</Label>
                    <Input
                      id="clima-temperatura"
                      type="number"
                      step="0.1"
                      value={watchWeatherTemperature ?? ''}
                      onChange={(event) => {
                        setValue('clima_temperatura', event.target.value === '' ? null : Number(event.target.value), { shouldDirty: true, shouldValidate: true });
                        handleWeatherManualChange();
                      }}
                      placeholder="Ex.: 28"
                    />
                    {errors.clima_temperatura && <p className="text-sm text-destructive">{errors.clima_temperatura.message}</p>}
                  </div>
                </div>
                {watch('clima_origem') && <p className="text-xs text-muted-foreground">Origem: {watch('clima_origem') === 'automatico' ? 'Open-Meteo (automática)' : 'preenchimento manual'}</p>}
              </details>

              <details open className={`rdo-operational-section group space-y-4 rounded-xl border p-4 sm:p-5 ${copiedOperationalData ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}>
                <summary className="cursor-pointer text-lg font-bold text-foreground">Efetivo por função</summary>
                {functionsError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as funções. {getOperationalCatalogErrorMessage(functionsError)} <button type="button" className="font-semibold underline" onClick={() => void refetchFunctions()}>Tentar novamente</button></p>}
                {copiedOperationalData && <p className="text-sm font-medium text-primary">Dados estruturais copiados do RDO anterior. Confira antes de enviar.</p>}
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => appendWorkforce({ funcao_id: '', quantidade: 1, horas_trabalhadas: 0 })}>
                    <Plus className="size-4" /> Adicionar função
                  </Button>
                </div>
                {workforceFields.map((field, index) => (
                  <div key={field.id} className="rdo-entry-grid rdo-entry-grid--workforce rounded-lg border bg-background p-3">
                    <div className="space-y-2">
                      <Label htmlFor={`workforce-role-${index}`}>Função</Label>
                      <Controller
                        name={`efetivo.${index}.funcao_id`}
                        control={control}
                        render={({ field: input }) => (
                          <Select value={input.value || 'select'} onValueChange={(value) => input.onChange(value === 'select' ? '' : value)}>
                            <SelectTrigger id={`workforce-role-${index}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="select">Selecione uma função</SelectItem>
                              {funcoes.filter((funcao) => !funcao.deleted_at || funcao.id === watch(`efetivo.${index}.funcao_id`))
                                .map((funcao) => <SelectItem key={funcao.id} value={funcao.id}>{funcao.nome}{funcao.deleted_at ? ' (arquivada)' : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.efetivo?.[index]?.funcao_id && <p className="text-xs text-destructive">{errors.efetivo[index]?.funcao_id?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input type="number" min="1" step="1" {...register(`efetivo.${index}.quantidade`, { valueAsNumber: true })} />
                      {errors.efetivo?.[index]?.quantidade && <p className="text-xs text-destructive">{errors.efetivo[index]?.quantidade?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Horas realizadas</Label>
                      <Input type="number" min="0" step="0.25" {...register(`efetivo.${index}.horas_trabalhadas`, { valueAsNumber: true })} />
                      {errors.efetivo?.[index]?.horas_trabalhadas && <p className="text-xs text-destructive">{errors.efetivo[index]?.horas_trabalhadas?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Matrícula (opcional)</Label>
                      <Input {...register(`efetivo.${index}.matricula`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome (opcional)</Label>
                      <Input {...register(`efetivo.${index}.nome`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Identificador ERP</Label>
                      <Input {...register(`efetivo.${index}.identificador_externo`)} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeWorkforce(index)} aria-label="Remover função do efetivo">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {workforceFields.length === 0 && <p className="text-sm text-muted-foreground">Adicione as funções presentes na obra para registrar o efetivo.</p>}
              </details>

              <details open className={`rdo-operational-section group space-y-4 rounded-xl border p-4 sm:p-5 ${copiedOperationalData ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}>
                <summary className="cursor-pointer text-lg font-bold text-foreground">Equipamentos</summary>
                {equipmentCatalogError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os equipamentos. {getOperationalCatalogErrorMessage(equipmentCatalogError)} <button type="button" className="font-semibold underline" onClick={() => void refetchEquipment()}>Tentar novamente</button></p>}
                {copiedOperationalData && <p className="text-sm font-medium text-primary">Equipamentos copiados do RDO anterior. Horas de uso foram zeradas; confira a lista.</p>}
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => appendEquipment({ equipamento_id: '', horas_uso: 0, observacao: '' })}>
                    <Plus className="size-4" /> Adicionar equipamento
                  </Button>
                </div>
                {equipmentFields.map((field, index) => (
                  <div key={field.id} className="rdo-entry-grid rdo-entry-grid--equipment rounded-lg border bg-background p-3">
                    <div className="space-y-2">
                      <Label htmlFor={`equipment-${index}`}>Equipamento</Label>
                      <Controller
                        name={`equipamentos.${index}.equipamento_id`}
                        control={control}
                        render={({ field: input }) => (
                          <Select value={input.value || 'select'} onValueChange={(value) => input.onChange(value === 'select' ? '' : value)}>
                            <SelectTrigger id={`equipment-${index}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="select">Selecione um equipamento</SelectItem>
                              {equipamentosDisponiveis
                                .filter((equipment) => !equipment.deleted_at || equipment.id === watch(`equipamentos.${index}.equipamento_id`))
                                .filter((equipment) => !equipment.unidade_id || equipment.unidade_id === watchUnidadeId)
                                .map((equipment) => <SelectItem key={equipment.id} value={equipment.id}>{equipment.nome}{equipment.deleted_at ? ' (arquivado)' : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.equipamentos?.[index]?.equipamento_id && <p className="text-xs text-destructive">{errors.equipamentos[index]?.equipamento_id?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Horas de uso</Label>
                      <Input type="number" min="0" step="0.25" {...register(`equipamentos.${index}.horas_uso`, { valueAsNumber: true })} />
                      {errors.equipamentos?.[index]?.horas_uso && <p className="text-xs text-destructive">{errors.equipamentos[index]?.horas_uso?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Observação</Label>
                      <Input {...register(`equipamentos.${index}.observacao`)} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEquipment(index)} aria-label="Remover equipamento">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {equipmentFields.length === 0 && <p className="text-sm text-muted-foreground">Adicione os equipamentos utilizados no dia.</p>}
              </details>

              <details open className="rdo-operational-section group space-y-4 rounded-xl border bg-card p-4 sm:p-5">
                <summary className="cursor-pointer text-lg font-bold text-foreground">Ocorrências e paralisações</summary>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => appendOccurrence({ tipo: 'outro', descricao: '', inicio: '', fim: '', horas_impacto: 0, responsavel: '' })}>
                    <Plus className="size-4" /> Adicionar ocorrência
                  </Button>
                </div>
                {occurrenceFields.map((field, index) => {
                  const startInput = register(`ocorrencias.${index}.inicio`);
                  const endInput = register(`ocorrencias.${index}.fim`);
                  return (
                    <div key={field.id} className="space-y-3 rounded-lg border bg-background p-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,1fr)_minmax(12rem,2fr)_1fr_1fr]">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={watch(`ocorrencias.${index}.tipo`)} onValueChange={(value) => setValue(`ocorrencias.${index}.tipo`, value as typeof field.tipo, { shouldDirty: true, shouldValidate: true })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {occurrenceTypes.map((option) => <SelectItem key={option.codigo} value={option.codigo}>{option.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Input {...register(`ocorrencias.${index}.descricao`)} />
                          {errors.ocorrencias?.[index]?.descricao && <p className="text-xs text-destructive">{errors.ocorrencias[index]?.descricao?.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Início</Label>
                          <Input type="datetime-local" {...startInput} onChange={(event) => {
                            void startInput.onChange(event);
                            updateOccurrenceDuration(index, event.target.value, getValues(`ocorrencias.${index}.fim`) || '');
                          }} />
                        </div>
                        <div className="space-y-2">
                          <Label>Fim</Label>
                          <Input type="datetime-local" {...endInput} onChange={(event) => {
                            void endInput.onChange(event);
                            updateOccurrenceDuration(index, getValues(`ocorrencias.${index}.inicio`) || '', event.target.value);
                          }} />
                          {errors.ocorrencias?.[index]?.fim && <p className="text-xs text-destructive">{errors.ocorrencias[index]?.fim?.message}</p>}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
                        <div className="space-y-2">
                          <Label>Horas de impacto</Label>
                          <Input type="number" min="0" step="0.25" {...register(`ocorrencias.${index}.horas_impacto`, { valueAsNumber: true })} />
                          {errors.ocorrencias?.[index]?.horas_impacto && <p className="text-xs text-destructive">{errors.ocorrencias[index]?.horas_impacto?.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Responsável</Label>
                          <Input {...register(`ocorrencias.${index}.responsavel`)} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOccurrence(index)} aria-label="Remover ocorrência">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {occurrenceFields.length === 0 && <p className="text-sm text-muted-foreground">Registre paralisações e ocorrências que impactaram os serviços.</p>}
                {occurrenceTypesError && <p role="status" className="text-xs text-amber-700">Não foi possível carregar o catálogo; usando as opções padrão disponíveis. {getOperationalCatalogErrorMessage(occurrenceTypesError)} <button type="button" className="font-semibold underline" onClick={() => void refetchOccurrenceTypes()}>Tentar novamente</button></p>}
              </details>

              {/* Seção 4: Materiais */}
              <div className={`space-y-4 rounded-xl p-1 ${copiedOperationalData ? 'border border-primary/50 bg-primary/5 p-4' : ''}`}>
                {copiedOperationalData && <p className="text-sm font-medium text-primary">Materiais copiados do RDO anterior. Confira as quantidades.</p>}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <svg
                      className="h-5 w-5 text-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                    </svg>
                    Materiais e Insumos
                    <HelpTooltip label="Materiais e insumos" content="Registre os principais materiais usados no serviço e selecione a unidade de medida na lista." />
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDuplicatePrevious()}
                      disabled={isDuplicating || offlineMode || !watchUnidadeId}
                    >
                      {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                      {isDuplicating ? 'Buscando...' : 'Duplicar RDO anterior'}
                    </Button>
                    <Button type="button" size="sm" onClick={handleAddMaterial}>
                      Adicionar item
                    </Button>
                  </div>
                </div>

                {duplicateMessage && (
                  <p
                    aria-live="polite"
                    className={`rounded-lg border p-3 text-sm ${
                      duplicateMessage.type === 'success'
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    {duplicateMessage.text}
                  </p>
                )}

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 items-end gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]"
                    >
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <div className="flex items-center gap-2"><Label className="text-xs font-bold uppercase text-muted-foreground">Descrição</Label><HelpTooltip label="Descrição do material" content="Informe o nome do material ou insumo utilizado." /></div>
                        <Input
                          placeholder="Ex: Cimento, Areia, Tubo PVC..."
                          {...register(`materiais.${index}.material`)}
                          className="mt-1 bg-background"
                          aria-invalid={!!errors.materiais?.[index]?.material}
                        />
                        {errors.materiais?.[index]?.material && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.materiais[index]?.material?.message}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><Label className="text-xs font-bold uppercase text-muted-foreground">Quantidade</Label><HelpTooltip label="Quantidade do material" content="Informe quanto foi utilizado. Use apenas valores maiores que zero." /></div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...register(`materiais.${index}.quantidade`, {
                            valueAsNumber: true,
                          })}
                          className="mt-1 bg-background"
                          aria-invalid={!!errors.materiais?.[index]?.quantidade}
                        />
                        {errors.materiais?.[index]?.quantidade && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.materiais[index]?.quantidade?.message}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><Label id={`material-unit-label-${index}`} className="text-xs font-bold uppercase text-muted-foreground">Unidade</Label><HelpTooltip label="Unidade de medida" content="Pesquise e selecione a unidade de medida do material." /></div>
                        <Controller
                          name={`materiais.${index}.unidade_medida`}
                          control={control}
                          render={({ field }) => (
                            <SearchableCombobox
                              id={`material-unit-${index}`}
                              labelId={`material-unit-label-${index}`}
                              value={field.value && isMeasurementUnit(field.value) ? field.value : field.value ? `legacy:${field.value}` : 'nao-informada'}
                              options={[
                                { value: 'nao-informada', label: 'Não informada' },
                                ...(field.value && !isMeasurementUnit(field.value)
                                  ? [{ value: `legacy:${field.value}`, label: `Unidade atual: ${field.value}` }]
                                  : []),
                                ...MEASUREMENT_UNITS.map((unit) => ({ value: unit.value, label: unit.label })),
                              ]}
                              placeholder="Selecione a unidade"
                              searchPlaceholder="Buscar unidade de medida..."
                              onChange={(value) => field.onChange(value === 'nao-informada' ? '' : value.startsWith('legacy:') ? value.slice(7) : value)}
                              invalid={!!errors.materiais?.[index]?.unidade_medida}
                              onBlur={field.onBlur}
                            />
                          )}
                        />
                      </div>

                      <button
                        type="button"
                        title="Remover material"
                        onClick={() => remove(index)}
                        className="col-start-2 row-start-2 min-h-11 justify-self-end rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100 sm:col-start-auto sm:row-start-auto"
                      >
                        <svg
                          className="w-5 h-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {errors.materiais && (
                  <p className="text-xs text-red-500">{errors.materiais.message}</p>
                )}
              </div>

              {/* Seção 5: Imagens */}
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <svg
                    className="h-5 w-5 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                  </svg>
                  Registros Fotográficos
                </h2>

                <ImageUpload onImageSelect={handleImageSelect} />

                {watchImagens.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {watchImagens.map((file, i) => (
                      <div
                        key={i}
                        className="relative group aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500 p-2 text-center font-semibold">
                          {file.name.slice(0, 20)}
                        </div>
                        <button
                          type="button"
                          title="Remover imagem"
                          onClick={() => handleRemoveImage(i)}
                          className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg
                            className="w-4 h-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {errors.imagens && (
                  <p className="text-xs text-red-500">{errors.imagens.message}</p>
                )}
              </div>

              {/* Seção 6: Assinatura */}
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Assinatura Digital
                </h2>

                <SignaturePad
                  label="Clique para assinar"
                  onSignatureCapture={handleSignatureCapture}
                />

                {watchAssinatura && (
                  <div className="inline-block rounded-lg border bg-muted/40 p-3">
                    <img src={watchAssinatura} alt="Assinatura" className="h-20" />
                  </div>
                )}

                {errors.assinatura && (
                  <p className="text-xs text-red-500">{errors.assinatura.message}</p>
                )}
              </div>

              {/* Barra de Progresso */}
              {isSubmitting && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">Enviando...</p>
                    <p className="text-sm font-bold text-primary">{uploadProgress}%</p>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="pt-6 border-t flex gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting || isRestoringDraft || !!queuedSubmission}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="w-5 h-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    offlineMode ? 'Salvar e enviar ao reconectar' : 'Finalizar e Enviar Relatório'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="h-12 rounded-xl border border-input bg-background px-6 py-3 font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default FormRdo;
