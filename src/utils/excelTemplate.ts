import JSZip from 'jszip';
import type { ProductionEntry, ProductionReport, TemplateWorkbookCell, TemplateWorkbookSheet } from '../types';
import { aggregateEquipmentTotals } from './reportEquipmentTotals';

const APP_BASE_URL = import.meta.env.BASE_URL || '/';
const NORMALIZED_BASE_URL = APP_BASE_URL.endsWith('/') ? APP_BASE_URL : `${APP_BASE_URL}/`;
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const OFFICE_RELATIONSHIP_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const EXCEL_TEMPLATE_URL = `${NORMALIZED_BASE_URL}templates/template.xlsx`;

type FormulaValue = {
  formula: string;
  value: number;
};

type XmlParent = Document | Element;

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function normalizeXmlPath(basePath: string, target: string) {
  if (target.startsWith('/')) return target.replace(/^\/+/, '');

  const baseParts = basePath.split('/').slice(0, -1);
  const targetParts = target.split('/');
  const parts = [...baseParts];

  targetParts.forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') {
      parts.pop();
      return;
    }
    parts.push(part);
  });

  return parts.join('/');
}

function parseXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const errorNode = document.getElementsByTagName('parsererror')[0];

  if (errorNode) {
    throw new Error(errorNode.textContent || 'XML parse failed');
  }

  return document;
}

function serializeXml(document: Document) {
  return new XMLSerializer().serializeToString(document);
}

function getElements(parent: XmlParent, tagName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS(SPREADSHEET_NS, tagName));
}

function getFirstElement(parent: XmlParent, tagName: string): Element | null {
  return parent.getElementsByTagNameNS(SPREADSHEET_NS, tagName)[0] ?? null;
}

function columnToNumber(column: string) {
  return column.split('').reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

function numberToColumn(value: number) {
  let column = '';
  let current = value;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column || 'A';
}

function cellColumn(cellRef: string) {
  return cellRef.replace(/\d+/g, '');
}

function getCell(row: Element, column: string) {
  const rowNumber = row.getAttribute('r');
  const cellRef = `${column}${rowNumber}`;
  return getElements(row, 'c').find(cell => cell.getAttribute('r') === cellRef) ?? null;
}

function copyStyleFromTemplateRow(worksheet: Document, cell: Element, column: string) {
  const templateCells = getElements(worksheet, 'row')
    .find(row => row.getAttribute('r') === '8')
    ?.getElementsByTagNameNS(SPREADSHEET_NS, 'c');
  const styledCell = Array.from(templateCells ?? [])
    .find(candidate => cellColumn(candidate.getAttribute('r') ?? '') === column);
  const styleId = styledCell?.getAttribute('s');

  if (styleId) {
    cell.setAttribute('s', styleId);
  }
}

function createCell(worksheet: Document, row: Element, column: string) {
  const rowNumber = row.getAttribute('r');
  const cell = worksheet.createElementNS(SPREADSHEET_NS, 'c');
  const targetColumnNumber = columnToNumber(column);

  cell.setAttribute('r', `${column}${rowNumber}`);
  copyStyleFromTemplateRow(worksheet, cell, column);

  const nextCell = getElements(row, 'c')
    .find(existingCell => columnToNumber(cellColumn(existingCell.getAttribute('r') ?? '')) > targetColumnNumber);

  row.insertBefore(cell, nextCell ?? null);
  return cell;
}

function getOrCreateCell(worksheet: Document, row: Element, column: string) {
  return getCell(row, column) ?? createCell(worksheet, row, column);
}

function removeChildren(cell: Element, tagNames: string[]) {
  tagNames.forEach(tagName => {
    getElements(cell, tagName).forEach(child => child.remove());
  });
}

function setNumericCell(worksheet: Document, row: Element, column: string, value: number, formula?: string) {
  const cell = getOrCreateCell(worksheet, row, column);

  cell.removeAttribute('t');
  removeChildren(cell, ['f', 'v', 'is']);

  if (formula) {
    const formulaNode = worksheet.createElementNS(SPREADSHEET_NS, 'f');
    formulaNode.textContent = formula;
    cell.appendChild(formulaNode);
  }

  const valueNode = worksheet.createElementNS(SPREADSHEET_NS, 'v');
  valueNode.textContent = Number.isFinite(value) ? String(value) : '0';
  cell.appendChild(valueNode);
}

function setTextCell(worksheet: Document, row: Element, column: string, value: string) {
  const cell = getOrCreateCell(worksheet, row, column);
  const inlineString = worksheet.createElementNS(SPREADSHEET_NS, 'is');
  const textNode = worksheet.createElementNS(SPREADSHEET_NS, 't');

  cell.setAttribute('t', 'inlineStr');
  removeChildren(cell, ['f', 'v', 'is']);

  textNode.textContent = value;
  inlineString.appendChild(textNode);
  cell.appendChild(inlineString);
}

function clearCell(worksheet: Document, row: Element, column: string) {
  const cell = getOrCreateCell(worksheet, row, column);

  cell.removeAttribute('t');
  removeChildren(cell, ['f', 'v', 'is']);
}

function findOrCreateRow(worksheet: Document, rowNumber: number) {
  const sheetData = getFirstElement(worksheet, 'sheetData');

  if (!sheetData) {
    throw new Error('Worksheet is missing sheetData');
  }

  const existingRow = getElements(sheetData, 'row')
    .find(row => Number(row.getAttribute('r')) === rowNumber);

  if (existingRow) return existingRow;

  const row = worksheet.createElementNS(SPREADSHEET_NS, 'row');
  row.setAttribute('r', String(rowNumber));

  const nextRow = getElements(sheetData, 'row')
    .find(item => Number(item.getAttribute('r')) > rowNumber);

  sheetData.insertBefore(row, nextRow ?? null);
  return row;
}

function updateWorksheetDimension(worksheet: Document) {
  const cells = getElements(worksheet, 'c');
  if (cells.length === 0) return;

  const bounds = cells.reduce(
    (acc, cell) => {
      const ref = cell.getAttribute('r') ?? '';
      const column = cellColumn(ref);
      const row = Number(ref.replace(/\D+/g, ''));
      const columnNumber = columnToNumber(column);

      if (Number.isFinite(row) && columnNumber > 0) {
        acc.maxColumn = Math.max(acc.maxColumn, columnNumber);
        acc.maxRow = Math.max(acc.maxRow, row);
      }

      return acc;
    },
    { maxColumn: 1, maxRow: 1 }
  );

  let dimension = getFirstElement(worksheet, 'dimension');
  if (!dimension) {
    dimension = worksheet.createElementNS(SPREADSHEET_NS, 'dimension');
    worksheet.documentElement.insertBefore(dimension, worksheet.documentElement.firstChild);
  }

  dimension.setAttribute('ref', `A1:${numberToColumn(bounds.maxColumn)}${bounds.maxRow}`);
}

function excelSerialFromDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000);
}

