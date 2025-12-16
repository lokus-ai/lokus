import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BaseManager } from './core/BaseManager.js';
import { BasesDataManager } from './data/index.js';
import { BaseConfigManager } from './core/BaseConfigManager.js';
import { useFolderScope } from '../contexts/FolderScopeContext.jsx';

const BasesContext = createContext();

export function BasesProvider({ children, workspacePath }) {
  const { isFileInScope, scopeMode } = useFolderScope();

  const [baseManager] = useState(() => new BaseManager());
  const [dataManager] = useState(() => new BasesDataManager());
  const [configManager] = useState(() => workspacePath ? new BaseConfigManager(workspacePath) : null);
  const [bases, setBases] = useState([]);
  const [activeBase, setActiveBase] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize the system
  useEffect(() => {
    if (!workspacePath) return;

    const initializeBases = async () => {
      setIsLoading(true);
      setError(null);

      try {

        // Initialize config manager
        if (configManager) {
          await configManager.load();
        }

        // Initialize data manager with workspace
        await dataManager.initialize(workspacePath);

        // Load all existing bases
        const result = await baseManager.listBases(workspacePath);

        let existingBases = result?.success ? result.bases : [];

        // Auto-create a default base if none exists
        if (existingBases.length === 0) {
          const defaultBase = {
            name: 'All Notes',
            sourceFolder: workspacePath,
            views: [{
              name: 'Table',
              type: 'table',
              columns: ['name', 'created', 'modified'],
              filters: [],
              sortBy: []
            }]
          };

          try {
            const createResult = await baseManager.createBase(workspacePath, defaultBase);
            if (createResult?.success) {
              existingBases = [createResult.base];
            } else {
              // Fallback: create a temporary in-memory base
              existingBases = [{
                ...defaultBase,
                id: 'temp-default',
                path: null // Indicates this is a temporary base
              }];
            }
          } catch (error) {
            // Fallback: create a temporary in-memory base
            existingBases = [{
              ...defaultBase,
              id: 'temp-default',
              path: null // Indicates this is a temporary base
            }];
          }
        }

        setBases(existingBases);

        // Auto-select the first base if available
        if (existingBases.length > 0 && !activeBase) {
          const firstBase = existingBases[0];

          // Fix: Convert views object to array if needed
          let views = firstBase.views;
          if (views && typeof views === 'object' && !Array.isArray(views)) {
            views = Object.values(views);
          }

          const baseWithFixedViews = {
            ...firstBase,
            views: views
          };

          setActiveBase(baseWithFixedViews);
          if (views && views.length > 0) {
            setActiveView(views[0]);
          } else {
          }
        }

      } catch (err) {
        console.error('BasesContext initialization failed:', err);
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
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [baseManager, workspacePath]);

  // Load a base
  const loadBase = useCallback(async (basePath) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await baseManager.loadBase(basePath);

      if (result.success) {

        // Fix: Convert views object to array if needed
        let views = result.base.views;
        if (views && typeof views === 'object' && !Array.isArray(views)) {
          views = Object.values(views);
        }

        const baseWithFixedViews = {
          ...result.base,
          views: views
        };

        setActiveBase(baseWithFixedViews);
        if (views && views.length > 0) {
          setActiveView(views[0]);
        } else {
        }
        return { success: true, base: baseWithFixedViews };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
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
    if (!activeBase || !activeView) {
      return { success: false, error: 'No active base or view' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get all files from workspace
      const files = await dataManager.getAllFiles();

      // Apply folder scope filtering
      let filteredFiles = files;
      if (scopeMode === 'local') {
        filteredFiles = files.filter(file => isFileInScope(file.path));
      }

      // Apply base-level filters
      if (activeBase.filters && activeBase.filters.length > 0) {
        // Apply global base filters
        // This will be handled by the QueryExecutor
      }

      // Apply view-level filters
      const viewConfig = {
        ...activeView,
        ...queryConfig
      };

      // Execute the query
      const result = await dataManager.executeQuery(viewConfig, filteredFiles);

      return {
        success: true,
        data: result.data,
        totalCount: result.totalCount,
        filteredCount: result.filteredCount
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [activeBase, activeView, dataManager, scopeMode, isFileInScope]);

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
    configManager,

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