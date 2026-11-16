import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Download, Eye, FilePlus2, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import Tooltip from '@/components/ui/Tooltip';
import FilterPanel from '@/components/rdos/FilterPanel';
import SearchBar from '@/components/rdos/SearchBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/hooks/useAuth';
import { useRdo } from '@/hooks/useRdo';
import { useRdoFilter } from '@/hooks/useRdoFilter';
import { supabase } from '@/lib/supabase';
import type { UnidadesRow } from '@/types/database';
import { exportRdosToCsv } from '@/services/exportCsvService';
import { exportRdosToXlsx } from '@/services/exportXlsxService';
import { getDisciplineLabel } from '@/utils/disciplines';
import RdoStatusBadge from '@/components/rdos/RdoStatusBadge';
import type { StatusRdo } from '@/types/database';

const DashboardRdos: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { rdos, isLoading, error, deleteRdo, isDeleting } = useRdo();
  const { success, error: notifyError } = useNotification();
  const { filters, setFilter, resetFilters, filteredRdos, isFiltered, filterCount } = useRdoFilter(rdos);

  const { data: unidades = [] } = useQuery<UnidadesRow[]>({
    queryKey: ['unidades'],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('unidades')
        .select('*')
        .is('deleted_at', null)
        .order('nome', { ascending: true });
      if (queryError) throw queryError;
      return data || [];
    },
  });

  const unidadeNames = useMemo(
    () => new Map(unidades.map((unidade) => [unidade.id, unidade.nome || unidade.codigo])),
    [unidades],
  );

  const totals = useMemo(() => ({
    total: rdos.length,
    draft: rdos.filter((rdo) => rdo.status === 'draft').length,
    submitted: rdos.filter((rdo) => rdo.status === 'submitted').length,
    approved: rdos.filter((rdo) => rdo.status === 'approved').length,
  }), [rdos]);
  const canCreate = profile && ['admin', 'supervisor', 'engenheiro', 'encarregado'].includes(profile.profile);
  const canEdit = canCreate;
  const canDelete = profile && ['admin', 'supervisor'].includes(profile.profile);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este RDO? Ele será removido da listagem, mas permanecerá no histórico.')) return;

    try {
      await deleteRdo(id);
      success('RDO excluído');
    } catch (cause) {
      notifyError('Não foi possível excluir o RDO', cause instanceof Error ? cause.message : undefined);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const rdoIds = filteredRdos.map((rdo) => rdo.id);
      const [workforceResult, equipmentResult, occurrencesResult, functionsResult, equipmentCatalogResult] = rdoIds.length
        ? await Promise.all([
            supabase.from('rdo_efetivo').select('*').in('rdo_id', rdoIds),
            supabase.from('rdo_equipamentos').select('*').in('rdo_id', rdoIds),
            supabase.from('rdo_ocorrencias').select('*').in('rdo_id', rdoIds),
            supabase.from('funcoes').select('*'),
            supabase.from('equipamentos').select('*'),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];
      const failedQuery = [workforceResult, equipmentResult, occurrencesResult, functionsResult, equipmentCatalogResult]
        .find((result) => result.error);
      if (failedQuery?.error) throw failedQuery.error;
      const data = {
        rdos: filteredRdos,
        unidades,
        efetivo: workforceResult.data || [],
        equipamentos: equipmentResult.data || [],
        ocorrencias: occurrencesResult.data || [],
        funcoes: functionsResult.data || [],
        equipamentosCatalogo: equipmentCatalogResult.data || [],
      };
      if (format === 'csv') exportRdosToCsv(data);
      else await exportRdosToXlsx(data);
    } catch (cause) {
      notifyError('Não foi possível exportar os RDOs', cause instanceof Error ? cause.message : undefined);
    }
  };

  return (
    <MainLayout>
      <section aria-labelledby="rdos-page-title" className="app-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="rdos-page-title" className="text-3xl font-bold tracking-tight text-gray-900">Relatórios diários de obra</h1>
            <p className="mt-1 text-gray-600">Consulte e acompanhe os RDOs da sua unidade.</p>
          </div>
          {canCreate && (
            <Button onClick={() => navigate('/rdo/novo')} className="gap-2">
              <FilePlus2 className="h-4 w-4" />
              Novo RDO
            </Button>
          )}
        </div>

        <section aria-label="Resumo dos relatórios" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ['Total', totals.total],
            ['Rascunhos', totals.draft],
            ['Enviados', totals.submitted],
            ['Aprovados', totals.approved],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-gray-900">{value}</CardContent>
            </Card>
          ))}
        </section>

        <section aria-label="Filtros e exportação">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <SearchBar
              value={filters.searchTerm}
              onChange={(value) => setFilter('searchTerm', value)}
            />
            <FilterPanel
              filters={filters}
              onFilterChange={setFilter}
              onReset={resetFilters}
              unidades={unidades}
              filterCount={filterCount}
              isFiltered={isFiltered}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-gray-500">
                {filteredRdos.length} {filteredRdos.length === 1 ? 'relatório' : 'relatórios'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={!filteredRdos.length}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')} disabled={!filteredRdos.length}>
                  <Download className="mr-2 h-4 w-4" /> Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </section>

        <section aria-label="Relatórios encontrados">
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center gap-3 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando RDOs...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-700">Não foi possível carregar os relatórios: {error}</div>
          ) : filteredRdos.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {rdos.length ? 'Nenhum RDO corresponde aos filtros.' : 'Ainda não há RDOs cadastrados.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Relatórios diários de obra cadastrados</caption>
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Número</th>
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Unidade</th>
                    <th className="px-5 py-4">Disciplina</th>
                    <th className="px-5 py-4">HH</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRdos.map((rdo) => {
                    const status = rdo.status || 'draft';
                    return (
                      <tr key={rdo.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-blue-700">{rdo.numero || '—'}</td>
                        <td className="whitespace-nowrap px-5 py-4">{new Date(`${rdo.data}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                        <td className="px-5 py-4">{unidadeNames.get(rdo.unidade_id) || '—'}</td>
                        <td className="px-5 py-4">{getDisciplineLabel(rdo.disciplina) || '—'}</td>
                        <td className="whitespace-nowrap px-5 py-4">{rdo.hh_planejado} / {rdo.hh_realizado ?? '—'}</td>
                        <td className="px-5 py-4">
                          <RdoStatusBadge status={status as StatusRdo} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <Tooltip label="Visualizar os detalhes deste RDO">
                              <Button size="icon" variant="ghost" aria-label="Abrir RDO" onClick={() => navigate(`/rdo/${rdo.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                            {canEdit && ['draft', 'rejected', 'submitted'].includes(status) && (
                              <Tooltip label={status === 'submitted' ? 'Adicionar fotos sem alterar os dados enviados' : 'Editar os dados deste RDO'}>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={status === 'submitted' ? 'Adicionar foto ao RDO' : 'Editar RDO'}
                                  onClick={() => navigate(`/rdo/${rdo.id}/edit`)}
                                >
                                  {status === 'submitted' ? <Camera className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                                </Button>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip label="Excluir este RDO">
                                <Button size="icon" variant="ghost" aria-label="Excluir RDO" disabled={isDeleting} onClick={() => void handleDelete(rdo.id)}>
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </section>
      </section>
    </MainLayout>
  );
};

export default DashboardRdos;