function findReportRowNumber(worksheet: Document, reportDate: string) {
  const serial = excelSerialFromDate(reportDate);
  const dateRow = getElements(worksheet, 'row').find(row => {
    const cell = getCell(row, 'A');
    const value = getFirstElement(cell ?? row, 'v')?.textContent;
    return Number(value) === serial;
  });

  if (dateRow) {
    return Number(dateRow.getAttribute('r'));
  }

  const day = Number(reportDate.split('-')[2]);
  return day + 7;
}

function getMonthlySheetName(reportDate: string) {
  const [year, month] = reportDate.split('-');
  return `${year.slice(2)}${month}월`;
}

async function getWorksheetPath(zip: JSZip, sheetName: string) {
  const workbookPath = 'xl/workbook.xml';
  const relationshipsPath = 'xl/_rels/workbook.xml.rels';
  const workbookXml = await zip.file(workbookPath)?.async('string');
  const relationshipsXml = await zip.file(relationshipsPath)?.async('string');

  if (!workbookXml || !relationshipsXml) {
    throw new Error('Workbook metadata is missing');
  }

  const workbook = parseXml(workbookXml);
  const relationships = parseXml(relationshipsXml);
  const sheet = getElements(workbook, 'sheet').find(item => item.getAttribute('name') === sheetName);
  const relationshipId = sheet?.getAttributeNS(OFFICE_RELATIONSHIP_NS, 'id');

  if (!relationshipId) {
    throw new Error(`Worksheet "${sheetName}" was not found`);
  }

  const relationship = Array.from(relationships.getElementsByTagName('Relationship'))
    .find(item => item.getAttribute('Id') === relationshipId);
  const target = relationship?.getAttribute('Target');

  if (!target) {
    throw new Error(`Worksheet relationship "${relationshipId}" was not found`);
  }

  return normalizeXmlPath('xl/workbook.xml', target);
}

