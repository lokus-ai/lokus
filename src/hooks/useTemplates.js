import { useState, useEffect, useCallback, useMemo } from 'react';
import { TemplateManager } from '../core/templates/manager.js';
import { builtinVariables } from '../core/templates/variables.js';

// Template manager singleton
let templateManager = null;

function getTemplateManager() {
  if (!templateManager) {
    templateManager = new TemplateManager({
      storage: new Map(), // In-memory storage for now
      maxTemplates: 1000
    });
  }
  return templateManager;
}

/**
 * Main hook for template management
 */
export function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const manager = useMemo(() => getTemplateManager(), []);

  // Load templates
  const loadTemplates = useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = manager.list(options);
      setTemplates(result.templates);
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Failed to load templates:', err);
      return { templates: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [manager]);

  // Create template
  const createTemplate = useCallback(async (templateData) => {
    setError(null);
    
    try {
      const template = await manager.create(templateData);
      await loadTemplates(); // Refresh list
      return template;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, loadTemplates]);

  // Update template
  const updateTemplate = useCallback(async (id, updates) => {
    setError(null);
    
    try {
      const template = await manager.update(id, updates);
      await loadTemplates(); // Refresh list
      return template;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, loadTemplates]);

  // Delete template
  const deleteTemplate = useCallback(async (id) => {
    setError(null);
    
    try {
      const success = manager.delete(id);
      if (success) {
        await loadTemplates(); // Refresh list
      }
      return success;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, loadTemplates]);

  // Duplicate template
  const duplicateTemplate = useCallback(async (id, newId, options = {}) => {
    setError(null);
    
    try {
      const template = await manager.duplicate(id, newId, options);
      await loadTemplates(); // Refresh list
      return template;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, loadTemplates]);

  // Process template
  const processTemplate = useCallback(async (id, variables = {}, options = {}) => {
    setError(null);
    
    try {
      return await manager.process(id, variables, options);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager]);

  // Get template by ID
  const getTemplate = useCallback((id) => {
    return manager.read(id);
  }, [manager]);

  // Search templates
  const searchTemplates = useCallback(async (query, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = manager.search(query, options);
      return result;
    } catch (err) {
      setError(err.message);
      return { templates: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [manager]);

  // Get categories
  const getCategories = useCallback(() => {
    return manager.getCategories();
  }, [manager]);

  // Get tags
  const getTags = useCallback(() => {
    return manager.getTags();
  }, [manager]);

  // Get statistics
  const getStatistics = useCallback(() => {
    return manager.getStatistics();
  }, [manager]);

  // Initialize with demo templates if none exist
  const initializeDemoTemplates = useCallback(async () => {
    try {
      const result = manager.list();
      if (result.templates.length === 0) {
        console.log('No templates found, initializing demo templates...');
        
        // Import and create demo templates
        const demoTemplates = [
          {
            id: 'meeting-notes',
            name: 'Meeting Notes',
            content: `# {{title || "Meeting Notes"}}

**Date:** {{date}}
**Time:** {{time}}
**Attendees:** {{attendees || "Add attendees here"}}

## Agenda
{{agenda || "Add agenda items here"}}

## Notes
{{cursor}}

## Action Items
- [ ] `,
            category: 'Work',
            tags: ['meeting', 'notes'],
            metadata: { description: 'Template for meeting notes with agenda and action items' }
          },
          {
            id: 'daily-journal',
            name: 'Daily Journal',
            content: `# {{date.long}}

## Morning Reflection
**Mood:** {{mood || "How are you feeling?"}}
**Goals for today:**
- {{goal1 || "What do you want to accomplish?"}}

## Evening Review
**Accomplishments:**
{{cursor}}

**Gratitude:**
- 

**Tomorrow's focus:**
- `,
            category: 'Personal',
            tags: ['journal', 'daily'],
            metadata: { description: 'Daily journal template for reflection and planning' }
          },
          {
            id: 'project-readme',
            name: 'Project README',
            content: `# {{title || "Project Name"}}

## Description
{{description || "Brief description of the project"}}

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
{{cursor}}

## Contributing
Please read CONTRIBUTING.md for details on our code of conduct.

## License
This project is licensed under the MIT License.
`,
            category: 'Documentation', 
            tags: ['readme', 'project'],
            metadata: { description: 'Standard README template for projects' }
          }
        ];

        // Create all demo templates
        for (const template of demoTemplates) {
          await manager.create(template);
        }
        
        console.log(`Initialized ${demoTemplates.length} demo templates`);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to initialize demo templates:', err);
      return false;
    }
  }, [manager]);

  // Load templates on mount
  useEffect(() => {
    const init = async () => {
      await initializeDemoTemplates();
      await loadTemplates();
    };
    init();
  }, [initializeDemoTemplates, loadTemplates]);

  return {
    templates,
    loading,
    error,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    processTemplate,
    getTemplate,
    searchTemplates,
    getCategories,
    getTags,
    getStatistics,
    manager
  };
}

/**
 * Hook for template processing and preview
 */
export function useTemplateProcessor() {
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const manager = useMemo(() => getTemplateManager(), []);

  // Process template with variables
  const process = useCallback(async (templateId, variables = {}, options = {}) => {
    setProcessing(true);
    setError(null);
    
    try {
      // Merge with built-in variables
      const builtins = builtinVariables.resolveAll(options.context || {});
      const allVariables = { ...builtins, ...variables };
      
      const result = await manager.process(templateId, allVariables, options);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [manager]);

  // Preview template processing
  const preview = useCallback(async (templateId, variables = {}, options = {}) => {
    setProcessing(true);
    setError(null);
    
    try {
      // Merge with built-in variables
      const builtins = builtinVariables.resolveAll(options.context || {});
      const allVariables = { ...builtins, ...variables };
      
      const result = await manager.preview(templateId, allVariables);
      setPreviewData(result);
      return result;
    } catch (err) {
      setError(err.message);
      setPreviewData(null);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [manager]);

  // Clear preview
  const clearPreview = useCallback(() => {
    setPreviewData(null);
    setError(null);
  }, []);

  return {
    processing,
    previewData,
    error,
    process,
    preview,
    clearPreview
  };
}

/**
 * Hook for built-in variables
 */
export function useBuiltinVariables() {
  const [variables, setVariables] = useState([]);

  // Load variables
  const loadVariables = useCallback(() => {
    const vars = builtinVariables.list();
    setVariables(vars);
    return vars;
  }, []);

  // Get variables by category
  const getVariablesByCategory = useCallback(() => {
    return builtinVariables.listByCategory();
  }, []);

  // Search variables
  const searchVariables = useCallback((query) => {
    return builtinVariables.search(query);
  }, []);

  // Resolve variable
  const resolveVariable = useCallback((name, context = {}) => {
    return builtinVariables.resolve(name, context);
  }, []);

  // Resolve all variables
  const resolveAll = useCallback((context = {}) => {
    return builtinVariables.resolveAll(context);
  }, []);

  // Load variables on mount
  useEffect(() => {
    loadVariables();
  }, [loadVariables]);

  return {
    variables,
    loadVariables,
    getVariablesByCategory,
    searchVariables,
    resolveVariable,
    resolveAll
  };
}

/**
 * Hook for template validation
 */
export function useTemplateValidation() {
  const manager = useMemo(() => getTemplateManager(), []);

  // Validate template content
  const validate = useCallback((content) => {
    return manager.validate(content);
  }, [manager]);

  // Get template statistics
  const getStatistics = useCallback((content) => {
    return manager.parser.getStatistics(content);
  }, [manager]);

  return {
    validate,
    getStatistics
  };
}

/**
 * Hook for template categories and organization
 */
export function useTemplateOrganization() {
  const { getCategories, getTags, getStatistics } = useTemplates();
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState(null);

  // Load organization data
  const loadData = useCallback(async () => {
    try {
      const [categoriesData, tagsData, statsData] = await Promise.all([
        getCategories(),
        getTags(),
        getStatistics()
      ]);
      
      setCategories(categoriesData);
      setTags(tagsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load organization data:', err);
    }
  }, [getCategories, getTags, getStatistics]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    categories,
    tags,
    stats,
    loadData
  };
}

// Export template manager for direct access if needed
export { getTemplateManager };