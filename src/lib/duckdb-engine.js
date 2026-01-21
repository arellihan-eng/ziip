import * as duckdb from '@duckdb/duckdb-wasm';

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
   * @param {File} file - The file object from input
   * @param {string} tableName - Optional table name (defaults to sanitized filename)
   * @param {object} options - Optional load options (skipRows, customHeaders)
   */
  async loadFile(file, tableName = null, options = {}) {
    if (!this.initialized) await this.init();

    // Generate table name from filename if not provided
    const name = tableName || this.sanitizeTableName(file.name);

    // Read file content
    let content = await file.text();

    // Handle skipRows and customHeaders
    const { skipRows = 0, customHeaders = null } = options;

    if (skipRows > 0 || customHeaders) {
      const lines = content.split(/\r?\n/);

      if (customHeaders) {
        // Skip header rows and prepend custom headers
        const dataLines = lines.slice(skipRows);
        content = [customHeaders.join(','), ...dataLines].join('\n');
      } else if (skipRows > 0) {
        // Just skip rows
        content = lines.slice(skipRows).join('\n');
      }
    }

    // Register the file with DuckDB
    await this.db.registerFileText(`${name}.csv`, content);

    // Create table from CSV with explicit settings for messy files
    await this.conn.query(`
      CREATE OR REPLACE TABLE ${name} AS
      SELECT * FROM read_csv('${name}.csv',
        header=true,
        delim=',',
        quote='"',
        escape='"',
        null_padding=true,
        ignore_errors=true,
        strict_mode=false,
        auto_detect=true,
        parallel=false
      )
    `);

    // Get row count
    const countResult = await this.conn.query(`SELECT COUNT(*) as count FROM ${name}`);
    const rowCount = countResult.toArray()[0].count;

    // Store table info
    this.tables.set(name, {
      originalName: file.name,
      rowCount: Number(rowCount),
      loadedAt: new Date()
    });

    console.log(`Loaded ${name}: ${rowCount} rows`);

    return {
      tableName: name,
      rowCount: Number(rowCount)
    };
  }

  /**
   * Load raw CSV string into DuckDB
   */
  async loadCSVString(csvString, tableName) {
    if (!this.initialized) await this.init();

    const name = this.sanitizeTableName(tableName);
    await this.db.registerFileText(`${name}.csv`, csvString);

    await this.conn.query(`
      CREATE OR REPLACE TABLE ${name} AS
      SELECT * FROM read_csv('${name}.csv',
        header=true,
        delim=',',
        quote='"',
        escape='"',
        null_padding=true,
        ignore_errors=true,
        strict_mode=false,
        auto_detect=true,
        parallel=false
      )
    `);

    const countResult = await this.conn.query(`SELECT COUNT(*) as count FROM ${name}`);
    const rowCount = countResult.toArray()[0].count;

    this.tables.set(name, {
      originalName: tableName,
      rowCount: Number(rowCount),
      loadedAt: new Date()
    });
    
    return { tableName: name, rowCount: Number(rowCount) };
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
    
    return {
      rows,
      schema,
      rowCount: rows.length,
      executionTime: Math.round(endTime - startTime)
    };
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