function rate(actual: number, plan: number) {
  return plan > 0 ? actual / plan : 0;
}

function formulaCell(formula: string, value: number): FormulaValue {
  return { formula, value };
}

function applyFormulaCells(
  worksheet: Document,
  row: Element,
  cells: Record<string, number | FormulaValue>
) {
  Object.entries(cells).forEach(([column, data]) => {
    if (typeof data === 'number') {
      setNumericCell(worksheet, row, column, data);
      return;
    }

    setNumericCell(worksheet, row, column, data.value, data.formula);
  });
}

function applyReportValues(worksheet: Document, row: Element, entries: ProductionEntry[]) {
  const rowNumber = Number(row.getAttribute('r'));
  const totals = aggregateEquipmentTotals(entries);
  const p15 = totals.P15;
  const p5 = totals.P5;
  const rm = totals['R/M'];
  const totalProductActual = p15.productActual + p5.productActual + rm.productActual;
  const totalProductPlan = p15.productPlan + p5.productPlan + rm.productPlan;
  const totalBilletActual = p15.billetActual + p5.billetActual;

  applyFormulaCells(worksheet, row, {
    B: p15.productActual,
    C: p15.productPlan,
    D: formulaCell(`B${rowNumber}/C${rowNumber}`, rate(p15.productActual, p15.productPlan)),
    E: p15.billetActual,
    F: 0,
    G: formulaCell(`B${rowNumber}+E${rowNumber}+F${rowNumber}`, p15.productActual + p15.billetActual),
    H: 0,
    I: 0,
    J: 0,
    K: 0,
    L: 0,
    M: 0,
    N: 0,
    O: formulaCell(`B${rowNumber}`, p15.productActual),

    P: p5.productActual,
    Q: p5.productPlan,
    R: formulaCell(`P${rowNumber}/Q${rowNumber}`, rate(p5.productActual, p5.productPlan)),
    S: p5.billetActual,
    T: 0,
    U: formulaCell(`P${rowNumber}+S${rowNumber}+T${rowNumber}`, p5.productActual + p5.billetActual),
    V: 0,
    W: 0,
    X: 0,
    Y: 0,
    Z: 0,
    AA: 0,
    AB: 0,
    AC: formulaCell(`P${rowNumber}`, p5.productActual),

    AD: rm.productActual,
    AE: rm.productPlan,
    AF: formulaCell(`AD${rowNumber}/AE${rowNumber}`, rate(rm.productActual, rm.productPlan)),
    AG: formulaCell(`AD${rowNumber}`, rm.productActual),
    AH: 0,
    AI: 0,
    AJ: 0,
    AK: 0,
    AL: 0,
    AM: 0,
    AN: 0,
    AO: formulaCell(`AD${rowNumber}`, rm.productActual),

    AP: formulaCell(`AD${rowNumber}+P${rowNumber}+B${rowNumber}`, totalProductActual),
    AQ: totalProductPlan,
    AR: formulaCell(`AP${rowNumber}/AQ${rowNumber}`, rate(totalProductActual, totalProductPlan)),
    AS: formulaCell(`E${rowNumber}+S${rowNumber}`, totalBilletActual),
    AT: 0,
    AU: formulaCell(`AP${rowNumber}+AS${rowNumber}+AT${rowNumber}`, totalProductActual + totalBilletActual),
    AV: 0,
    AW: 0,
    AX: 0,
    AY: 0,
    AZ: 0,
    BA: 0,
    BB: 0,
    BC: formulaCell(`AP${rowNumber}`, totalProductActual),
    BD: 0,
  });
}

function applyTemplateWorkbookCell(
  worksheet: Document,
  row: Element,
  cell: TemplateWorkbookCell
) {
  if (typeof cell.value === 'number') {
    setNumericCell(worksheet, row, cell.column, cell.value, cell.formula);
    return;
  }

  if (cell.formula) {
    setNumericCell(worksheet, row, cell.column, 0, cell.formula);
    return;
  }

  if (cell.value === null || cell.value === undefined || cell.value === '') {
    clearCell(worksheet, row, cell.column);
    return;
  }

  setTextCell(worksheet, row, cell.column, String(cell.value));
}

function applyTemplateWorkbookSheet(worksheet: Document, sheet: TemplateWorkbookSheet) {
  sheet.rows.forEach(rowData => {
    const row = findOrCreateRow(worksheet, rowData.row_number);
    rowData.cells.forEach(cell => applyTemplateWorkbookCell(worksheet, row, cell));
  });

  updateWorksheetDimension(worksheet);
}

