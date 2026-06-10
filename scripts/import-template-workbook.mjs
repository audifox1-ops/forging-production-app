#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const ENV_FILES = ['.env.local', '.env'];
const TEMPLATE_PATH = resolve(process.cwd(), 'public/templates/template.xlsx');
const WORKBOOK_PATH = 'xl/workbook.xml';
const WORKBOOK_RELS_PATH = 'xl/_rels/workbook.xml.rels';
const TEMPLATE_WORKBOOK_ANCHOR_REPORT_ID = 'template-workbook-anchor';
const TEMPLATE_WORKBOOK_COMMENT_TYPE = 'template-workbook-sheet';
const SHEET_NAMES = [
  '2601월',
  '2602월',
  '2603월',
  '2604월',
  '2605월',
  '2606월',
  '2025년 전체',
  '2026년 전체',
];

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function assertRequiredEnv() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function ensureAuthenticated(client) {
  const { data } = await client.auth.getSession();
  if (data.session) return;

  const { error } = await client.auth.signInAnonymously();
  if (error) {
    throw new Error(`Supabase anonymous sign-in failed: ${error.message}`);
  }
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function getAttr(attrs, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return match?.[1] ?? match?.[2] ?? null;
}

function stripXmlTags(value) {
  return value.replace(/<[^>]+>/g, '');
}

function parseSharedStrings(xml) {
  if (!xml) return [];

  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch;

  while ((siMatch = siRegex.exec(xml))) {
    const siXml = siMatch[1];
    const parts = [];
    const textRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let textMatch;

    while ((textMatch = textRegex.exec(siXml))) {
      parts.push(decodeXml(stripXmlTags(textMatch[1])));
    }

    strings.push(parts.join(''));
  }

  return strings;
}

function parseRelationships(xml) {
  const relationships = new Map();
  const relationshipRegex = /<Relationship\b([^>]*)\/?>/g;
  let match;

  while ((match = relationshipRegex.exec(xml))) {
    const id = getAttr(match[1], 'Id');
    const target = getAttr(match[1], 'Target');
    if (id && target) relationships.set(id, target);
  }

  return relationships;
}

function parseWorkbookSheets(xml) {
  const sheets = new Map();
  const sheetRegex = /<sheet\b([^>]*)\/?>/g;
  let match;

  while ((match = sheetRegex.exec(xml))) {
    const attrs = match[1];
    const name = getAttr(attrs, 'name');
    const relationshipId = getAttr(attrs, 'r:id');
    if (name && relationshipId) sheets.set(name, relationshipId);
  }

  return sheets;
}

function normalizeXmlPath(basePath, target) {
  if (target.startsWith('/')) return target.replace(/^\/+/, '');

  const baseParts = basePath.split('/').slice(0, -1);
  const parts = [...baseParts];

  target.split('/').forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') {
      parts.pop();
      return;
    }
    parts.push(part);
  });

  return parts.join('/');
}

async function getWorksheetPath(zip, sheetName) {
  const workbookXml = await zip.file(WORKBOOK_PATH)?.async('string');
  const relationshipsXml = await zip.file(WORKBOOK_RELS_PATH)?.async('string');

  if (!workbookXml || !relationshipsXml) {
    throw new Error('Workbook metadata is missing.');
  }

  const workbookSheets = parseWorkbookSheets(workbookXml);
  const relationships = parseRelationships(relationshipsXml);
  const relationshipId = workbookSheets.get(sheetName);
  const target = relationshipId ? relationships.get(relationshipId) : null;

  if (!relationshipId || !target) {
    throw new Error(`Worksheet "${sheetName}" was not found in template.xlsx.`);
  }

  return normalizeXmlPath(WORKBOOK_PATH, target);
}

