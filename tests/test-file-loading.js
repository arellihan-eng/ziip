/**
 * Comprehensive Test Runner for CSV File Loading
 *
 * Tests all edge cases against the DuckDB file loading system.
 * This is a Node.js test runner that simulates browser File objects.
 *
 * Run: node tests/test-file-loading.js
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, 'csv-edge-cases');
const MANIFEST_PATH = join(TEST_DIR, '_manifest.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

/**
 * Mock File class to simulate browser File API
 */
class MockFile {
  constructor(content, filename) {
    this._content = content;
    this.name = filename;
    this.size = Buffer.byteLength(content);
    this.type = 'text/csv';
    this.lastModified = Date.now();
  }

  async text() {
    // Simulate how browser reads files - handle binary as UTF-8
    if (Buffer.isBuffer(this._content)) {
      return this._content.toString('utf-8');
    }
    return this._content;
  }

  async arrayBuffer() {
    if (Buffer.isBuffer(this._content)) {
      return this._content.buffer.slice(
        this._content.byteOffset,
        this._content.byteOffset + this._content.byteLength
      );
    }
    return Buffer.from(this._content).buffer;
  }
}

/**
 * Import and test the file detection module
 */
async function loadModules() {
  // We'll test the preprocessing functions directly
  // For now, let's test the core preprocessing logic
  return {
    preprocessCSV: preprocessCSV,
    detectEncoding: detectEncoding,
    detectDelimiter: detectDelimiter,
    normalizeContent: normalizeContent
  };
}

/**
 * Core preprocessing function (extracted from duckdb-engine.js for testing)
 */
function preprocessCSV(content) {
  // Normalize line endings to \n
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Remove BOM if present (UTF-8 BOM)
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  // Remove null bytes
  content = content.replace(/\0/g, '');

  return content;
}

/**
 * Detect encoding from byte content
 */
function detectEncoding(buffer) {
  if (!(buffer instanceof Buffer)) {
    buffer = Buffer.from(buffer);
  }

  // Check for BOMs
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { encoding: 'utf-8-bom', confidence: 1.0 };
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return { encoding: 'utf-16-le', confidence: 1.0 };
  }
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return { encoding: 'utf-16-be', confidence: 1.0 };
  }

  // Heuristic detection
  // Check for UTF-8 validity
  let isValidUtf8 = true;
  let hasHighBytes = false;

  for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
    if (buffer[i] > 127) {
      hasHighBytes = true;
      // Check UTF-8 multi-byte sequence
      if ((buffer[i] & 0xE0) === 0xC0) {
        // 2-byte sequence
        if (i + 1 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80) {
          isValidUtf8 = false;
          break;
        }
        i++;
      } else if ((buffer[i] & 0xF0) === 0xE0) {
        // 3-byte sequence
        if (i + 2 >= buffer.length ||
            (buffer[i + 1] & 0xC0) !== 0x80 ||
            (buffer[i + 2] & 0xC0) !== 0x80) {
          isValidUtf8 = false;
          break;
        }
        i += 2;
      } else if ((buffer[i] & 0xF8) === 0xF0) {
        // 4-byte sequence
        if (i + 3 >= buffer.length ||
            (buffer[i + 1] & 0xC0) !== 0x80 ||
            (buffer[i + 2] & 0xC0) !== 0x80 ||
            (buffer[i + 3] & 0xC0) !== 0x80) {
          isValidUtf8 = false;
          break;
        }
        i += 3;
      } else if (buffer[i] > 127) {
        isValidUtf8 = false;
        break;
      }
    }
  }

  if (isValidUtf8) {
    return { encoding: 'utf-8', confidence: hasHighBytes ? 0.9 : 0.7 };
  }

  // Likely Latin-1/Windows-1252
  return { encoding: 'latin-1', confidence: 0.6 };
}

/**
 * Detect delimiter from content
 */
