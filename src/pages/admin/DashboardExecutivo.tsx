import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ApprovalRateChart,
  DisciplineHhComparisonChart,
  HhDeviationAnalysisChart,
  HhTrendChart,
  StatusDistributionChart,
} from '@/components/charts/RdoAnalyticsCharts';
import { useRdo } from '@/hooks/useRdo';
import { supabase } from '@/lib/supabase';
import type { ProfilesRow } from '@/types/database';

const DashboardExecutivo: React.FC = () => {
  const { rdos, isLoading: loadingRdos, error: rdoError } = useRdo();
  const { data: profiles = [], isLoading: loadingProfiles, error: profileError } = useQuery<ProfilesRow[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const summary = useMemo(() => {
    const planejado = rdos.reduce((total, rdo) => total + rdo.hh_planejado, 0);
    const realizado = rdos.reduce((total, rdo) => total + (rdo.hh_realizado || 0), 0);
    return {
      total: rdos.length,
      enviados: rdos.filter((rdo) => rdo.status === 'submitted').length,
      aprovados: rdos.filter((rdo) => rdo.status === 'approved').length,
      rejeitados: rdos.filter((rdo) => rdo.status === 'rejected').length,
      planejado,
      realizado,
    };
  }, [rdos]);

  const isLoading = loadingRdos || loadingProfiles;
  const error = rdoError || profileError;

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel executivo</h1>
          <p className="mt-1 text-gray-600">Indicadores dos relatórios, horas de trabalho e acessos cadastrados.</p>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar todos os indicadores.</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['RDOs', summary.total],
            ['Enviados', summary.enviados],
            ['Aprovados', summary.aprovados],
            ['Rejeitados', summary.rejeitados],
            ['Usuários', profiles.length],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{isLoading ? '—' : value}</CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Horas registradas</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500">Planejadas</p><p className="text-2xl font-semibold">{summary.planejado.toLocaleString('pt-BR')} h</p></div>
              <div><p className="text-sm text-gray-500">Realizadas</p><p className="text-2xl font-semibold text-blue-700">{summary.realizado.toLocaleString('pt-BR')} h</p></div>
            </CardContent>
          </Card>
          <ApprovalRateChart rdos={rdos} title="Taxa de aprovação" />
          <StatusDistributionChart rdos={rdos} title="RDOs por status" />
          <HhTrendChart rdos={rdos} title="Horas planejadas e realizadas" />
          <DisciplineHhComparisonChart rdos={rdos} title="Horas por disciplina" />
          <HhDeviationAnalysisChart rdos={rdos} title="Maiores desvios de HH" />
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardExecutivo;
