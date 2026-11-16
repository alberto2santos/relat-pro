import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Disciplina, RdosRow } from '@/types/database';
import { calculateHHDeviation } from '@/utils/hhDeviation';

// ============================================================================
// TIPOS LOCAIS
// ============================================================================

interface ChartProps {
  rdos: RdosRow[];
  title: string;
}

const COLORS = {
  planned: '#0072B2',
  realized: '#E69F00',
  deviation: '#D55E00',
  green: '#009E73',
};

const STATUS_COLORS = {
  draft: '#64748B',
  submitted: '#0072B2',
  approved: '#15803D',
  rejected: '#B91C1C',
};

const EmptyChartState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <Card className="border-dashed border-2">
    <CardHeader>
      <CardTitle className="text-sm font-bold text-gray-500 uppercase">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-gray-400 text-center py-12 text-sm">{message}</p>
    </CardContent>
  </Card>
);

// ============================================================================
// 1. GRÁFICO DE TENDÊNCIA DE HH (Linha)
// ============================================================================

export const HhTrendChart: React.FC<ChartProps> = ({ rdos, title }) => {
  const data = rdos
    .filter((r) => r.hh_realizado !== null)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(-20)
    .map((r) => ({
      data: new Date(`${r.data}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
      planejado: r.hh_planejado,
      realizado: r.hh_realizado,
    }));

  if (data.length === 0) return <EmptyChartState title={title} message="Sem dados de HH para exibir." />;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip formatter={(value) => [`${value}h`, 'Horas']} />
            <Legend iconType="circle" />
            <Line type="monotone" dataKey="planejado" stroke={COLORS.planned} strokeWidth={3} name="HH Planejado" dot={{ r: 4, fill: COLORS.planned }} />
            <Line type="monotone" dataKey="realizado" stroke={COLORS.realized} strokeWidth={3} name="HH Realizado" dot={{ r: 4, fill: COLORS.realized }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// 2. DISTRIBUIÇÃO DE STATUS (Pizza)
// ============================================================================

export const StatusDistributionChart: React.FC<ChartProps> = ({ rdos, title }) => {
  const statusCounts = {
    draft: rdos.filter((r) => r.status === 'draft').length,
    enviado: rdos.filter((r) => r.status === 'submitted').length,
    aprovado: rdos.filter((r) => r.status === 'approved').length,
    rejeitado: rdos.filter((r) => r.status === 'rejected').length,
  };

  const data = [
    { name: 'Rascunho', value: statusCounts.draft, color: STATUS_COLORS.draft },
    { name: 'Enviado', value: statusCounts.enviado, color: STATUS_COLORS.submitted },
    { name: 'Aprovado', value: statusCounts.aprovado, color: STATUS_COLORS.approved },
    { name: 'Rejeitado', value: statusCounts.rejeitado, color: STATUS_COLORS.rejected },
  ].filter((item) => item.value > 0);

  if (data.length === 0) return <EmptyChartState title={title} message="Nenhum relatório processado." />;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} RDOs`, 'Quantidade']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// 3. ANÁLISE DE DESVIO HH (Barra)
// ============================================================================

export const HhDeviationAnalysisChart: React.FC<ChartProps> = ({ rdos, title }) => {
  const data = rdos
    .filter((r) => r.hh_realizado !== null)
    .map((r) => {
      const { percentage, deviation } = calculateHHDeviation(r.hh_planejado, r.hh_realizado || 0);
      return {
        numero: r.numero,
        desvio: Number((deviation < 0 ? -percentage : percentage).toFixed(1)),
      };
    })
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
    .slice(0, 10);

  if (data.length === 0) return <EmptyChartState title={title} message="Dados insuficientes para cálculo de desvio." />;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="numero" angle={-45} textAnchor="end" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(value) => [`${value}%`, 'Desvio']} />
            <Bar dataKey="desvio" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={Math.abs(entry.desvio) > 20 ? COLORS.deviation : COLORS.realized} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// 4. COMPARATIVO POR DISCIPLINA
// ============================================================================

export const DisciplineHhComparisonChart: React.FC<ChartProps> = ({ rdos, title }) => {
  const disciplinas: Disciplina[] = [
    'automacao', 'instrumentacao', 'eletrica', 'civil',
  ];
  const nomesDisciplina: Record<Disciplina, string> = {
    automacao: 'Automação',
    instrumentacao: 'Instrumentação',
    eletrica: 'Elétrica',
    civil: 'Construção e Montagem',
  };

  const data = disciplinas.reduce<Array<{ name: string; planejado: number; realizado: number }>>((rows, disc) => {
      const filtered = rdos.filter((r) => r.disciplina === disc);
      if (filtered.length === 0) return rows;

      rows.push({
        name: nomesDisciplina[disc],
        planejado: filtered.reduce((sum, r) => sum + r.hh_planejado, 0),
        realizado: filtered.reduce((sum, r) => sum + (r.hh_realizado || 0), 0),
      });
      return rows;
    }, []);

  if (data.length === 0) return <EmptyChartState title={title} message="Sem dados por disciplina." />;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => [`${value}h`, 'Horas']} />
            <Legend />
            <Bar dataKey="planejado" fill={COLORS.planned} name="Planejado" radius={[4, 4, 0, 0]} />
            <Bar dataKey="realizado" fill={COLORS.realized} name="Realizado" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// 5. TAXA DE APROVAÇÃO
// ============================================================================

export const ApprovalRateChart: React.FC<ChartProps> = ({ rdos, title }) => {
  const avaliados = rdos.filter((r) => r.status === 'approved' || r.status === 'rejected').length;
  const aprovados = rdos.filter((r) => r.status === 'approved').length;
  const taxa = avaliados > 0 ? (aprovados / avaliados) * 100 : 0;

  return (
    <Card className="shadow-sm border-blue-100 bg-blue-50/20">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-blue-800 uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-6">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={taxa > 80 ? COLORS.green : COLORS.realized}
              strokeWidth="8"
              strokeDasharray={`${(taxa / 100) * 282.7} 282.7`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-blue-900">
            {taxa.toFixed(0)}%
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-gray-500 italic">Baseado em {avaliados} relatórios avaliados</p>
      </CardContent>
    </Card>
  );
};
