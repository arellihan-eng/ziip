import React, { useState, useMemo, useEffect } from 'react';

export default function SaveRecipeModal({
  isOpen,
  onClose,
  onSave,
  question,
  sql,
  schema,
  existingRecipes = [],
  isAuthenticated = false
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [storageType, setStorageType] = useState('local'); // 'local' or 'cloud'
  const [errors, setErrors] = useState({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(question?.slice(0, 50) || 'My Analysis');
      setDescription('');
      setErrors({});
    }
  }, [isOpen, question]);

  const handleSave = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (name.length > 100) newErrors.name = 'Name must be under 100 characters';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      question,
      sql,
      schema: schema?.map(col => ({ name: col.name, type: col.type })) || [],
      storageType,
      createdAt: new Date().toISOString()
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Save Recipe</h2>
              <p className="text-sm text-slate-400">Save this analysis for reuse</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Recipe Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors({}); }}
              placeholder="e.g., Monthly Sales Summary"
              className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none transition ${
                errors.name ? 'border-red-500' : 'border-slate-700 focus:border-violet-500'
              }`}
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this recipe do? When should it be used?"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
            />
          </div>

          {/* Storage Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Storage</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStorageType('local')}
                className={`p-4 rounded-xl border transition text-left ${
                  storageType === 'local'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span className="font-medium text-white">Local</span>
                </div>
                <p className="text-xs text-slate-400">Stored in browser, private to you</p>
              </button>
              <button
                onClick={() => isAuthenticated && setStorageType('cloud')}
                disabled={!isAuthenticated}
                className={`p-4 rounded-xl border transition text-left ${
                  storageType === 'cloud'
                    ? 'border-violet-500 bg-violet-500/10'
                    : !isAuthenticated
                      ? 'border-slate-700 opacity-60 cursor-not-allowed'
                      : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  </svg>
                  <span className="font-medium text-white">Cloud</span>
                  {!isAuthenticated && (
                    <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Sign in</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {isAuthenticated ? 'Sync across devices' : 'Sign in to enable cloud sync'}
                </p>
              </button>
            </div>
          </div>

          {/* Schema Preview */}
          {schema && schema.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Expected Data Schema
              </label>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {schema.map((col, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-700/50 rounded-lg text-sm">
                      <span className="text-white">{col.name}</span>
                      <span className="text-slate-400 ml-1 text-xs">{col.type}</span>
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                New data files must match this schema to use this recipe
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-800/30">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-xl font-medium transition"
          >
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
}

// Schema validation component for adding new files to a recipe
export function SchemaValidator({ newSchema, expectedSchema, onResult }) {
  const validation = useMemo(() => {
    if (!expectedSchema || !newSchema) {
      return { isValid: true, matches: [], missing: [], extra: [], typeChanges: [] };
    }

    const expectedMap = new Map(expectedSchema.map(col => [col.name.toLowerCase(), col]));
    const newMap = new Map(newSchema.map(col => [col.name.toLowerCase(), col]));

    const matches = [];
    const typeChanges = [];
    const missing = [];
    const extra = [];

    // Check expected columns
    for (const [name, col] of expectedMap) {
      const newCol = newMap.get(name);
      if (!newCol) {
        missing.push(col);
      } else if (newCol.type !== col.type) {
        typeChanges.push({ expected: col, actual: newCol });
      } else {
        matches.push(col);
      }
    }

    // Check for extra columns
    for (const [name, col] of newMap) {
      if (!expectedMap.has(name)) {
        extra.push(col);
      }
    }

    const isValid = missing.length === 0 && typeChanges.length === 0;

    return { isValid, matches, missing, extra, typeChanges };
  }, [newSchema, expectedSchema]);

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${
        validation.isValid
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-red-500/10 border border-red-500/30'
      }`}>
        {validation.isValid ? (
          <>
            <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>
              <p className="font-medium text-green-300">Schema Match</p>
              <p className="text-sm text-green-400/70">This file is compatible with the recipe</p>
            </div>
          </>
        ) : (
          <>
            <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="font-medium text-red-300">Schema Mismatch</p>
              <p className="text-sm text-red-400/70">This file has issues that need attention</p>
            </div>
          </>
        )}
      </div>

      {/* Matching Columns */}
      {validation.matches.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Matching Columns ({validation.matches.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {validation.matches.map((col, i) => (
              <span key={i} className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-300">
                {col.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing Columns */}
      {validation.missing.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Missing Columns ({validation.missing.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {validation.missing.map((col, i) => (
              <span key={i} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                {col.name} <span className="text-red-400/60 text-xs">{col.type}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Type Changes */}
      {validation.typeChanges.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Type Changes ({validation.typeChanges.length})
          </p>
          <div className="space-y-1">
            {validation.typeChanges.map((change, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
                <span className="text-white">{change.expected.name}</span>
                <span className="text-yellow-400/60 text-xs">{change.expected.type}</span>
                <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                <span className="text-yellow-300 text-xs">{change.actual.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extra Columns */}
      {validation.extra.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Extra Columns ({validation.extra.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {validation.extra.map((col, i) => (
              <span key={i} className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
                {col.name} <span className="text-blue-400/60 text-xs">{col.type}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Extra columns will be ignored by this recipe</p>
        </div>
      )}
    </div>
  );
}

// Login prompt component for gated features
export function LoginPrompt({ feature, onSignIn }) {
  return (
    <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl text-center">
      <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Sign in to {feature}</h3>
      <p className="text-slate-400 text-sm mb-4">
        Create a free account to unlock {feature.toLowerCase()} and more features.
      </p>
      <button
        onClick={onSignIn}
        className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-xl font-medium transition inline-flex items-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
