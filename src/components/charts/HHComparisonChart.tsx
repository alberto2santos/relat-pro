import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HHComparisonChartProps {
  data: {
    planejado: number;
    realizado: number;
  };
}

const HHComparisonChart: React.FC<HHComparisonChartProps> = ({ data }) => {
  // Transformar em array para Recharts
  const chartData = [
    {
      name: 'Horas',
      planejado: data.planejado,
      realizado: data.realizado,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="planejado" fill="#0072B2" name="Planejado" />
        <Bar dataKey="realizado" fill="#E69F00" name="Realizado" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default HHComparisonChart;