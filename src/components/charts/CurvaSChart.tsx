import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';

interface DataPoint {
  data: string;
  progressoPlano: number;
  progressoRealizado: number;
}

interface CurvaSChartProps {
  data: DataPoint[];
}

const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
  if (active && payload && payload.length) {
    const plano = payload.find((item) => item.dataKey === 'progressoPlano');
    const realizado = payload.find((item) => item.dataKey === 'progressoRealizado');
    return (
      <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-lg">
        <p className="font-bold text-sm mb-2">{label}</p>
        <p className="text-sm">
          Plano: <span className="font-semibold text-blue-500">{String(plano?.value ?? 0)}%</span>
        </p>
        <p className="text-sm">
          Realizado: <span className="font-semibold text-green-500">{String(realizado?.value ?? 0)}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const CurvaSChart: React.FC<CurvaSChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="data" />
        <YAxis 
          unit="%" 
          domain={[0, 100]} 
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip content={CustomTooltip} />
        <Legend />
        {/* Progresso planejado */}
        <Area
          type="monotone"
          dataKey="progressoPlano"
          stroke="#0072B2"
          fill="#0072B2"
          fillOpacity={0.3}
          name="Plano"
        />
        {/* Progresso realizado */}
        <Area
          type="monotone"
          dataKey="progressoRealizado"
          stroke="#E69F00"
          fill="#E69F00"
          fillOpacity={0.3}
          name="Realizado"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default CurvaSChart;
