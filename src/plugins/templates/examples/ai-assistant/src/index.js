/**
 * Smart Writing Assistant Plugin
 * 
 * AI-powered writing assistant with chat interface, prompt templates,
 * and intelligent text processing capabilities.
 */

import { BasePlugin } from '@lokus/plugin-core'
import { MCPResourceBuilder, MCPToolBuilder, MCPPromptBuilder } from '@lokus/mcp'
import { WritingAssistant } from './WritingAssistant.js'
import { ChatInterface } from './ChatInterface.js'
import { PromptLibrary } from './PromptLibrary.js'

export class SmartWritingAssistantPlugin extends BasePlugin {
  constructor() {
    super()
    this.assistant = null
    this.chatInterface = null
    this.promptLibrary = null
    this.mcpAPI = null
    this.settings = {
      apiProvider: 'openai',
      apiKey: null,
      model: 'gpt-3.5-turbo',
      maxTokens: 2000,
      temperature: 0.7,
      autoSave: true
    }
  }

  /**
   * Plugin activation
   */
  async activate() {
    await super.activate()
    
    try {
      // Load settings
      await this.loadSettings()
      
      // Get MCP API
      this.mcpAPI = this.api.getMCPAPI()
      if (!this.mcpAPI) {
        throw new Error('MCP API not available')
      }

      // Initialize components
      await this.initializeComponents()

      // Register MCP resources, tools, and prompts
      await this.registerMCPComponents()

      // Register commands and UI
      this.registerCommands()
      this.registerUI()

      this.logger.info('Smart Writing Assistant Plugin activated successfully')
      
    } catch (error) {
      this.logger.error('Failed to activate Smart Writing Assistant Plugin:', error)
      throw error
    }
  }

  /**
   * Load plugin settings
   */
  async loadSettings() {
    const savedSettings = await this.api.getSettings()
    this.settings = {
      ...this.settings,
      ...savedSettings,
      apiKey: await this.api.getSecureValue('apiKey') // Load from secure storage
    }
  }

  /**
   * Initialize plugin components
   */
  async initializeComponents() {
    // Initialize writing assistant
    this.assistant = new WritingAssistant(this.settings)
    await this.assistant.initialize()

    // Initialize chat interface
    this.chatInterface = new ChatInterface(this.assistant, this.api)
    await this.chatInterface.initialize()

    // Initialize prompt library
    this.promptLibrary = new PromptLibrary()
    await this.promptLibrary.loadDefaults()
  }

  /**
   * Register MCP components
   */
  async registerMCPComponents() {
    await this.registerResources()
    await this.registerTools()
    await this.registerPrompts()
  }

  /**
   * Register MCP resources
   */
  async registerResources() {
    // Writing templates resource
    const templatesResource = new MCPResourceBuilder()
      .setUri('ai://templates')
      .setName('Writing Templates')
      .setDescription('Collection of writing templates and prompts')
      .setType('template')
      .setMimeType('text/plain')
      .setContent(JSON.stringify(this.promptLibrary.getTemplates()))
      .setMetadata({
        count: this.promptLibrary.getTemplateCount(),
        categories: this.promptLibrary.getCategories(),
        searchable: true
      })
      .build()

    this.mcpAPI.registerResource(templatesResource)

    // Chat history resource
    const chatHistoryResource = new MCPResourceBuilder()
      .setUri('ai://chat/history')
      .setName('Chat History')
      .setDescription('AI chat conversation history')
      .setType('conversation')
      .setMimeType('application/json')
      .setContent(JSON.stringify(this.chatInterface.getHistory()))
      .setMetadata({
        conversationCount: this.chatInterface.getConversationCount(),
        totalMessages: this.chatInterface.getTotalMessages(),
        searchable: true
      })
      .build()

    this.mcpAPI.registerResource(chatHistoryResource)
  }