function detectDelimiter(content) {
  const lines = content.split('\n').slice(0, 10).filter(l => l.trim());
  if (lines.length === 0) return ',';

  const delimiters = [',', '\t', ';', '|'];
  const scores = {};

  for (const delim of delimiters) {
    const counts = lines.map(line => {
      // Count delimiters outside of quoted sections
      let count = 0;
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delim && !inQuotes) count++;
      }
      return count;
    });

    // Score based on consistency
    const nonZeroCounts = counts.filter(c => c > 0);
    if (nonZeroCounts.length === 0) {
      scores[delim] = 0;
    } else {
      const avg = nonZeroCounts.reduce((a, b) => a + b, 0) / nonZeroCounts.length;
      const variance = nonZeroCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / nonZeroCounts.length;
      // Higher score = more consistent counts with more delimiters
      scores[delim] = (avg * nonZeroCounts.length) / (variance + 1);
    }
  }

  // Return delimiter with highest score
  let best = ',';
  let bestScore = 0;
  for (const [delim, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }

  return best;
}

/**
 * Normalize content for consistent parsing
 */
function normalizeContent(buffer) {
  const encoding = detectEncoding(buffer);
  let content;

  if (encoding.encoding === 'utf-16-le') {
    content = buffer.toString('utf16le');
  } else if (encoding.encoding === 'utf-16-be') {
    // Swap bytes for BE
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length - 1; i += 2) {
      swapped[i] = buffer[i + 1];
      swapped[i + 1] = buffer[i];
    }
    content = swapped.toString('utf16le');
  } else {
    content = buffer.toString('utf-8');
  }

  return preprocessCSV(content);
}

/**
 * Test result tracking
 */
class TestResults {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.warnings = [];
  }

  pass(name, details = '') {
    this.tests.push({ name, status: 'pass', details });
    this.passed++;
  }

  fail(name, error, details = '') {
    this.tests.push({ name, status: 'fail', error, details });
    this.failed++;
  }

  skip(name, reason = '') {
    this.tests.push({ name, status: 'skip', reason });
    this.skipped++;
  }

  warn(name, message) {
    this.warnings.push({ name, message });
  }

  summary() {
    const total = this.passed + this.failed + this.skipped;
    return {
      total,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      passRate: total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0
    };
  }
}

/**
 * Run preprocessing tests
 */
async function runPreprocessingTests(results) {
  log(colors.cyan, '\n=== Preprocessing Tests ===\n');

  // Test 1: Line ending normalization
  const crlfContent = 'a,b,c\r\nd,e,f\r\n';
  const crContent = 'a,b,c\rd,e,f\r';
  const lfContent = 'a,b,c\nd,e,f\n';

  const normalizedCRLF = preprocessCSV(crlfContent);
  const normalizedCR = preprocessCSV(crContent);

  if (normalizedCRLF === lfContent) {
    results.pass('CRLF normalization');
  } else {
    results.fail('CRLF normalization', 'Content not normalized correctly');
  }

  if (normalizedCR === lfContent) {
    results.pass('CR normalization');
  } else {
    results.fail('CR normalization', 'Content not normalized correctly');
  }

  // Test 2: BOM removal
  const bomContent = '\ufeffa,b,c\n';
  const normalizedBOM = preprocessCSV(bomContent);
  if (normalizedBOM === 'a,b,c\n') {
    results.pass('UTF-8 BOM removal');
  } else {
    results.fail('UTF-8 BOM removal', 'BOM not removed');
  }

  // Test 3: Null byte removal
  const nullContent = 'a\x00b,c\x00d\n';
  const normalizedNull = preprocessCSV(nullContent);
  if (normalizedNull === 'ab,cd\n') {
    results.pass('Null byte removal');
  } else {
    results.fail('Null byte removal', 'Null bytes not removed');
  }
}

/**
 * Run encoding detection tests
 */
