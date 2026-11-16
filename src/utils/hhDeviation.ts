/**
 * Utilitário de Cálculos de HH - Relat Pro RDO
 * Apoia o acompanhamento dos servicos executados.
 */

export type DeviationStatus = 'ok' | 'warning' | 'alert';

interface DeviationResult {
  deviation: number;
  percentage: number;
  status: DeviationStatus;
}

/**
 * Constantes de negócio para limites de desvio
 */
const THRESHOLDS = {
  OK: 5,      // Até 5% de desvio é considerado normal
  WARNING: 15 // Até 15% é alerta, acima disso é crítico
};

/**
 * Calcula o desvio entre HH planejado e realizado.
 * @param planned Horas-Homem planejadas
 * @param realized Horas-Homem realizadas
 */
export function calculateHHDeviation(planned: number, realized: number): DeviationResult {
  if (planned <= 0) {
    return {
      deviation: realized,
      percentage: realized > 0 ? 100 : 0,
      status: realized > 0 ? 'alert' : 'ok'
    };
  }

  const deviation = realized - planned;
  const percentage = (Math.abs(deviation) / planned) * 100;

  let status: DeviationStatus = 'ok';
  if (percentage > THRESHOLDS.WARNING) {
    status = 'alert';
  } else if (percentage > THRESHOLDS.OK) {
    status = 'warning';
  }

  return { deviation, percentage, status };
}

/**
 * Retorna a classe de cor do Tailwind para textos ou backgrounds.
 * Útil para integração direta com componentes Shadcn.
 */
export function getDeviationTailwindClass(status: DeviationStatus, type: 'text' | 'bg' | 'border' = 'text'): string {
  const map = {
    ok: {
      text: 'text-green-600',
      bg: 'bg-green-100 text-green-700',
      border: 'border-green-200'
    },
    warning: {
      text: 'text-amber-500',
      bg: 'bg-amber-100 text-amber-700',
      border: 'border-amber-200'
    },
    alert: {
      text: 'text-red-600',
      bg: 'bg-red-100 text-red-700',
      border: 'border-red-200'
    }
  };

  return map[status][type];
}

/**
 * Retorna o rótulo descritivo do status.
 */
export function getDeviationLabel(status: DeviationStatus): string {
  const labels = {
    ok: 'Dentro do Prazo',
    warning: 'Atenção: Desvio Moderado',
    alert: 'Crítico: Desvio Alto'
  };
  return labels[status];
}

/**
 * Converte horas decimais para formato legível de relógio (H:MM).
 * Ex: 8.5 -> "08:30"
 */
export function formatHoursToClock(hours: number): string {
  const absoluteHours = Math.abs(hours);
  const h = Math.floor(absoluteHours);
  const m = Math.round((absoluteHours % 1) * 60);
  
  const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return hours < 0 ? `-${formatted}` : formatted;
}

/**
 * Formata percentual para exibição com sinal de positivo/negativo.
 */
export function formatPercentage(percentage: number, deviation: number): string {
  const signal = deviation > 0 ? '+' : '';
  return `${signal}${percentage.toFixed(1)}%`;
}