  /**
   * Register MCP tools
   */
  async registerTools() {
    // Rewrite text tool
    const rewriteTool = new MCPToolBuilder()
      .setName('rewrite_text')
      .setDescription('Rewrite text with specified style and improvements')
      .setInputSchema({
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to rewrite'
          },
          style: {
            type: 'string',
            enum: ['casual', 'formal', 'academic', 'creative', 'technical', 'conversational'],
            description: 'Writing style to apply',
            default: 'casual'
          },
          improvements: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific improvements to focus on',
            default: ['clarity', 'conciseness']
          },
          tone: {
            type: 'string',
            enum: ['professional', 'friendly', 'enthusiastic', 'neutral', 'empathetic'],
            description: 'Tone of the rewritten text',
            default: 'neutral'
          }
        },
        required: ['text']
      })
      .setExecutor(async (args) => {
        return await this.assistant.rewriteText(
          args.text,
          args.style,
          args.improvements,
          args.tone
        )
      })
      .build()

    this.mcpAPI.registerTool(rewriteTool)

    // Summarize text tool
    const summarizeTool = new MCPToolBuilder()
      .setName('summarize_text')
      .setDescription('Create a summary of the provided text')
      .setInputSchema({
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to summarize'
          },
          length: {
            type: 'string',
            enum: ['short', 'medium', 'long'],
            description: 'Length of the summary',
            default: 'medium'
          },
          format: {
            type: 'string',
            enum: ['paragraph', 'bullets', 'outline', 'key-points'],
            description: 'Format of the summary',
            default: 'paragraph'
          },
          focus: {
            type: 'string',
            description: 'Specific aspect to focus on in the summary'
          }
        },
        required: ['text']
      })
      .setExecutor(async (args) => {
        return await this.assistant.summarizeText(
          args.text,
          args.length,
          args.format,
          args.focus
        )
      })
      .build()

    this.mcpAPI.registerTool(summarizeTool)

    // Expand ideas tool
    const expandTool = new MCPToolBuilder()
      .setName('expand_ideas')
      .setDescription('Expand and elaborate on ideas or concepts')
      .setInputSchema({
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic or idea to expand'
          },
          context: {
            type: 'string',
            description: 'Additional context for the expansion'
          },
          depth: {
            type: 'string',
            enum: ['basic', 'detailed', 'comprehensive'],
            description: 'Depth of expansion',
            default: 'detailed'
          },
          audience: {
            type: 'string',
            description: 'Target audience for the expanded content'
          },
          format: {
            type: 'string',
            enum: ['prose', 'outline', 'bullet-points', 'structured'],
            description: 'Format for the expanded content',
            default: 'prose'
          }
        },
        required: ['topic']
      })
      .setExecutor(async (args) => {
        return await this.assistant.expandIdeas(
          args.topic,
          args.context,
          args.depth,
          args.audience,
          args.format
        )
      })
      .build()

    this.mcpAPI.registerTool(expandTool)

    // Grammar check tool
    const grammarTool = new MCPToolBuilder()
      .setName('check_grammar')
      .setDescription('Check and correct grammar in text')
      .setInputSchema({
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to check for grammar issues'
          },
          language: {
            type: 'string',
            description: 'Language of the text',
            default: 'en'
          },
          suggestions: {
            type: 'boolean',
            description: 'Include improvement suggestions',
            default: true
          },
          strictness: {
            type: 'string',
            enum: ['relaxed', 'standard', 'strict'],
            description: 'Grammar checking strictness',
            default: 'standard'
          }
        },
        required: ['text']
      })
      .setExecutor(async (args) => {
        return await this.assistant.checkGrammar(
          args.text,
          args.language,
          args.suggestions,
          args.strictness
        )
      })
      .build()

    this.mcpAPI.registerTool(grammarTool)
  }

  /**
   * Register MCP prompts
   */
  async registerPrompts() {
    // Writing coach prompt
    const coachPrompt = new MCPPromptBuilder()
      .setName('writing_coach')
      .setDescription('Get writing advice and feedback from an AI coach')
      .setTemplate(`As an experienced writing coach, please review the following text and provide constructive feedback:

TEXT TO REVIEW:
{{text}}

FOCUS AREAS: {{focus_areas}}

Please provide:
1. Overall assessment
2. Specific strengths
3. Areas for improvement
4. Actionable suggestions
5. Examples of better phrasing (if applicable)

Keep your feedback encouraging and constructive.`)
      .setArguments([
        {
          name: 'text',
          description: 'Text to review',
          required: true,
          type: 'string'
        },
        {
          name: 'focus_areas',
          description: 'Specific areas to focus feedback on',
          required: false,
          type: 'string',
          default: 'clarity, structure, engagement, flow'
        }
      ])
      .build()

    this.mcpAPI.registerPrompt(coachPrompt)

    // Brainstorming prompt
    const brainstormPrompt = new MCPPromptBuilder()
      .setName('brainstorm')
      .setDescription('Generate creative ideas and brainstorming assistance')
      .setTemplate(`Help me brainstorm ideas for: {{topic}}

{{#if context}}
CONTEXT: {{context}}
{{/if}}

{{#if audience}}
TARGET AUDIENCE: {{audience}}
{{/if}}

{{#if goal}}
GOAL: {{goal}}
{{/if}}

Please provide:
1. 10-15 creative ideas
2. Different angles and perspectives
3. Potential subtopics or themes
4. Questions to explore further
5. Unexpected connections or approaches

Be creative and think outside the box!`)
      .setArguments([
        {
          name: 'topic',
          description: 'Topic to brainstorm about',
          required: true,
          type: 'string'
        },
        {
          name: 'context',
          description: 'Additional context',
          required: false,
          type: 'string'
        },
        {
          name: 'audience',
          description: 'Target audience',
          required: false,
          type: 'string'
        },
        {
          name: 'goal',
          description: 'Goal or objective',
          required: false,
          type: 'string'
        }
      ])
      .build()

    this.mcpAPI.registerPrompt(brainstormPrompt)

    // Content outline prompt
    const outlinePrompt = new MCPPromptBuilder()
      .setName('content_outline')
      .setDescription('Create structured outlines for content')
      .setTemplate(`Create a detailed outline for: {{title}}

CONTENT TYPE: {{content_type}}
{{#if target_length}}
TARGET LENGTH: {{target_length}}
{{/if}}
{{#if audience}}
AUDIENCE: {{audience}}
{{/if}}
{{#if key_points}}
KEY POINTS TO COVER: {{key_points}}
{{/if}}

Please provide:
1. A clear, hierarchical outline
2. Main sections and subsections
3. Key points for each section
4. Suggested content flow
5. Potential hooks and transitions
6. Estimated word counts per section

Make the outline detailed enough to guide the writing process.`)
      .setArguments([
        {
          name: 'title',
          description: 'Title or topic for the content',
          required: true,
          type: 'string'
        },
        {
          name: 'content_type',
          description: 'Type of content (article, blog post, essay, etc.)',
          required: false,
          type: 'string',
          default: 'article'
        },
        {
          name: 'target_length',
          description: 'Target length or word count',
          required: false,
          type: 'string'
        },
        {
          name: 'audience',
          description: 'Target audience',
          required: false,
          type: 'string'
        },
        {
          name: 'key_points',
          description: 'Specific points to cover',
          required: false,
          type: 'string'
        }
      ])
      .build()

    this.mcpAPI.registerPrompt(outlinePrompt)
  }

  /**
   * Register plugin commands
   */
  registerCommands() {
    // Start AI chat
    this.registerCommand({
      name: 'ai.chat',
      description: 'Start AI chat conversation',
      action: async () => {
        this.chatInterface.openChatPanel()
      }
    })

    // AI writing help
    this.registerCommand({
      name: 'ai.help',
      description: 'Get AI writing help for current selection or document',
      action: async () => {
        const selection = this.api.getSelection()
        const text = selection || this.api.getEditorContent()
        
        if (!text.trim()) {
          this.showNotification('No text selected or available', 'warning')
          return
        }

        const help = await this.assistant.getWritingHelp(text)
        this.chatInterface.showHelpResult(help)
      }
    })

    // Rewrite selection
    this.registerCommand({
      name: 'ai.rewrite',
      description: 'Rewrite selected text',
      action: async () => {
        const selection = this.api.getSelection()
        
        if (!selection) {
          this.showNotification('Please select text to rewrite', 'warning')
          return
        }

        const options = await this.showRewriteOptionsDialog()
        if (!options) return

        const result = await this.assistant.rewriteText(
          selection,
          options.style,
          options.improvements,
          options.tone
        )

        if (result.success) {
          this.api.replaceSelection(result.rewrittenText)
          this.showNotification('Text rewritten successfully', 'success')
        } else {
          this.showNotification(`Rewrite failed: ${result.error}`, 'error')
        }
      }
    })

    // Summarize text
    this.registerCommand({
      name: 'ai.summarize',
      description: 'Summarize selected text',
      action: async () => {
        const selection = this.api.getSelection()
        
        if (!selection) {
          this.showNotification('Please select text to summarize', 'warning')
          return
        }

        const result = await this.assistant.summarizeText(selection, 'medium', 'paragraph')
        
        if (result.success) {
          this.chatInterface.showSummaryResult(result)
        } else {
          this.showNotification(`Summarization failed: ${result.error}`, 'error')
        }
      }
    })

    // Expand ideas
    this.registerCommand({
      name: 'ai.expand',
      description: 'Expand selected ideas or topic',
      action: async () => {
        const selection = this.api.getSelection()
        
        if (!selection) {
          this.showNotification('Please select text to expand', 'warning')
          return
        }

        const result = await this.assistant.expandIdeas(selection, '', 'detailed')
        
        if (result.success) {
          this.chatInterface.showExpansionResult(result)
        } else {
          this.showNotification(`Expansion failed: ${result.error}`, 'error')
        }
      }
    })
  }

  /**
   * Register UI components
   */
  registerUI() {
    // Register chat panel
    this.registerPanel({
      id: 'ai-chat',
      title: 'AI Chat',
      icon: 'chat',
      component: this.chatInterface.getChatComponent(),
      position: 'right',
      defaultSize: 400
    })

    // Register writing assistant toolbar
    this.registerToolbarButton({
      id: 'ai-assistant',
      icon: 'ai',
      tooltip: 'AI Writing Assistant',
      command: 'ai.chat'
    })
  }

  /**
   * Show rewrite options dialog
   */
  async showRewriteOptionsDialog() {
    return await this.showDialog({
      title: 'Rewrite Options',
      type: 'form',
      fields: [
        {
          name: 'style',
          label: 'Writing Style',
          type: 'select',
          options: [
            { value: 'casual', label: 'Casual' },
            { value: 'formal', label: 'Formal' },
            { value: 'academic', label: 'Academic' },
            { value: 'creative', label: 'Creative' },
            { value: 'technical', label: 'Technical' }
          ],
          default: 'casual'
        },
        {
          name: 'tone',
          label: 'Tone',
          type: 'select',
          options: [
            { value: 'professional', label: 'Professional' },
            { value: 'friendly', label: 'Friendly' },
            { value: 'enthusiastic', label: 'Enthusiastic' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'empathetic', label: 'Empathetic' }
          ],
          default: 'neutral'
        },
        {
          name: 'improvements',
          label: 'Focus Areas',
          type: 'checkbox',
          options: [
            { value: 'clarity', label: 'Clarity' },
            { value: 'conciseness', label: 'Conciseness' },
            { value: 'flow', label: 'Flow' },
            { value: 'engagement', label: 'Engagement' },
            { value: 'grammar', label: 'Grammar' }
          ],
          default: ['clarity', 'conciseness']
        }
      ]
    })
  }

  /**
   * Plugin deactivation
   */
  async deactivate() {
    if (this.chatInterface) {
      await this.chatInterface.shutdown()
      this.chatInterface = null
    }

    if (this.assistant) {
      await this.assistant.shutdown()
      this.assistant = null
    }

    this.mcpAPI = null
    await super.deactivate()
    
    this.logger.info('Smart Writing Assistant Plugin deactivated')
  }

  /**
   * Get plugin status
   */
  getPluginStatus() {
    return {
      ...super.getStatus(),
      assistant: this.assistant?.getStatus() || null,
      chatInterface: this.chatInterface?.getStatus() || null,
      mcpAPI: this.mcpAPI ? 'available' : 'unavailable',
      settings: {
        apiProvider: this.settings.apiProvider,
        model: this.settings.model,
        hasApiKey: !!this.settings.apiKey
      }
    }
  }
}

export default SmartWritingAssistantPlugin