async function runEncodingTests(results) {
  log(colors.cyan, '\n=== Encoding Detection Tests ===\n');

  // Test UTF-8 BOM detection
  const utf8BomBuffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x61, 0x62, 0x63]);
  const utf8BomResult = detectEncoding(utf8BomBuffer);
  if (utf8BomResult.encoding === 'utf-8-bom' && utf8BomResult.confidence === 1.0) {
    results.pass('UTF-8 BOM detection');
  } else {
    results.fail('UTF-8 BOM detection', `Got: ${utf8BomResult.encoding}`);
  }

  // Test UTF-16 LE detection
  const utf16leBuffer = Buffer.from([0xFF, 0xFE, 0x61, 0x00]);
  const utf16leResult = detectEncoding(utf16leBuffer);
  if (utf16leResult.encoding === 'utf-16-le') {
    results.pass('UTF-16 LE detection');
  } else {
    results.fail('UTF-16 LE detection', `Got: ${utf16leResult.encoding}`);
  }

  // Test UTF-16 BE detection
  const utf16beBuffer = Buffer.from([0xFE, 0xFF, 0x00, 0x61]);
  const utf16beResult = detectEncoding(utf16beBuffer);
  if (utf16beResult.encoding === 'utf-16-be') {
    results.pass('UTF-16 BE detection');
  } else {
    results.fail('UTF-16 BE detection', `Got: ${utf16beResult.encoding}`);
  }

  // Test plain UTF-8 detection (no BOM)
  const utf8Buffer = Buffer.from('name,city\nAlice,Mönchen\n', 'utf-8');
  const utf8Result = detectEncoding(utf8Buffer);
  if (utf8Result.encoding === 'utf-8') {
    results.pass('UTF-8 heuristic detection');
  } else {
    results.fail('UTF-8 heuristic detection', `Got: ${utf8Result.encoding}`);
  }
}

/**
 * Run delimiter detection tests
 */
async function runDelimiterTests(results) {
  log(colors.cyan, '\n=== Delimiter Detection Tests ===\n');

  // Test comma detection
  const commaContent = 'a,b,c\n1,2,3\n4,5,6';
  if (detectDelimiter(commaContent) === ',') {
    results.pass('Comma delimiter detection');
  } else {
    results.fail('Comma delimiter detection', `Got: ${detectDelimiter(commaContent)}`);
  }

  // Test tab detection
  const tabContent = 'a\tb\tc\n1\t2\t3\n4\t5\t6';
  if (detectDelimiter(tabContent) === '\t') {
    results.pass('Tab delimiter detection');
  } else {
    results.fail('Tab delimiter detection', `Got: ${detectDelimiter(tabContent)}`);
  }

  // Test semicolon detection
  const semicolonContent = 'a;b;c\n1;2;3\n4;5;6';
  if (detectDelimiter(semicolonContent) === ';') {
    results.pass('Semicolon delimiter detection');
  } else {
    results.fail('Semicolon delimiter detection', `Got: ${detectDelimiter(semicolonContent)}`);
  }

  // Test pipe detection
  const pipeContent = 'a|b|c\n1|2|3\n4|5|6';
  if (detectDelimiter(pipeContent) === '|') {
    results.pass('Pipe delimiter detection');
  } else {
    results.fail('Pipe delimiter detection', `Got: ${detectDelimiter(pipeContent)}`);
  }

  // Test comma with quoted values containing commas
  const quotedCommaContent = '"a,1","b,2","c,3"\n"1,x","2,y","3,z"';
  if (detectDelimiter(quotedCommaContent) === ',') {
    results.pass('Comma detection with quoted commas');
  } else {
    results.fail('Comma detection with quoted commas', `Got: ${detectDelimiter(quotedCommaContent)}`);
  }
}

/**
 * Run file loading tests from generated test files
 */
