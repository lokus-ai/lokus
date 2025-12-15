import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { PluginContext } from 'lokus-plugin-sdk';

// State types
interface { { pluginNamePascalCase } }State {
    isActive: boolean;
    lastUpdate: Date;
    data: any[];
    error: string | null;
    isLoading: boolean;
}
// ... rest is same ...
