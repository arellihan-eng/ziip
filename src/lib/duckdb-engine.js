import * as duckdb from '@duckdb/duckdb-wasm';
import { analyzeFile, detectDelimiter, cleanContent, normalizeLineEndings, detectEncoding, decodeToUTF8 } from './file-detection.js';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

class DuckDBEngine {
  constructor() {
    this.db = null;
    this.conn = null;
    this.initialized = false;
    this.tables = new Map(); // Track loaded tables
  }

  async init() {
    if (this.initialized) return;

    // Select best bundle for browser
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();

    this.db = new duckdb.AsyncDuckDB(logger, worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    this.conn = await this.db.connect();
    this.initialized = true;

    URL.revokeObjectURL(worker_url);

    console.log('DuckDB initialized');
    return this;
  }

  /**
   * Load a CSV file into DuckDB as a table
   * Uses comprehensive file detection for encoding, delimiter, and content cleaning.
   * @param {File} file - The file object from input
   * @param {string} tableName - Optional table name (defaults to sanitized filename)
   * @param {object} options - Optional load options (skipRows, customHeaders)
   * @returns {Promise<{tableName: string, rowCount: number, strategy: string, warnings: string[]}>}
   */
  async loadFile(file, tableName = null, options = {}) {
    if (!this.initialized) await this.init();

    // Generate table name from filename if not provided
    const name = tableName || this.sanitizeTableName(file.name);

    // Analyze file using comprehensive detection
    const analysis = await analyzeFile(file);

    if (!analysis.success) {
      throw new Error(analysis.error || 'Failed to analyze file');
    }

    // Log any warnings
    if (analysis.warnings && analysis.warnings.length > 0) {
      analysis.warnings.forEach(w => console.warn('File warning:', w));
    }

    // Get the cleaned, normalized content from analysis
    let content = analysis.content;

    // Handle skipRows and customHeaders
    const { skipRows = 0, customHeaders = null } = options;

    if (skipRows > 0 || customHeaders) {
      const lines = content.split('\n');

      if (customHeaders) {
        // Skip header rows and prepend custom headers
        const dataLines = lines.slice(skipRows);
        content = [customHeaders.join(analysis.delimiter), ...dataLines].join('\n');
      } else if (skipRows > 0) {
        // Just skip rows
        content = lines.slice(skipRows).join('\n');
      }
    }

    // Build DuckDB options based on detected settings
    const detectedDelim = analysis.delimiter;
    const delimEscaped = detectedDelim === '\t' ? '\\t' : detectedDelim;

    // Try loading with progressively more forgiving strategies
    const strategies = [
      // Strategy 1: Use detected delimiter with standard settings
      {
        name: 'detected',
        options: `header=true, delim='${delimEscaped}', quote='"', escape='"', null_padding=true, ignore_errors=true, strict_mode=false, auto_detect=true, parallel=false`
      },
      // Strategy 2: All columns as varchar (avoids type detection issues)
      {
        name: 'all_varchar',
        options: `header=true, delim='${delimEscaped}', quote='"', escape='"', null_padding=true, ignore_errors=true, strict_mode=false, auto_detect=false, all_varchar=true, parallel=false`
      },
      // Strategy 3: Minimal options with detected delimiter
      {
        name: 'minimal',
        options: `header=true, delim='${delimEscaped}', ignore_errors=true, null_padding=true, parallel=false`
      },
      // Strategy 4: Let DuckDB fully auto-detect (fallback)
      {
        name: 'auto',
        options: `header=true, ignore_errors=true, null_padding=true, parallel=false`
      }
    ];

    let lastError = null;
    for (const strategy of strategies) {
      try {
        // Register the file with DuckDB (re-register for each attempt)
        await this.db.registerFileText(`${name}.csv`, content);

        // Create table from CSV
        await this.conn.query(`
          CREATE OR REPLACE TABLE ${name} AS
          SELECT * FROM read_csv('${name}.csv', ${strategy.options})
        `);

        console.log(`Loaded ${name} using strategy: ${strategy.name} (delimiter: '${detectedDelim}')`);

        // Sanitize column names (remove quotes, newlines, etc.)
        await this.sanitizeColumnNames(name);

        // Get row count
        const countResult = await this.conn.query(`SELECT COUNT(*) as count FROM ${name}`);
        const rowCount = countResult.toArray()[0].count;

        // Store table info
        this.tables.set(name, {
          originalName: file.name,
          rowCount: Number(rowCount),
          loadedAt: new Date(),
          encoding: analysis.encoding,
          delimiter: detectedDelim
        });

        console.log(`Loaded ${name}: ${rowCount} rows`);

        return {
          tableName: name,
          rowCount: Number(rowCount),
          strategy: strategy.name,
          encoding: analysis.encoding,
          delimiter: detectedDelim,
          warnings: analysis.warnings || []
        };
      } catch (err) {
        console.warn(`Strategy ${strategy.name} failed:`, err.message);
        lastError = err;
        // Continue to next strategy
      }
    }

    // All strategies failed
    throw lastError;
  }

  /**
   * Pre-process CSV content to handle common issues
   * (Now uses file-detection utilities for comprehensive cleaning)
   */
  preprocessCSV(content) {
    // Normalize line endings to \n
    content = normalizeLineEndings(content);

    // Clean problematic characters (null bytes, smart quotes, zero-width chars)
    content = cleanContent(content);

    // Remove BOM if present (backup - should already be handled by decoding)
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    return content;
  }

  /**
   * Load raw CSV string into DuckDB
   * Uses file-detection utilities for preprocessing.
   */
  async loadCSVString(csvString, tableName, options = {}) {
    if (!this.initialized) await this.init();

    const name = this.sanitizeTableName(tableName);

    // Preprocess the content
    let content = this.preprocessCSV(csvString);

    // Detect delimiter from content
    const { delimiter: detectedDelim } = detectDelimiter(content);
    const delimEscaped = detectedDelim === '\t' ? '\\t' : detectedDelim;

    // Try loading with progressively more forgiving strategies
    const strategies = [
      { name: 'detected', options: `header=true, delim='${delimEscaped}', quote='"', escape='"', null_padding=true, ignore_errors=true, strict_mode=false, auto_detect=true, parallel=false` },
      { name: 'all_varchar', options: `header=true, delim='${delimEscaped}', quote='"', escape='"', null_padding=true, ignore_errors=true, strict_mode=false, auto_detect=false, all_varchar=true, parallel=false` },
      { name: 'minimal', options: `header=true, delim='${delimEscaped}', ignore_errors=true, null_padding=true, parallel=false` },
      { name: 'auto', options: `header=true, ignore_errors=true, null_padding=true, parallel=false` }
    ];

    let lastError = null;
    for (const strategy of strategies) {
      try {
        await this.db.registerFileText(`${name}.csv`, content);
        await this.conn.query(`
          CREATE OR REPLACE TABLE ${name} AS
          SELECT * FROM read_csv('${name}.csv', ${strategy.options})
        `);

        await this.sanitizeColumnNames(name);

        const countResult = await this.conn.query(`SELECT COUNT(*) as count FROM ${name}`);
        const rowCount = countResult.toArray()[0].count;

        this.tables.set(name, {
          originalName: tableName,
          rowCount: Number(rowCount),
          loadedAt: new Date(),
          delimiter: detectedDelim
        });

        return { tableName: name, rowCount: Number(rowCount), strategy: strategy.name, delimiter: detectedDelim };
      } catch (err) {
        console.warn(`Strategy ${strategy.name} failed:`, err.message);
        lastError = err;
      }
    }

    throw lastError;
  }

  /**
   * Get schema for a table (or all tables)
   */
  async getSchema(tableName = null) {
    if (!this.initialized) await this.init();

    if (tableName) {
      return this.getTableSchema(tableName);
    }

    // Get schema for all tables
    const schemas = {};
    for (const [name] of this.tables) {
      schemas[name] = await this.getTableSchema(name);
    }
    return schemas;
  }

  async getTableSchema(tableName) {
    const result = await this.conn.query(`DESCRIBE ${tableName}`);
    const rows = result.toArray();

    return rows.map(row => ({
      column: row.column_name,
      type: row.column_type,
      nullable: row.null === 'YES'
    }));
  }

  /**
   * Get sample rows from a table
   */
  async getSample(tableName, limit = 5) {
    if (!this.initialized) await this.init();

    const result = await this.conn.query(`SELECT * FROM ${tableName} LIMIT ${limit}`);
    return result.toArray();
  }

  /**
   * Execute a SQL query and return results
   */
  async execute(sql) {
    if (!this.initialized) await this.init();

    const startTime = performance.now();
    const result = await this.conn.query(sql);
    const endTime = performance.now();

    const rows = result.toArray();
    const schema = result.schema.fields.map(f => ({
      name: f.name,
      type: f.type.toString()
    }));

    // Clean up any values that have embedded quotes from CSV parsing issues
    const cleanedRows = rows.map(row => {
      const cleanRow = {};
      for (const [key, value] of Object.entries(row)) {
        cleanRow[key] = this.cleanValue(value);
      }
      return cleanRow;
    });

    return {
      rows: cleanedRows,
      schema,
      rowCount: cleanedRows.length,
      executionTime: Math.round(endTime - startTime)
    };
  }

  /**
   * Clean a value that may have embedded quotes from CSV parsing
   */
  cleanValue(value) {
    // Handle null/undefined
    if (value == null) return value;

    // Handle BigInt
    if (typeof value === 'bigint') return Number(value);

    // Handle strings with embedded quotes
    if (typeof value === 'string') {
      // Remove surrounding quotes if present (e.g., "value" -> value)
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      // Unescape double quotes (e.g., "" -> ")
      value = value.replace(/""/g, '"');
      // If value is now a simple number, it can stay as string (DuckDB typed it)
    }

    return value;
  }

  /**
   * Get context for Claude (schema + sample for all tables)
   */
  async getClaudeContext() {
    if (!this.initialized) await this.init();

    const context = {
      tables: []
    };

    for (const [name, info] of this.tables) {
      const schema = await this.getTableSchema(name);
      const sample = await this.getSample(name, 5);

      context.tables.push({
        name,
        originalFile: info.originalName,
        rowCount: info.rowCount,
        schema,
        sampleRows: sample
      });
    }

    return context;
  }

  /**
   * Format context as string for Claude prompt
   */
  async formatContextForPrompt() {
    const context = await this.getClaudeContext();

    let prompt = `Available tables:\n\n`;

    for (const table of context.tables) {
      prompt += `TABLE: ${table.name} (${table.rowCount.toLocaleString()} rows)\n`;
      prompt += `Source: ${table.originalFile}\n`;
      prompt += `Columns:\n`;

      for (const col of table.schema) {
        prompt += `  - ${col.column} (${col.type})\n`;
      }

      prompt += `\nSample data:\n`;
      prompt += JSON.stringify(table.sampleRows, (key, value) =>
        typeof value === 'bigint' ? Number(value) : value
      , 2);
      prompt += `\n\n`;
    }

    return prompt;
  }

  /**
   * List all loaded tables
   */
  listTables() {
    return Array.from(this.tables.entries()).map(([name, info]) => ({
      name,
      ...info
    }));
  }

  /**
   * Drop a table
   */
  async dropTable(tableName) {
    await this.conn.query(`DROP TABLE IF EXISTS ${tableName}`);
    this.tables.delete(tableName);
  }

  /**
   * Clean up resources
   */
  async close() {
    if (this.conn) await this.conn.close();
    if (this.db) await this.db.terminate();
    this.initialized = false;
    this.tables.clear();
  }

  /**
   * Get raw lines from a file (for structure detection)
   */
  async getRawLines(file, numLines = 30) {
    const content = await file.text();
    const lines = content.split(/\r?\n/).slice(0, numLines);
    return lines;
  }

  // Utility: sanitize filename to valid table name
  sanitizeTableName(filename) {
    return filename
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9_]/g, '_') // Replace invalid chars
      .replace(/^[0-9]/, '_$&') // Prefix if starts with number
      .toLowerCase()
      .slice(0, 64); // Limit length
  }

  // Utility: sanitize column name for SQL safety
  sanitizeColumnName(colName) {
    return colName
      .replace(/[\r\n]+/g, ' ') // Replace newlines with space
      .replace(/["'`]/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .slice(0, 64); // Limit length
  }

  // Rename columns with problematic characters
  async sanitizeColumnNames(tableName) {
    const schema = await this.getTableSchema(tableName);
    const renames = [];

    for (const col of schema) {
      const sanitized = this.sanitizeColumnName(col.column);
      if (sanitized !== col.column) {
        renames.push({ old: col.column, new: sanitized });
      }
    }

    // Apply renames
    for (const rename of renames) {
      const oldEscaped = rename.old.replace(/"/g, '""');
      const newEscaped = rename.new.replace(/"/g, '""');
      await this.conn.query(`ALTER TABLE ${tableName} RENAME COLUMN "${oldEscaped}" TO "${newEscaped}"`);
      console.log(`Renamed column "${rename.old}" to "${rename.new}"`);
    }

    return renames.length;
  }
}

// Singleton instance
let engineInstance = null;

export function getEngine() {
  if (!engineInstance) {
    engineInstance = new DuckDBEngine();
  }
  return engineInstance;
}

export default DuckDBEngine;