function columnToNumber(column) {
  return column.split('').reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

function getCellColumn(cellRef) {
  return cellRef.replace(/\d+/g, '');
}

function parseInlineString(cellXml) {
  const parts = [];
  const textRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match;

  while ((match = textRegex.exec(cellXml))) {
    parts.push(decodeXml(stripXmlTags(match[1])));
  }

  return parts.join('');
}

function parseCellValue(cellXml, type, sharedStrings) {
  if (type === 'inlineStr') {
    const text = parseInlineString(cellXml);
    return text === '' ? null : text;
  }

  const valueMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellXml);
  const rawValue = valueMatch ? decodeXml(stripXmlTags(valueMatch[1])) : '';

  if (rawValue === '') return null;
  if (type === 's') return sharedStrings[Number(rawValue)] ?? '';
  if (type === 'str') return rawValue;

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : rawValue;
}

function excelSerialToIsoDate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
  return date.toISOString().slice(0, 10);
}

function parseHiddenColumnRanges(worksheetXml) {
  const ranges = [];
  const columnRegex = /<col\b([^>]*)\/?>/g;
  let columnMatch;

  while ((columnMatch = columnRegex.exec(worksheetXml))) {
    if (getAttr(columnMatch[1], 'hidden') !== '1') continue;

    const min = Number(getAttr(columnMatch[1], 'min'));
    const max = Number(getAttr(columnMatch[1], 'max'));
    if (Number.isFinite(min) && Number.isFinite(max)) {
      ranges.push({ min, max });
    }
  }

  return ranges;
}

function buildSheetMeta(sheetName) {
  const monthlyMatch = /^(\d{2})(\d{2})월$/.exec(sheetName);
  if (monthlyMatch) {
    return {
      id: `${monthlyMatch[1]}${monthlyMatch[2]}`,
      kind: 'monthly',
      year: 2000 + Number(monthlyMatch[1]),
    };
  }

  const annualMatch = /^(\d{4})년 전체$/.exec(sheetName);
  if (annualMatch) {
    return {
      id: `annual-${annualMatch[1]}`,
      kind: 'annual',
      year: Number(annualMatch[1]),
    };
  }

  return {
    id: sheetName.replace(/\s+/g, '-'),
    kind: 'annual',
    year: 0,
  };
}

function parseWorksheet(sheetName, worksheetXml, sharedStrings, importedAt) {
  const meta = buildSheetMeta(sheetName);
  const rows = [];
  const hiddenRows = [];
  const hiddenColumns = parseHiddenColumnRanges(worksheetXml);
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(worksheetXml))) {
    const rowNumber = Number(getAttr(rowMatch[1], 'r'));
    if (!Number.isFinite(rowNumber)) continue;
    if (getAttr(rowMatch[1], 'hidden') === '1') {
      hiddenRows.push(rowNumber);
    }

    const cells = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowMatch[2]))) {
      const attrs = cellMatch[1];
      const cellXml = cellMatch[2];
      const cellRef = getAttr(attrs, 'r');
      const column = cellRef ? getCellColumn(cellRef) : '';
      if (!column) continue;

      const type = getAttr(attrs, 't');
      const formulaMatch = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(cellXml);
      const formula = formulaMatch ? decodeXml(stripXmlTags(formulaMatch[1])) : undefined;
      const value = parseCellValue(cellXml, type, sharedStrings);

      if ((value === null || value === '') && !formula) continue;

      cells.push({
        column,
        value,
        ...(formula ? { formula } : {}),
      });
    }

    if (cells.length === 0) continue;

    cells.sort((a, b) => columnToNumber(a.column) - columnToNumber(b.column));

    const firstCell = cells.find(cell => cell.column === 'A');
    rows.push({
      row_number: rowNumber,
      ...(meta.kind === 'monthly' ? { row_date: excelSerialToIsoDate(firstCell?.value) } : {}),
      ...(typeof firstCell?.value === 'string' ? { row_label: firstCell.value } : {}),
      cells,
    });
  }

  return {
    ...meta,
    sheet_name: sheetName,
    rows,
    ...(hiddenRows.length > 0 ? { hidden_rows: hiddenRows } : {}),
    ...(hiddenColumns.length > 0 ? { hidden_columns: hiddenColumns } : {}),
    imported_at: importedAt,
  };
}

