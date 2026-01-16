import { useState, useCallback, useRef, useEffect } from 'react';
import { getEngine } from './duckdb-engine';
import { generateSQL, analyzeAndSuggest, explainResults, detectCSVStructure, mergeMultiRowHeaders } from './claude-sql';

export function useZiipEngine(apiKey) {
  const engineRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [tables, setTables] = useState([]);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [lastResults, setLastResults] = useState(null);
  const [lastStructure, setLastStructure] = useState(null);

  // Initialize engine
  useEffect(() => {
    const init = async () => {
      try {
        engineRef.current = getEngine();
        await engineRef.current.init();
        setIsInitialized(true);
      } catch (err) {
        setError(`Failed to initialize DuckDB: ${err.message}`);
      }
    };
    init();
  }, []);

  // Smart load - detects structure first
  const loadFileSmart = useCallback(async (file) => {
    if (!engineRef.current || !apiKey) {
      throw new Error('Engine not ready or API key missing');
    }
    
    setIsLoading(true);
    setError(null);
    setLoadingStatus('Analyzing file structure...');
    
    try {
      // Get raw lines for analysis
      const rawLines = await engineRef.current.getRawLines(file, 30);
      
      // Detect structure
      const structure = await detectCSVStructure(rawLines, apiKey);
      setLastStructure(structure);
      console.log('Detected structure:', structure);
      
      let loadOptions = {
        skipRows: structure.skipRows || 0,
        customHeaders: null
      };
      
      // Handle multi-row headers
      if (structure.hasMultiRowHeader && structure.multiRowHeaderEnd) {
        setLoadingStatus('Merging multi-row headers...');
        const headerRowStart = structure.headerRow - 1; // 0-indexed
        const headerRowEnd = structure.multiRowHeaderEnd; // inclusive, 1-indexed
        const headerRows = rawLines.slice(headerRowStart, headerRowEnd);
        
        const mergedHeaders = await mergeMultiRowHeaders(headerRows, apiKey);
        loadOptions.customHeaders = mergedHeaders;
        loadOptions.skipRows = structure.multiRowHeaderEnd; // Skip all header rows
      }
      
      setLoadingStatus('Loading into database...');
      const result = await engineRef.current.loadFile(file, null, loadOptions);
      setTables(engineRef.current.listTables());
      
      setLoadingStatus('');
      return {
        ...result,
        structure
      };
    } catch (err) {
      setError(`Failed to load file: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, [apiKey]);

  // Simple load - no structure detection (for clean CSVs)
  const loadFile = useCallback(async (file) => {
    if (!engineRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await engineRef.current.loadFile(file);
      setTables(engineRef.current.listTables());
      return result;
    } catch (err) {
      setError(`Failed to load file: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load multiple files
  const loadFiles = useCallback(async (files) => {
    const results = [];
    for (const file of files) {
      const result = await loadFile(file);
      results.push(result);
    }
    return results;
  }, [loadFile]);

  // Ask a question (the main interface) - with auto-retry on SQL errors
  const ask = useCallback(async (question, maxRetries = 2) => {
    if (!engineRef.current || !apiKey) {
      throw new Error('Engine not ready or API key missing');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get context for Claude
      const context = await engineRef.current.formatContextForPrompt();
      
      let sql = null;
      let results = null;
      let lastError = null;
      
      // Try generating and executing SQL, with retries on failure
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Generate SQL (pass previous error if retrying)
          sql = await generateSQL(question, context, apiKey, lastError);
          setLastQuery(sql);
          
          // Execute SQL
          results = await engineRef.current.execute(sql);
          setLastResults(results);
          
          // Success - break out of retry loop
          return {
            sql,
            ...results
          };
        } catch (execError) {
          console.log(`Attempt ${attempt + 1} failed:`, execError.message);
          lastError = { message: execError.message, sql };
          
          if (attempt === maxRetries) {
            // Final attempt failed
            setError(`Query failed: ${execError.message}`);
            throw execError;
          }
          // Otherwise, loop will retry with error feedback
        }
      }
    } catch (err) {
      // Error already set in retry loop if it was SQL execution failure
      // This catch handles other errors (e.g., context generation)
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  // Execute raw SQL
  const executeSQL = useCallback(async (sql) => {
    if (!engineRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await engineRef.current.execute(sql);
      setLastQuery(sql);
      setLastResults(results);
      return results;
    } catch (err) {
      setError(`SQL error: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get schema info
  const getSchema = useCallback(async (tableName = null) => {
    if (!engineRef.current) return null;
    return engineRef.current.getSchema(tableName);
  }, []);

  // Get sample data
  const getSample = useCallback(async (tableName, limit = 5) => {
    if (!engineRef.current) return null;
    return engineRef.current.getSample(tableName, limit);
  }, []);

  // Get suggested questions
  const getSuggestions = useCallback(async () => {
    if (!engineRef.current || !apiKey) return [];
    
    const context = await engineRef.current.formatContextForPrompt();
    return analyzeAndSuggest(context, apiKey);
  }, [apiKey]);

  // Get explanation of results
  const explainLastResults = useCallback(async (question) => {
    if (!lastQuery || !lastResults || !apiKey) return null;
    return explainResults(lastQuery, lastResults.rows, question, apiKey);
  }, [lastQuery, lastResults, apiKey]);

  // Drop a table
  const dropTable = useCallback(async (tableName) => {
    if (!engineRef.current) return;
    await engineRef.current.dropTable(tableName);
    setTables(engineRef.current.listTables());
  }, []);

  // Reset everything
  const reset = useCallback(async () => {
    if (!engineRef.current) return;
    
    for (const table of tables) {
      await engineRef.current.dropTable(table.name);
    }
    setTables([]);
    setLastQuery(null);
    setLastResults(null);
    setError(null);
  }, [tables]);

  return {
    // State
    isInitialized,
    isLoading,
    loadingStatus,
    tables,
    error,
    lastQuery,
    lastResults,
    lastStructure,
    
    // Actions
    loadFile,
    loadFileSmart,
    loadFiles,
    ask,
    executeSQL,
    getSchema,
    getSample,
    getSuggestions,
    explainLastResults,
    dropTable,
    reset
  };
}

export default useZiipEngine;
