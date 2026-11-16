import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SearchableCombobox from '@/components/form/SearchableCombobox';
import ImageUpload from '@/components/form/ImageUpload';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import type {
  Disciplina,
  EquipamentosRow,
  FuncoesRow,
  MateriaisRdoRow,
  RdoEfetivoRow,
  RdoEquipamentosRow,
  RdoOcorrenciasRow,
  RdosRow,
  UnidadesRow,
} from '@/types/database';
import { isMeasurementUnit, MEASUREMENT_UNITS } from '@/utils/measurementUnits';
import {
  calculateHoursBetween,
  equipmentEntrySchema,
  OCCURRENCE_TYPE_OPTIONS,
  occurrenceEntrySchema,
  workforceEntrySchema,
} from '@/utils/rdoOperational';
import {
  buildAtomicRdoPayload,
  getAtomicRdoRpcErrorMessage,
  parseAtomicRdoSaveResult,
} from '@/utils/rdoAtomicSave';

const MATERIAL_SCHEMA = z.object({
  id: z.string().optional(),
  material: z.string().trim().min(1, 'Informe o material.'),
  quantidade: z.number().min(0.01, 'A quantidade precisa ser maior que zero.'),
  unidade_medida: z.string().max(20).nullable().optional(),
});

const EDIT_WORKFORCE_SCHEMA = workforceEntrySchema.extend({ id: z.string().uuid().optional() });
const EDIT_EQUIPMENT_SCHEMA = equipmentEntrySchema.extend({ id: z.string().uuid().optional() });
const EDIT_OCCURRENCE_SCHEMA = occurrenceEntrySchema.extend({ id: z.string().uuid().optional() });

const FORM_SCHEMA = z.object({
  numero: z.string().trim().min(1, 'Informe o número do RDO.'),
  data: z.string().min(1, 'Informe a data.'),
  unidade_id: z.string().uuid('Selecione uma unidade.'),
  hh_planejado: z.number().min(0.5, 'O mínimo é 0,5 hora.'),
  hh_realizado: z.number().min(0, 'O valor não pode ser negativo.').nullable(),
  disciplina: z.enum(['automacao', 'instrumentacao', 'eletrica', 'civil']).nullable(),
  engenheiro_obs: z.string().max(500).nullable(),
  coordenador_obs: z.string().max(500).nullable(),
  materiais: z.array(MATERIAL_SCHEMA),
  clima_condicao: z.string().max(120).nullable(),
  clima_temperatura: z.number().min(-100).max(100).nullable(),
  clima_origem: z.enum(['automatico', 'manual']).nullable(),
  efetivo: z.array(EDIT_WORKFORCE_SCHEMA),
  equipamentos: z.array(EDIT_EQUIPMENT_SCHEMA),
  ocorrencias: z.array(EDIT_OCCURRENCE_SCHEMA),
});

type EditFormData = z.infer<typeof FORM_SCHEMA>;

type EditablePhoto = {
  id: string;
  url: string;
  descricao: string | null;
  created_at: string;
};

type PendingPhoto = {
  id: string;
  file: File;
};

const toLocalDateTime = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function snapshotToForm(snapshot: Record<string, unknown>): EditFormData {
  const rows = (key: string) => Array.isArray(snapshot[key])
    ? (snapshot[key] as unknown[]).filter(isRecord)
    : [];
  const toStringOrEmpty = (value: unknown) => typeof value === 'string' ? value : '';
  const toNumberOrNull = (value: unknown) => typeof value === 'number' ? value : null;
  const parsed = FORM_SCHEMA.safeParse({
    numero: toStringOrEmpty(snapshot.numero),
    data: toStringOrEmpty(snapshot.data),
    unidade_id: toStringOrEmpty(snapshot.unidade_id),
    hh_planejado: typeof snapshot.hh_planejado === 'number' ? snapshot.hh_planejado : 8,
    hh_realizado: toNumberOrNull(snapshot.hh_realizado),
    disciplina: snapshot.disciplina || null,
    engenheiro_obs: snapshot.engenheiro_obs || '',
    coordenador_obs: snapshot.coordenador_obs || '',
    materiais: rows('materials').map((item) => ({
      id: item.id,
      material: item.material,
      quantidade: item.quantidade,
      unidade_medida: item.unidade_medida,
    })),
    clima_condicao: snapshot.clima_condicao || null,
    clima_temperatura: toNumberOrNull(snapshot.clima_temperatura),
    clima_origem: snapshot.clima_origem || null,
    efetivo: rows('workforce').map((item) => ({
      id: item.id,
      funcao_id: item.funcao_id,
      quantidade: item.quantidade,
      horas_trabalhadas: item.horas_trabalhadas,
      matricula: item.matricula || '',
      nome: item.nome || '',
      identificador_externo: item.identificador_externo || '',
    })),
    equipamentos: rows('equipment').map((item) => ({
      id: item.id,
      equipamento_id: item.equipamento_id,
      horas_uso: item.horas_uso,
      observacao: item.observacao || '',
    })),
    ocorrencias: rows('occurrences').map((item) => ({
      id: item.id,
      tipo: item.tipo,
      descricao: item.descricao,
      inicio: toLocalDateTime(typeof item.inicio === 'string' ? item.inicio : null),
      fim: toLocalDateTime(typeof item.fim === 'string' ? item.fim : null),
      horas_impacto: item.horas_impacto,
      responsavel: item.responsavel || '',
    })),
  });
  if (!parsed.success) {
    throw new Error('A versão do servidor contém dados que não podem ser carregados no formulário.');
  }
  return parsed.data;
}

