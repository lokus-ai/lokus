/**
 * Example MCP Plugin for Lokus
 * 
 * This plugin demonstrates how to create an MCP (Model Context Protocol) 
 * plugin that can interact with AI assistants and provide resources, tools, 
 * and prompts for enhanced AI capabilities.
 */

import { MCPResourceBuilder, MCPToolBuilder, MCPPromptBuilder } from '@lokus/plugin-api'

export class ExampleMCPPlugin {
  constructor() {
    this.name = 'Example MCP Plugin'
    this.resources = new Map()
    this.tools = new Map()
    this.prompts = new Map()
  }

  /**
   * Plugin activation - sets up MCP server capabilities
   * @param {MCPPluginAPI} mcpAPI - The MCP plugin API
   */
  async activate(mcpAPI) {
    console.log(`${this.name} activated!`)
    
    // Setup resources, tools, and prompts
    await this.setupResources(mcpAPI)
    await this.setupTools(mcpAPI)
    await this.setupPrompts(mcpAPI)
    
    console.log('MCP server ready with:', {
      resources: this.resources.size,
      tools: this.tools.size,
      prompts: this.prompts.size
    })
  }

  /**
   * Plugin deactivation - cleanup MCP resources
   * @param {MCPPluginAPI} mcpAPI - The MCP plugin API
   */
  async deactivate(mcpAPI) {
    this.resources.clear()
    this.tools.clear()
    this.prompts.clear()
    console.log(`${this.name} deactivated!`)
  }

  /**
   * Setup MCP resources - data sources for AI assistants
   * @param {MCPPluginAPI} mcpAPI - The MCP plugin API
   */
  async setupResources(mcpAPI) {
    // Example 1: File system resource
    const filesResource = new MCPResourceBuilder()
      .setUri('file:///workspace/files')
      .setName('Workspace Files')
      .setDescription('Access to workspace files and documents')
      .setType('file')
      .setMimeType('text/plain')
      .addAnnotation('audience', ['user', 'assistant'])
      .addAnnotation('scope', 'workspace')
      .build()
    
    this.resources.set('workspace-files', filesResource)
    mcpAPI.server?.registerResource(filesResource)

    // Example 2: Project information resource
    const projectResource = new MCPResourceBuilder()
      .setUri('lokus://project/info')
      .setName('Project Information')
      .setDescription('Current project structure and metadata')
      .setType('structured')
      .setMimeType('application/json')
      .addAnnotation('live', 'true')
      .addAnnotation('updateFrequency', 'on-change')
      .build()
    
    this.resources.set('project-info', projectResource)
    mcpAPI.server?.registerResource(projectResource)

    // Example 3: Code snippets resource
    const snippetsResource = new MCPResourceBuilder()
      .setUri('lokus://snippets')
      .setName('Code Snippets')
      .setDescription('Collection of reusable code snippets')
      .setType('collection')
      .setMimeType('text/x-code')
      .addAnnotation('category', 'development')
      .addAnnotation('searchable', 'true')
      .build()
    
    this.resources.set('snippets', snippetsResource)
    mcpAPI.server?.registerResource(snippetsResource)
  }

