import jsPDF from 'jspdf';
import { getDisciplineLabel } from '@/utils/disciplines';
import { getAuditActionLabel } from '@/utils/auditLabels';
import { localDateISO } from '@/utils/dates';
import type {
  RdosRow,
  MateriaisRdoRow,
  EvidenciasRdoRow,
  AuditoriasRdoRow,
  EquipamentosRow,
  FuncoesRow,
  RdoEfetivoRow,
  RdoEquipamentosRow,
  RdoOcorrenciasRow,
  StatusRdo,
} from '@/types/database';

// 
// TIPOS
// 

type RGB = [number, number, number];

interface RdoExportData {
  rdo: RdosRow;
  materiais: MateriaisRdoRow[];
  evidencias: EvidenciasRdoRow[];
  auditorias: AuditoriasRdoRow[];
  efetivo: RdoEfetivoRow[];
  equipamentos: RdoEquipamentosRow[];
  ocorrencias: RdoOcorrenciasRow[];
  funcoes: FuncoesRow[];
  equipamentosCatalogo: EquipamentosRow[];
  unidadeNome?: string | null | undefined;
}

// 
// CONFIGURAÇÕES DO PDF
// 

const PDF_CONFIG = {
  pageWidth: 210,
  pageHeight: 297,
  margin: 10,
  lineHeight: 7,
  fontSize: {
    title: 16,
    heading: 12,
    subheading: 10,
    normal: 9,
    small: 8,
  },
};

const COLORS_PDF: Record<string, RGB> = {
  primary: [59, 130, 246],
  success: [16, 185, 129],
  warning: [245, 158, 11],
  danger: [239, 68, 68],
  gray: [107, 114, 128],
  darkGray: [55, 65, 81],
};

// 
// FUNÇÃO PRINCIPAL - EXPORTAR RDO PARA PDF
// 

