import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import LandingPage from './components/LandingPage';
import AnalysisView from './components/AnalysisView';
import SavedRecipes from './components/SavedRecipes';
import Privacy from './components/Privacy';
import Terms from './components/Terms';

function App() {
  const [files, setFiles] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState(null);

  // Check for pending recipe from SavedRecipes page
  useEffect(() => {
    const pendingFile = window.__ziipPendingFile;
    const pendingRecipeData = sessionStorage.getItem('ziip_pending_recipe');

    if (pendingFile && pendingRecipeData) {
      const recipe = JSON.parse(pendingRecipeData);
      setFiles([pendingFile]);
      setPendingRecipe(recipe);
      setShowAnalysis(true);

      // Clean up
      delete window.__ziipPendingFile;
      sessionStorage.removeItem('ziip_pending_recipe');
    }
  }, []);

  const handleFileLoad = (loadedFiles) => {
    setFiles(loadedFiles);
    setShowAnalysis(true);
  };

  const handleBack = () => {
    setFiles(null);
    setPendingRecipe(null);
    setShowAnalysis(false);
  };

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              showAnalysis ? (
                <AnalysisView initialFiles={files} onBack={handleBack} pendingRecipe={pendingRecipe} />
              ) : (
                <LandingPage onFileLoad={handleFileLoad} />
              )
            }
          />
          <Route path="/recipes" element={<SavedRecipes />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