  /**
   * Setup MCP tools - functions AI assistants can call
   * @param {MCPPluginAPI} mcpAPI - The MCP plugin API
   */
  async setupTools(mcpAPI) {
    // Example 1: Code formatter tool
    const formatCodeTool = new MCPToolBuilder()
      .setName('format_code')
      .setDescription('Format code using various language formatters')
      .setInputSchema({
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The code to format'
          },
          language: {
            type: 'string',
            description: 'Programming language (js, ts, py, etc.)',
            enum: ['javascript', 'typescript', 'python', 'rust', 'go']
          },
          options: {
            type: 'object',
            description: 'Formatting options',
            properties: {
              tabSize: { type: 'number', default: 2 },
              useTabs: { type: 'boolean', default: false },
              semicolons: { type: 'boolean', default: true }
            }
          }
        },
        required: ['code', 'language']
      })
      .setExecutor(async (args) => {
        return await this.formatCode(args.code, args.language, args.options || {})
      })
      .build()
    
    this.tools.set('format_code', formatCodeTool)
    mcpAPI.server?.registerTool(formatCodeTool)

    // Example 2: File search tool
    const searchFilesTool = new MCPToolBuilder()
      .setName('search_files')
      .setDescription('Search for files in the workspace')
      .setInputSchema({
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (filename or content)'
          },
          fileType: {
            type: 'string',
            description: 'File extension filter (e.g., .js, .py)',
            pattern: '^\\.[a-zA-Z0-9]+$'
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results',
            minimum: 1,
            maximum: 100,
            default: 10
          }
        },
        required: ['query']
      })
      .setExecutor(async (args) => {
        return await this.searchFiles(args.query, args.fileType, args.maxResults || 10)
      })
      .build()
    
    this.tools.set('search_files', searchFilesTool)
    mcpAPI.server?.registerTool(searchFilesTool)

    // Example 3: Generate documentation tool
    const generateDocsTool = new MCPToolBuilder()
      .setName('generate_docs')
      .setDescription('Generate documentation for code functions')
      .setInputSchema({
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code to document'
          },
          style: {
            type: 'string',
            description: 'Documentation style',
            enum: ['jsdoc', 'pydoc', 'rustdoc', 'godoc'],
            default: 'jsdoc'
          },
          includeExamples: {
            type: 'boolean',
            description: 'Include usage examples',
            default: true
          }
        },
        required: ['code']
      })
      .setExecutor(async (args) => {
        return await this.generateDocumentation(
          args.code, 
          args.style || 'jsdoc', 
          args.includeExamples !== false
        )
      })
      .build()
    
    this.tools.set('generate_docs', generateDocsTool)
    mcpAPI.server?.registerTool(generateDocsTool)
  }

  /**
   * Setup MCP prompts - reusable prompt templates
   * @param {MCPPluginAPI} mcpAPI - The MCP plugin API
   */
  async setupPrompts(mcpAPI) {
    // Example 1: Code review prompt
    const codeReviewPrompt = new MCPPromptBuilder()
      .setName('code_review')
      .setDescription('Perform a comprehensive code review')
      .setArguments([
        { name: 'code', description: 'Code to review', required: true },
        { name: 'language', description: 'Programming language', required: true },
        { name: 'focus', description: 'Review focus area', required: false }
      ])
      .setTemplate(`
        Please perform a comprehensive code review of the following {{language}} code:

        \`\`\`{{language}}
        {{code}}
        \`\`\`

        {{#if focus}}
        Please focus specifically on: {{focus}}
        {{/if}}

        Review criteria:
        - Code quality and readability
        - Performance considerations
        - Security vulnerabilities
        - Best practices adherence
        - Potential bugs or edge cases
        - Testing suggestions

        Provide specific, actionable feedback with examples where appropriate.
      `)
      .build()
    
    this.prompts.set('code_review', codeReviewPrompt)
    mcpAPI.server?.registerPrompt(codeReviewPrompt)

    // Example 2: Bug fixing prompt
    const bugFixPrompt = new MCPPromptBuilder()
      .setName('fix_bug')
      .setDescription('Help fix a bug in code')
      .setArguments([
        { name: 'code', description: 'Buggy code', required: true },
        { name: 'error', description: 'Error message or description', required: true },
        { name: 'context', description: 'Additional context', required: false }
      ])
      .setTemplate(`
        I need help fixing a bug in this code:

        \`\`\`
        {{code}}
        \`\`\`

        Error/Issue: {{error}}

        {{#if context}}
        Additional context: {{context}}
        {{/if}}

        Please:
        1. Identify the root cause of the issue
        2. Provide a corrected version of the code
        3. Explain what was wrong and why your fix works
        4. Suggest ways to prevent similar issues in the future
      `)
      .build()
    
    this.prompts.set('fix_bug', bugFixPrompt)
    mcpAPI.server?.registerPrompt(bugFixPrompt)

    // Example 3: API documentation prompt
    const apiDocsPrompt = new MCPPromptBuilder()
      .setName('api_docs')
      .setDescription('Generate API documentation')
      .setArguments([
        { name: 'apiCode', description: 'API code to document', required: true },
        { name: 'format', description: 'Documentation format', required: false }
      ])
      .setTemplate(`
        Generate comprehensive API documentation for:

        \`\`\`
        {{apiCode}}
        \`\`\`

        {{#if format}}
        Format: {{format}}
        {{else}}
        Format: Markdown with OpenAPI-style descriptions
        {{/if}}

        Include:
        - Endpoint descriptions
        - Parameters and their types
        - Request/response examples
        - Error codes and messages
        - Authentication requirements
        - Rate limiting information
      `)
      .build()
    
    this.prompts.set('api_docs', apiDocsPrompt)
    mcpAPI.server?.registerPrompt(apiDocsPrompt)
  }

  /**
   * Format code using language-specific formatters
   * @param {string} code - Code to format
   * @param {string} language - Programming language
   * @param {object} options - Formatting options
   * @returns {object} Formatted code result
   */
  async formatCode(code, language, options) {
    try {
      // Simulate code formatting (in a real plugin, you'd use actual formatters)
      const formatted = this.simulateCodeFormatting(code, language, options)
      
      return {
        success: true,
        formatted_code: formatted,
        language: language,
        options_used: options,
        changes_made: ['indentation', 'spacing', 'line_breaks']
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        original_code: code
      }
    }
  }

  /**
   * Search for files in the workspace
   * @param {string} query - Search query
   * @param {string} fileType - File extension filter
   * @param {number} maxResults - Maximum results
   * @returns {object} Search results
   */
  async searchFiles(query, fileType, maxResults) {
    try {
      // Simulate file search (in a real plugin, you'd use actual file system)
      const results = this.simulateFileSearch(query, fileType, maxResults)
      
      return {
        success: true,
        query: query,
        fileType: fileType,
        totalResults: results.length,
        results: results
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        query: query
      }
    }
  }

  /**
   * Generate documentation for code
   * @param {string} code - Code to document
   * @param {string} style - Documentation style
   * @param {boolean} includeExamples - Include examples
   * @returns {object} Generated documentation
   */
  async generateDocumentation(code, style, includeExamples) {
    try {
      // Simulate documentation generation
      const docs = this.simulateDocGeneration(code, style, includeExamples)
      
      return {
        success: true,
        documentation: docs,
        style: style,
        includesExamples: includeExamples,
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: code
      }
    }
  }

  // Simulation methods (replace with real implementations)
  simulateCodeFormatting(code, language, options) {
    // Simple simulation - just add proper indentation
    return code.split('\n').map(line => {
      const trimmed = line.trim()
      if (trimmed.length === 0) return ''
      return '  '.repeat(options.tabSize || 2) + trimmed
    }).join('\n')
  }

  simulateFileSearch(query, fileType, maxResults) {
    // Simulate search results
    const mockFiles = [
      { path: '/src/components/App.jsx', size: 1024, modified: '2023-12-01T10:00:00Z' },
      { path: '/src/utils/helpers.js', size: 512, modified: '2023-12-01T09:30:00Z' },
      { path: '/tests/App.test.js', size: 256, modified: '2023-12-01T08:00:00Z' }
    ]
    
    return mockFiles
      .filter(file => 
        file.path.toLowerCase().includes(query.toLowerCase()) &&
        (!fileType || file.path.endsWith(fileType))
      )
      .slice(0, maxResults)
  }

  simulateDocGeneration(code, style, includeExamples) {
    return `/**
 * Generated ${style} documentation
 * 
 * This function performs the main operation described in the code.
 * 
 * @param {any} input - The input parameter
 * @returns {any} The processed result
 * 
 * ${includeExamples ? '@example\n * const result = myFunction(input)\n * console.log(result)' : ''}
 */`
  }
}

// Export the plugin class
export default ExampleMCPPlugin