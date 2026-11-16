export const MEASUREMENT_UNITS = [
  { value: 'UN', label: 'Unidade (un)' },
  { value: 'PC', label: 'Peça (pc)' },
  { value: 'M', label: 'Metro (m)' },
  { value: 'M2', label: 'Metro quadrado (m²)' },
  { value: 'M3', label: 'Metro cúbico (m³)' },
  { value: 'KG', label: 'Quilograma (kg)' },
  { value: 'G', label: 'Grama (g)' },
  { value: 'T', label: 'Tonelada (t)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ML', label: 'Mililitro (mL)' },
  { value: 'H', label: 'Hora (h)' },
  { value: 'DIA', label: 'Dia' },
  { value: 'CX', label: 'Caixa (cx)' },
  { value: 'RL', label: 'Rolo (rl)' },
  { value: 'JG', label: 'Jogo (jg)' },
  { value: 'PCT', label: 'Pacote (pct)' },
  { value: 'SC', label: 'Saco (sc)' },
  { value: 'BR', label: 'Barra (br)' },
  { value: 'PAR', label: 'Par' },
  { value: 'CJ', label: 'Conjunto (cj)' },
] as const;

export const isMeasurementUnit = (value: string): boolean =>
  MEASUREMENT_UNITS.some((unit) => unit.value === value);
