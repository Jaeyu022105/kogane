/**
 * Spreadsheet generator for Kogane.
 * Generates standards-compliant OpenXML (.xlsx), Microsoft XML Spreadsheet (.xls), and CSV files
 * with multi-sheet support, custom styling, number formatting, and formula capabilities.
 * Zero external dependencies — built using pure TypeScript and node:zlib.
 */

import { deflateRawSync } from 'node:zlib';

export type CellValue = string | number | boolean | Date | null | undefined;

export type CellFormat =
  | 'string'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'integer'
  | 'header'
  | 'title'
  | 'kpi'
  | 'total';

export interface SpreadsheetCell {
  value: CellValue;
  format?: CellFormat;
  formula?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: number;
}

export type SpreadsheetRow = Array<SpreadsheetCell | CellValue>;

export interface SpreadsheetSheet {
  name: string;
  columnWidths?: number[];
  rows: SpreadsheetRow[];
}

export interface SpreadsheetWorkbook {
  title?: string;
  author?: string;
  createdAt?: Date;
  sheets: SpreadsheetSheet[];
}

// ── Security & Sanitization ───────────────────────────────────────────────────

/**
 * Sanitize text to prevent Spreadsheet/CSV Formula Injection (DDE attacks).
 * If a cell string starts with '=', '+', '-', '@', '\t', '\r', it could trigger
 * arbitrary formula execution or DDE command in Excel. Prepending a single quote
 * forces Excel to treat it as a literal string.
 */
export function sanitizeSpreadsheetText(value: string): string {
  if (!value) return '';
  const trimmed = value.trimStart();
  if (/^[@=+\-\t\r|%]/.test(trimmed)) {
    return `'${value}`;
  }
  return value;
}

export function sanitizeSheetName(name: string): string {
  if (!name) return 'Sheet';
  const cleaned = name.replace(/[\\/?*[\]:]/g, '_').trim();
  return cleaned.slice(0, 31) || 'Sheet';
}

/**
 * Converts A1 formula cell references (e.g. B2:B10, AVERAGE(D2:D10))
 * into R1C1 notation (e.g. R2C2:R10C2, AVERAGE(R2C4:R10C4)) required by Microsoft SpreadsheetML (.xls).
 */