async function runFileLoadingTests(results) {
  log(colors.cyan, '\n=== File Loading Tests ===\n');

  if (!existsSync(MANIFEST_PATH)) {
    log(colors.yellow, 'Test files not generated. Run: node tests/generate-test-files.js');
    return;
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  for (const test of manifest.tests) {
    const filepath = join(TEST_DIR, test.name);
    if (!existsSync(filepath)) {
      results.skip(test.name, 'File not found');
      continue;
    }

    try {
      // Read file as buffer to preserve encoding
      const buffer = readFileSync(filepath);

      // Detect encoding
      const encodingInfo = detectEncoding(buffer);

      // Normalize content
      const content = normalizeContent(buffer);

      // Detect delimiter
      const delimiter = detectDelimiter(content);

      // Count data rows (excluding header)
      const lines = content.split('\n').filter(l => l.trim());
      const rowCount = Math.max(0, lines.length - 1);

      // Validate
      let passed = true;
      let details = [];

      // Check encoding detection for known encoded files
      if (test.encoding === 'utf8-bom' && encodingInfo.encoding !== 'utf-8-bom') {
        passed = false;
        details.push(`Encoding: expected utf-8-bom, got ${encodingInfo.encoding}`);
      }
      if (test.encoding === 'utf16le' && encodingInfo.encoding !== 'utf-16-le') {
        passed = false;
        details.push(`Encoding: expected utf-16-le, got ${encodingInfo.encoding}`);
      }
      if (test.encoding === 'utf16be' && encodingInfo.encoding !== 'utf-16-be') {
        passed = false;
        details.push(`Encoding: expected utf-16-be, got ${encodingInfo.encoding}`);
      }

      // Check delimiter for known delimiter tests
      if (test.name.includes('delimiter-tab') && delimiter !== '\t') {
        passed = false;
        details.push(`Delimiter: expected tab, got '${delimiter}'`);
      }
      if (test.name.includes('delimiter-semicolon') && delimiter !== ';') {
        passed = false;
        details.push(`Delimiter: expected semicolon, got '${delimiter}'`);
      }
      if (test.name.includes('delimiter-pipe') && delimiter !== '|') {
        passed = false;
        details.push(`Delimiter: expected pipe, got '${delimiter}'`);
      }

      // Check for expected errors
      if (test.expectError) {
        if (content.trim() === '') {
          results.pass(test.name, 'Correctly identifies empty file');
          continue;
        }
      }

      if (passed) {
        results.pass(test.name, `rows=${rowCount}, enc=${encodingInfo.encoding}, delim='${delimiter === '\t' ? 'TAB' : delimiter}'`);
      } else {
        results.fail(test.name, details.join('; '));
      }

      if (test.expectWarning) {
        results.warn(test.name, 'Expected warning condition');
      }

    } catch (error) {
      if (test.expectError) {
        results.pass(test.name, `Expected error: ${error.message}`);
      } else {
        results.fail(test.name, error.message);
      }
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log(colors.blue);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         CSV File Loading - Comprehensive Test Suite        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const results = new TestResults();

  // Run test suites
  await runPreprocessingTests(results);
  await runEncodingTests(results);
  await runDelimiterTests(results);
  await runFileLoadingTests(results);

  // Print results
  console.log('\n');
  log(colors.blue, '═'.repeat(60));
  log(colors.blue, 'TEST RESULTS');
  log(colors.blue, '═'.repeat(60));
  console.log('');

  for (const test of results.tests) {
    if (test.status === 'pass') {
      log(colors.green, `  ✓ ${test.name}`, test.details ? colors.dim + ` (${test.details})` : '');
    } else if (test.status === 'fail') {
      log(colors.red, `  ✗ ${test.name}`);
      if (test.error) log(colors.red, `    Error: ${test.error}`);
    } else if (test.status === 'skip') {
      log(colors.yellow, `  ○ ${test.name} (skipped: ${test.reason})`);
    }
  }

  if (results.warnings.length > 0) {
    console.log('');
    log(colors.yellow, 'Warnings:');
    for (const warn of results.warnings) {
      log(colors.yellow, `  ⚠ ${warn.name}: ${warn.message}`);
    }
  }

  // Summary
  const summary = results.summary();
  console.log('\n');
  log(colors.blue, '═'.repeat(60));
  log(colors.blue, 'SUMMARY');
  log(colors.blue, '═'.repeat(60));
  console.log('');
  console.log(`  Total:   ${summary.total}`);
  log(colors.green, `  Passed:  ${summary.passed}`);
  log(colors.red, `  Failed:  ${summary.failed}`);
  log(colors.yellow, `  Skipped: ${summary.skipped}`);
  console.log('');

  const passRateColor = summary.passRate >= 90 ? colors.green :
                        summary.passRate >= 70 ? colors.yellow : colors.red;
  log(passRateColor, `  Pass Rate: ${summary.passRate}%`);
  console.log('');

  // Exit with error code if tests failed
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
