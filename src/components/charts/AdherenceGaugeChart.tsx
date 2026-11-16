import { FC, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Sector, Tooltip, Legend } from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

// Interface para os itens de dados do gráfico
interface DataItem {
  name: string;
  value: number;
  fill: string;
}

// Interface das props do componente
interface AdherenceGaugeChartProps {
  data: DataItem[];
}

const AdherenceGaugeChart: FC<AdherenceGaugeChartProps> = ({ data }) => {
  // Calcula o total dos valores para determinar a porcentagem
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  // Porcentagem baseada no primeiro item (assumindo ser o principal para adesão)
  const percentage = total > 0 ? Math.round((data[0]?.value ?? 0) / total * 100) : 0;

  // Função para renderizar o shape customizado do setor com cornerRadius
  const renderCustomizedShape = (props: PieSectorShapeProps) => <Sector {...props} cornerRadius={8} />;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={85}
            shape={renderCustomizedShape}
          />
          <Tooltip formatter={(value, name) => [String(value), String(name)]} />
          <Legend layout="horizontal" align="center" verticalAlign="bottom" />
        </PieChart>
        {/* Div centralizada exibindo a porcentagem */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
            {percentage}%
          </div>
        </div>
      </div>
    </ResponsiveContainer>
  );
};

export default AdherenceGaugeChart;