function updateIssueDate(worksheet: Document, reportDate: string) {
  const [year, month, day] = reportDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const row = findOrCreateRow(worksheet, 3);
  const text = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}   ${WEEKDAYS[date.getDay()]}`;

  setTextCell(worksheet, row, 'R', text);
}

async function updateWorkbookCalculation(zip: JSZip) {
  const workbookPath = 'xl/workbook.xml';
  const workbookXml = await zip.file(workbookPath)?.async('string');

  if (!workbookXml) return;

  const workbook = parseXml(workbookXml);
  let calcPr = getFirstElement(workbook, 'calcPr');

  if (!calcPr) {
    calcPr = workbook.createElementNS(SPREADSHEET_NS, 'calcPr');
    workbook.documentElement.appendChild(calcPr);
  }

  calcPr.setAttribute('calcMode', 'auto');
  calcPr.setAttribute('fullCalcOnLoad', '1');
  calcPr.setAttribute('forceFullCalc', '1');

  zip.file(workbookPath, serializeXml(workbook));
}

function triggerDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function buildExcelTemplateFileName(reportDate?: string) {
  return `forging-production-template${reportDate ? `_${reportDate}` : ''}.xlsx`;
}

export function buildReportExcelFileName(reportDate: string) {
  return `forging-production-report_${reportDate}.xlsx`;
}

export function buildTemplateWorkbookFileName() {
  return 'forging-production-summary.xlsx';
}

export async function generateReportExcelBlob(report: ProductionReport, entries: ProductionEntry[]) {
  const response = await fetch(EXCEL_TEMPLATE_URL);

  if (!response.ok) {
    throw new Error(`Excel template download failed: ${response.status}`);
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const sheetPath = await getWorksheetPath(zip, getMonthlySheetName(report.report_date));
  const worksheetXml = await zip.file(sheetPath)?.async('string');

  if (!worksheetXml) {
    throw new Error(`Worksheet "${sheetPath}" is missing`);
  }

  const worksheet = parseXml(worksheetXml);
  const rowNumber = findReportRowNumber(worksheet, report.report_date);
  const row = findOrCreateRow(worksheet, rowNumber);

  updateIssueDate(worksheet, report.report_date);
  applyReportValues(worksheet, row, entries);

  zip.file(sheetPath, serializeXml(worksheet));
  await updateWorkbookCalculation(zip);

  return zip.generateAsync({
    type: 'blob',
    mimeType: XLSX_CONTENT_TYPE,
    compression: 'DEFLATE',
  });
}

export async function downloadExcelTemplate(reportDate?: string) {
  const response = await fetch(EXCEL_TEMPLATE_URL);

  if (!response.ok) {
    throw new Error(`Excel template download failed: ${response.status}`);
  }

  triggerDownload(await response.blob(), buildExcelTemplateFileName(reportDate));
}

export async function generateTemplateWorkbookBlob(sheets: TemplateWorkbookSheet[]) {
  const response = await fetch(EXCEL_TEMPLATE_URL);

  if (!response.ok) {
    throw new Error(`Excel template download failed: ${response.status}`);
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());

  for (const sheet of sheets) {
    const sheetPath = await getWorksheetPath(zip, sheet.sheet_name);
    const worksheetXml = await zip.file(sheetPath)?.async('string');

    if (!worksheetXml) {
      throw new Error(`Worksheet "${sheetPath}" is missing`);
    }

    const worksheet = parseXml(worksheetXml);
    applyTemplateWorkbookSheet(worksheet, sheet);
    zip.file(sheetPath, serializeXml(worksheet));
  }

  await updateWorkbookCalculation(zip);

  return zip.generateAsync({
    type: 'blob',
    mimeType: XLSX_CONTENT_TYPE,
    compression: 'DEFLATE',
  });
}

export async function downloadTemplateWorkbook(sheets: TemplateWorkbookSheet[]) {
  if (sheets.length === 0) {
    throw new Error('No production summary workbook data to download');
  }

  const blob = await generateTemplateWorkbookBlob(sheets);
  triggerDownload(blob, buildTemplateWorkbookFileName());
}

export async function downloadReportExcel(report: ProductionReport, entries: ProductionEntry[]) {
  const blob = await generateReportExcelBlob(report, entries);
  triggerDownload(blob, buildReportExcelFileName(report.report_date));
}
