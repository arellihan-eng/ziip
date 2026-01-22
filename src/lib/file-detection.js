/**
 * File Detection Module
 * Handles encoding detection, delimiter detection, and file preprocessing
 * for robust CSV/Excel loading from any source.
 */

import * as XLSX from 'xlsx';

// Common byte sequences for encoding detection
const BOM_MARKERS = {
  UTF8: [0xEF, 0xBB, 0xBF],
  UTF16_LE: [0xFF, 0xFE],
  UTF16_BE: [0xFE, 0xFF],
  UTF32_LE: [0xFF, 0xFE, 0x00, 0x00],
  UTF32_BE: [0x00, 0x00, 0xFE, 0xFF]
};

// Windows-1252 specific characters (bytes 0x80-0x9F that are valid in Win-1252 but not in ISO-8859-1)
const WIN1252_SPECIFIC = new Set([0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8E, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9E, 0x9F]);

// Windows-1252 to Unicode mapping for bytes 0x80-0x9F
const WIN1252_TO_UNICODE = {
  0x80: 0x20AC, // €
  0x82: 0x201A, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201E, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02C6, // ˆ
  0x89: 0x2030, // ‰
  0x8A: 0x0160, // Š
  0x8B: 0x2039, // ‹
  0x8C: 0x0152, // Œ
  0x8E: 0x017D, // Ž
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201C, // "
  0x94: 0x201D, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02DC, // ˜
  0x99: 0x2122, // ™
  0x9A: 0x0161, // š
  0x9B: 0x203A, // ›
  0x9C: 0x0153, // œ
  0x9E: 0x017E, // ž
  0x9F: 0x0178  // Ÿ
};

/**
 * Detect file encoding from raw bytes
 * @param {ArrayBuffer} buffer - Raw file bytes
 * @returns {{encoding: string, hasBOM: boolean, bomLength: number}}
 */
export function detectEncoding(buffer) {
  const bytes = new Uint8Array(buffer);

  // Check for BOMs first (most reliable)
  if (bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xFE && bytes[2] === 0x00 && bytes[3] === 0x00) {
    return { encoding: 'UTF-32LE', hasBOM: true, bomLength: 4 };
  }
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xFE && bytes[3] === 0xFF) {
    return { encoding: 'UTF-32BE', hasBOM: true, bomLength: 4 };
  }
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return { encoding: 'UTF-8', hasBOM: true, bomLength: 3 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return { encoding: 'UTF-16LE', hasBOM: true, bomLength: 2 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return { encoding: 'UTF-16BE', hasBOM: true, bomLength: 2 };
  }

  // No BOM - use heuristics
  return detectEncodingHeuristic(bytes);
}

/**
 * Detect encoding using heuristics when no BOM is present
 * @param {Uint8Array} bytes
 * @returns {{encoding: string, hasBOM: boolean, bomLength: number}}
 */
function detectEncodingHeuristic(bytes) {
  // Check for UTF-16 without BOM (look for null bytes in expected positions)
  const nullCount = countNullBytes(bytes, Math.min(1000, bytes.length));
  if (nullCount > 0) {
    // Check if nulls appear in even or odd positions (indicates UTF-16)
    const { evenNulls, oddNulls } = countNullPositions(bytes, Math.min(1000, bytes.length));
    if (evenNulls > bytes.length / 4 && oddNulls < bytes.length / 20) {
      return { encoding: 'UTF-16LE', hasBOM: false, bomLength: 0 };
    }
    if (oddNulls > bytes.length / 4 && evenNulls < bytes.length / 20) {
      return { encoding: 'UTF-16BE', hasBOM: false, bomLength: 0 };
    }
  }

  // Check for Windows-1252 specific bytes
  let win1252Indicators = 0;
  let utf8Valid = true;
  let i = 0;

  while (i < Math.min(10000, bytes.length)) {
    const byte = bytes[i];

    // Check for Windows-1252 specific characters
    if (WIN1252_SPECIFIC.has(byte)) {
      win1252Indicators++;
    }

    // Validate UTF-8 sequences
    if (byte >= 0x80) {
      if ((byte & 0xE0) === 0xC0) {
        // 2-byte sequence
        if (i + 1 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80) {
          utf8Valid = false;
        }
        i += 2;
        continue;
      } else if ((byte & 0xF0) === 0xE0) {
        // 3-byte sequence
        if (i + 2 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) {
          utf8Valid = false;
        }
        i += 3;
        continue;
      } else if ((byte & 0xF8) === 0xF0) {
        // 4-byte sequence
        if (i + 3 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) {
          utf8Valid = false;
        }
        i += 4;
        continue;
      } else if ((byte & 0xC0) !== 0x80) {
        // Invalid UTF-8 start byte in range 0x80-0xBF, or invalid lead byte
        utf8Valid = false;
      }
    }
    i++;
  }

  // If we found Windows-1252 specific chars and UTF-8 is invalid, it's Windows-1252
  if (win1252Indicators > 0 && !utf8Valid) {
    return { encoding: 'Windows-1252', hasBOM: false, bomLength: 0 };
  }

  // If UTF-8 is valid (or all ASCII), assume UTF-8
  if (utf8Valid) {
    return { encoding: 'UTF-8', hasBOM: false, bomLength: 0 };
  }

  // Fallback to ISO-8859-1 (which is a superset of ASCII and common in Europe)
  return { encoding: 'ISO-8859-1', hasBOM: false, bomLength: 0 };
}