function formatSupabaseError(error) {
  const details = [
    error.message,
    error.code ? `code=${error.code}` : '',
    error.details ? `details=${error.details}` : '',
    error.hint ? `hint=${error.hint}` : '',
  ].filter(Boolean);

  return details.join(' ');
}

function assertNoSupabaseError(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${formatSupabaseError(result.error)}`);
  }
}

async function getAdminUserId(client) {
  const result = await client
    .from('users')
    .select('id')
    .eq('email', 'admin@forging.com')
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Admin user lookup failed: ${formatSupabaseError(result.error)}`);
  }

  return result.data?.id ?? null;
}

async function parseTemplateWorkbook() {
  if (!existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template file not found: ${TEMPLATE_PATH}`);
  }

  const importedAt = new Date().toISOString();
  const zip = await JSZip.loadAsync(readFileSync(TEMPLATE_PATH));
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const sheets = [];

  for (const sheetName of SHEET_NAMES) {
    const sheetPath = await getWorksheetPath(zip, sheetName);
    const worksheetXml = await zip.file(sheetPath)?.async('string');
    if (!worksheetXml) {
      throw new Error(`Worksheet file is missing: ${sheetPath}`);
    }

    sheets.push(parseWorksheet(sheetName, worksheetXml, sharedStrings, importedAt));
  }

  return sheets;
}

function toTemplateWorkbookComment(sheet) {
  return {
    id: `template-workbook-sheet-${sheet.id}`,
    report_id: TEMPLATE_WORKBOOK_ANCHOR_REPORT_ID,
    summary: JSON.stringify({ type: TEMPLATE_WORKBOOK_COMMENT_TYPE, sheet }),
    manager_comment: null,
    created_at: sheet.imported_at,
    updated_at: sheet.imported_at,
  };
}

async function saveTemplateWorkbook(client, sheets) {
  const now = new Date().toISOString();
  const adminUserId = await getAdminUserId(client);
  const anchorReport = {
    id: TEMPLATE_WORKBOOK_ANCHOR_REPORT_ID,
    report_date: '1900-01-01',
    next_plan_date: '1900-01-02',
    status: 'reviewed',
    created_by: adminUserId,
    created_at: now,
    updated_at: now,
  };

  const anchorResult = await client
    .from('production_reports')
    .upsert(anchorReport, { onConflict: 'id' });
  assertNoSupabaseError('Anchor report upsert failed', anchorResult);

  const comments = sheets.map(toTemplateWorkbookComment);
  const commentsResult = await client
    .from('report_comments')
    .upsert(comments, { onConflict: 'id' });
  assertNoSupabaseError('Template sheet comments upsert failed', commentsResult);

  const readback = await client
    .from('report_comments')
    .select('id, summary')
    .eq('report_id', TEMPLATE_WORKBOOK_ANCHOR_REPORT_ID)
    .order('id', { ascending: true });
  assertNoSupabaseError('Template sheet readback failed', readback);

  const storedSheets = (readback.data ?? [])
    .map(row => {
      try {
        const payload = JSON.parse(row.summary);
        return payload?.type === TEMPLATE_WORKBOOK_COMMENT_TYPE ? payload.sheet?.sheet_name : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return {
    anchorReport,
    comments,
    storedSheets,
  };
}

async function main() {
  ENV_FILES.forEach(loadEnvFile);
  const { supabaseUrl, supabaseAnonKey } = assertRequiredEnv();
  const client = createClient(supabaseUrl, supabaseAnonKey);

  await ensureAuthenticated(client);

  const sheets = await parseTemplateWorkbook();
  sheets.forEach(sheet => {
    const cellCount = sheet.rows.reduce((sum, row) => sum + row.cells.length, 0);
    console.log(`template:sheet:parsed name="${sheet.sheet_name}" rows=${sheet.rows.length} cells=${cellCount}`);
  });

  const result = await saveTemplateWorkbook(client, sheets);
  console.log(`template:anchor:upsert:ok id=${result.anchorReport.id}`);
  console.log(`template:comments:upsert:ok count=${result.comments.length}`);
  console.log(`template:server:readback:ok count=${result.storedSheets.length} sheets=${result.storedSheets.join(', ')}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