export const exportRdoToPdf = async (data: RdoExportData): Promise<void> => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yPosition = PDF_CONFIG.margin;

    // Página 1: Cabeçalho + Informações básicas
    yPosition = addHeader(pdf, yPosition);
    yPosition = addBasicInfo(pdf, data, yPosition);
    yPosition = addHhSection(pdf, data, yPosition);
    yPosition = addObservationsSection(pdf, data, yPosition);

    // Demais seções: nova página só quando a próxima não cabe no espaço restante.
    if (data.rdo.clima_condicao || data.efetivo.length || data.equipamentos.length || data.ocorrencias.length) {
      yPosition = ensureSpace(pdf, yPosition, 45);
      yPosition = addOperationalSection(pdf, data, yPosition);
    }

    if (data.materiais.length > 0) {
      yPosition = ensureSpace(pdf, yPosition, 35);
      yPosition = addMaterialsSection(pdf, data.materiais, yPosition);
    }

    if (data.evidencias.length > 0) {
      yPosition = ensureSpace(pdf, yPosition, 95);
      yPosition = await addEvidenciasSection(pdf, data.evidencias, yPosition);
    }

    yPosition = ensureSpace(pdf, yPosition, 40);
    yPosition = addAuditoriaSection(pdf, data.auditorias, yPosition);
    addFooter(pdf);

    // Salvar PDF
    const fileName = `RDO-${data.rdo.numero || 'exportacao'}-${localDateISO()}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Erro ao gerar PDF'
    );
  }
};

const ensureSpace = (pdf: jsPDF, yPos: number, minHeight: number): number => {
  const limit = pdf.internal.pageSize.getHeight() - 20;
  if (yPos + minHeight > limit) {
    pdf.addPage();
    return PDF_CONFIG.margin;
  }
  return yPos + 4;
};

const addOperationalSection = (pdf: jsPDF, data: RdoExportData, yPos: number): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFontSize(PDF_CONFIG.fontSize.subheading);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('CLIMA E APONTAMENTOS OPERACIONAIS', PDF_CONFIG.margin, yPos);

  const lines = [
    `Clima: ${data.rdo.clima_condicao || 'Não informado'}${data.rdo.clima_temperatura !== null ? ` · ${data.rdo.clima_temperatura} °C` : ''}${data.rdo.clima_origem ? ` · ${data.rdo.clima_origem}` : ''}`,
    'Efetivo:',
    ...data.efetivo.map((entry) => {
      const name = data.funcoes.find((funcao) => funcao.id === entry.funcao_id)?.nome || 'Função arquivada';
      return `• ${name}: ${entry.quantidade} pessoa(s), ${entry.horas_trabalhadas} h${entry.nome ? ` · ${entry.nome}` : ''}`;
    }),
    'Equipamentos:',
    ...data.equipamentos.map((entry) => {
      const name = data.equipamentosCatalogo.find((equipment) => equipment.id === entry.equipamento_id)?.nome || 'Equipamento arquivado';
      return `• ${name}: ${entry.horas_uso} h${entry.observacao ? ` · ${entry.observacao}` : ''}`;
    }),
    'Ocorrências e paralisações:',
    ...data.ocorrencias.map((entry) => `• ${entry.tipo.replace(/_/g, ' ')}: ${entry.descricao} · ${entry.horas_impacto} h${entry.responsavel ? ` · ${entry.responsavel}` : ''}`),
  ];

  yPos += 8;
  pdf.setFontSize(PDF_CONFIG.fontSize.normal);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  lines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(line, pageWidth - PDF_CONFIG.margin * 2) as string[];
    if (yPos + wrapped.length * 5 > 275) {
      pdf.addPage();
      yPos = PDF_CONFIG.margin;
    }
    pdf.text(wrapped, PDF_CONFIG.margin, yPos);
    yPos += wrapped.length * 5 + 2;
  });
  return yPos + 3;
};

// 
// SEÇÕES DO PDF
// 

const addHeader = (pdf: jsPDF, yPos: number): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(PDF_CONFIG.fontSize.title);
  pdf.setTextColor(...COLORS_PDF.primary);
  pdf.text('RELATÓRIO DIÁRIO DE OBRA', PDF_CONFIG.margin, yPos);

  yPos += 8;

  pdf.setDrawColor(...COLORS_PDF.primary);
  pdf.line(
    PDF_CONFIG.margin,
    yPos,
    pageWidth - PDF_CONFIG.margin,
    yPos
  );

  yPos += 5;

  pdf.setFontSize(PDF_CONFIG.fontSize.small);
  pdf.setTextColor(...COLORS_PDF.gray);
  pdf.text(
    'Gestão e acompanhamento de obras',
    PDF_CONFIG.margin,
    yPos
  );

  return yPos + 8;
};

const addBasicInfo = (
  pdf: jsPDF,
  data: RdoExportData,
  yPos: number
): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const colWidth = (pageWidth - PDF_CONFIG.margin * 2) / 2;

  pdf.setFontSize(PDF_CONFIG.fontSize.subheading);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('INFORMAÇÕES BÁSICAS', PDF_CONFIG.margin, yPos);

  yPos += 7;

  pdf.setFontSize(PDF_CONFIG.fontSize.normal);
  pdf.setTextColor(...COLORS_PDF.darkGray);

  // Coluna esquerda
  addLabelValue(
    pdf,
    'Número RDO:',
    data.rdo.numero || 'N/A',
    PDF_CONFIG.margin,
    yPos
  );
  yPos += 6;

  addLabelValue(
    pdf,
    'Data:',
    new Date(`${data.rdo.data}T12:00:00`).toLocaleDateString('pt-BR'),
    PDF_CONFIG.margin,
    yPos
  );
  yPos += 6;

  addLabelValue(
    pdf,
    'Unidade:',
    data.unidadeNome || 'N/A',
    PDF_CONFIG.margin,
    yPos
  );
  yPos += 6;

  // Coluna direita
  const rightCol = PDF_CONFIG.margin + colWidth;

  addLabelValue(
    pdf,
    'Disciplina:',
    getDisciplineLabel(data.rdo.disciplina) || 'Não especificada',
    rightCol,
    yPos - 18
  );

  addLabelValue(
    pdf,
    'Status:',
    getStatusLabel(data.rdo.status),
    rightCol,
    yPos - 12
  );

  addLabelValue(
    pdf,
    'Criado em:',
    data.rdo.created_at ? new Date(data.rdo.created_at).toLocaleDateString('pt-BR') : 'N/A',
    rightCol,
    yPos - 6
  );

  return yPos + 6;
};

const addHhSection = (
  pdf: jsPDF,
  data: RdoExportData,
  yPos: number
): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(PDF_CONFIG.fontSize.subheading);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('HORAS', PDF_CONFIG.margin, yPos);

  yPos += 7;

  // Box com background
  pdf.setFillColor(240, 249, 255);
  pdf.rect(
    PDF_CONFIG.margin,
    yPos,
    pageWidth - PDF_CONFIG.margin * 2,
    20,
    'F'
  );

  pdf.setFontSize(PDF_CONFIG.fontSize.normal);
  pdf.setTextColor(...COLORS_PDF.darkGray);

  const colWidth = (pageWidth - PDF_CONFIG.margin * 2) / 3;
  const boxY = yPos + 7;

  // HH Planejado
  pdf.text('HH Planejado', PDF_CONFIG.margin + 5, boxY);
  pdf.setFontSize(PDF_CONFIG.fontSize.title);
  pdf.setTextColor(...COLORS_PDF.primary);
  pdf.text(`${data.rdo.hh_planejado}h`, PDF_CONFIG.margin + 5, boxY + 8);

  // HH Realizado
  pdf.setFontSize(PDF_CONFIG.fontSize.normal);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('HH Realizado', PDF_CONFIG.margin + colWidth + 5, boxY);
  pdf.setFontSize(PDF_CONFIG.fontSize.title);
  pdf.setTextColor(...COLORS_PDF.success);
  pdf.text(
    `${data.rdo.hh_realizado || '—'}h`,
    PDF_CONFIG.margin + colWidth + 5,
    boxY + 8
  );

  // Desvio
  pdf.setFontSize(PDF_CONFIG.fontSize.normal);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('Desvio', PDF_CONFIG.margin + colWidth * 2 + 5, boxY);

  if (data.rdo.hh_realizado) {
    const desvio =
      ((data.rdo.hh_realizado - data.rdo.hh_planejado) / data.rdo.hh_planejado) *
      100;
    const desvioColor: RGB =
      Math.abs(desvio) <= 10
        ? COLORS_PDF.warning as RGB
        : (COLORS_PDF.danger as RGB);

    pdf.setFontSize(PDF_CONFIG.fontSize.title);
    pdf.setTextColor(...desvioColor);
    pdf.text(
      `${desvio > 0 ? '+' : ''}${desvio.toFixed(1)}%`,
      PDF_CONFIG.margin + colWidth * 2 + 5,
      boxY + 8
    );
  } else {
    pdf.setFontSize(PDF_CONFIG.fontSize.normal);
    pdf.setTextColor(...(COLORS_PDF.gray as RGB));
    pdf.text('—', PDF_CONFIG.margin + colWidth * 2 + 5, boxY + 8);
  }

  return yPos + 25;
};

const addObservationsSection = (
  pdf: jsPDF,
  data: RdoExportData,
  yPos: number
): number => {
  if (!data.rdo.engenheiro_obs && !data.rdo.coordenador_obs) {
    return yPos;
  }

  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(PDF_CONFIG.fontSize.subheading);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('OBSERVAÇÕES', PDF_CONFIG.margin, yPos);

  yPos += 7;

  pdf.setFontSize(PDF_CONFIG.fontSize.normal);

  if (data.rdo.engenheiro_obs) {
    pdf.setTextColor(...(COLORS_PDF.primary as RGB));
    pdf.text('Engenheiro:', PDF_CONFIG.margin, yPos);
    yPos += 5;

    pdf.setTextColor(...COLORS_PDF.darkGray);
    const engLinhas = pdf.splitTextToSize(
      data.rdo.engenheiro_obs,
      pageWidth - PDF_CONFIG.margin * 2 - 5
    ) as string[];
    pdf.text(engLinhas, PDF_CONFIG.margin + 5, yPos);
    yPos += engLinhas.length * 5 + 3;
  }

  if (data.rdo.coordenador_obs) {
    pdf.setTextColor(...(COLORS_PDF.success as RGB));
    pdf.text('Coordenador:', PDF_CONFIG.margin, yPos);
    yPos += 5;

    pdf.setTextColor(...COLORS_PDF.darkGray);
    const coordLinhas = pdf.splitTextToSize(
      data.rdo.coordenador_obs,
      pageWidth - PDF_CONFIG.margin * 2 - 5
    ) as string[];
    pdf.text(coordLinhas, PDF_CONFIG.margin + 5, yPos);
    yPos += coordLinhas.length * 5 + 3;
  }

  return yPos + 3;
};

const addMaterialsSection = (
  pdf: jsPDF,
  materiais: MateriaisRdoRow[],
  yPos: number
): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(PDF_CONFIG.fontSize.subheading);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('MATERIAIS UTILIZADOS', PDF_CONFIG.margin, yPos);

  yPos += 8;

  // Cabeçalho da tabela
  pdf.setFillColor(...(COLORS_PDF.primary as RGB));
  pdf.rect(PDF_CONFIG.margin, yPos, pageWidth - PDF_CONFIG.margin * 2, 7, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(PDF_CONFIG.fontSize.small);

  const col1X = PDF_CONFIG.margin;
  const col2X = PDF_CONFIG.margin + 100;
  const col3X = PDF_CONFIG.margin + 150;

  pdf.text('Material', col1X + 2, yPos + 5);
  pdf.text('Quantidade', col2X + 2, yPos + 5);
  pdf.text('Unidade', col3X + 2, yPos + 5);

  yPos += 7;

  // Linhas da tabela
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.setFontSize(PDF_CONFIG.fontSize.normal);

  materiais.forEach((material, index) => {
    const bgColor: RGB = index % 2 === 0 ? [245, 245, 245] : [255, 255, 255];
    pdf.setFillColor(...bgColor);
    pdf.rect(PDF_CONFIG.margin, yPos, pageWidth - PDF_CONFIG.margin * 2, 6, 'F');

    pdf.text(material.material, col1X + 2, yPos + 4);
    pdf.text(material.quantidade.toString(), col2X + 2, yPos + 4);
    pdf.text(material.unidade_medida || '—', col3X + 2, yPos + 4);

    yPos += 6;

    if (yPos > 270) {
      pdf.addPage();
      yPos = PDF_CONFIG.margin;
    }
  });

  return yPos + 5;
};

const addEvidenciasSection = async (
  pdf: jsPDF,
  evidencias: EvidenciasRdoRow[],
  yPos: number
): Promise<number> => {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(PDF_CONFIG.fontSize.subheading);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('EVIDÊNCIAS', PDF_CONFIG.margin, yPos);

  yPos += 8;

  const imgPerRow = 2;
  const imgWidth = (pageWidth - PDF_CONFIG.margin * 2 - 5) / imgPerRow;
  const imgHeight = imgWidth * 0.75;

  let colIndex = 0;
  let rowYPos = yPos;
  let descLinhas: string[] = [];

  for (const evidencia of evidencias) {
    try {
      const xPos = PDF_CONFIG.margin + colIndex * (imgWidth + 5);

      if (evidencia.tipo === 'foto' || evidencia.tipo === 'assinatura') {
        pdf.addImage(
          evidencia.url,
          'JPEG',
          xPos,
          rowYPos,
          imgWidth,
          imgHeight
        );

        pdf.setFontSize(PDF_CONFIG.fontSize.small);
        pdf.setTextColor(...(COLORS_PDF.gray as RGB));
        descLinhas = pdf.splitTextToSize(
          evidencia.descricao || evidencia.tipo,
          imgWidth
        ) as string[];
        pdf.text(descLinhas, xPos, rowYPos + imgHeight + 3);
      }

      colIndex += 1;

      if (colIndex >= imgPerRow) {
        colIndex = 0;
        rowYPos += imgHeight + descLinhas.length * 3 + 8;

        if (rowYPos + imgHeight + 15 > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          rowYPos = PDF_CONFIG.margin;
        }
      }
    } catch (error) {
      console.warn(`Erro ao adicionar imagem: ${evidencia.url}`, error);
    }
  }

  if (colIndex > 0) rowYPos += imgHeight + descLinhas.length * 3 + 8;
  return rowYPos + 10;
};

const addAuditoriaSection = (
  pdf: jsPDF,
  auditorias: AuditoriasRdoRow[],
  yPos: number
): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(PDF_CONFIG.fontSize.subheading);
  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text('HISTÓRICO DE AUDITORIA', PDF_CONFIG.margin, yPos);

  yPos += 8;

  pdf.setFontSize(PDF_CONFIG.fontSize.small);

  auditorias.slice(0, 10).forEach((auditoria, index) => {
    if (yPos > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      yPos = PDF_CONFIG.margin;
    }
    const acaoColor: RGB = getAcaoColor(auditoria.acao) as RGB;

    pdf.setTextColor(...acaoColor);
    pdf.text(
      `${index + 1}. ${getAuditActionLabel(auditoria.acao)}`,
      PDF_CONFIG.margin,
      yPos
    );

    pdf.setTextColor(...(COLORS_PDF.gray as RGB));
    pdf.text(
      auditoria.created_at
        ? new Date(auditoria.created_at).toLocaleDateString('pt-BR', {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Data indisponível',
      PDF_CONFIG.margin + 60,
      yPos
    );

    yPos += 5;

    if (auditoria.comentario) {
      pdf.setTextColor(...COLORS_PDF.gray);
      const comentLinhas = pdf.splitTextToSize(
        `"${auditoria.comentario}"`,
        pageWidth - PDF_CONFIG.margin * 2 - 10
      ) as string[];
      pdf.text(comentLinhas, PDF_CONFIG.margin + 5, yPos);
      yPos += comentLinhas.length * 4;
    }

    yPos += 2;
  });

  return yPos + 10;
};

const addFooter = (pdf: jsPDF): void => {
  const pageCount = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFontSize(PDF_CONFIG.fontSize.small);
  pdf.setTextColor(...(COLORS_PDF.gray as RGB));

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    pdf.setDrawColor(...(COLORS_PDF.gray as RGB));
    pdf.line(
      PDF_CONFIG.margin,
      pageHeight - 12,
      pageWidth - PDF_CONFIG.margin,
      pageHeight - 12
    );

    pdf.text(
      `Relat Pro RDO | ${new Date().toLocaleDateString('pt-BR')}`,
      PDF_CONFIG.margin,
      pageHeight - 8
    );

    pdf.text(
      `Página ${i}/${pageCount}`,
      pageWidth - PDF_CONFIG.margin - 30,
      pageHeight - 8
    );
  }
};

// 
// FUNÇÕES UTILITÁRIAS
// 

const addLabelValue = (
  pdf: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number
): void => {
  pdf.setTextColor(...(COLORS_PDF.gray as RGB));
  pdf.text(label, x, y);

  pdf.setTextColor(...COLORS_PDF.darkGray);
  pdf.text(value, x + 40, y);
};

const getStatusLabel = (status: StatusRdo | null): string => {
  if (!status) return 'Não informado';
  const labels: Record<StatusRdo, string> = {
    draft: 'Rascunho',
    submitted: 'Enviado',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
  };
  return labels[status];
};

const getAcaoColor = (acao: string): RGB => {
  const colors: Record<string, RGB> = {
    draft: COLORS_PDF.primary as RGB,
    submitted: COLORS_PDF.warning as RGB,
    approved: COLORS_PDF.success as RGB,
    rejected: COLORS_PDF.danger as RGB,
  };
  return colors[acao] || (COLORS_PDF.gray as RGB);
};
