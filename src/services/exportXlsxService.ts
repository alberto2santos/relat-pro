import type ExcelJSModule from 'exceljs';
import type {
  EquipamentosRow,
  FuncoesRow,
  RdoEfetivoRow,
  RdoEquipamentosRow,
  RdoOcorrenciasRow,
  RdosRow,
  UnidadesRow,
  StatusRdo,
} from '@/types/database';
import { neutralizeSpreadsheetFormula } from '@/utils/spreadsheetSafety';
import { getDisciplineLabel } from '@/utils/disciplines';
import { localDateISO } from '@/utils/dates';

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

const HEADER_FILL = 'FF1D4ED8';
const HEADER_FONT = 'FFFFFFFF';
const BORDER_COLOR = 'FFE2E8F0';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const exportRdosToXlsx = async (data: ExportData): Promise<void> => {
  const {
    rdos,
    unidades = [],
    efetivo = [],
    equipamentos = [],
    ocorrencias = [],
    funcoes = [],
    equipamentosCatalogo = [],
    fileName = 'relat-pro-rdo',
  } = data;

  if (rdos.length === 0) {
    throw new Error('Não existem dados para exportação.');
  }

  const unidadeNames = new Map(unidades.map((unidade) => [unidade.id, unidade.nome]));
  const functionNames = new Map(funcoes.map((row) => [row.id, row.nome]));
  const equipmentNames = new Map(equipamentosCatalogo.map((row) => [row.id, row.nome]));
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Relat Pro RDO';
  workbook.created = new Date();
  workbook.modified = new Date();

  const reportsSheet = workbook.addWorksheet('Relatórios Diários', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  reportsSheet.columns = [
    { header: 'Número RDO', key: 'numero', width: 15 },
    { header: 'Data da Obra', key: 'data', width: 15 },
    { header: 'Unidade/TAG', key: 'unidade', width: 25 },
    { header: 'Disciplina', key: 'disciplina', width: 18 },
    { header: 'HH Planejado', key: 'hhPlanejado', width: 15 },
    { header: 'HH Realizado', key: 'hhRealizado', width: 15 },
    { header: 'Desvio (%)', key: 'desvio', width: 12 },
    { header: 'Status Atual', key: 'status', width: 18 },
    { header: 'Relato Técnico', key: 'relato', width: 40 },
    { header: 'Observações Coord.', key: 'observacoes', width: 32 },
    { header: 'Clima', key: 'clima', width: 25 },
    { header: 'Temperatura (°C)', key: 'temperatura', width: 16 },
    { header: 'Origem do clima', key: 'origemClima', width: 16 },
    { header: 'Data de Registro', key: 'registro', width: 22 },
  ];

  reportsSheet.addRows(rdos.map((rdo) => {
    const hhRealizado = rdo.hh_realizado ?? 0;
    const desvio = rdo.hh_planejado > 0
      ? Number((((hhRealizado - rdo.hh_planejado) / rdo.hh_planejado) * 100).toFixed(2))
      : 0;

    return {
      numero: rdo.numero || 'N/A',
      data: new Date(`${rdo.data}T12:00:00`).toLocaleDateString('pt-BR'),
      unidade: unidadeNames.get(rdo.unidade_id) || 'Não Identificada',
      disciplina: getDisciplineLabel(rdo.disciplina) || 'N/A',
      hhPlanejado: rdo.hh_planejado,
      hhRealizado,
      desvio,
      status: translateStatus(rdo.status),
      relato: rdo.engenheiro_obs || '',
      observacoes: rdo.coordenador_obs || '',
      clima: rdo.clima_condicao || '',
      temperatura: rdo.clima_temperatura,
      origemClima: rdo.clima_origem || '',
      registro: rdo.created_at ? new Date(rdo.created_at).toLocaleString('pt-BR') : '',
    };
  }));
  styleTable(reportsSheet);
  reportsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: reportsSheet.rowCount, column: reportsSheet.columnCount },
  };
  reportsSheet.getColumn('desvio').numFmt = '0.00"%"';
  reportsSheet.getColumn('hhPlanejado').numFmt = '0.00';
  reportsSheet.getColumn('hhRealizado').numFmt = '0.00';

  addOperationalSheets(workbook, efetivo, equipamentos, ocorrencias, functionNames, equipmentNames);
  addSummarySheet(workbook, rdos);
  neutralizeTextCells(workbook);

  const timestamp = localDateISO();
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${fileName}-${timestamp}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
};

