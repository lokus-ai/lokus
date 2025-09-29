import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BaseManager } from './core/BaseManager.js';
import { BasesDataManager } from './data/index.js';

const BasesContext = createContext();

export function BasesProvider({ children, workspacePath }) {
  console.log('🏗️ BasesProvider: Rendering with workspacePath:', workspacePath);

  const [baseManager] = useState(() => new BaseManager());
  const [dataManager] = useState(() => new BasesDataManager());
  const [bases, setBases] = useState([]);
  const [activeBase, setActiveBase] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize the system
  useEffect(() => {
    console.log('🚀 BasesContext: Initialize effect triggered with:', { workspacePath });
    if (!workspacePath) return;

    const initializeBases = async () => {
      console.log('📋 BasesContext: Starting initialization...');
      setIsLoading(true);
      setError(null);

      try {
        // Initialize data manager with workspace
        console.log('🔧 BasesContext: Initializing data manager...');
        await dataManager.initialize(workspacePath);

        // Load all existing bases
        console.log('📚 BasesContext: Loading bases...');
        const result = await baseManager.listBases(workspacePath);
        console.log('📋 BasesContext: Raw listBases result:', result);

        const existingBases = result?.success ? result.bases : [];
        console.log('📋 BasesContext: Setting bases array:', existingBases);
        setBases(existingBases);

        // Auto-select the first base if available
        if (existingBases.length > 0 && !activeBase) {
          const firstBase = existingBases[0];
          console.log('🎯 BasesContext: Auto-selecting first base:', firstBase.name);
          console.log('🔍 BasesContext: First base has views:', firstBase.views);
          console.log('🔍 BasesContext: Full first base object:', firstBase);

          // Fix: Convert views object to array if needed
          let views = firstBase.views;
          if (views && typeof views === 'object' && !Array.isArray(views)) {
            views = Object.values(views);
            console.log('🔧 BasesContext: Converted first base views object to array:', views.length);
          }

          const baseWithFixedViews = {
            ...firstBase,
            views: views
          };

          setActiveBase(baseWithFixedViews);
          if (views && views.length > 0) {
            setActiveView(views[0]);
            console.log('📋 BasesContext: Auto-selected view:', views[0].name);
          } else {
            console.log('⚠️ BasesContext: No views found in first base during auto-selection');
          }
        }

        console.log(`✅ BasesContext: Initialized Bases system with ${existingBases.length} bases`);
      } catch (err) {
        console.error('❌ BasesContext: Failed to initialize Bases system:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeBases();
  }, [workspacePath, baseManager, dataManager]);

  // Create a new base
  const createBase = useCallback(async (name, config = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await baseManager.createBase(name, {
        ...config,
        basePath: workspacePath
      });

      if (result.success) {
        const newBase = result.base;
        setBases(prev => [...prev, newBase]);
        setActiveBase(newBase);
        if (newBase.views && newBase.views.length > 0) {
          setActiveView(newBase.views[0]);
        }
        return { success: true, base: newBase };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to create base:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [baseManager, workspacePath]);

  // Load a base
  const loadBase = useCallback(async (basePath) => {
    console.log('🚀 BasesContext: Loading base with path:', basePath);
    setIsLoading(true);
    setError(null);

    try {
      const result = await baseManager.loadBase(basePath);

      if (result.success) {
        console.log('✅ BasesContext: Base loaded successfully:', result.base.name);
        console.log('🔍 BasesContext: Base has views:', result.base.views);

        // Fix: Convert views object to array if needed
        let views = result.base.views;
        if (views && typeof views === 'object' && !Array.isArray(views)) {
          views = Object.values(views);
          console.log('🔧 BasesContext: Converted views object to array:', views.length);
        }

        const baseWithFixedViews = {
          ...result.base,
          views: views
        };

        setActiveBase(baseWithFixedViews);
        if (views && views.length > 0) {
          setActiveView(views[0]);
          console.log('📋 BasesContext: Set active view:', views[0].name);
        } else {
          console.log('⚠️ BasesContext: No views found in base');
        }
        return { success: true, base: baseWithFixedViews };
      } else {
        console.error('❌ BasesContext: Load base failed:', result.error);
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to load base:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [baseManager]);

  // Save the current base
  const saveBase = useCallback(async (base = activeBase) => {
    if (!base) return { success: false, error: 'No base to save' };

    setIsLoading(true);
    setError(null);

    try {
      const result = await baseManager.saveBase(base.path, base);

      if (result.success) {
        // Update the base in our state
        setBases(prev =>
          prev.map(b => b.path === base.path ? { ...base, ...result.base } : b)
        );

        if (activeBase && activeBase.path === base.path) {
          setActiveBase({ ...base, ...result.base });
        }

        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to save base:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [baseManager, activeBase]);

  // Delete a base
  const deleteBase = useCallback(async (basePath) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await baseManager.deleteBase(basePath);

      if (result.success) {
        setBases(prev => prev.filter(b => b.path !== basePath));

        if (activeBase && activeBase.path === basePath) {
          setActiveBase(null);
          setActiveView(null);
        }

        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to delete base:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [baseManager, activeBase]);

  // Switch to a different view
  const switchView = useCallback((viewName) => {
    if (!activeBase) return;

    const view = activeBase.views?.find(v => v.name === viewName);
    if (view) {
      setActiveView(view);
    }
  }, [activeBase]);

  // Execute a query on current base
  const executeQuery = useCallback(async (queryConfig = {}) => {
    console.log('📊 BasesContext: executeQuery called with:', {
      activeBase: activeBase?.name || 'none',
      activeView: activeView?.name || 'none',
      queryConfig
    });

    if (!activeBase || !activeView) {
      console.log('❌ BasesContext: No active base or view');
      return { success: false, error: 'No active base or view' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get all files from workspace
      console.log('📂 BasesContext: Getting all files...');
      const files = await dataManager.getAllFiles();
      console.log('📂 BasesContext: Got files:', files?.length || 0);

      // Apply base-level filters
      let filteredFiles = files;
      if (activeBase.filters && activeBase.filters.length > 0) {
        // Apply global base filters
        // This will be handled by the QueryExecutor
        console.log('🔍 BasesContext: Applying base filters');
      }

      // Apply view-level filters
      const viewConfig = {
        ...activeView,
        ...queryConfig
      };
      console.log('🔧 BasesContext: View config:', viewConfig);

      // Execute the query
      console.log('⚡ BasesContext: Executing query...');
      const result = await dataManager.executeQuery(viewConfig, filteredFiles);
      console.log('⚡ BasesContext: Query execution result:', result);

      return {
        success: true,
        data: result.data,
        totalCount: result.totalCount,
        filteredCount: result.filteredCount
      };
    } catch (err) {
      console.error('❌ BasesContext: Failed to execute query:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [activeBase, activeView, dataManager]);

  // Get available properties for filtering/display
  const getAvailableProperties = useCallback(async () => {
    try {
      const properties = await dataManager.getAvailableProperties();
      return { success: true, properties };
    } catch (err) {
      console.error('Failed to get properties:', err);
      return { success: false, error: err.message };
    }
  }, [dataManager]);

  // Search bases
  const searchBases = useCallback(async (query) => {
    try {
      const results = await baseManager.searchBases(query, workspacePath);
      return { success: true, results };
    } catch (err) {
      console.error('Failed to search bases:', err);
      return { success: false, error: err.message };
    }
  }, [baseManager, workspacePath]);

  const contextValue = {
    // State
    bases,
    activeBase,
    activeView,
    isLoading,
    error,
    workspacePath,

    // Base management
    createBase,
    loadBase,
    saveBase,
    deleteBase,
    searchBases,

    // View management
    switchView,

    // Data operations
    executeQuery,
    getAvailableProperties,

    // Direct access to managers (for advanced usage)
    baseManager,
    dataManager
  };

  return (
    <BasesContext.Provider value={contextValue}>
      {children}
    </BasesContext.Provider>
  );
}

export function useBases() {
  const context = useContext(BasesContext);
  if (!context) {
    throw new Error('useBases must be used within a BasesProvider');
  }
  return context;
}

export default BasesContext;