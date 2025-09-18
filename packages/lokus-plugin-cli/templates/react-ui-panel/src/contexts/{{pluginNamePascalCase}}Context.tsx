import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { PluginContext } from '@lokus/plugin-sdk';

// State types
interface {{pluginNamePascalCase}}State {
  isActive: boolean;
  lastUpdate: Date;
  data: any[];
  error: string | null;
  isLoading: boolean;
}

// Action types
type {{pluginNamePascalCase}}Action =
  | { type: 'SET_ACTIVE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_DATA'; payload: any[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_TIMESTAMP' }
  | { type: 'REFRESH' }
  | { type: 'CLEAR' };

// Context types
interface {{pluginNamePascalCase}}ContextValue {
  context: PluginContext;
  state: {{pluginNamePascalCase}}State;
  actions: {
    setActive: (active: boolean) => void;
    setLoading: (loading: boolean) => void;
    setData: (data: any[]) => void;
    setError: (error: string | null) => void;
    refresh: () => void;
    clear: () => void;
  };
}

// Initial state
const initialState: {{pluginNamePascalCase}}State = {
  isActive: true,
  lastUpdate: new Date(),
  data: [],
  error: null,
  isLoading: false
};

// Reducer
function {{pluginNameCamelCase}}Reducer(
  state: {{pluginNamePascalCase}}State,
  action: {{pluginNamePascalCase}}Action
): {{pluginNamePascalCase}}State {
  switch (action.type) {
    case 'SET_ACTIVE':
      return {
        ...state,
        isActive: action.payload,
        lastUpdate: new Date()
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
      
    case 'SET_DATA':
      return {
        ...state,
        data: action.payload,
        lastUpdate: new Date(),
        error: null
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
      
    case 'UPDATE_TIMESTAMP':
      return {
        ...state,
        lastUpdate: new Date()
      };
      
    case 'REFRESH':
      return {
        ...state,
        isLoading: true,
        error: null,
        lastUpdate: new Date()
      };
      
    case 'CLEAR':
      return {
        ...state,
        data: [],
        error: null,
        lastUpdate: new Date()
      };
      
    default:
      return state;
  }
}

// Create context
const {{pluginNamePascalCase}}Context = createContext<{{pluginNamePascalCase}}ContextValue | null>(null);

// Provider component
interface {{pluginNamePascalCase}}ProviderProps {
  context: PluginContext;
  children: React.ReactNode;
}

export const {{pluginNamePascalCase}}Provider: React.FC<{{pluginNamePascalCase}}ProviderProps> = ({
  context,
  children
}) => {
  const [state, dispatch] = useReducer({{pluginNameCamelCase}}Reducer, initialState);

  // Actions
  const actions = {
    setActive: (active: boolean) => {
      dispatch({ type: 'SET_ACTIVE', payload: active });
      context.logger.debug(`Plugin set to ${active ? 'active' : 'inactive'}`);
    },
    
    setLoading: (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
    
    setData: (data: any[]) => {
      dispatch({ type: 'SET_DATA', payload: data });
      context.logger.debug(`Data updated: ${data.length} items`);
    },
    
    setError: (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
      if (error) {
        context.logger.error('Error occurred:', new Error(error));
      }
    },
    
    refresh: () => {
      dispatch({ type: 'REFRESH' });
      context.logger.debug('Refresh triggered');
    },
    
    clear: () => {
      dispatch({ type: 'CLEAR' });
      context.logger.debug('Data cleared');
    }
  };

  // Auto-update timestamp every minute
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'UPDATE_TIMESTAMP' });
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, []);

  // Listen to plugin context events
  useEffect(() => {
    const handleConfigChange = () => {
      dispatch({ type: 'UPDATE_TIMESTAMP' });
    };

    // Subscribe to configuration changes
    context.configuration.onDidChange('{{pluginName}}', handleConfigChange);

    return () => {
      // Cleanup subscriptions if needed
    };
  }, [context]);

  // Persist state to plugin storage
  useEffect(() => {
    const persistState = async () => {
      try {
        await context.storage.set('{{pluginName}}.state', {
          isActive: state.isActive,
          lastUpdate: state.lastUpdate.toISOString(),
          dataCount: state.data.length
        });
      } catch (error) {
        context.logger.warn('Failed to persist state:', error as Error);
      }
    };

    persistState();
  }, [state.isActive, state.data.length, context]);

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const persistedState = await context.storage.get('{{pluginName}}.state');
        if (persistedState) {
          if (typeof persistedState.isActive === 'boolean') {
            actions.setActive(persistedState.isActive);
          }
        }
      } catch (error) {
        context.logger.warn('Failed to load persisted state:', error as Error);
      }
    };

    loadPersistedState();
  }, []);

  const contextValue: {{pluginNamePascalCase}}ContextValue = {
    context,
    state,
    actions
  };

  return (
    <{{pluginNamePascalCase}}Context.Provider value={contextValue}>
      {children}
    </{{pluginNamePascalCase}}Context.Provider>
  );
};

// Hook to use the context
export const use{{pluginNamePascalCase}}Context = (): {{pluginNamePascalCase}}ContextValue => {
  const context = useContext({{pluginNamePascalCase}}Context);
  
  if (!context) {
    throw new Error('use{{pluginNamePascalCase}}Context must be used within a {{pluginNamePascalCase}}Provider');
  }
  
  return context;
};

// Hook to use just the plugin context
export const usePluginContext = (): PluginContext => {
  const { context } = use{{pluginNamePascalCase}}Context();
  return context;
};

// Hook to use just the state
export const use{{pluginNamePascalCase}}State = (): {{pluginNamePascalCase}}State => {
  const { state } = use{{pluginNamePascalCase}}Context();
  return state;
};

// Hook to use just the actions
export const use{{pluginNamePascalCase}}Actions = () => {
  const { actions } = use{{pluginNamePascalCase}}Context();
  return actions;
};