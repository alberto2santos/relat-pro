// src/services/exportCsvService.ts

import type {
  EquipamentosRow,
  FuncoesRow,
  RdoEfetivoRow,
  RdoEquipamentosRow,
  RdoOcorrenciasRow,
  RdosRow,
  StatusRdo,
  UnidadesRow,
} from '@/types/database';
import { neutralizeSpreadsheetFormula } from '@/utils/spreadsheetSafety';
import { localDateISO } from '@/utils/dates';

// ============================================================================
// TIPOS
// ============================================================================

interface ExportData {
  rdos: RdosRow[];
  unidades?: UnidadesRow[];
  efetivo?: RdoEfetivoRow[];
  equipamentos?: RdoEquipamentosRow[];
  ocorrencias?: RdoOcorrenciasRow[];
  funcoes?: FuncoesRow[];
  equipamentosCatalogo?: EquipamentosRow[];
  fileName?: string;
}

// ============================================================================
// FUNÇÕES DE EXPORTAÇÃO CSV
// ============================================================================

export const exportRdosToCsv = (data: ExportData): void => {
  try {
    const {
      rdos,
      unidades = [],
      efetivo = [],
      equipamentos = [],
      ocorrencias = [],
      funcoes = [],
      equipamentosCatalogo = [],
      fileName = 'rdos',
    } = data;

    if (rdos.length === 0) {
      throw new Error('Nenhum RDO para exportar');
    }

    // Mapear unidades para lookup rápido
    const unidadesMap = new Map(unidades.map((u) => [u.id, u.nome]));
    const functionNames = new Map(funcoes.map((row) => [row.id, row.nome]));
    const equipmentNames = new Map(equipamentosCatalogo.map((row) => [row.id, row.nome]));
    const rdoOperations = new Map(rdos.map((rdo) => [rdo.id, {
      workforce: efetivo.filter((row) => row.rdo_id === rdo.id)
        .map((row) => `${functionNames.get(row.funcao_id) || row.funcao_id}: ${row.quantidade} pessoa(s), ${row.horas_trabalhadas} h`).join('; '),
      equipment: equipamentos.filter((row) => row.rdo_id === rdo.id)
        .map((row) => `${equipmentNames.get(row.equipamento_id) || row.equipamento_id}: ${row.horas_uso} h${row.observacao ? ` (${row.observacao})` : ''}`).join('; '),
      occurrences: ocorrencias.filter((row) => row.rdo_id === rdo.id)
        .map((row) => `${row.tipo}: ${row.descricao} (${row.horas_impacto} h)`).join('; '),
    }]));

    // Criar headers
    const headers = [
      'Número RDO',
      'Data',
      'Unidade',
      'Disciplina',
      'HH Planejado',
      'HH Realizado',
      'Desvio (%)',
      'Status',
      'Observações Engenheiro',
      'Observações Coordenador',
      'Clima',
      'Temperatura (°C)',
      'Origem do clima',
      'Efetivo por função',
      'Equipamentos',
      'Ocorrências e paralisações',
      'Criado em',
    ];

    // Criar linhas de dados
    const rows = rdos.map((rdo) => {
      const desvio = rdo.hh_realizado !== null
        ? (((rdo.hh_realizado - rdo.hh_planejado) / rdo.hh_planejado) * 100).toFixed(2)
        : '';

      return [
        rdo.numero || '',
        formatDate(rdo.data),
        unidadesMap.get(rdo.unidade_id) || '',
        rdo.disciplina || '',
        rdo.hh_planejado,
        rdo.hh_realizado ?? '',
        desvio,
        translateStatus(rdo.status),
        rdo.engenheiro_obs || '',
        rdo.coordenador_obs || '',
        rdo.clima_condicao || '',
        rdo.clima_temperatura ?? '',
        rdo.clima_origem || '',
        rdoOperations.get(rdo.id)?.workforce || '',
        rdoOperations.get(rdo.id)?.equipment || '',
        rdoOperations.get(rdo.id)?.occurrences || '',
        formatDateTime(rdo.created_at),
      ];
    });

    // Construir CSV
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
    ].join('\n');

    // Download
    downloadCsv(csvContent, `${fileName}-${formatDateForFilename()}.csv`);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Erro ao exportar CSV'
    );
  }
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

const escapeCsvCell = (cell: string | number | null | undefined): string => {
  if (cell === null || cell === undefined) return '';

  const rawValue = String(cell);
  const cellStr = typeof cell === 'string' ? neutralizeSpreadsheetFormula(rawValue) : rawValue;

  // Se contém vírgula, aspas ou quebra de linha, envolver em aspas
  if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
    return `"${cellStr.replace(/"/g, '""')}"`;
  }

  return cellStr;
};

const formatDate = (dateString: string): string => {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('pt-BR');
};

const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateForFilename = (): string => {
  return localDateISO();
};

const translateStatus = (status: StatusRdo | null): string => {
  if (!status) return 'Não informado';
  const statusMap: Record<StatusRdo, string> = {
    draft: 'Rascunho',
    submitted: 'Enviado',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
  };
  return statusMap[status];
};

const downloadCsv = (content: string, fileName: string): void => {
  const bom = '\uFEFF'; // BOM para UTF-8 (suporte a acentos no Excel)
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