/**
 * Count null bytes in buffer
 */
function countNullBytes(bytes, length) {
  let count = 0;
  for (let i = 0; i < length; i++) {
    if (bytes[i] === 0) count++;
  }
  return count;
}

/**
 * Count null bytes at even vs odd positions (for UTF-16 detection)
 */
function countNullPositions(bytes, length) {
  let evenNulls = 0;
  let oddNulls = 0;
  for (let i = 0; i < length; i++) {
    if (bytes[i] === 0) {
      if (i % 2 === 0) evenNulls++;
      else oddNulls++;
    }
  }
  return { evenNulls, oddNulls };
}

/**
 * Convert bytes to UTF-8 string based on detected encoding
 * @param {ArrayBuffer} buffer - Raw file bytes
 * @param {string} encoding - Detected encoding
 * @param {number} bomLength - Length of BOM to skip
 * @returns {string}
 */
export function decodeToUTF8(buffer, encoding, bomLength = 0) {
  const bytes = new Uint8Array(buffer, bomLength);

  switch (encoding) {
    case 'UTF-8':
      return new TextDecoder('utf-8').decode(bytes);

    case 'UTF-16LE':
      return new TextDecoder('utf-16le').decode(bytes);

    case 'UTF-16BE':
      return new TextDecoder('utf-16be').decode(bytes);

    case 'Windows-1252':
      return decodeWindows1252(bytes);

    case 'ISO-8859-1':
      return new TextDecoder('iso-8859-1').decode(bytes);

    case 'UTF-32LE':
    case 'UTF-32BE':
      // UTF-32 is rare, convert to UTF-16 first
      return decodeUTF32(bytes, encoding === 'UTF-32LE');

    default:
      // Fallback to UTF-8 with replacement characters
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

/**
 * Decode Windows-1252 bytes to UTF-8 string
 */
function decodeWindows1252(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else if (WIN1252_TO_UNICODE[byte] !== undefined) {
      result += String.fromCodePoint(WIN1252_TO_UNICODE[byte]);
    } else {
      // Direct mapping for 0xA0-0xFF (same as ISO-8859-1)
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

/**
 * Decode UTF-32 bytes to string
 */
function decodeUTF32(bytes, littleEndian) {
  let result = '';
  for (let i = 0; i < bytes.length - 3; i += 4) {
    let codePoint;
    if (littleEndian) {
      codePoint = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    } else {
      codePoint = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
    }
    if (codePoint > 0 && codePoint <= 0x10FFFF) {
      result += String.fromCodePoint(codePoint);
    }
  }
  return result;
}

/**
 * Detect delimiter from CSV content
 * @param {string} content - CSV content as string
 * @returns {{delimiter: string, confidence: number}}
 */
export function detectDelimiter(content) {
  const candidates = [',', '\t', ';', '|'];
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0).slice(0, 20);

  if (lines.length === 0) {
    return { delimiter: ',', confidence: 0 };
  }

  const scores = {};

  for (const delim of candidates) {
    // Count delimiters per line (outside quotes)
    const counts = lines.map(line => countDelimitersOutsideQuotes(line, delim));

    // Check consistency (all lines should have similar counts)
    const nonZeroCounts = counts.filter(c => c > 0);
    if (nonZeroCounts.length === 0) {
      scores[delim] = 0;
      continue;
    }

    const avgCount = nonZeroCounts.reduce((a, b) => a + b, 0) / nonZeroCounts.length;
    const consistency = nonZeroCounts.filter(c => Math.abs(c - avgCount) <= 1).length / nonZeroCounts.length;

    // Score based on: consistency, number of columns, and delimiter preference
    scores[delim] = consistency * avgCount * (nonZeroCounts.length / lines.length);

    // Slight preference for comma (most common)
    if (delim === ',') scores[delim] *= 1.1;
  }

  // Find best delimiter
  let bestDelim = ',';
  let bestScore = 0;
  for (const [delim, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }

  // Calculate confidence
  const confidence = Math.min(1, bestScore / 10);

  return { delimiter: bestDelim, confidence };
}

/**
 * Count delimiters outside of quoted strings
 */
function countDelimitersOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (!inQuotes) {
      if (char === '"' || char === "'") {
        inQuotes = true;
        quoteChar = char;
      } else if (char === delimiter) {
        count++;
      }
    } else {
      if (char === quoteChar) {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === quoteChar) {
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
          quoteChar = null;
        }
      }
    }
  }

  return count;
}

/**
 * Detect if file has a header row
 * @param {string} content - CSV content
 * @param {string} delimiter - Detected delimiter
 * @returns {{hasHeader: boolean, headerRowIndex: number, confidence: number}}
 */
export function detectHeader(content, delimiter) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0).slice(0, 30);

  if (lines.length < 2) {
    return { hasHeader: true, headerRowIndex: 0, confidence: 0.5 };
  }

  // Parse first several rows
  const rows = lines.slice(0, 10).map(line => parseCSVLine(line, delimiter));

  // Check if first row looks like headers
  const firstRow = rows[0];
  const dataRows = rows.slice(1);

  if (!firstRow || firstRow.length === 0) {
    return { hasHeader: true, headerRowIndex: 0, confidence: 0.5 };
  }

  let headerScore = 0;

  // Headers are typically:
  // 1. Text/strings (not pure numbers)
  // 2. Unique values
  // 3. Different "types" than data rows

  // Check if first row values are all non-numeric
  const firstRowAllText = firstRow.every(val => isNaN(parseFloat(val)) || val.trim() === '');
  if (firstRowAllText) headerScore += 2;

  // Check uniqueness in first row
  const uniqueFirst = new Set(firstRow.map(v => v.toLowerCase().trim())).size;
  if (uniqueFirst === firstRow.length) headerScore += 1;

  // Check if data rows have different type patterns
  if (dataRows.length > 0) {
    const dataRow = dataRows[0];
    let typeChanges = 0;
    for (let i = 0; i < Math.min(firstRow.length, dataRow.length); i++) {
      const headerIsNum = !isNaN(parseFloat(firstRow[i])) && firstRow[i].trim() !== '';
      const dataIsNum = !isNaN(parseFloat(dataRow[i])) && dataRow[i].trim() !== '';
      if (!headerIsNum && dataIsNum) typeChanges++;
    }
    if (typeChanges > firstRow.length / 3) headerScore += 2;
  }

  // Check for header-like patterns (contains letters, not just numbers/symbols)
  const hasLetters = firstRow.some(val => /[a-zA-Z]/.test(val));
  if (hasLetters) headerScore += 1;

  const hasHeader = headerScore >= 2;
  const confidence = Math.min(1, headerScore / 5);

  return { hasHeader, headerRowIndex: 0, confidence };
}

