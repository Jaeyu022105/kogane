import { describe, expect, test } from 'bun:test';
import {
  generateCsv,
  generateMultiSheetCsv,
  generateSpreadsheetXml,
  generateXlsx,
  sanitizeSpreadsheetText,
  type SpreadsheetWorkbook,
} from '../server/utils/spreadsheet';

describe('Spreadsheet Engine', () => {
  const sampleWorkbook: SpreadsheetWorkbook = {
    title: 'Financial Performance',
    author: 'Kogane POS',
    sheets: [
      {
        name: 'Sales Summary',
        columnWidths: [15, 20, 15],
        rows: [
          [
            { value: 'Sales Summary', format: 'title' },
            { value: null },
            { value: null },
          ],
          [
            { value: 'Date', format: 'header' },
            { value: 'Revenue', format: 'header' },
            { value: 'Orders', format: 'header' },
          ],
          [
            { value: '2026-10-01', format: 'string' },
            { value: 1250.5, format: 'currency' },
            { value: 45, format: 'integer' },
          ],
          [
            { value: '2026-10-02', format: 'string' },
            { value: 980.25, format: 'currency' },
            { value: 38, format: 'integer' },
          ],
          [
            { value: 'Total', bold: true },
            { value: 2230.75, format: 'total', formula: 'SUM(B3:B4)' },
            { value: 83, format: 'integer', formula: 'SUM(C3:C4)' },
          ],
        ],
      },
      {
        name: 'Top Items',
        columnWidths: [20, 10, 15],
        rows: [
          [
            { value: 'Item Name', format: 'header' },
            { value: 'Qty Sold', format: 'header' },
            { value: 'Revenue', format: 'header' },
          ],
          [
            { value: 'Signature Burger', format: 'string' },
            { value: 120, format: 'integer' },
            { value: 1440.0, format: 'currency' },
          ],
        ],
      },
    ],
  };

  test('generateXlsx creates a valid non-empty PKZIP OpenXML document', () => {
    const bytes = generateXlsx(sampleWorkbook);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(500);

    // Verify ZIP magic header: PK\x03\x04 = 0x50, 0x4b, 0x03, 0x04
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  test('generateSpreadsheetXml generates valid multi-sheet SpreadsheetML XML with R1C1 formulas', () => {
    const xml = generateSpreadsheetXml(sampleWorkbook);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('progid="Excel.Sheet"');
    expect(xml).toContain('ss:Name="Sales Summary"');
    expect(xml).toContain('ss:Name="Top Items"');
    expect(xml).toContain('1250.5');
    expect(xml).toContain('Signature Burger');
    // Verifies formula converted from A1 notation (B3:B4) to SpreadsheetML R1C1 notation (R3C2:R4C2)
    expect(xml).toContain('ss:Formula="=SUM(R3C2:R4C2)"');
  });

  test('generateCsv creates RFC 4180 compliant CSV with proper quote escaping and UTF-8 BOM', () => {
    const sheetWithQuotes = {
      name: 'Quotes',
      rows: [
        [{ value: 'Product' }, { value: 'Description' }],
        [{ value: '12" Pizza' }, { value: 'He said "Hello World"' }],
      ],
    };
    const csv = generateCsv(sheetWithQuotes);
    // RFC 4180: Quotes are doubled (""), not backslash escaped (\")
    expect(csv).toContain('"12"" Pizza"');
    expect(csv).toContain('"He said ""Hello World"""');
    // Verifies UTF-8 BOM is present for Excel Windows compatibility
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  test('generateMultiSheetCsv outputs separated sections with UTF-8 BOM', () => {
    const multiCsv = generateMultiSheetCsv(sampleWorkbook);
    expect(multiCsv).toContain('=== SALES SUMMARY ===');
    expect(multiCsv).toContain('=== TOP ITEMS ===');
    expect(multiCsv.charCodeAt(0)).toBe(0xFEFF);
  });

  test('sanitizeSpreadsheetText neutralizes formula injection exploits including pipe and percent', () => {
    expect(sanitizeSpreadsheetText('=CMD|"/C calc"!A0')).toBe('\'=CMD|"/C calc"!A0');
    expect(sanitizeSpreadsheetText('+123456')).toBe('\'+123456');
    expect(sanitizeSpreadsheetText('-5+10')).toBe('\'-5+10');
    expect(sanitizeSpreadsheetText('@SUM(1,2)')).toBe('\'@SUM(1,2)');
    expect(sanitizeSpreadsheetText('|calc.exe')).toBe('\'|calc.exe');
    expect(sanitizeSpreadsheetText('%0Acmd.exe')).toBe('\'%0Acmd.exe');
    expect(sanitizeSpreadsheetText('Safe Product Name')).toBe('Safe Product Name');
  });
});
