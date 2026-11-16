import React, { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type {
  AuditoriasRdoRow,
  EquipamentosRow,
  EvidenciasRdoRow,
  FuncoesRow,
  MateriaisRdoRow,
  RdoEfetivoRow,
  RdoEquipamentosRow,
  RdoOcorrenciasRow,
  ProfilesRow,
  RdosRow,
  UnidadesRow,
} from '@/types/database';
import { exportRdoToPdf } from '@/services/exportPdfService';
import type { StatusRdo } from '@/types/database';
import RdoStatusBadge from '@/components/rdos/RdoStatusBadge';
import { getDisciplineLabel } from '@/utils/disciplines';
import { getAuditActionLabel } from '@/utils/auditLabels';

// ============================================================================
// TIPAGEM E INTERFACES
// ============================================================================

interface RdoComplementos {
  materiais: MateriaisRdoRow[];
  evidencias: EvidenciasRdoRow[];
  auditorias: AuditoriasRdoRow[];
  efetivo: RdoEfetivoRow[];
  equipamentos: RdoEquipamentosRow[];
  ocorrencias: RdoOcorrenciasRow[];
  funcoes: FuncoesRow[];
  equipamentosCatalogo: EquipamentosRow[];
  autor: ProfilesRow | null;
  unidade: UnidadesRow | null;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const ReadRdo: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Buscar RDO
  const { data: rdo, isLoading: isLoadingRdo, error: errorRdo } = useQuery<RdosRow | null>({
    queryKey: ['rdo-detail', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('Identificador do RDO ausente.');

      const { data, error } = await supabase
        .from('rdos')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('[ReadRdo] Erro ao buscar RDO:', error);
        throw error;
      }

      return data || null;
    },
  });

  // Buscar complementos (materiais, evidências, auditorias, autor, unidade)
  const { data: complementos, isLoading: isLoadingComp, error: errorComp } = useQuery<RdoComplementos | null>({
    queryKey: ['rdo-complementos', id],
    queryFn: async () => {
      if (!id || !rdo) return null;

      try {
        const [matsRes, evidsRes, audsRes, autRes, unidRes, workforceRes, equipmentRes, occurrencesRes, functionsRes, equipmentCatalogRes] = await Promise.all([
          supabase
            .from('materiais_rdo')
            .select('*')
            .eq('rdo_id', id)
            .is('deleted_at', null),
          supabase
            .from('evidencias_rdo')
            .select('*')
            .eq('rdo_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('auditorias_rdo')
            .select('*')
            .eq('rdo_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('*')
            .eq('id', rdo.user_id)
            .maybeSingle(),
          supabase
            .from('unidades')
            .select('*')
            .eq('id', rdo.unidade_id)
            .single(),
          supabase.from('rdo_efetivo').select('*').eq('rdo_id', id).order('created_at'),
          supabase.from('rdo_equipamentos').select('*').eq('rdo_id', id).order('created_at'),
          supabase.from('rdo_ocorrencias').select('*').eq('rdo_id', id).order('created_at'),
          supabase.from('funcoes').select('*'),
          supabase.from('equipamentos').select('*'),
        ]);

        const failedQuery = [matsRes, evidsRes, audsRes, autRes, unidRes, workforceRes, equipmentRes, occurrencesRes, functionsRes, equipmentCatalogRes]
          .find((result) => result.error);
        if (failedQuery?.error) throw failedQuery.error;

        const evidencias = await Promise.all((evidsRes.data || []).map(async (evidencia) => {
          const { data, error } = await supabase.storage
            .from('evidencias')
            .createSignedUrl(evidencia.url, 10 * 60);

          if (error) throw error;
          return { ...evidencia, url: data.signedUrl };
        }));

        return {
          materiais: matsRes.data || [],
          evidencias,
          auditorias: audsRes.data || [],
          efetivo: workforceRes.data || [],
          equipamentos: equipmentRes.data || [],
          ocorrencias: occurrencesRes.data || [],
          funcoes: functionsRes.data || [],
          equipamentosCatalogo: equipmentCatalogRes.data || [],
          autor: autRes.data,
          unidade: unidRes.data,
        };
      } catch (err) {
        console.error('[ReadRdo] Erro ao buscar complementos:', err);
        throw err;
      }
    },
    enabled: !!id && !!rdo,
  });

  // Handler para ação de aprovação/rejeição
  const handleAction = async (status: StatusRdo) => {
    if (!user || !id) return;

    setIsSubmittingAction(true);
    setActionError(null);
    setSyncWarning(null);

    try {
      const { data: syncEventId, error } = await supabase.rpc('transition_rdo_status', {
        p_rdo_id: id,
        p_status: status,
        p_comment: approvalComment || null,
      });
      if (error) throw error;

      if (status === 'approved') {
        try {
          if (!syncEventId) {
            throw new Error('O evento de sincronização do RDO não foi criado.');
          }
          const { error: syncError } = await supabase.functions.invoke('sync-approved-rdo', {
            body: { action: 'sync', eventId: syncEventId },
          });
          if (syncError) throw syncError;
        } catch (syncError) {
          // 503 = integração não configurada no servidor: a aprovação vale e o evento fica na fila
          // para o administrador reenviar depois; não há o que o revisor resolver.
          if ((syncError as { context?: Response }).context?.status === 503) {
            console.info('[ReadRdo] Integração Protheus não configurada; evento mantido na fila.');
          } else {
            console.error('[ReadRdo] RDO aprovado, mas não sincronizado com o Protheus:', syncError);
            setSyncWarning('O RDO foi aprovado, mas não foi possível sincronizá-lo com o Protheus. Um administrador pode verificar a integração e reenviar o evento.');
          }
        }
      }

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['rdo-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['rdo-complementos', id] });

      setApprovalComment('');
    } catch (err) {
      console.error('[ReadRdo] Erro ao processar ação:', err);
      setActionError(err instanceof Error ? err.message : 'Erro ao processar ação');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handler para exportar PDF
  const handleExportPdf = async () => {
    if (!rdo) return;

    setIsExporting(true);
    try {
      await exportRdoToPdf({
        rdo,
        materiais: complementos?.materiais || [],
        efetivo: complementos?.efetivo || [],
        equipamentos: complementos?.equipamentos || [],
        ocorrencias: complementos?.ocorrencias || [],
        funcoes: complementos?.funcoes || [],
        equipamentosCatalogo: complementos?.equipamentosCatalogo || [],
        evidencias: complementos?.evidencias || [],
        auditorias: complementos?.auditorias || [],
        unidadeNome: complementos?.unidade?.nome,
      });
    } catch (err) {
      console.error('[ReadRdo] Erro ao exportar:', err);
      setActionError('Erro ao exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (!id) {
    return <Navigate to="/404" replace />;
  }

  // Estados de carregamento
  if (isLoadingRdo || isLoadingComp) {
    return (
      <MainLayout>
        <div className="app-page app-page--medium min-h-64 items-center justify-center">
          <svg
            className="w-12 h-12 text-blue-600 animate-spin mb-4"
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
          <p className="text-gray-600 font-semibold">Carregando RDO...</p>
        </div>
      </MainLayout>
    );
  }

  // Estados de erro
  if (errorRdo || errorComp || !rdo) {
    return (
      <MainLayout>
        <div className="app-page app-page--medium min-h-64 items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
            <svg
              className="w-12 h-12 text-red-600 mx-auto mb-4"
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
            <h2 className="text-lg font-bold text-red-900 mb-2">Erro ao Carregar</h2>
            <p className="text-red-700 mb-6">Não foi possível carregar o RDO solicitado.</p>
            <button
              onClick={() => navigate('/rdos')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all"
            >
              Voltar para RDOs
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const status = rdo.status || 'draft';
  const desvioHh = rdo.hh_realizado !== null && rdo.hh_realizado !== undefined && rdo.hh_planejado > 0
    ? ((rdo.hh_realizado - rdo.hh_planejado) / rdo.hh_planejado) * 100
    : null;

  // Verificar permissões para aprovar/rejeitar
  const canApprove =
    profile && ['admin', 'supervisor', 'engenheiro'].includes(profile.profile) && status === 'submitted';
  const canSubmit = (status === 'draft' || status === 'rejected') && (
    rdo.user_id === user?.id || (profile && ['admin', 'supervisor', 'engenheiro'].includes(profile.profile))
  );

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
        {/* Header com Voltar e Status */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
          <button
            onClick={() => navigate('/rdos')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 font-semibold transition-colors"
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <RdoStatusBadge status={status} />
        </div>

        {/* Mensagem de Erro */}
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
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
            <p className="text-sm font-medium">{actionError}</p>
          </div>
        )}
        {syncWarning && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 3.86 2.82 17.14A2 2 0 0 0 4.56 20h14.88a2 2 0 0 0 1.74-2.86L13.74 3.86a2 2 0 0 0-3.48 0Z" />
            </svg>
            <p className="text-sm font-medium">{syncWarning}</p>
          </div>
        )}

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card: Identificação */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-gray-50/30">
                <CardTitle className="text-lg flex items-center gap-2 font-bold">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-300"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 4a2 2 0 012-2h6a2 2 0 012 2v12a1 1 0 110 2h-6a1 1 0 110-2h6V4H6v12a1 1 0 110 2H4a2 2 0 01-2-2V4z" />
                  </svg>
                  Identificação
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 text-sm">
                <div>
                  <p className="font-bold text-gray-400 uppercase text-[10px]">Número</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">{rdo.numero || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase text-[10px]">Data</p>
                  <p className="font-semibold">{new Date(`${rdo.data}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase text-[10px]">Unidade</p>
                  <p className="font-semibold">{complementos?.unidade?.nome || '—'}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase text-[10px]">Disciplina</p>
                  <p className="font-semibold">{getDisciplineLabel(rdo.disciplina) || '—'}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase text-[10px]">Criado em</p>
                  <p className="font-semibold text-xs">{rdo.created_at ? new Date(rdo.created_at).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase text-[10px]">Autor</p>
                  <p className="font-semibold text-xs">{complementos?.autor?.id.slice(0, 8) || '—'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="border-b bg-gray-50/30">
                <CardTitle className="text-lg font-bold">Operação do dia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 text-sm">
                <section>
                  <h3 className="font-semibold">Clima</h3>
                  <p className="mt-1 text-muted-foreground">
                    {rdo.clima_condicao || 'Sem condição informada'}
                    {rdo.clima_temperatura !== null ? ` · ${rdo.clima_temperatura} °C` : ''}
                    {rdo.clima_origem ? ` · origem ${rdo.clima_origem}` : ''}
                  </p>
                </section>
                <section>
                  <h3 className="font-semibold">Efetivo por função</h3>
                  {complementos?.efetivo.length ? (
                    <ul className="mt-2 divide-y">
                      {complementos.efetivo.map((entry) => (
                        <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                          <span>{complementos.funcoes.find((funcao) => funcao.id === entry.funcao_id)?.nome || 'Função arquivada'} · {entry.quantidade} pessoa(s)</span>
                          <span className="text-muted-foreground">{entry.horas_trabalhadas} h{entry.nome ? ` · ${entry.nome}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-muted-foreground">Nenhum efetivo registrado.</p>}
                </section>
                <section>
                  <h3 className="font-semibold">Equipamentos</h3>
                  {complementos?.equipamentos.length ? (
                    <ul className="mt-2 divide-y">
                      {complementos.equipamentos.map((entry) => (
                        <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                          <span>{complementos.equipamentosCatalogo.find((item) => item.id === entry.equipamento_id)?.nome || 'Equipamento arquivado'}</span>
                          <span className="text-muted-foreground">{entry.horas_uso} h{entry.observacao ? ` · ${entry.observacao}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-muted-foreground">Nenhum equipamento registrado.</p>}
                </section>
                <section>
                  <h3 className="font-semibold">Ocorrências e paralisações</h3>
                  {complementos?.ocorrencias.length ? (
                    <ul className="mt-2 space-y-2">
                      {complementos.ocorrencias.map((entry) => (
                        <li key={entry.id} className="rounded-lg border p-3">
                          <p className="font-medium">{entry.tipo.replace(/_/g, ' ')} · {entry.horas_impacto} h de impacto</p>
                          <p className="mt-1 text-muted-foreground">{entry.descricao}</p>
                          {entry.responsavel && <p className="mt-1 text-xs text-muted-foreground">Responsável: {entry.responsavel}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-muted-foreground">Nenhuma ocorrência registrada.</p>}
                </section>
              </CardContent>
            </Card>

            {/* Card: Materiais */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-gray-50/30">
                <CardTitle className="text-lg flex items-center gap-2 font-bold">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-300"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                  </svg>
                  Materiais
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {complementos?.materiais && complementos.materiais.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b text-gray-500">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold uppercase text-[10px]">Descrição</th>
                          <th className="px-4 py-3 text-center font-bold uppercase text-[10px]">Quantidade</th>
                          <th className="px-4 py-3 text-center font-bold uppercase text-[10px]">Unidade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {complementos.materiais.map((m) => (
                          <tr key={m.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3">{m.material}</td>
                            <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-300">{m.quantidade}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{m.unidade_medida || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-6">Nenhum material registrado</p>
                )}
              </CardContent>
            </Card>

            {/* Card: Evidências */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-gray-50/30">
                <CardTitle className="text-lg flex items-center gap-2 font-bold">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-300"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                  </svg>
                  Evidências
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {complementos?.evidencias && complementos.evidencias.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {complementos.evidencias.map((e) => (
                      <div
                        key={e.id}
                        className="group relative aspect-square rounded-xl border overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setSelectedImage(e.url)}
                      >
                        <img
                          src={e.url}
                          alt="Evidência"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg
                            className="w-6 h-6 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path
                              fillRule="evenodd"
                              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-6">Nenhuma evidência registrada</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita */}
          <div className="space-y-6">
            {/* Card: Controle de HH */}
            <Card className="shadow-sm border-blue-100 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2 font-bold">
                  <svg
                    className="w-4 h-4 text-blue-600 dark:text-blue-300"
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
                  Controle de HH
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-end border-t border-blue-100 pt-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Planejado</p>
                    <p className="text-2xl font-bold text-gray-900">{rdo.hh_planejado}h</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Realizado</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{rdo.hh_realizado || 0}h</p>
                  </div>
                </div>
                {desvioHh !== null && (
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Desvio</p>
                    <p className={`text-lg font-bold ${desvioHh > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {desvioHh > 0 ? '+' : ''}{desvioHh.toFixed(1)}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card: Painel de Controle */}
            <Card className="shadow-lg border-blue-600">
              <CardHeader className="bg-blue-600 text-white">
                <CardTitle className="text-md flex items-center gap-2 font-bold">
                  <svg
                    className="w-4 h-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                  Painel de Controle
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Seção de Aprovação */}
                {canSubmit && (
                  <div className="space-y-3 border-b pb-6">
                    <p className="text-sm text-gray-600">Quando estiver pronto, envie o RDO para análise.</p>
                    <Button
                      type="button"
                      onClick={() => void handleAction('submitted')}
                      disabled={isSubmittingAction}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmittingAction ? 'Enviando...' : 'Enviar para aprovação'}
                    </Button>
                  </div>
                )}

                {canApprove && (
                  <div className="space-y-3 border-b pb-6">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase">Parecer Técnico</Label>
                    <Textarea
                      placeholder="Observações sobre a aprovação ou rejeição..."
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      className="text-sm resize-none"
                      rows={4}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void handleAction('approved')}
                        disabled={isSubmittingAction}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2 px-4 rounded-lg transition-all"
                      >
                        {isSubmittingAction ? (
                          <>
                            <svg
                              className="w-4 h-4 animate-spin inline mr-2"
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
                            Processando...
                          </>
                        ) : (
                          'Aprovar'
                        )}
                      </button>
                      <button
                        onClick={() => void handleAction('rejected')}
                        disabled={isSubmittingAction}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-2 px-4 rounded-lg transition-all"
                      >
                        {isSubmittingAction ? (
                          <>
                            <svg
                              className="w-4 h-4 animate-spin inline mr-2"
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
                            Processando...
                          </>
                        ) : (
                          'Rejeitar'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Botão de Exportar PDF */}
                <button
                  onClick={handleExportPdf}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  {isExporting ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
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
                      Exportando...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Exportar PDF
                    </>
                  )}
                </button>

                {/* Histórico de Auditorias */}
                {complementos?.auditorias && complementos.auditorias.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Histórico de Ações</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {complementos.auditorias.map((aud) => (
                        <div key={aud.id} className="bg-gray-50 p-2 rounded text-xs">
                          <p className="font-semibold text-gray-900">
                            {getAuditActionLabel(aud.acao)}
                          </p>
                          {aud.created_at && (
                            <p className="text-gray-600 text-[10px]">
                              {new Date(aud.created_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                          {aud.comentario && (
                            <p className="text-gray-700 mt-1 italic">{aud.comentario}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de Imagem */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl w-full">
              <button
                onClick={() => setSelectedImage(null)}
                title="Fechar visualização"
                className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-8 h-8"
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
              <img
                src={selectedImage}
                className="w-full h-auto rounded-lg shadow-2xl"
                alt="Preview em tela cheia"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ReadRdo;