const addOperationalSheets = (
  workbook: ExcelJSModule.Workbook,
  workforce: RdoEfetivoRow[],
  equipment: RdoEquipamentosRow[],
  occurrences: RdoOcorrenciasRow[],
  functionNames: Map<string, string>,
  equipmentNames: Map<string, string>,
): void => {
  const workforceSheet = workbook.addWorksheet('Efetivo');
  workforceSheet.columns = [
    { header: 'RDO ID', key: 'rdo_id', width: 38 },
    { header: 'Função', key: 'funcao', width: 26 },
    { header: 'Quantidade', key: 'quantidade', width: 14 },
    { header: 'Horas trabalhadas', key: 'horas', width: 18 },
    { header: 'Matrícula', key: 'matricula', width: 18 },
    { header: 'Nome', key: 'nome', width: 26 },
    { header: 'Identificador externo', key: 'externo', width: 24 },
  ];
  workforceSheet.addRows(workforce.map((row) => ({
    rdo_id: row.rdo_id,
    funcao: functionNames.get(row.funcao_id) || row.funcao_id,
    quantidade: row.quantidade,
    horas: row.horas_trabalhadas,
    matricula: row.matricula || '',
    nome: row.nome || '',
    externo: row.identificador_externo || '',
  })));
  styleTable(workforceSheet);

  const equipmentSheet = workbook.addWorksheet('Equipamentos');
  equipmentSheet.columns = [
    { header: 'RDO ID', key: 'rdo_id', width: 38 },
    { header: 'Equipamento', key: 'equipamento', width: 30 },
    { header: 'Horas de uso', key: 'horas', width: 16 },
    { header: 'Observação', key: 'observacao', width: 40 },
  ];
  equipmentSheet.addRows(equipment.map((row) => ({
    rdo_id: row.rdo_id,
    equipamento: equipmentNames.get(row.equipamento_id) || row.equipamento_id,
    horas: row.horas_uso,
    observacao: row.observacao || '',
  })));
  styleTable(equipmentSheet);

  const occurrencesSheet = workbook.addWorksheet('Ocorrências');
  occurrencesSheet.columns = [
    { header: 'RDO ID', key: 'rdo_id', width: 38 },
    { header: 'Tipo', key: 'tipo', width: 20 },
    { header: 'Descrição', key: 'descricao', width: 48 },
    { header: 'Início', key: 'inicio', width: 24 },
    { header: 'Fim', key: 'fim', width: 24 },
    { header: 'Horas de impacto', key: 'horas', width: 18 },
    { header: 'Responsável', key: 'responsavel', width: 26 },
  ];
  occurrencesSheet.addRows(occurrences.map((row) => ({
    rdo_id: row.rdo_id,
    tipo: row.tipo,
    descricao: row.descricao,
    inicio: row.inicio ? new Date(row.inicio).toLocaleString('pt-BR') : '',
    fim: row.fim ? new Date(row.fim).toLocaleString('pt-BR') : '',
    horas: row.horas_impacto,
    responsavel: row.responsavel || '',
  })));
  styleTable(occurrencesSheet);
};

const neutralizeTextCells = (workbook: ExcelJSModule.Workbook): void => {
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') {
          cell.value = neutralizeSpreadsheetFormula(cell.value);
        }
      });
    });
  });
};

const styleTable = (worksheet: ExcelJSModule.Worksheet): void => {
  const header = worksheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        bottom: { style: 'hair', color: { argb: BORDER_COLOR } },
      };
    });
  });
}

const addSummarySheet = (workbook: ExcelJSModule.Workbook, rdos: RdosRow[]): void => {
  const stats = {
    total: rdos.length,
    aprovados: rdos.filter((rdo) => rdo.status === 'approved').length,
    enviados: rdos.filter((rdo) => rdo.status === 'submitted').length,
    rejeitados: rdos.filter((rdo) => rdo.status === 'rejected').length,
    rascunhos: rdos.filter((rdo) => rdo.status === 'draft').length,
  };
  const hhTotalPlanejado = rdos.reduce((sum, rdo) => sum + rdo.hh_planejado, 0);
  const hhTotalRealizado = rdos.reduce((sum, rdo) => sum + (rdo.hh_realizado ?? 0), 0);
  const desvioGlobal = hhTotalPlanejado > 0
    ? Number((((hhTotalRealizado - hhTotalPlanejado) / hhTotalPlanejado) * 100).toFixed(2))
    : 0;

  const summarySheet = workbook.addWorksheet('Resumo Executivo');
  summarySheet.columns = [{ width: 32 }, { width: 22 }];
  summarySheet.addRows([
    ['RESUMO EXECUTIVO - RELAT PRO RDO'],
    [],
    ['MÉTRICAS DE STATUS'],
    ['Total de Relatórios', stats.total],
    ['Aprovados', stats.aprovados],
    ['Pendentes de Aprovação', stats.enviados],
    ['Rejeitados', stats.rejeitados],
    ['Rascunhos', stats.rascunhos],
    [],
    ['MÉTRICAS DE PRODUTIVIDADE (HH)'],
    ['HH Total Planejado', hhTotalPlanejado],
    ['HH Total Realizado', hhTotalRealizado],
    ['Desvio Global de Horas (%)', desvioGlobal],
    [],
    ['Relatório gerado em:', new Date().toLocaleString('pt-BR')],
  ]);
  summarySheet.mergeCells('A1:B1');
  summarySheet.mergeCells('A3:B3');
  summarySheet.mergeCells('A10:B10');

  for (const rowNumber of [1, 3, 10]) {
    const row = summarySheet.getRow(rowNumber);
    row.height = 24;
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.font = { bold: true, color: { argb: HEADER_FONT } };
      cell.alignment = { vertical: 'middle' };
    });
  }

  summarySheet.getCell('B11').numFmt = '0.00';
  summarySheet.getCell('B12').numFmt = '0.00';
  summarySheet.getCell('B13').numFmt = '0.00"%"';
};

const translateStatus = (status: StatusRdo | null): string => {
  const statusMap: Record<StatusRdo, string> = {
    draft: 'Rascunho',
    submitted: 'Enviado',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
  };

  return status ? statusMap[status] : 'Não informado';
};