export function formulaA1ToR1C1(formula: string): string {
  if (!formula) return '';
  return formula.replace(/\b([A-Za-z]+)(\d+)\b/g, (_match, colStr, rowStr) => {
    let col = 0;
    const upper = colStr.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
      col = col * 26 + (upper.charCodeAt(i) - 64);
    }
    return `R${rowStr}C${col}`;
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeCell(cell: SpreadsheetCell | CellValue): SpreadsheetCell {
  if (cell != null && typeof cell === 'object' && !(cell instanceof Date) && 'value' in cell) {
    return cell as SpreadsheetCell;
  }
  return { value: cell as CellValue };
}

// ── CRC-32 & ZIP Engine ───────────────────────────────────────────────────────

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

export function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Creates a standard PKZIP 2.0 archive in memory from a list of files.
 */
export function createZipArchive(files: ZipEntry[]): Uint8Array {
  const fileRecords: Array<{
    nameBytes: Uint8Array;
    compressedData: Uint8Array;
    crc: number;
    uncompressedSize: number;
    compressedSize: number;
    offset: number;
  }> = [];

  const parts: Uint8Array[] = [];
  let currentOffset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
  const dosDate =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf-8');
    const uncompressed = file.data;
    const checksum = crc32(uncompressed);
    const compressed = deflateRawSync(uncompressed);

    // If compression didn't shrink, we still use deflate for consistency
    const compressedData = new Uint8Array(compressed);

    // Local file header (30 bytes + name length)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true);         // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8 filename)
    lv.setUint16(8, 8, true);          // Compression method (8 = Deflate)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, compressedData.length, true);
    lv.setUint32(22, uncompressed.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // Extra field length
    localHeader.set(nameBytes, 30);

    parts.push(localHeader, compressedData);

    fileRecords.push({
      nameBytes,
      compressedData,
      crc: checksum,
      uncompressedSize: uncompressed.length,
      compressedSize: compressedData.length,
      offset: currentOffset,
    });

    currentOffset += localHeader.length + compressedData.length;
  }

  const centralDirStart = currentOffset;
  let centralDirSize = 0;

  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const cv = new DataView(cdHeader.buffer);

    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 20, true);         // Version made by
    cv.setUint16(6, 20, true);         // Version needed to extract
    cv.setUint16(8, 0x0800, true);     // Flags (UTF-8)
    cv.setUint16(10, 8, true);         // Deflate
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, rec.crc, true);
    cv.setUint32(20, rec.compressedSize, true);
    cv.setUint32(24, rec.uncompressedSize, true);
    cv.setUint16(28, rec.nameBytes.length, true);
    cv.setUint16(30, 0, true);         // Extra field length
    cv.setUint16(32, 0, true);         // Comment length
    cv.setUint16(34, 0, true);         // Disk number start
    cv.setUint16(36, 0, true);         // Internal file attributes
    cv.setUint32(38, 0, true);         // External file attributes
    cv.setUint32(42, rec.offset, true); // Relative offset of local header
    cdHeader.set(rec.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of Central Directory (EOCD, 22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true);          // Disk number
  ev.setUint16(6, 0, true);          // Disk with CD
  ev.setUint16(8, fileRecords.length, true);  // Entries on this disk
  ev.setUint16(10, fileRecords.length, true); // Total entries
  ev.setUint32(12, centralDirSize, true);     // CD size
  ev.setUint32(16, centralDirStart, true);    // CD start offset
  ev.setUint16(20, 0, true);         // Comment length
  parts.push(eocd);

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

// ── OpenXML (.xlsx) Generator ─────────────────────────────────────────────────

function columnIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Builds standard styles.xml for OpenXML.
 * Indices:
 * 0: Normal
 * 1: Header (Bold, Brand Background #3D1820, White Text)
 * 2: Currency ($#,##0.00)
 * 3: Currency Bold Total ($#,##0.00, Bold, Top Border)
 * 4: Integer (#,##0)
 * 5: Percent (0.0%)
 * 6: Date (yyyy-mm-dd hh:mm)
 * 7: Title (14pt Bold, #3D1820)
 * 8: Subtitle (10pt Italic, Gray)
 * 9: Bold Text
 */
function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="$#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
    <numFmt numFmtId="166" formatCode="yyyy-mm-dd hh:mm"/>
  </numFmts>
  <fonts count="4">
    <font><name val="Calibri"/><sz val="11"/><color theme="1"/></font>
    <font><b/><name val="Calibri"/><sz val="11"/><color rgb="FFFFFFFF"/></font>
    <font><b/><name val="Calibri"/><sz val="14"/><color rgb="FF3D1820"/></font>
    <font><i/><name val="Calibri"/><sz val="10"/><color rgb="FF666666"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF3D1820"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF6E6D7"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top style="thin"><color rgb="FF888888"/></top><bottom style="double"><color rgb="FF3D1820"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function resolveStyleIndex(cell: SpreadsheetCell): number {
  if (cell.format === 'header') return 1;
  if (cell.format === 'total') return 3;
  if (cell.format === 'currency') return cell.bold ? 3 : 2;
  if (cell.format === 'integer') return 4;
  if (cell.format === 'percent') return 5;
  if (cell.format === 'date') return 6;
  if (cell.format === 'title') return 7;
  if (cell.format === 'kpi') return 7;
  if (cell.bold) return 9;
  return 0;
}

function buildWorksheetXml(sheet: SpreadsheetSheet): string {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  xml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;

  if (sheet.columnWidths && sheet.columnWidths.length > 0) {
    xml += `  <cols>\n`;
    sheet.columnWidths.forEach((width, index) => {
      xml += `    <col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>\n`;
    });
    xml += `  </cols>\n`;
  }

  xml += `  <sheetData>\n`;

  sheet.rows.forEach((row, rowIndex) => {
    const rowNum = rowIndex + 1;
    xml += `    <row r="${rowNum}">\n`;

    row.forEach((rawCell, colIndex) => {
      const cell = normalizeCell(rawCell);
      const cellRef = `${columnIndexToLetter(colIndex)}${rowNum}`;
      const styleId = resolveStyleIndex(cell);
      const styleAttr = styleId > 0 ? ` s="${styleId}"` : '';

      if (cell.formula) {
        const cleanFormula = cell.formula.startsWith('=') ? cell.formula.slice(1) : cell.formula;
        xml += `      <c r="${cellRef}"${styleAttr}>`;
        xml += `<f>${escapeXml(cleanFormula)}</f>`;
        if (typeof cell.value === 'number') {
          xml += `<v>${cell.value}</v>`;
        }
        xml += `</c>\n`;
        return;
      }

      if (cell.value == null || cell.value === '') {
        if (styleId > 0) {
          xml += `      <c r="${cellRef}"${styleAttr}/>\n`;
        }
        return;
      }

      if (typeof cell.value === 'number') {
        xml += `      <c r="${cellRef}"${styleAttr}><v>${cell.value}</v></c>\n`;
        return;
      }

      if (typeof cell.value === 'boolean') {
        xml += `      <c r="${cellRef}" t="b"${styleAttr}><v>${cell.value ? 1 : 0}</v></c>\n`;
        return;
      }

      if (cell.value instanceof Date) {
        const iso = cell.value.toISOString().replace('T', ' ').slice(0, 19);
        const textVal = sanitizeSpreadsheetText(iso);
        xml += `      <c r="${cellRef}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(textVal)}</t></is></c>\n`;
        return;
      }

      const textVal = sanitizeSpreadsheetText(String(cell.value));
      xml += `      <c r="${cellRef}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(textVal)}</t></is></c>\n`;
    });

    xml += `    </row>\n`;
  });

  xml += `  </sheetData>\n`;
  xml += `</worksheet>`;
  return xml;
}

export function generateXlsx(workbook: SpreadsheetWorkbook): Uint8Array {
  const files: ZipEntry[] = [];

  // 1. [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\n`;

  workbook.sheets.forEach((_, idx) => {
    contentTypes += `  <Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n`;
  });
  contentTypes += `</Types>`;
  files.push({ name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf-8') });

  // 2. _rels/.rels
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  files.push({ name: '_rels/.rels', data: Buffer.from(rootRels, 'utf-8') });

  // 3. xl/_rels/workbook.xml.rels
  let wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n`;
  workbook.sheets.forEach((_, idx) => {
    wbRels += `  <Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>\n`;
  });
  wbRels += `  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n`;
  wbRels += `</Relationships>`;
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf-8') });

  // 4. xl/workbook.xml
  let wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>\n`;
  workbook.sheets.forEach((sheet, idx) => {
    wbXml += `    <sheet name="${escapeXml(sanitizeSheetName(sheet.name))}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>\n`;
  });
  wbXml += `  </sheets>\n  <calcPr fullCalcOnLoad="1"/>\n</workbook>`;
  files.push({ name: 'xl/workbook.xml', data: Buffer.from(wbXml, 'utf-8') });

  // 5. xl/styles.xml
  files.push({ name: 'xl/styles.xml', data: Buffer.from(buildStylesXml(), 'utf-8') });

  // 6. xl/worksheets/sheetN.xml
  workbook.sheets.forEach((sheet, idx) => {
    const sheetXml = buildWorksheetXml(sheet);
    files.push({ name: `xl/worksheets/sheet${idx + 1}.xml`, data: Buffer.from(sheetXml, 'utf-8') });
  });

  return createZipArchive(files);
}

// ── Microsoft XML Spreadsheet 2003 (.xls) Generator ───────────────────────────

export function generateSpreadsheetXml(workbook: SpreadsheetWorkbook): string {
  const author = escapeXml(workbook.author ?? 'Kogane');
  const created = (workbook.createdAt ?? new Date()).toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>${author}</Author>
    <Created>${created}</Created>
    <Company>Kogane</Company>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Borders/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#3D1820" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#3D1820"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#666666"/>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="$#,##0.00"/>
    </Style>
    <Style ss:ID="CurrencyBold">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <NumberFormat ss:Format="$#,##0.00"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#888888"/>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#3D1820"/>
      </Borders>
    </Style>
    <Style ss:ID="Integer">
      <NumberFormat ss:Format="#,##0"/>
    </Style>
    <Style ss:ID="Percent">
      <NumberFormat ss:Format="0.0%"/>
    </Style>
    <Style ss:ID="Date">
      <NumberFormat ss:Format="yyyy-mm-dd hh:mm"/>
    </Style>
    <Style ss:ID="Bold">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
    </Style>
  </Styles>\n`;

  for (const sheet of workbook.sheets) {
    xml += `  <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheet.name))}">\n    <Table>\n`;

    if (sheet.columnWidths) {
      for (const width of sheet.columnWidths) {
        xml += `      <Column ss:Width="${width * 7}"/>\n`;
      }
    }

    for (const row of sheet.rows) {
      xml += `      <Row>\n`;
      for (const rawCell of row) {
        const cell = normalizeCell(rawCell);
        let styleId = 'Default';
        if (cell.format === 'header') styleId = 'Header';
        else if (cell.format === 'title' || cell.format === 'kpi') styleId = 'Title';
        else if (cell.format === 'currency') styleId = cell.bold ? 'CurrencyBold' : 'Currency';
        else if (cell.format === 'total') styleId = 'CurrencyBold';
        else if (cell.format === 'integer') styleId = 'Integer';
        else if (cell.format === 'percent') styleId = 'Percent';
        else if (cell.format === 'date') styleId = 'Date';
        else if (cell.bold) styleId = 'Bold';

        const styleAttr = styleId !== 'Default' ? ` ss:StyleID="${styleId}"` : '';
        let formulaAttr = '';
        if (cell.formula) {
          const raw = cell.formula.startsWith('=') ? cell.formula.slice(1) : cell.formula;
          formulaAttr = ` ss:Formula="=${escapeXml(formulaA1ToR1C1(raw))}"`;
        }

        if (cell.value == null || cell.value === '') {
          xml += `        <Cell${styleAttr}${formulaAttr}/>\n`;
        } else if (typeof cell.value === 'number') {
          xml += `        <Cell${styleAttr}${formulaAttr}><Data ss:Type="Number">${cell.value}</Data></Cell>\n`;
        } else {
          const val = sanitizeSpreadsheetText(cell.value instanceof Date ? cell.value.toISOString() : String(cell.value));
          xml += `        <Cell${styleAttr}${formulaAttr}><Data ss:Type="String">${escapeXml(val)}</Data></Cell>\n`;
        }
      }
      xml += `      </Row>\n`;
    }

    xml += `    </Table>\n  </Worksheet>\n`;
  }

  xml += `</Workbook>`;
  return xml;
}

// ── CSV Generator ─────────────────────────────────────────────────────────────

export function generateCsv(sheet: SpreadsheetSheet, includeBom = true): string {
  const lines: string[] = [];
  for (const row of sheet.rows) {
    const formattedCells = row.map((rawCell) => {
      const cell = normalizeCell(rawCell);
      if (cell.value == null) return '""';
      if (typeof cell.value === 'number') return String(cell.value);
      if (typeof cell.value === 'boolean') return cell.value ? 'true' : 'false';
      const text = sanitizeSpreadsheetText(
        cell.value instanceof Date ? cell.value.toISOString() : String(cell.value),
      );
      return `"${text.replace(/"/g, '""')}"`;
    });
    lines.push(formattedCells.join(','));
  }
  const content = lines.join('\r\n');
  return includeBom ? `\uFEFF${content}` : content;
}

export function generateMultiSheetCsv(workbook: SpreadsheetWorkbook, includeBom = true): string {
  const sections: string[] = [];
  for (const sheet of workbook.sheets) {
    sections.push(`=== ${sanitizeSheetName(sheet.name).toUpperCase()} ===\r\n${generateCsv(sheet, false)}`);
  }
  const content = sections.join('\r\n\r\n');
  return includeBom ? `\uFEFF${content}` : content;
}