const EditRdo: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<PendingPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [conflict, setConflict] = useState<{
    serverVersion: number;
    serverValues: EditFormData;
  } | null>(null);
  const [conflictChoices, setConflictChoices] = useState<Partial<Record<keyof EditFormData, 'local' | 'server'>>>({});
  const requestRef = useRef<{ fingerprint: string; requestId: string; payload: ReturnType<typeof buildAtomicRdoPayload> } | null>(null);
  const copyTargetRef = useRef<{ fingerprint: string; rdoId: string } | null>(null);

  const { data: rdo, isLoading: loadingRdo, error: rdoError } = useQuery<RdosRow>({
    queryKey: ['edit-rdo', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rdos')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: materiais = [], isLoading: loadingMateriais } = useQuery<MateriaisRdoRow[]>({
    queryKey: ['edit-rdo-materiais', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materiais_rdo')
        .select('*')
        .eq('rdo_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: unidades = [], isLoading: loadingUnidades, error: unidadesError, refetch: refetchUnidades } = useQuery<UnidadesRow[]>({
    queryKey: ['unidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .is('deleted_at', null)
        .order('nome', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: funcoes = [], isError: functionsError } = useQuery<FuncoesRow[]>({
    queryKey: ['funcoes-rdo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcoes').select('*').order('nome');
      if (error) throw error;
      return data || [];
    },
  });
  const { data: equipamentosDisponiveis = [], isError: equipmentCatalogError } = useQuery<EquipamentosRow[]>({
    queryKey: ['equipamentos-rdo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipamentos').select('*').order('nome');
      if (error) throw error;
      return data || [];
    },
  });
  const { data: occurrenceTypes = OCCURRENCE_TYPE_OPTIONS, isError: occurrenceTypesError } = useQuery({
    queryKey: ['rdo-occurrence-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_ocorrencia').select('codigo, nome, ordem').order('ordem');
      if (error) throw error;
      return data;
    },
  });
  const { data: efetivo = [], isLoading: loadingEfetivo, isError: workforceError } = useQuery<RdoEfetivoRow[]>({
    queryKey: ['edit-rdo-efetivo', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('rdo_efetivo').select('*').eq('rdo_id', id).order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
  const { data: equipamentosRdo = [], isLoading: loadingEquipamentos, isError: equipmentError } = useQuery<RdoEquipamentosRow[]>({
    queryKey: ['edit-rdo-equipamentos', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('rdo_equipamentos').select('*').eq('rdo_id', id).order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
  const { data: ocorrencias = [], isLoading: loadingOcorrencias, isError: occurrencesError } = useQuery<RdoOcorrenciasRow[]>({
    queryKey: ['edit-rdo-ocorrencias', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('rdo_ocorrencias').select('*').eq('rdo_id', id).order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: photos = [], isLoading: loadingPhotos, isError: photosError } = useQuery<EditablePhoto[]>({
    queryKey: ['edit-rdo-evidencias', id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidencias_rdo')
        .select('id, url, descricao, created_at')
        .eq('rdo_id', id)
        .eq('tipo', 'foto')
        .order('created_at', { ascending: false });
      if (error) throw error;

      return Promise.all((data || []).map(async (photo) => {
        const { data: signedUrl, error: signedUrlError } = await supabase.storage
          .from('evidencias')
          .createSignedUrl(photo.url, 10 * 60);
        if (signedUrlError) throw signedUrlError;
        return { ...photo, url: signedUrl.signedUrl };
      }));
    },
  });

  const form = useForm<EditFormData>({
    resolver: zodResolver(FORM_SCHEMA),
    defaultValues: {
      numero: '',
      data: '',
      unidade_id: '',
      hh_planejado: 8,
      hh_realizado: null,
      disciplina: null,
      engenheiro_obs: '',
      coordenador_obs: '',
      materiais: [],
      clima_condicao: null,
      clima_temperatura: null,
      clima_origem: null,
      efetivo: [],
      equipamentos: [],
      ocorrencias: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'materiais' });
  const { fields: workforceFields, append: appendWorkforce, remove: removeWorkforce } = useFieldArray({ control: form.control, name: 'efetivo' });
  const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment } = useFieldArray({ control: form.control, name: 'equipamentos' });
  const { fields: occurrenceFields, append: appendOccurrence, remove: removeOccurrence } = useFieldArray({ control: form.control, name: 'ocorrencias' });

  useEffect(() => {
    if (!rdo) return;
    form.reset({
      numero: rdo.numero || '',
      data: rdo.data,
      unidade_id: rdo.unidade_id,
      hh_planejado: rdo.hh_planejado,
      hh_realizado: rdo.hh_realizado,
      disciplina: (rdo.disciplina as Disciplina | null) || null,
      engenheiro_obs: rdo.engenheiro_obs || '',
      coordenador_obs: rdo.coordenador_obs || '',
      materiais: materiais.map(({ id: materialId, material, quantidade, unidade_medida }) => ({
        id: materialId,
        material,
        quantidade,
        unidade_medida,
      })),
      clima_condicao: rdo.clima_condicao,
      clima_temperatura: rdo.clima_temperatura,
      clima_origem: rdo.clima_origem,
      efetivo: efetivo.map(({ id: entryId, funcao_id, quantidade, horas_trabalhadas, matricula, nome, identificador_externo }) => ({
        id: entryId,
        funcao_id,
        quantidade,
        horas_trabalhadas,
        matricula: matricula || '',
        nome: nome || '',
        identificador_externo: identificador_externo || '',
      })),
      equipamentos: equipamentosRdo.map(({ id: entryId, equipamento_id, horas_uso, observacao }) => ({
        id: entryId,
        equipamento_id,
        horas_uso,
        observacao: observacao || '',
      })),
      ocorrencias: ocorrencias.map(({ id: entryId, tipo, descricao, inicio, fim, horas_impacto, responsavel }) => ({
        id: entryId,
        tipo,
        descricao,
        inicio: toLocalDateTime(inicio),
        fim: toLocalDateTime(fim),
        horas_impacto,
        responsavel: responsavel || '',
      })),
    });
  }, [rdo, materiais, efetivo, equipamentosRdo, ocorrencias, form]);

  const canManageRdo = !!user && !!rdo && (
    rdo.user_id === user.id || (profile && ['admin', 'supervisor', 'engenheiro'].includes(profile.profile))
  );
  const canEdit = canManageRdo && (rdo.status === 'draft' || rdo.status === 'rejected');
  const canAddEvidence = canManageRdo
    && (rdo.status === 'draft' || rdo.status === 'rejected' || rdo.status === 'submitted');
  const operationalDataError = functionsError || equipmentCatalogError || occurrenceTypesError || workforceError || equipmentError || occurrencesError;

  const handlePhotoSelected = useCallback((file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Use uma foto JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('A foto deve ter no máximo 10 MiB.');
      return;
    }
    setPhotoError(null);
    setSelectedPhotos((current) => [...current, { id: crypto.randomUUID(), file }]);
  }, []);

  const handleUploadPhotos = async () => {
    if (!id || !canAddEvidence || selectedPhotos.length === 0 || isUploadingPhotos) return;
    setIsUploadingPhotos(true);
    setPhotoError(null);
    const failedPhotos: PendingPhoto[] = [];
    let uploadedCount = 0;

    for (const photo of selectedPhotos) {
      const extension = photo.file.type === 'image/png' ? 'png' : photo.file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${id}/${photo.id}.${extension}`;
      try {
        const { data: existingEvidence, error: existingEvidenceError } = await supabase
          .from('evidencias_rdo')
          .select('url')
          .eq('id', photo.id)
          .maybeSingle();
        if (existingEvidenceError) throw existingEvidenceError;
        if (existingEvidence && existingEvidence.url !== path) {
          throw new Error('O identificador desta foto já está associado a outra evidência.');
        }

        if (!existingEvidence) {
          const { data: existingObjects, error: listError } = await supabase.storage
            .from('evidencias')
            .list(id, { search: `${photo.id}.${extension}`, limit: 100 });
          if (listError) throw listError;
          const objectAlreadyUploaded = existingObjects.some((object) => object.name === `${photo.id}.${extension}`);

          if (!objectAlreadyUploaded) {
            const { error: uploadError } = await supabase.storage
              .from('evidencias')
              .upload(path, photo.file, { contentType: photo.file.type, upsert: false });
            if (uploadError) throw uploadError;
          }

          const { error: insertError } = await supabase.from('evidencias_rdo').insert({
            id: photo.id,
            rdo_id: id,
            tipo: 'foto',
            url: path,
            descricao: photo.file.name.slice(0, 500),
          });
          if (insertError) throw insertError;
        }

        setSelectedPhotos((current) => current.filter((entry) => entry.id !== photo.id));
        uploadedCount += 1;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Falha ao anexar a foto.';
        failedPhotos.push(photo);
        setPhotoError((current) => current
          ? `${current} ${photo.file.name}: ${message}`
          : `${photo.file.name}: ${message}`);
      }
    }

    setSelectedPhotos(failedPhotos);
    setIsUploadingPhotos(false);
    if (uploadedCount > 0) {
      success(`${uploadedCount} foto(s) anexada(s) ao RDO.`);
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['edit-rdo-evidencias', id] }),
          queryClient.invalidateQueries({ queryKey: ['rdo-complementos', id] }),
        ]);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Não foi possível atualizar a lista de fotos.';
        setPhotoError(message);
      }
    }
  };

  const saveAtomically = async (
    values: EditFormData,
    target: { rdoId: string; baseVersion: number; asCopy?: boolean },
  ) => {
    const fingerprint = JSON.stringify({ target, values });
    if (!requestRef.current || requestRef.current.fingerprint !== fingerprint) {
      const requestId = crypto.randomUUID();
      const atomicValues = target.asCopy
        ? {
          ...values,
          materiais: values.materiais.map(({ id: _id, ...entry }) => entry),
          efetivo: values.efetivo.map(({ id: _id, ...entry }) => entry),
          equipamentos: values.equipamentos.map(({ id: _id, ...entry }) => entry),
          ocorrencias: values.ocorrencias.map(({ id: _id, ...entry }) => entry),
        }
        : values;
      requestRef.current = {
        fingerprint,
        requestId,
        payload: buildAtomicRdoPayload(requestId, {
          ...atomicValues,
          materials: atomicValues.materiais,
          workforce: atomicValues.efetivo,
          equipment: atomicValues.equipamentos,
          occurrences: atomicValues.ocorrencias,
        }),
      };
    }

    const { data, error: rpcError } = await supabase.rpc('salvar_rdo_completo', {
      rdo_id: target.rdoId,
      versao_base: target.baseVersion,
      payload: requestRef.current.payload,
    });
    if (rpcError) {
      throw new Error(getAtomicRdoRpcErrorMessage(rpcError));
    }

    const result = parseAtomicRdoSaveResult(data);
    if (!result.ok) {
      if (result.code === 'VERSION_CONFLICT' && result.serverVersion !== null && result.serverSnapshot) {
        try {
          setConflict({
            serverVersion: result.serverVersion,
            serverValues: snapshotToForm(result.serverSnapshot),
          });
          setConflictChoices({});
        } catch (snapshotError) {
          console.error('[EditRdo] Snapshot de conflito inválido:', snapshotError);
        }
      }
      throw new Error(result.message);
    }
    requestRef.current = null;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rdos'] }),
      queryClient.invalidateQueries({ queryKey: ['rdo-detail', target.rdoId] }),
      queryClient.invalidateQueries({ queryKey: ['rdo-complementos', target.rdoId] }),
      queryClient.invalidateQueries({ queryKey: ['edit-rdo', target.rdoId] }),
      queryClient.invalidateQueries({ queryKey: ['edit-rdo-materiais', target.rdoId] }),
      queryClient.invalidateQueries({ queryKey: ['edit-rdo-efetivo', target.rdoId] }),
      queryClient.invalidateQueries({ queryKey: ['edit-rdo-equipamentos', target.rdoId] }),
      queryClient.invalidateQueries({ queryKey: ['edit-rdo-ocorrencias', target.rdoId] }),
    ]);
    success(target.asCopy ? 'Cópia local criada como novo rascunho' : 'RDO atualizado');
    navigate(`/rdo/${target.rdoId}`);
  };

  const onSubmit = async (values: EditFormData) => {
    if (!id || !rdo || !canEdit || operationalDataError) return;
    setSaveError(null);
    try {
      await saveAtomically(values, { rdoId: id, baseVersion: rdo.version });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha inesperada ao salvar o RDO.';
      setSaveError(message);
      if (!conflict) notifyError('Não foi possível salvar o RDO', message);
    }
  };

  const handleAcceptServer = async () => {
    if (!conflict || !window.confirm('Substituir os dados exibidos pela versão salva no servidor? Seus dados locais não serão aplicados.')) return;
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['edit-rdo', id] }),
        queryClient.invalidateQueries({ queryKey: ['edit-rdo-materiais', id] }),
        queryClient.invalidateQueries({ queryKey: ['edit-rdo-efetivo', id] }),
        queryClient.invalidateQueries({ queryKey: ['edit-rdo-equipamentos', id] }),
        queryClient.invalidateQueries({ queryKey: ['edit-rdo-ocorrencias', id] }),
      ]);
      setConflict(null);
      navigate(`/rdo/${id}`);
    } catch (cause) {
      console.error('[EditRdo] Não foi possível atualizar a versão do servidor:', cause);
      setSaveError(cause instanceof Error ? cause.message : 'Não foi possível carregar a versão do servidor.');
    }
  };

  const handleKeepLocalAsCopy = async () => {
    if (!conflict || !window.confirm('Criar um novo rascunho com os dados locais? O RDO atual no servidor será preservado.')) return;
    setSaveError(null);
    try {
      const values = form.getValues();
      const fingerprint = JSON.stringify(values);
      if (!copyTargetRef.current || copyTargetRef.current.fingerprint !== fingerprint) {
        copyTargetRef.current = { fingerprint, rdoId: crypto.randomUUID() };
      }
      await saveAtomically(values, { rdoId: copyTargetRef.current.rdoId, baseVersion: 0, asCopy: true });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Não foi possível criar a cópia local.');
    }
  };

  const handleMerge = async () => {
    if (!conflict) return;
    const keys: Array<keyof EditFormData> = [
      'numero', 'data', 'unidade_id', 'hh_planejado', 'hh_realizado', 'disciplina',
      'engenheiro_obs', 'coordenador_obs', 'materiais', 'clima_condicao',
      'clima_temperatura', 'clima_origem', 'efetivo', 'equipamentos', 'ocorrencias',
    ];
    if (keys.some((key) => !conflictChoices[key])) {
      setSaveError('Escolha a versão local ou do servidor para cada campo antes de mesclar.');
      return;
    }
    try {
      const serverValues = conflict.serverValues;
      const localValues = form.getValues();
      const choose = <K extends keyof EditFormData>(key: K): EditFormData[K] =>
        conflictChoices[key] === 'server' ? serverValues[key] : localValues[key];
      await saveAtomically({
        numero: choose('numero'),
        data: choose('data'),
        unidade_id: choose('unidade_id'),
        hh_planejado: choose('hh_planejado'),
        hh_realizado: choose('hh_realizado'),
        disciplina: choose('disciplina'),
        engenheiro_obs: choose('engenheiro_obs'),
        coordenador_obs: choose('coordenador_obs'),
        materiais: choose('materiais'),
        clima_condicao: choose('clima_condicao'),
        clima_temperatura: choose('clima_temperatura'),
        clima_origem: choose('clima_origem'),
        efetivo: choose('efetivo'),
        equipamentos: choose('equipamentos'),
        ocorrencias: choose('ocorrencias'),
      }, { rdoId: id, baseVersion: conflict.serverVersion });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Não foi possível salvar a mesclagem.');
    }
  };

  if (loadingRdo || loadingMateriais || loadingEfetivo || loadingEquipamentos || loadingOcorrencias) {
    return <MainLayout><div className="app-page app-page--medium min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div></MainLayout>;
  }

  if (rdoError || !rdo) {
    return <MainLayout><div className="app-page app-page--medium items-center text-center text-red-700">Não foi possível carregar este RDO.</div></MainLayout>;
  }

  if (!canEdit && !canAddEvidence) {
    return <MainLayout><div className="app-page app-page--medium items-center text-center text-red-700">Você não tem permissão para editar este RDO.</div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="app-page app-page--medium">
        {conflict && (
          <Card className="border-amber-400">
            <CardHeader>
              <CardTitle>Conflito de edição</CardTitle>
              <CardDescription>
                Sua edição começou na versão {rdo.version}, mas o servidor está na versão {conflict.serverVersion}.
                Seus dados locais foram preservados. Escolha como resolver antes de continuar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
              <div className="space-y-3">
                {([
                  ['numero', 'Número'],
                  ['data', 'Data'],
                  ['unidade_id', 'Unidade'],
                  ['hh_planejado', 'HH planejado'],
                  ['hh_realizado', 'HH realizado'],
                  ['disciplina', 'Disciplina'],
                  ['engenheiro_obs', 'Observações do engenheiro'],
                  ['coordenador_obs', 'Observações do coordenador'],
                  ['materiais', 'Materiais'],
                  ['clima_condicao', 'Condição climática'],
                  ['clima_temperatura', 'Temperatura'],
                  ['clima_origem', 'Origem do clima'],
                  ['efetivo', 'Efetivo'],
                  ['equipamentos', 'Equipamentos'],
                  ['ocorrencias', 'Ocorrências'],
                ] as Array<[keyof EditFormData, string]>).map(([key, label]) => {
                  const localValue = form.getValues(key);
                  const serverValue = conflict.serverValues[key];
                  const describe = (value: unknown) => Array.isArray(value)
                    ? `${value.length} item(ns)`
                    : value === null || value === '' ? '—' : String(value);
                  return (
                    <div key={key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="truncate text-xs text-muted-foreground">Local: {describe(localValue)}</span>
                      <span className="truncate text-xs text-muted-foreground">Servidor: {describe(serverValue)}</span>
                      <Select
                        value={conflictChoices[key] || ''}
                        onValueChange={(value) => setConflictChoices((current) => ({
                          ...current,
                          [key]: value as 'local' | 'server',
                        }))}
                      >
                        <SelectTrigger aria-label={`Escolher versão para ${label}`} className="w-full sm:w-40">
                          <SelectValue placeholder="Escolher..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Manter local</SelectItem>
                          <SelectItem value="server">Usar servidor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleMerge()}>
                  Mesclar e salvar
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleKeepLocalAsCopy()}>
                  Manter local como novo RDO
                </Button>
                <Button type="button" variant="outline" onClick={handleAcceptServer}>
                  Aceitar versão do servidor
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {canEdit && <Card>
          <CardHeader>
            <CardTitle>Editar RDO {rdo.numero || ''}</CardTitle>
            <CardDescription>Atualize os dados do relatório e os materiais registrados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {saveError && !conflict && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {saveError}
                </p>
              )}
              {operationalDataError && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  Não foi possível carregar as seções operacionais. Recarregue a página antes de salvar para evitar perda de dados.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número do RDO</Label>
                  <Input id="numero" {...form.register('numero')} />
                  {form.formState.errors.numero && <p className="text-sm text-red-600">{form.formState.errors.numero.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input id="data" type="date" {...form.register('data')} />
                  {form.formState.errors.data && <p className="text-sm text-red-600">{form.formState.errors.data.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label id="edit-unidade-label" htmlFor="edit-unidade_id">Unidade</Label>
                  <SearchableCombobox
                    id="edit-unidade_id"
                    labelId="edit-unidade-label"
                    value={form.watch('unidade_id') || ''}
                    options={unidades.map((unit) => ({
                      value: unit.id,
                      label: `${unit.codigo} — ${unit.nome || 'Unidade sem nome'}`,
                    }))}
                    loading={loadingUnidades}
                    hasError={!!unidadesError}
                    invalid={!!form.formState.errors.unidade_id}
                    onRetry={() => void refetchUnidades()}
                    onEmptyAction={profile?.profile === 'admin' ? () => navigate('/admin/unidades') : undefined}
                    emptyActionLabel={profile?.profile === 'admin' ? 'Cadastrar unidades' : 'Fale com o administrador'}
                    emptyMessage={profile?.profile === 'admin'
                      ? 'Cadastre as unidades da obra para liberar o preenchimento do RDO.'
                      : 'Nenhuma unidade foi configurada. Solicite ao administrador que cadastre as unidades da obra.'}
                    searchPlaceholder="Digite o código ou nome..."
                    loadingMessage="Carregando unidades..."
                    onChange={(value) => form.setValue('unidade_id', value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                  />
                  {form.formState.errors.unidade_id && <p className="text-sm text-red-600">{form.formState.errors.unidade_id.message}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hh_planejado">HH planejado</Label>
                  <Input id="hh_planejado" type="number" step="0.5" {...form.register('hh_planejado', { valueAsNumber: true })} />
                  {form.formState.errors.hh_planejado && <p className="text-sm text-red-600">{form.formState.errors.hh_planejado.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hh_realizado">HH realizado</Label>
                  <Input id="hh_realizado" type="number" step="0.5" {...form.register('hh_realizado', { setValueAs: (value) => value === '' ? null : Number(value) })} />
                  {form.formState.errors.hh_realizado && <p className="text-sm text-red-600">{form.formState.errors.hh_realizado.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Controller
                  name="disciplina"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? 'nenhuma'}
                      onValueChange={(value) => field.onChange(value === 'nenhuma' ? null : value)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhuma">Não informada</SelectItem>
                        <SelectItem value="eletrica">Elétrica</SelectItem>
                        <SelectItem value="civil">Construção e Montagem</SelectItem>
                        <SelectItem value="instrumentacao">Instrumentação</SelectItem>
                        <SelectItem value="automacao">Automação</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.disciplina && <p className="text-sm text-destructive">{form.formState.errors.disciplina.message}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="engenheiro_obs">Observações do engenheiro</Label>
                  <Textarea id="engenheiro_obs" rows={4} {...form.register('engenheiro_obs')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coordenador_obs">Observações do coordenador</Label>
                  <Textarea id="coordenador_obs" rows={4} {...form.register('coordenador_obs')} />
                </div>
              </div>

              <details open className="rdo-operational-section group space-y-4 rounded-xl border p-4 sm:p-5">
                <summary className="cursor-pointer font-semibold">Clima</summary>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Condição</Label>
                    <Input {...form.register('clima_condicao', { onChange: () => form.setValue('clima_origem', 'manual', { shouldDirty: true }) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperatura (°C)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...form.register('clima_temperatura', {
                        setValueAs: (value) => value === '' ? null : Number(value),
                        onChange: () => form.setValue('clima_origem', 'manual', { shouldDirty: true }),
                      })}
                    />
                  </div>
                </div>
                {form.watch('clima_origem') && <p className="text-xs text-muted-foreground">Origem: {form.watch('clima_origem')}</p>}
              </details>

              <details open className="rdo-operational-section group space-y-4 rounded-xl border p-4 sm:p-5">
                <summary className="cursor-pointer font-semibold">Efetivo por função</summary>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => appendWorkforce({ funcao_id: '', quantidade: 1, horas_trabalhadas: 0 })}>
                    <Plus className="size-4" /> Adicionar função
                  </Button>
                </div>
                {workforceFields.map((field, index) => (
                  <div key={field.id} className="rdo-entry-grid rdo-entry-grid--workforce rounded-lg border bg-background p-3">
                    <div className="space-y-2">
                      <Label>Função</Label>
                      <Controller
                        name={`efetivo.${index}.funcao_id`}
                        control={form.control}
                        render={({ field: input }) => (
                          <Select value={input.value || 'select'} onValueChange={(value) => input.onChange(value === 'select' ? '' : value)}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="select">Selecione uma função</SelectItem>
                              {funcoes.filter((funcao) => !funcao.deleted_at || funcao.id === form.watch(`efetivo.${index}.funcao_id`))
                                .map((funcao) => <SelectItem key={funcao.id} value={funcao.id}>{funcao.nome}{funcao.deleted_at ? ' (arquivada)' : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.efetivo?.[index]?.funcao_id && <p className="text-xs text-destructive">{form.formState.errors.efetivo[index]?.funcao_id?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input type="number" min="1" step="1" {...form.register(`efetivo.${index}.quantidade`, { valueAsNumber: true })} />
                      {form.formState.errors.efetivo?.[index]?.quantidade && <p className="text-xs text-destructive">{form.formState.errors.efetivo[index]?.quantidade?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Horas realizadas</Label>
                      <Input type="number" min="0" step="0.25" {...form.register(`efetivo.${index}.horas_trabalhadas`, { valueAsNumber: true })} />
                      {form.formState.errors.efetivo?.[index]?.horas_trabalhadas && <p className="text-xs text-destructive">{form.formState.errors.efetivo[index]?.horas_trabalhadas?.message}</p>}
                    </div>
                    <div className="space-y-2"><Label>Matrícula</Label><Input {...form.register(`efetivo.${index}.matricula`)} /></div>
                    <div className="space-y-2"><Label>Nome</Label><Input {...form.register(`efetivo.${index}.nome`)} /></div>
                    <div className="space-y-2"><Label>Identificador ERP</Label><Input {...form.register(`efetivo.${index}.identificador_externo`)} /></div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeWorkforce(index)} aria-label="Remover função"><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                ))}
                {workforceFields.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma função informada.</p>}
              </details>

              <details open className="rdo-operational-section group space-y-4 rounded-xl border p-4 sm:p-5">
                <summary className="cursor-pointer font-semibold">Equipamentos</summary>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => appendEquipment({ equipamento_id: '', horas_uso: 0, observacao: '' })}>
                    <Plus className="size-4" /> Adicionar equipamento
                  </Button>
                </div>
                {equipmentFields.map((field, index) => (
                  <div key={field.id} className="rdo-entry-grid rdo-entry-grid--equipment rounded-lg border bg-background p-3">
                    <div className="space-y-2">
                      <Label>Equipamento</Label>
                      <Controller
                        name={`equipamentos.${index}.equipamento_id`}
                        control={form.control}
                        render={({ field: input }) => (
                          <Select value={input.value || 'select'} onValueChange={(value) => input.onChange(value === 'select' ? '' : value)}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="select">Selecione um equipamento</SelectItem>
                              {equipamentosDisponiveis
                                .filter((equipment) => !equipment.deleted_at || equipment.id === form.watch(`equipamentos.${index}.equipamento_id`))
                                .filter((equipment) => !equipment.unidade_id || equipment.unidade_id === form.watch('unidade_id'))
                                .map((equipment) => <SelectItem key={equipment.id} value={equipment.id}>{equipment.nome}{equipment.deleted_at ? ' (arquivado)' : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.equipamentos?.[index]?.equipamento_id && <p className="text-xs text-destructive">{form.formState.errors.equipamentos[index]?.equipamento_id?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Horas de uso</Label>
                      <Input type="number" min="0" step="0.25" {...form.register(`equipamentos.${index}.horas_uso`, { valueAsNumber: true })} />
                      {form.formState.errors.equipamentos?.[index]?.horas_uso && <p className="text-xs text-destructive">{form.formState.errors.equipamentos[index]?.horas_uso?.message}</p>}
                    </div>
                    <div className="space-y-2"><Label>Observação</Label><Input {...form.register(`equipamentos.${index}.observacao`)} /></div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEquipment(index)} aria-label="Remover equipamento"><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                ))}
                {equipmentFields.length === 0 && <p className="text-sm text-muted-foreground">Nenhum equipamento informado.</p>}
              </details>

              <details open className="rdo-operational-section group space-y-4 rounded-xl border p-4 sm:p-5">
                <summary className="cursor-pointer font-semibold">Ocorrências e paralisações</summary>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => appendOccurrence({ tipo: 'outro', descricao: '', inicio: '', fim: '', horas_impacto: 0, responsavel: '' })}>
                    <Plus className="size-4" /> Adicionar ocorrência
                  </Button>
                </div>
                {occurrenceFields.map((field, index) => {
                  const startInput = form.register(`ocorrencias.${index}.inicio`);
                  const endInput = form.register(`ocorrencias.${index}.fim`);
                  return (
                    <div key={field.id} className="space-y-3 rounded-lg border p-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={form.watch(`ocorrencias.${index}.tipo`)} onValueChange={(value) => form.setValue(`ocorrencias.${index}.tipo`, value as typeof field.tipo, { shouldDirty: true, shouldValidate: true })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {occurrenceTypes.map((option) => <SelectItem key={option.codigo} value={option.codigo}>{option.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Input {...form.register(`ocorrencias.${index}.descricao`)} />
                          {form.formState.errors.ocorrencias?.[index]?.descricao && <p className="text-xs text-destructive">{form.formState.errors.ocorrencias[index]?.descricao?.message}</p>}
                        </div>
                        <div className="space-y-2"><Label>Início</Label><Input type="datetime-local" {...startInput} onChange={(event) => {
                          void startInput.onChange(event);
                          const hours = calculateHoursBetween(event.target.value, form.getValues(`ocorrencias.${index}.fim`) || '');
                          if (hours !== null) form.setValue(`ocorrencias.${index}.horas_impacto`, hours, { shouldDirty: true });
                        }} /></div>
                        <div className="space-y-2"><Label>Fim</Label><Input type="datetime-local" {...endInput} onChange={(event) => {
                          void endInput.onChange(event);
                          const hours = calculateHoursBetween(form.getValues(`ocorrencias.${index}.inicio`) || '', event.target.value);
                          if (hours !== null) form.setValue(`ocorrencias.${index}.horas_impacto`, hours, { shouldDirty: true });
                        }} />{form.formState.errors.ocorrencias?.[index]?.fim && <p className="text-xs text-destructive">{form.formState.errors.ocorrencias[index]?.fim?.message}</p>}</div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
                        <div className="space-y-2">
                          <Label>Horas de impacto</Label>
                          <Input type="number" min="0" step="0.25" {...form.register(`ocorrencias.${index}.horas_impacto`, { valueAsNumber: true })} />
                          {form.formState.errors.ocorrencias?.[index]?.horas_impacto && <p className="text-xs text-destructive">{form.formState.errors.ocorrencias[index]?.horas_impacto?.message}</p>}
                        </div>
                        <div className="space-y-2"><Label>Responsável</Label><Input {...form.register(`ocorrencias.${index}.responsavel`)} /></div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOccurrence(index)} aria-label="Remover ocorrência"><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </div>
                  );
                })}
                {occurrenceFields.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ocorrência informada.</p>}
              </details>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Materiais</h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ material: '', quantidade: 1, unidade_medida: '' })}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar material
                  </Button>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label>Material</Label>
                      <Input {...form.register(`materiais.${index}.material`)} />
                      {form.formState.errors.materiais?.[index]?.material && <p className="text-sm text-red-600">{form.formState.errors.materiais[index]?.material?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input type="number" step="0.01" {...form.register(`materiais.${index}.quantidade`, { valueAsNumber: true })} />
                      {form.formState.errors.materiais?.[index]?.quantidade && <p className="text-sm text-red-600">{form.formState.errors.materiais[index]?.quantidade?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label id={`edit-material-unit-label-${index}`}>Unidade de medida</Label>
                      <Controller
                        name={`materiais.${index}.unidade_medida`}
                        control={form.control}
                        render={({ field }) => (
                          <SearchableCombobox
                            id={`edit-material-unit-${index}`}
                            labelId={`edit-material-unit-label-${index}`}
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
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remover material">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
                {form.formState.errors.materiais?.root && <p className="text-sm text-red-600">{form.formState.errors.materiais.root.message}</p>}
              </section>

              <div className="flex flex-wrap gap-3 border-t pt-5">
                <Button type="submit" disabled={form.formState.isSubmitting || !!operationalDataError}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar alterações
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(`/rdo/${id}`)}>Cancelar</Button>
                <Badge variant="outline" className="ml-auto">Status: {rdo.status || 'draft'}</Badge>
              </div>
            </form>
          </CardContent>
        </Card>}

        {canAddEvidence && (
          <Card>
            <CardHeader>
              <CardTitle>Fotos do RDO</CardTitle>
              <CardDescription>
                {rdo.status === 'submitted'
                  ? 'O RDO já foi enviado para revisão. Você pode anexar fotos adicionais; os demais campos permanecem bloqueados.'
                  : 'Adicione fotos agora ou capture uma imagem com a câmera do celular.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {photosError && (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível carregar as fotos já anexadas. Você ainda pode tentar adicionar novas fotos.
                </p>
              )}
              {loadingPhotos ? (
                <p className="text-sm text-muted-foreground">Carregando fotos...</p>
              ) : photos && photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <figure key={photo.id} className="overflow-hidden rounded-lg border">
                      <img src={photo.url} alt={photo.descricao || 'Foto anexada ao RDO'} className="aspect-square w-full object-cover" />
                      <figcaption className="truncate p-2 text-xs text-muted-foreground">
                        {new Date(photo.created_at).toLocaleString('pt-BR')}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma foto anexada ainda.</p>
              )}

              <ImageUpload onImageSelect={handlePhotoSelected} label="Selecionar foto para anexar" />
              {selectedPhotos.length > 0 && (
                <div className="space-y-3">
                  <ul className="space-y-2 text-sm">
                    {selectedPhotos.map((photo) => (
                      <li key={photo.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                        <span className="min-w-0 truncate">{photo.file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${photo.file.name}`}
                          disabled={isUploadingPhotos}
                          onClick={() => setSelectedPhotos((current) => current.filter((entry) => entry.id !== photo.id))}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button type="button" disabled={isUploadingPhotos} onClick={() => void handleUploadPhotos()}>
                    {isUploadingPhotos ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {isUploadingPhotos ? 'Anexando fotos...' : `Anexar ${selectedPhotos.length} foto(s)`}
                  </Button>
                </div>
              )}
              {photoError && <p role="alert" className="text-sm text-destructive">{photoError}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default EditRdo;
