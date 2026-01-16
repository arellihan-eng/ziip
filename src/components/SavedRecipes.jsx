import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRecipes } from '../hooks/useRecipes';

export default function SavedRecipes() {
  const { user, signIn, signOut, isAuthenticated } = useAuth();
  const { recipes, loading, deleteRecipe, migrateToCloud, saveRecipe } = useRecipes();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeToRun, setRecipeToRun] = useState(null);
  const [migrating, setMigrating] = useState(null);

  const handleRunWithNewData = (recipe) => {
    setRecipeToRun(recipe);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file || !recipeToRun) return;

    // Store the recipe to run in sessionStorage
    sessionStorage.setItem('ziip_pending_recipe', JSON.stringify(recipeToRun));

    // Navigate to home with the file
    window.__ziipPendingFile = file;
    navigate('/');

    // Reset
    setRecipeToRun(null);
    e.target.value = '';
  };

  const handleDelete = (recipe) => {
    deleteRecipe(recipe.id, recipe.source);
  };

  const handleMigrateToCloud = async (recipe) => {
    setMigrating(recipe.id);
    try {
      await migrateToCloud(recipe);
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      setMigrating(null);
    }
  };

  const exportRecipes = () => {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ziip-recipes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importRecipes = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        for (const recipe of imported) {
          await saveRecipe({ ...recipe, storageType: 'local' });
        }
      } catch (err) {
        console.error('Failed to import recipes:', err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/50 via-slate-950 to-fuchsia-950/30" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-violet-500/25">
            ⚡
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Ziip
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-white transition">
            ← Back to Analysis
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

      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Saved Recipes</h1>
          <p className="text-slate-400">Your saved analyses ready to run on new data</p>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-slate-400">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportRecipes}
              disabled={recipes.length === 0}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-sm transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export All
            </button>
            <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm cursor-pointer transition flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
              <input type="file" accept=".json" onChange={importRecipes} className="hidden" />
            </label>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-slate-400">Loading recipes...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && recipes.length === 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No saved recipes yet</h3>
            <p className="text-slate-400 mb-6">Run an analysis and click Save to create your first recipe</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-xl font-medium transition"
            >
              Start Analyzing
            </Link>
          </div>
        )}

        {/* Recipe List */}
        {recipes.length > 0 && (
          <div className="space-y-4">
            {recipes.map(recipe => (
              <div key={recipe.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold truncate">{recipe.name}</h3>
                      {recipe.description && (
                        <p className="text-slate-400 text-sm mt-1">{recipe.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                        <span>{new Date(recipe.createdAt).toLocaleDateString()}</span>
                        {recipe.schema && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <line x1="3" y1="9" x2="21" y2="9" />
                              <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                            {recipe.schema.length} columns
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${
                          recipe.source === 'cloud'
                            ? 'bg-violet-500/20 text-violet-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {recipe.source === 'cloud' ? (
                            <>
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                              </svg>
                              cloud
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                              </svg>
                              local
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setSelectedRecipe(selectedRecipe?.id === recipe.id ? null : recipe)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        title="View details"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {selectedRecipe?.id === recipe.id ? (
                            <polyline points="18 15 12 9 6 15" />
                          ) : (
                            <polyline points="6 9 12 15 18 9" />
                          )}
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(recipe)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedRecipe?.id === recipe.id && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      {/* Original Question */}
                      {recipe.question && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-slate-400 mb-2">Original Question</h4>
                          <p className="text-white bg-slate-800/50 rounded-lg px-4 py-3">{recipe.question}</p>
                        </div>
                      )}

                      {/* SQL */}
                      {recipe.sql && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-slate-400 mb-2">SQL Query</h4>
                          <pre className="text-sm text-violet-300 font-mono bg-slate-800/50 rounded-lg px-4 py-3 overflow-auto">{recipe.sql}</pre>
                        </div>
                      )}

                      {/* Schema */}
                      {recipe.schema && recipe.schema.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-slate-400 mb-2">Expected Schema</h4>
                          <div className="flex flex-wrap gap-2">
                            {recipe.schema.map((col, i) => (
                              <span key={i} className="px-3 py-1.5 bg-slate-800/50 rounded-lg text-sm">
                                <span className="text-white">{col.name}</span>
                                <span className="text-slate-400 ml-2 text-xs">{col.type}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-6 flex-wrap">
                        <button
                          onClick={() => handleRunWithNewData(recipe)}
                          className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-xl text-sm font-medium transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Run with New Data
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(recipe.sql);
                          }}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Copy SQL
                        </button>
                        {/* Move to Cloud option for local recipes when signed in */}
                        {recipe.source === 'local' && isAuthenticated && (
                          <button
                            onClick={() => handleMigrateToCloud(recipe)}
                            disabled={migrating === recipe.id}
                            className="px-4 py-2 bg-slate-800 hover:bg-violet-900/30 border border-slate-700 hover:border-violet-500/50 rounded-xl text-sm transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {migrating === recipe.id ? (
                              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                              </svg>
                            )}
                            Move to Cloud
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-slate-800 py-6">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          {isAuthenticated ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
              Cloud recipes sync across your devices
            </span>
          ) : (
            <span>
              Your recipes are stored locally in this browser.{' '}
              <button onClick={() => signIn('google')} className="text-violet-400 hover:text-violet-300 underline">
                Sign in
              </button>
              {' '}to sync across devices.
            </span>
          )}
        </div>
      </footer>

      {/* Hidden file input for running recipes with new data */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelected}
        className="hidden"
      />
    </div>
  );
}