/**
 * Parse a single CSV line respecting quotes
 */
export function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (!inQuotes) {
      if (char === '"' || char === "'") {
        inQuotes = true;
        quoteChar = char;
      } else if (char === delimiter) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    } else {
      if (char === quoteChar) {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === quoteChar) {
          current += char;
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
          quoteChar = null;
        }
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * Normalize line endings to LF
 */
export function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Clean content of problematic characters
 */
export function cleanContent(content) {
  // Remove null bytes
  content = content.replace(/\0/g, '');

  // Replace smart quotes with regular quotes
  content = content.replace(/[\u2018\u2019]/g, "'"); // Single smart quotes
  content = content.replace(/[\u201C\u201D]/g, '"'); // Double smart quotes

  // Remove zero-width characters
  content = content.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Replace other problematic Unicode
  content = content.replace(/\u00A0/g, ' '); // Non-breaking space to regular space

  // Fix double-quoted values (e.g., ""value"" -> "value")
  // This handles cases where CSV exports double-escape quotes
  content = fixDoubleQuotedValues(content);

  return content;
}

/**
 * Fix double-quoted values in CSV content
 * Handles patterns like: ,""value"", -> ,"value",
 * And standalone double-quotes around simple values: ,"2069033", that shouldn't be quoted
 */
function fixDoubleQuotedValues(content) {
  const lines = content.split('\n');
  const fixedLines = lines.map(line => {
    // Skip empty lines
    if (!line.trim()) return line;

    // Fix double-double quotes at field boundaries: ,""value"", -> ,"value",
    // Pattern: comma or start, then "", then content, then "", then comma or end
    line = line.replace(/(^|,)""([^"]*)""/g, '$1"$2"');

    // Fix triple+ quotes that can occur from multiple export/import cycles
    line = line.replace(/"{3,}/g, '"');

    // Fix cases where simple values (numbers, plain text) are unnecessarily quoted
    // but only if they don't contain the delimiter or special chars
    // This regex finds quoted simple values and removes the quotes
    line = line.replace(/"(\d+(?:\.\d+)?)"/g, (match, num, offset) => {
      // Check if this is inside a larger quoted string by looking at context
      // Count quotes before this position
      const before = line.substring(0, offset);
      const quoteCount = (before.match(/"/g) || []).length;
      // If even number of quotes before, we're not inside a quoted string
      if (quoteCount % 2 === 0) {
        return num; // Remove quotes from simple number
      }
      return match; // Keep as is
    });

    return line;
  });

  return fixedLines.join('\n');
}

/**
 * Sanitize column names for SQL compatibility
 */
export function sanitizeColumnName(name) {
  if (!name || typeof name !== 'string') {
    return 'column';
  }

  // Remove newlines and collapse whitespace
  let sanitized = name.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Remove or replace problematic characters
  sanitized = sanitized
    .replace(/["'`]/g, '')  // Remove quotes
    .replace(/[^\w\s_-]/g, '_')  // Replace special chars with underscore
    .replace(/\s+/g, '_')  // Replace spaces with underscore
    .replace(/_+/g, '_')  // Collapse multiple underscores
    .replace(/^_|_$/g, '');  // Remove leading/trailing underscores

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  // Ensure not empty
  if (!sanitized) {
    sanitized = 'column';
  }

  // Limit length
  return sanitized.slice(0, 64);
}

/**
 * Handle duplicate column names
 * @param {string[]} names - Array of column names
 * @returns {string[]} - Array with unique names
 */
export function makeUniqueColumnNames(names) {
  const seen = new Map();
  const result = [];

  for (let name of names) {
    // Handle empty names
    if (!name || name.trim() === '') {
      name = 'column';
    }

    // Check for duplicates
    const baseName = name;
    let finalName = name;
    let counter = seen.get(baseName.toLowerCase()) || 0;

    if (counter > 0) {
      finalName = `${baseName}_${counter}`;
    }

    seen.set(baseName.toLowerCase(), counter + 1);
    result.push(finalName);
  }

  return result;
}

/**
 * Detect file format from extension and content
 * @param {File} file
 * @returns {{format: string, canProcess: boolean, isExcel?: boolean, message?: string}}
 */
export function detectFileFormat(file) {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();

  const formats = {
    'csv': { format: 'csv', canProcess: true },
    'tsv': { format: 'tsv', canProcess: true },
    'txt': { format: 'text', canProcess: true },
    'xlsx': { format: 'excel', canProcess: true, isExcel: true },
    'xls': { format: 'excel-legacy', canProcess: true, isExcel: true },
    'xlsb': { format: 'excel-binary', canProcess: false, message: 'Excel binary files (.xlsb) are not supported. Please save as .xlsx or CSV in Excel.' },
    'json': { format: 'json', canProcess: false, message: 'JSON files are not yet supported. Please convert to CSV format.' },
    'parquet': { format: 'parquet', canProcess: false, message: 'Parquet files are not yet supported in the browser version.' },
  };

  return formats[ext] || { format: 'unknown', canProcess: true }; // Try to process unknown as CSV
}

/**
 * Parse Excel file and convert to CSV string
 * @param {ArrayBuffer} buffer - Excel file as ArrayBuffer
 * @param {Object} options - Options for parsing
 * @returns {{success: boolean, content?: string, sheetName?: string, sheetCount?: number, error?: string}}
 */
export function parseExcelFile(buffer, options = {}) {
  try {
    // Read the workbook
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Get sheet names
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      return { success: false, error: 'Excel file contains no sheets' };
    }

    // Use first sheet by default, or specified sheet
    const sheetName = options.sheetName || sheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return { success: false, error: `Sheet "${sheetName}" not found` };
    }

    // Convert to CSV
    const csvContent = XLSX.utils.sheet_to_csv(sheet, {
      blankrows: false,  // Skip blank rows
      rawNumbers: false  // Format numbers as strings to preserve leading zeros
    });

    return {
      success: true,
      content: csvContent,
      sheetName: sheetName,
      sheetCount: sheetNames.length,
      allSheetNames: sheetNames
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse Excel file: ${err.message}`
    };
  }
}

/**
 * Full file analysis - combines all detection methods
 * @param {File} file
 * @returns {Promise<Object>}
 */
export async function analyzeFile(file) {
  const formatInfo = detectFileFormat(file);

  if (!formatInfo.canProcess) {
    return {
      success: false,
      error: formatInfo.message,
      format: formatInfo.format
    };
  }

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Handle Excel files
  if (formatInfo.isExcel) {
    const excelResult = parseExcelFile(buffer);

    if (!excelResult.success) {
      return {
        success: false,
        error: excelResult.error,
        format: formatInfo.format
      };
    }

    // Excel content is already CSV, just clean it
    let normalizedContent = normalizeLineEndings(excelResult.content);
    normalizedContent = cleanContent(normalizedContent);

    // Detect delimiter (should be comma from XLSX.utils.sheet_to_csv)
    const delimiterInfo = detectDelimiter(normalizedContent);
    const headerInfo = detectHeader(normalizedContent, delimiterInfo.delimiter);
    const lines = normalizedContent.split('\n').filter(l => l.trim().length > 0);
    const firstRow = parseCSVLine(lines[0] || '', delimiterInfo.delimiter);

    const warnings = [];
    if (excelResult.sheetCount > 1) {
      warnings.push(`Excel file has ${excelResult.sheetCount} sheets. Using "${excelResult.sheetName}". Other sheets: ${excelResult.allSheetNames.filter(n => n !== excelResult.sheetName).join(', ')}`);
    }

    return {
      success: true,
      format: formatInfo.format,
      encoding: 'excel',
      hasBOM: false,
      delimiter: delimiterInfo.delimiter,
      delimiterConfidence: delimiterInfo.confidence,
      hasHeader: headerInfo.hasHeader,
      headerConfidence: headerInfo.confidence,
      lineCount: lines.length,
      columnCount: firstRow.length,
      content: normalizedContent,
      sheetName: excelResult.sheetName,
      sheetCount: excelResult.sheetCount,
      warnings
    };
  }

  // Handle CSV/text files
  const encodingInfo = detectEncoding(buffer);
  const content = decodeToUTF8(buffer, encodingInfo.encoding, encodingInfo.bomLength);

  // Clean and normalize
  let normalizedContent = normalizeLineEndings(content);
  normalizedContent = cleanContent(normalizedContent);

  // Detect delimiter
  const delimiterInfo = detectDelimiter(normalizedContent);

  // Detect header
  const headerInfo = detectHeader(normalizedContent, delimiterInfo.delimiter);

  // Get line count
  const lines = normalizedContent.split('\n').filter(l => l.trim().length > 0);

  // Parse first row for column count
  const firstRow = parseCSVLine(lines[0] || '', delimiterInfo.delimiter);

  return {
    success: true,
    format: formatInfo.format,
    encoding: encodingInfo.encoding,
    hasBOM: encodingInfo.hasBOM,
    delimiter: delimiterInfo.delimiter,
    delimiterConfidence: delimiterInfo.confidence,
    hasHeader: headerInfo.hasHeader,
    headerConfidence: headerInfo.confidence,
    lineCount: lines.length,
    columnCount: firstRow.length,
    content: normalizedContent,
    warnings: generateWarnings(encodingInfo, delimiterInfo, headerInfo, lines)
  };
}

/**
 * Generate user-friendly warnings
 */
function generateWarnings(encodingInfo, delimiterInfo, headerInfo, lines) {
  const warnings = [];

  if (encodingInfo.encoding === 'Windows-1252') {
    warnings.push('File appears to use Windows-1252 encoding. Some characters may have been converted.');
  }

  if (delimiterInfo.delimiter === ';') {
    warnings.push('Detected semicolon delimiter (European CSV format).');
  }

  if (delimiterInfo.confidence < 0.5) {
    warnings.push('Low confidence in delimiter detection. Data may not parse correctly.');
  }

  if (!headerInfo.hasHeader || headerInfo.confidence < 0.5) {
    warnings.push('Header row detection uncertain. First row may be treated as data.');
  }

  if (lines.length > 100000) {
    warnings.push(`Large file detected (${lines.length.toLocaleString()} rows). Loading may take a moment.`);
  }

  return warnings;
}

export default {
  detectEncoding,
  decodeToUTF8,
  detectDelimiter,
  detectHeader,
  parseCSVLine,
  normalizeLineEndings,
  cleanContent,
  sanitizeColumnName,
  makeUniqueColumnNames,
  detectFileFormat,
  parseExcelFile,
  analyzeFile
};
