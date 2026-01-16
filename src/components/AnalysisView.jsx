import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useZiipEngine } from '../lib/useZiipEngine';
import { useAuth } from '../hooks/useAuth';
import { useRecipes } from '../hooks/useRecipes';
import SmartChart, { ChartTypeSelector, SmartFilters, QuickInsights } from './SmartChart';
import SaveRecipeModal, { LoginPrompt, SchemaValidator } from './SaveRecipeModal';

export default function AnalysisView({ initialFiles, onBack, pendingRecipe }) {
  const { user, signIn, signOut, isAuthenticated } = useAuth();
  const { recipes: savedRecipes, saveRecipe } = useRecipes();
  const [apiKey, setApiKey] = useState(localStorage.getItem('anthropic_key') || '');
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [tablePreviews, setTablePreviews] = useState({});
  const [expandedTable, setExpandedTable] = useState(null);
  const [chartType, setChartType] = useState('table');
  const [filters, setFilters] = useState({});
  const [showSQL, setShowSQL] = useState(false);
  const [refinement, setRefinement] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(null); // 'charts' or 'save'
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [pendingFileSchema, setPendingFileSchema] = useState(null);
  const [hasRunPendingRecipe, setHasRunPendingRecipe] = useState(false);

  const {
    isInitialized,
    isLoading,
    loadingStatus,
    tables,
    error,
    lastQuery,
    lastResults,
    loadFileSmart,
    ask,
    executeSQL,
    getSchema,
    getSample,
    getSuggestions,
    explainLastResults,
    dropTable,
    reset
  } = useZiipEngine(apiKey);

  // Load initial files
  useEffect(() => {
    if (isInitialized && initialFiles?.length > 0) {
      loadInitialFiles();
    }
  }, [isInitialized, initialFiles]);

  const loadInitialFiles = async () => {
    for (const file of initialFiles) {
      const result = await loadFileSmart(file);
      if (result?.tableName) {
        const schema = await getSchema(result.tableName);
        const sample = await getSample(result.tableName, 5);
        setTablePreviews(prev => ({
          ...prev,
          [result.tableName]: { schema, sample }
        }));
      }
    }

    // If there's a pending recipe, run it after files are loaded
    if (pendingRecipe && !hasRunPendingRecipe) {
      setHasRunPendingRecipe(true);
      setQuestion(pendingRecipe.question || '');
      try {
        await executeSQL(pendingRecipe.sql);
        if (pendingRecipe.question) {
          setExplanation(`Running saved recipe: ${pendingRecipe.name}`);
          setChatHistory([{ role: 'user', content: pendingRecipe.question }]);
        }
      } catch (err) {
        console.error('Failed to run recipe:', err);
      }
    } else if (apiKey) {
      const sugg = await getSuggestions();
      setSuggestions(sugg);
    }
  };

  const handleFileUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const result = await loadFileSmart(file);
      if (result?.tableName) {
        const schema = await getSchema(result.tableName);
        const sample = await getSample(result.tableName, 5);
        setTablePreviews(prev => ({
          ...prev,
          [result.tableName]: { schema, sample }
        }));
      }
    }
    if (apiKey) {
      const sugg = await getSuggestions();
      setSuggestions(sugg);
    }
  }, [loadFileSmart, getSchema, getSample, getSuggestions, apiKey]);

  const handleStackTables = useCallback(async (tableNames, newName) => {
    if (tableNames.length < 2) return;
    const unionSQL = tableNames.map(t => `SELECT * FROM ${t}`).join(' UNION ALL ');
    await executeSQL(`CREATE OR REPLACE TABLE ${newName} AS ${unionSQL}`);
    for (const t of tableNames) {
      await dropTable(t);
      setTablePreviews(prev => {
        const updated = { ...prev };
        delete updated[t];
        return updated;
      });
    }
    const schema = await getSchema(newName);
    const sample = await getSample(newName, 5);
    setTablePreviews(prev => ({ ...prev, [newName]: { schema, sample } }));
  }, [executeSQL, dropTable, getSchema, getSample]);

  const handleAsk = useCallback(async (q = question) => {
    if (!q.trim()) return;
    setExplanation('');
    setChartType('table');
    setFilters({}); // Reset filters on new query
    setChatHistory([{ role: 'user', content: q }]); // Start fresh chat history
    try {
      await ask(q);
      const exp = await explainLastResults(q);
      setExplanation(exp);
      setChatHistory(prev => [...prev, { role: 'assistant', content: exp }]);
    } catch (err) {
      console.error('Ask failed:', err);
    }
  }, [question, ask, explainLastResults]);

  const handleRefine = useCallback(async () => {
    if (!refinement.trim() || !lastQuery) return;

    // Build context from chat history
    const context = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    const refinedQuestion = `Based on the previous query "${question}" which produced: ${explanation}\n\nNow: ${refinement}`;

    setChatHistory(prev => [...prev, { role: 'user', content: refinement }]);
    setRefinement('');
    setFilters({});

    try {
      await ask(refinedQuestion);
      const exp = await explainLastResults(refinement);
      setExplanation(exp);
      setChatHistory(prev => [...prev, { role: 'assistant', content: exp }]);
    } catch (err) {
      console.error('Refine failed:', err);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
  }, [refinement, lastQuery, question, explanation, chatHistory, ask, explainLastResults]);

  const handleSaveClick = useCallback(() => {
    // Allow local saves without auth - only require auth for cloud saves
    if (!lastQuery) {
      console.log('No query to save');
      return;
    }
    setSaveModalOpen(true);
  }, [lastQuery]);

  const handleSaveRecipe = useCallback(async (recipeData) => {
    await saveRecipe(recipeData);
  }, [saveRecipe]);

  const handleChartTypeChange = useCallback((newType) => {
    if (newType !== 'table' && !isAuthenticated) {
      setShowLoginPrompt('charts');
      return;
    }
    setChartType(newType);
  }, [isAuthenticated]);

  const handleLoginFromPrompt = useCallback(async () => {
    await signIn('google');
    setShowLoginPrompt(null);
  }, [signIn]);

  const loadRecipe = useCallback((recipe) => {
    setQuestion(recipe.question);
    handleAsk(recipe.question);
    setSelectedRecipe(null);
  }, [handleAsk]);

  const handleRecipeFileUpload = useCallback(async (e, recipe) => {
    const file = e.target.files[0];
    if (!file) return;

    // Load the file to get its schema
    const result = await loadFileSmart(file);
    if (result?.tableName) {
      const schema = await getSchema(result.tableName);
      const sample = await getSample(result.tableName, 5);
      setTablePreviews(prev => ({
        ...prev,
        [result.tableName]: { schema, sample }
      }));

      // Convert schema to format for validation
      const newSchema = schema.map(col => ({ name: col.column, type: col.type }));
      setPendingFileSchema(newSchema);
      setSelectedRecipe(recipe);
    }
  }, [loadFileSmart, getSchema, getSample]);

  const runRecipeWithNewData = useCallback(async () => {
    if (!selectedRecipe) return;
    // Execute the saved SQL against the new data
    try {
      await executeSQL(selectedRecipe.sql);
      setSelectedRecipe(null);
      setPendingFileSchema(null);
    } catch (err) {
      console.error('Failed to run recipe:', err);
    }
  }, [selectedRecipe, executeSQL]);

  const deleteRecipe = useCallback((id) => {
    const updated = savedRecipes.filter(r => r.id !== id);
    setSavedRecipes(updated);
    localStorage.setItem('ziip_recipes', JSON.stringify(updated));
  }, [savedRecipes]);

  const exportRecipes = () => {
    const blob = new Blob([JSON.stringify(savedRecipes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ziip-recipes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importRecipes = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const updated = [...savedRecipes, ...imported];
        setSavedRecipes(updated);
        localStorage.setItem('ziip_recipes', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to import recipes:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleApiKeySave = (key) => {
    setApiKey(key);
    localStorage.setItem('anthropic_key', key);
  };

  const handleReset = () => {
    reset();
    setTablePreviews({});
    setSuggestions([]);
    setExplanation('');
    if (onBack) onBack();
  };

  const canChart = lastResults?.rows?.length > 0 && lastResults.schema?.length >= 2;

  // Filter data based on active filters
  const filteredData = useMemo(() => {
    if (!lastResults?.rows || !Object.keys(filters).length) return lastResults?.rows;
    return lastResults.rows.filter(row => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === null || value === undefined) return true;
        return row[key] === value;
      });
    });
  }, [lastResults?.rows, filters]);

  // Get value keys for insights
  const valueKeys = useMemo(() => {
    if (!lastResults?.schema) return [];
    return lastResults.schema
      .filter(col => ['int', 'float', 'double', 'decimal', 'bigint', 'integer'].some(t =>
        col.type.toLowerCase().includes(t)
      ))
      .map(col => col.name);
  }, [lastResults?.schema]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/50 via-slate-950 to-fuchsia-950/30" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3" onClick={(e) => { e.preventDefault(); handleReset(); }}>
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-violet-500/25">
            ⚡
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Ziip
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/recipes"
            className="text-slate-400 hover:text-white transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Recipes{savedRecipes.length > 0 ? ` (${savedRecipes.length})` : ''}
          </Link>
          {user && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-sm font-medium">
                {user.name?.charAt(0) || '?'}
              </div>
              <button onClick={signOut} className="text-slate-500 hover:text-slate-300 transition text-sm">
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        {/* API Key Input */}
        {!apiKey && (
          <div className="mb-8">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-2">Enter your Anthropic API Key</h3>
              <p className="text-slate-400 text-sm mb-4">Your key stays in your browser. We never see it.</p>
              <input
                type="password"
                placeholder="sk-ant-..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                onBlur={(e) => handleApiKeySave(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApiKeySave(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Status */}
        {!isInitialized && (
          <div className="text-center py-12 text-slate-400">
            <div className="inline-flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              Initializing DuckDB...
            </div>
          </div>
        )}

        {/* No Data - Upload Prompt */}
        {isInitialized && tables.length === 0 && !initialFiles?.length && !isLoading && (
          <div className="mb-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Upload Your Data</h3>
                <p className="text-slate-400 mb-6">Drop a CSV file to start analyzing</p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-xl font-medium cursor-pointer transition">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Choose CSV File
                  <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" disabled={isLoading} />
                </label>
                <p className="text-slate-500 text-sm mt-4">or drag and drop anywhere on the page</p>
              </div>
            </div>
          </div>
        )}

        {/* Loaded Tables */}
        {tables.length > 0 && (
          <div className="mb-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Loaded Data</h3>
                <div className="flex gap-2">
                  <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm cursor-pointer transition">
                    <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" disabled={isLoading} />
                    + Add File
                  </label>
                  {tables.length >= 2 && (
                    <button
                      onClick={() => {
                        const name = prompt('Name for stacked table:', 'combined_data');
                        if (name) handleStackTables(tables.map(t => t.name), name);
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg text-sm font-medium"
                    >
                      Stack All
                    </button>
                  )}
                  <button onClick={handleReset} className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/50 rounded-lg text-sm text-slate-400 hover:text-red-400 transition">
                    Clear
                  </button>
                </div>
              </div>

              {tables.map(table => {
                const preview = tablePreviews[table.name];
                const isExpanded = expandedTable === table.name;

                return (
                  <div key={table.name} className="border border-slate-800 rounded-xl mb-3 overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition"
                      onClick={() => setExpandedTable(isExpanded ? null : table.name)}
                    >
                      <div>
                        <span className="font-medium">{table.name}</span>
                        <span className="text-slate-400 text-sm ml-3">
                          {table.rowCount.toLocaleString()} rows
                          {preview?.schema && ` • ${preview.schema.length} columns`}
                        </span>
                      </div>
                      <span className="text-slate-500">{isExpanded ? '▼' : '▶'}</span>
                    </div>

                    {isExpanded && preview && (
                      <div className="p-4 border-t border-slate-800">
                        <div className="flex flex-wrap gap-2 mb-4">
                          {preview.schema.map(col => (
                            <span key={col.column} className="px-3 py-1 bg-violet-500/20 rounded-full text-sm">
                              {col.column}
                              <span className="text-violet-400 ml-1 text-xs">{col.type}</span>
                            </span>
                          ))}
                        </div>
                        {preview.sample?.length > 0 && (
                          <div className="overflow-auto max-h-48 rounded-lg border border-slate-800">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-800">
                                  {preview.schema.map(col => (
                                    <th key={col.column} className="px-3 py-2 text-left text-slate-300 font-medium whitespace-nowrap">
                                      {col.column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {preview.sample.map((row, i) => (
                                  <tr key={i} className="border-t border-slate-800">
                                    {preview.schema.map(col => (
                                      <td key={col.column} className="px-3 py-2 text-slate-400 whitespace-nowrap max-w-xs truncate">
                                        {formatValue(row[col.column])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && !lastResults && (
          <div className="mb-6">
            <p className="text-slate-400 text-sm mb-3">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 5).map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setQuestion(s); handleAsk(s); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Question Input */}
        {tables.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur opacity-20" />
              <div className="relative flex gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  placeholder="Ask a question about your data..."
                  className="flex-1 bg-transparent px-4 py-3 text-white placeholder-slate-500 focus:outline-none"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleAsk()}
                  disabled={isLoading || !question.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 rounded-xl font-medium transition"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Thinking...
                    </span>
                  ) : 'Ask'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-red-400">{error}</span>
              </div>
              {question && (
                <button
                  onClick={() => handleAsk()}
                  className="px-4 py-1.5 bg-red-900/50 hover:bg-red-800/50 border border-red-700 rounded-lg text-red-300 text-sm transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6M23 20v-6h-6" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {lastResults && lastResults.rows.length > 0 && (
          <div className="mb-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <div>
                  <span className="font-semibold">Results</span>
                  <span className="text-slate-400 text-sm ml-3">
                    {lastResults.rowCount.toLocaleString()} rows • {lastResults.executionTime}ms
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {canChart && (
                    <div className="relative">
                      <ChartTypeSelector value={chartType} onChange={handleChartTypeChange} />
                      {!isAuthenticated && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => exportResultsToCSV(filteredData || lastResults.rows, lastResults.schema)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition flex items-center gap-1.5"
                    title="Export to CSV"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={handleSaveClick}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition flex items-center gap-1.5"
                    title="Save recipe"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Save
                  </button>
                </div>
              </div>

              {explanation && (
                <div className="p-4 border-b border-slate-800 bg-violet-500/5">
                  <p className="text-slate-300">{explanation}</p>
                </div>
              )}

              {/* Smart Filters */}
              {lastResults.rows.length > 1 && (
                <div className="p-4 border-b border-slate-800">
                  <SmartFilters
                    data={lastResults.rows}
                    schema={lastResults.schema}
                    filters={filters}
                    onFilterChange={setFilters}
                  />
                </div>
              )}

              {/* Quick Insights */}
              {valueKeys.length > 0 && filteredData?.length > 0 && (
                <div className="p-4 border-b border-slate-800">
                  <QuickInsights
                    data={filteredData}
                    schema={lastResults.schema}
                    valueKeys={valueKeys}
                  />
                </div>
              )}

              <div className="p-4">
                {chartType === 'table' ? (
                  <div className="overflow-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800">
                          {lastResults.schema.map(col => (
                            <th key={col.name} className="px-4 py-3 text-left text-slate-300 font-medium whitespace-nowrap sticky top-0 bg-slate-800">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(filteredData || []).slice(0, 100).map((row, i) => (
                          <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                            {lastResults.schema.map(col => (
                              <td key={col.name} className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                {formatValue(row[col.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredData?.length > 100 && (
                      <p className="text-center text-slate-500 text-sm py-3">
                        Showing 100 of {filteredData.length} rows
                        {filters && Object.keys(filters).some(k => filters[k] != null) && (
                          <span className="text-violet-400"> (filtered from {lastResults.rows.length})</span>
                        )}
                      </p>
                    )}
                    {filteredData?.length <= 100 && filters && Object.keys(filters).some(k => filters[k] != null) && (
                      <p className="text-center text-slate-500 text-sm py-3">
                        <span className="text-violet-400">{filteredData.length} rows shown (filtered from {lastResults.rows.length})</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <SmartChart
                    data={filteredData || lastResults.rows}
                    schema={lastResults.schema}
                    chartType={chartType}
                  />
                )}
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">How we got this</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowSQL(!showSQL)}
                      className="text-slate-400 hover:text-white text-sm transition flex items-center gap-1"
                    >
                      {showSQL ? (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                          Hide SQL
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                          </svg>
                          View SQL
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(lastQuery)}
                      className="text-slate-400 hover:text-white text-sm transition"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Plain English Steps */}
                <QuerySteps sql={lastQuery} />

                {/* Collapsible SQL */}
                {showSQL && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <pre className="text-sm text-violet-300 font-mono overflow-auto bg-slate-900/50 p-3 rounded-lg">{lastQuery}</pre>
                  </div>
                )}
              </div>

              {/* Refinement Chat */}
              <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-slate-400 text-sm font-medium">Refine Results</span>
                </div>

                {/* Chat History */}
                {chatHistory.length > 2 && (
                  <div className="mb-3 space-y-2 max-h-40 overflow-y-auto">
                    {chatHistory.slice(2).map((msg, i) => (
                      <div
                        key={i}
                        className={`text-sm px-3 py-2 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-violet-500/20 text-violet-200 ml-8'
                            : 'bg-slate-800/50 text-slate-300 mr-8'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Refinement Suggestions */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    'Show top 10 only',
                    'Break down by category',
                    'Add percentages',
                    'Sort descending',
                    'Exclude zeros'
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setRefinement(suggestion)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-400 hover:text-white transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* Refinement Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refinement}
                    onChange={(e) => setRefinement(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                    placeholder="Adjust the results... (e.g., 'show only last 30 days' or 'group by region')"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleRefine}
                    disabled={isLoading || !refinement.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center gap-2"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                    Refine
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="relative z-10 border-t border-slate-800 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-slate-500">
          <FunFooter />
        </div>
      </footer>

      {/* Save Recipe Modal */}
      <SaveRecipeModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveRecipe}
        question={question}
        sql={lastQuery}
        schema={lastResults?.schema}
        existingRecipes={savedRecipes}
        isAuthenticated={isAuthenticated}
      />

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLoginPrompt(null)} />
          <div className="relative max-w-md mx-4">
            <LoginPrompt
              feature={showLoginPrompt === 'charts' ? 'View Charts' : 'Save Recipes'}
              onSignIn={handleLoginFromPrompt}
            />
            <button
              onClick={() => setShowLoginPrompt(null)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'bigint') return Number(val).toLocaleString();
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }
  if (typeof val === 'string') {
    // Clean up escaped quotes like "\"123456\"" -> 123456
    let cleaned = val;
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    cleaned = cleaned.replace(/\\"/g, '').replace(/^"|"$/g, '');

    // Try to parse as number if it looks numeric
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
      const num = parseFloat(cleaned);
      return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2);
    }
    return cleaned;
  }
  if (typeof val === 'object') return JSON.stringify(val, (k, v) => typeof v === 'bigint' ? Number(v) : v);
  return String(val);
}

// Parse SQL into plain English steps
function QuerySteps({ sql }) {
  const steps = parseSQLToSteps(sql);

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-full flex items-center justify-center text-xs text-violet-400 font-medium">
            {i + 1}
          </div>
          <div className="flex-1 pt-0.5">
            <span className="text-slate-300">{step.text}</span>
            {step.detail && (
              <span className="text-slate-500 ml-1">({step.detail})</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function parseSQLToSteps(sql) {
  if (!sql) return [{ text: 'No query generated' }];

  const steps = [];
  const upperSQL = sql.toUpperCase();

  // Extract table names from FROM clause
  const fromMatch = sql.match(/FROM\s+([^\s,]+)/i);
  const tableName = fromMatch ? fromMatch[1].replace(/["`]/g, '') : 'your data';

  // What are we selecting?
  const selectMatch = sql.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
  if (selectMatch) {
    const selectPart = selectMatch[1].trim();
    if (selectPart === '*') {
      steps.push({ text: `Get all columns from ${tableName}` });
    } else if (upperSQL.includes('COUNT(*)') || upperSQL.includes('COUNT(')) {
      if (upperSQL.includes('SUM(') || upperSQL.includes('AVG(')) {
        steps.push({ text: `Calculate totals and counts from ${tableName}` });
      } else {
        steps.push({ text: `Count records in ${tableName}` });
      }
    } else if (upperSQL.includes('SUM(')) {
      const sumMatch = sql.match(/SUM\(([^)]+)\)/i);
      steps.push({ text: `Sum up ${sumMatch ? sumMatch[1] : 'values'}`, detail: tableName });
    } else if (upperSQL.includes('AVG(')) {
      const avgMatch = sql.match(/AVG\(([^)]+)\)/i);
      steps.push({ text: `Calculate average of ${avgMatch ? avgMatch[1] : 'values'}`, detail: tableName });
    } else if (upperSQL.includes('MAX(') || upperSQL.includes('MIN(')) {
      steps.push({ text: `Find highest/lowest values`, detail: tableName });
    } else {
      const cols = selectPart.split(',').map(c => c.trim().split(/\s+AS\s+/i)[0]).slice(0, 3);
      steps.push({ text: `Get ${cols.join(', ')}${cols.length < selectPart.split(',').length ? '...' : ''}`, detail: tableName });
    }
  }

  // JOIN operations
  if (upperSQL.includes('JOIN')) {
    const joinMatch = sql.match(/JOIN\s+([^\s]+)/i);
    steps.push({ text: `Combine with ${joinMatch ? joinMatch[1] : 'another table'}` });
  }

  // WHERE conditions
  if (upperSQL.includes('WHERE')) {
    const whereMatch = sql.match(/WHERE\s+([\s\S]*?)(?:GROUP|ORDER|LIMIT|$)/i);
    if (whereMatch) {
      const conditions = whereMatch[1].trim();
      if (conditions.length > 50) {
        steps.push({ text: 'Filter by multiple conditions' });
      } else {
        steps.push({ text: `Filter where ${conditions.replace(/AND/gi, 'and').replace(/OR/gi, 'or')}` });
      }
    }
  }

  // GROUP BY
  if (upperSQL.includes('GROUP BY')) {
    const groupMatch = sql.match(/GROUP\s+BY\s+([^ORDER|HAVING|LIMIT]+)/i);
    if (groupMatch) {
      const groupCols = groupMatch[1].trim().split(',').map(c => c.trim()).slice(0, 2);
      steps.push({ text: `Group by ${groupCols.join(', ')}` });
    }
  }

  // HAVING
  if (upperSQL.includes('HAVING')) {
    steps.push({ text: 'Filter grouped results' });
  }

  // ORDER BY
  if (upperSQL.includes('ORDER BY')) {
    const orderMatch = sql.match(/ORDER\s+BY\s+([^\s]+)/i);
    const isDesc = upperSQL.includes('DESC');
    if (orderMatch) {
      steps.push({ text: `Sort by ${orderMatch[1]}`, detail: isDesc ? 'highest first' : 'lowest first' });
    }
  }

  // LIMIT
  if (upperSQL.includes('LIMIT')) {
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      steps.push({ text: `Show top ${limitMatch[1]} results` });
    }
  }

  if (steps.length === 0) {
    steps.push({ text: 'Execute custom query' });
  }

  return steps;
}

// Export results to CSV
function exportResultsToCSV(rows, schema) {
  if (!rows?.length || !schema?.length) return;

  const headers = schema.map(col => col.name);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ziip-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Fun rotating footer phrases
const funPhrases = [
  "Twerking your data into shape",
  "Making spreadsheets cry since 2024",
  "Your data's therapist",
  "Turning chaos into charts",
  "SQL so good it should be illegal",
  "Data whisperer at your service",
  "Pivot tables hate this one trick",
  "Excel who? Never heard of her",
  "Crunching numbers like potato chips",
  "Your data's glow-up starts here",
  "Making analysts obsolete, one query at a time",
  "Data goes in, insights come out",
  "Because life's too short for VLOOKUP",
  "Spreadsheet sorcery in progress",
  "Where rows become revelations"
];

function FunFooter() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % funPhrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="transition-opacity duration-500">
      {funPhrases[phraseIndex]} ⚡
    </span>
  );
}
