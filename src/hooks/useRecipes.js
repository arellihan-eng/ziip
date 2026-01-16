import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useRecipes() {
  const { user, isAuthenticated } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load recipes on mount and when auth changes
  useEffect(() => {
    loadRecipes();
  }, [isAuthenticated, user?.id]);

  const loadRecipes = async () => {
    setLoading(true);
    setError(null);

    try {
      // Always load local recipes
      const localRecipes = JSON.parse(localStorage.getItem('ziip_recipes') || '[]')
        .map(r => ({ ...r, source: 'local' }));

      // If signed in and Supabase is configured, also load cloud recipes
      if (isAuthenticated && user?.id && supabase) {
        const { data: cloudRecipes, error: fetchError } = await supabase
          .from('recipes')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Failed to fetch cloud recipes:', fetchError);
          // Still show local recipes if cloud fetch fails
          setRecipes(localRecipes);
        } else {
          // Merge local and cloud recipes, avoiding duplicates
          const cloudRecipesMapped = (cloudRecipes || []).map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            question: r.question,
            sql: r.sql,
            schema: r.schema,
            storageType: 'cloud',
            createdAt: r.created_at,
            source: 'cloud'
          }));

          // Combine: cloud recipes first, then local recipes not in cloud
          const cloudIds = new Set(cloudRecipesMapped.map(r => r.id));
          const uniqueLocalRecipes = localRecipes.filter(r => !cloudIds.has(r.id));
          setRecipes([...cloudRecipesMapped, ...uniqueLocalRecipes]);
        }
      } else {
        setRecipes(localRecipes);
      }
    } catch (err) {
      console.error('Error loading recipes:', err);
      setError(err.message);
      // Fallback to local only
      const localRecipes = JSON.parse(localStorage.getItem('ziip_recipes') || '[]');
      setRecipes(localRecipes);
    } finally {
      setLoading(false);
    }
  };

  const saveRecipe = useCallback(async (recipeData) => {
    const recipe = {
      id: recipeData.id || Date.now(),
      ...recipeData,
      createdAt: recipeData.createdAt || new Date().toISOString()
    };

    // If cloud storage and user is signed in, save to Supabase
    if (recipeData.storageType === 'cloud' && isAuthenticated && user?.id && supabase) {
      try {
        const { data, error: insertError } = await supabase
          .from('recipes')
          .insert({
            id: recipe.id,
            user_id: user.id,
            name: recipe.name,
            description: recipe.description,
            question: recipe.question,
            sql: recipe.sql,
            schema: recipe.schema,
            created_at: recipe.createdAt
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to save to cloud:', insertError);
          throw insertError;
        }

        // Update state with cloud recipe
        setRecipes(prev => [{ ...recipe, source: 'cloud' }, ...prev]);
        return { ...recipe, source: 'cloud' };
      } catch (err) {
        console.error('Cloud save failed, falling back to local:', err);
        // Fall through to local save
      }
    }

    // Save to localStorage
    const localRecipes = JSON.parse(localStorage.getItem('ziip_recipes') || '[]');
    const updated = [recipe, ...localRecipes];
    localStorage.setItem('ziip_recipes', JSON.stringify(updated));
    setRecipes(prev => [{ ...recipe, source: 'local' }, ...prev.filter(r => r.id !== recipe.id)]);
    return { ...recipe, source: 'local' };
  }, [isAuthenticated, user?.id]);

  const deleteRecipe = useCallback(async (recipeId, source) => {
    // Delete from cloud if it's a cloud recipe
    if (source === 'cloud' && isAuthenticated && user?.id && supabase) {
      try {
        const { error: deleteError } = await supabase
          .from('recipes')
          .delete()
          .eq('id', recipeId)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Failed to delete from cloud:', deleteError);
        }
      } catch (err) {
        console.error('Cloud delete failed:', err);
      }
    }

    // Always remove from local storage too (in case it exists in both)
    const localRecipes = JSON.parse(localStorage.getItem('ziip_recipes') || '[]');
    const updated = localRecipes.filter(r => r.id !== recipeId);
    localStorage.setItem('ziip_recipes', JSON.stringify(updated));

    // Update state
    setRecipes(prev => prev.filter(r => r.id !== recipeId));
  }, [isAuthenticated, user?.id]);

  const migrateToCloud = useCallback(async (recipe) => {
    if (!isAuthenticated || !user?.id || !supabase) {
      throw new Error('Must be signed in to migrate to cloud');
    }

    try {
      const { error: insertError } = await supabase
        .from('recipes')
        .insert({
          id: recipe.id,
          user_id: user.id,
          name: recipe.name,
          description: recipe.description,
          question: recipe.question,
          sql: recipe.sql,
          schema: recipe.schema,
          created_at: recipe.createdAt
        });

      if (insertError) throw insertError;

      // Remove from local storage
      const localRecipes = JSON.parse(localStorage.getItem('ziip_recipes') || '[]');
      const updated = localRecipes.filter(r => r.id !== recipe.id);
      localStorage.setItem('ziip_recipes', JSON.stringify(updated));

      // Update state
      setRecipes(prev => prev.map(r =>
        r.id === recipe.id ? { ...r, source: 'cloud', storageType: 'cloud' } : r
      ));

      return true;
    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }
  }, [isAuthenticated, user?.id]);

  return {
    recipes,
    loading,
    error,
    saveRecipe,
    deleteRecipe,
    migrateToCloud,
    refresh: loadRecipes
  };
}

export default useRecipes;
