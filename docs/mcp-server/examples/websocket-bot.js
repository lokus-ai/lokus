#!/usr/bin/env node

/**
 * WebSocket Chat Bot Example
 * 
 * This example demonstrates how to build a chat bot that connects to Lokus MCP server
 * and can answer questions about your workspace content, create notes, and perform
 * various knowledge management tasks.
 */

const WebSocket = require('ws');
const readline = require('readline');

class LokusBot {
  constructor(mcpUrl, apiKey) {
    this.mcpUrl = mcpUrl;
    this.apiKey = apiKey;
    this.ws = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.isInitialized = false;
    this.context = {
      recentFiles: [],
      currentTopic: null,
      conversationHistory: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.mcpUrl, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      this.ws.on('open', async () => {
        console.log('🤖 Lokus Bot connected to MCP server');
        await this.initialize();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on('error', reject);
    });
  }

  async initialize() {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: { subscribe: true },
        tools: { listChanged: true }
      },
      clientInfo: {
        name: 'Lokus Bot',
        version: '1.0.0',
        description: 'AI assistant for Lokus workspace'
      }
    });

    this.isInitialized = true;
    console.log('✅ Bot initialized with Lokus MCP server');
    
    // Load initial context
    await this.loadWorkspaceContext();
  }

  async loadWorkspaceContext() {
    try {
      // Get recent files
      const resources = await this.sendRequest('resources/list');
      this.context.recentFiles = resources.resources
        .filter(r => r.type === 'file')
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
        .slice(0, 10);

      console.log(`📁 Loaded context: ${this.context.recentFiles.length} recent files`);
    } catch (error) {
      console.error('Failed to load workspace context:', error.message);
    }
  }

  async sendRequest(method, params = {}) {
    const id = this.messageId++;
    const message = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(message));
    });
  }

  handleMessage(message) {
    if ('id' in message) {
      const request = this.pendingRequests.get(message.id);
      if (request) {
        this.pendingRequests.delete(message.id);
        if ('error' in message) {
          request.reject(new Error(message.error.message));
        } else {
          request.resolve(message.result);
        }
      }
    }
  }

  async processUserInput(input) {
    this.context.conversationHistory.push({ role: 'user', content: input });
    
    const intent = this.classifyIntent(input);
    let response;

    try {
      switch (intent.type) {
        case 'search':
          response = await this.handleSearch(intent.query);
          break;
        case 'create_note':
          response = await this.handleCreateNote(intent.title, intent.content);
          break;
        case 'summarize':
          response = await this.handleSummarize(intent.target);
          break;
        case 'list_recent':
          response = await this.handleListRecent();
          break;
        case 'get_info':
          response = await this.handleGetInfo(intent.topic);
          break;
        default:
          response = await this.handleGeneralQuery(input);
      }
    } catch (error) {
      response = `❌ Sorry, I encountered an error: ${error.message}`;
    }

    this.context.conversationHistory.push({ role: 'assistant', content: response });
    return response;
  }

  classifyIntent(input) {
    const lowerInput = input.toLowerCase();

    // Search intent
    if (lowerInput.includes('search') || lowerInput.includes('find')) {
      const query = input.replace(/^(search|find)\s+(for\s+)?/i, '').trim();
      return { type: 'search', query };
    }

    // Create note intent
    if (lowerInput.includes('create') && lowerInput.includes('note')) {
      const match = input.match(/create\s+(?:a\s+)?note\s+(?:about\s+|titled\s+)?"?([^"]+)"?/i);
      const title = match ? match[1] : 'New Note';
      return { type: 'create_note', title, content: null };
    }

    // Summarize intent
    if (lowerInput.includes('summarize') || lowerInput.includes('summary')) {
      const target = input.replace(/^(summarize|summary\s+of)\s+/i, '').trim();
      return { type: 'summarize', target };
    }

    // List recent intent
    if (lowerInput.includes('recent') || lowerInput.includes('latest')) {
      return { type: 'list_recent' };
    }

    // Get info intent
    if (lowerInput.startsWith('what') || lowerInput.startsWith('tell me about')) {
      const topic = input.replace(/^(what\s+is\s+|tell\s+me\s+about\s+)/i, '').trim();
      return { type: 'get_info', topic };
    }

    return { type: 'general', query: input };
  }

  async handleSearch(query) {
    const result = await this.sendRequest('tools/call', {
      name: 'search_files',
      arguments: {
        query,
        includeContent: true
      }
    });

    if (result.isError) {
      return `❌ Search failed: ${result.content[0].text}`;
    }

    const searchResults = this.parseSearchResults(result.content[0].text);
    
    if (searchResults.length === 0) {
      return `🔍 No results found for "${query}". Try a different search term.`;
    }

    let response = `🔍 Found ${searchResults.length} results for "${query}":\n\n`;
    
    searchResults.slice(0, 5).forEach((result, index) => {
      response += `${index + 1}. **${result.name}**\n`;
      response += `   📄 ${result.path}\n`;
      if (result.excerpt) {
        response += `   💬 ${result.excerpt}\n`;
      }
      response += '\n';
    });

    if (searchResults.length > 5) {
      response += `... and ${searchResults.length - 5} more results.`;
    }

    return response;
  }

  async handleCreateNote(title, content = null) {
    const noteContent = content || await this.generateNoteContent(title);
    const fileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
    const timestamp = new Date().toISOString();

    const fullContent = `# ${title}

Created: ${timestamp}
Bot: Lokus Assistant

## Content

${noteContent}

## Tags

#created-by-bot #${title.toLowerCase().replace(/\s+/g, '-')}
`;

    const result = await this.sendRequest('tools/call', {
      name: 'create_file',
      arguments: {
        path: `/workspace/notes/${fileName}`,
        content: fullContent
      }
    });

    if (result.isError) {
      return `❌ Failed to create note: ${result.content[0].text}`;
    }

    // Update context
    this.context.recentFiles.unshift({
      uri: `file:///workspace/notes/${fileName}`,
      name: title,
      type: 'file',
      lastModified: timestamp
    });

    return `✅ Created note "${title}" at /workspace/notes/${fileName}`;
  }

  async generateNoteContent(title) {
    // Try to use a prompt template if available
    try {
      const prompts = await this.sendRequest('prompts/list');
      const contentPrompt = prompts.prompts.find(p => p.name.includes('content') || p.name.includes('note'));
      
      if (contentPrompt) {
        const rendered = await this.sendRequest('prompts/get', {
          name: contentPrompt.name,
          arguments: { topic: title }
        });
        
        return rendered.messages[0].content.text;
      }
    } catch (error) {
      // Fall back to simple template
    }

    return `This note is about ${title}.

Please add your content here.

## Key Points

- Point 1
- Point 2
- Point 3

## References

- Add references here
`;
  }

  async handleSummarize(target) {
    // Try to find the target file/content
    const searchResult = await this.sendRequest('tools/call', {
      name: 'search_files',
      arguments: { query: target, includeContent: true }
    });

    if (searchResult.isError || !searchResult.content[0].text.includes('found')) {
      return `❌ Could not find content to summarize for "${target}"`;
    }

    const files = this.parseSearchResults(searchResult.content[0].text);
    if (files.length === 0) {
      return `❌ No files found to summarize for "${target}"`;
    }

    // Read the first matching file
    const file = files[0];
    const content = await this.sendRequest('resources/read', {
      uri: file.uri || `file://${file.path}`
    });

    const fileContent = content.contents[0].text;
    
    // Generate summary (simplified - in real implementation, you'd use AI)
    const summary = this.generateSummary(fileContent);
    
    return `📄 **Summary of ${file.name}:**

${summary}

*Summary generated by Lokus Bot*`;
  }

  generateSummary(content) {
    // Simple extractive summarization
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keywords = this.extractKeywords(content);
    
    const importantSentences = sentences
      .filter(sentence => {
        const lowerSentence = sentence.toLowerCase();
        return keywords.some(keyword => lowerSentence.includes(keyword.toLowerCase()));
      })
      .slice(0, 3);

    if (importantSentences.length === 0) {
      return "This document contains information that may be relevant to your interests.";
    }

    return importantSentences.join('. ') + '.';
  }

  extractKeywords(content) {
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const frequency = {};
    
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  async handleListRecent() {
    const recentFiles = this.context.recentFiles.slice(0, 10);
    
    if (recentFiles.length === 0) {
      return `📂 No recent files found in your workspace.`;
    }

    let response = `📂 **Recent files in your workspace:**\n\n`;
    
    recentFiles.forEach((file, index) => {
      const date = new Date(file.lastModified).toLocaleDateString();
      response += `${index + 1}. **${file.name}**\n`;
      response += `   📅 Modified: ${date}\n`;
      response += `   📄 ${file.uri}\n\n`;
    });

    return response;
  }

  async handleGetInfo(topic) {
    // Search for information about the topic
    const searchResult = await this.sendRequest('tools/call', {
      name: 'search_files',
      arguments: {
        query: topic,
        includeContent: true
      }
    });

    if (searchResult.isError) {
      return `❌ Could not search for information about "${topic}"`;
    }

    const results = this.parseSearchResults(searchResult.content[0].text);
    
    if (results.length === 0) {
      return `🤔 I don't have any information about "${topic}" in your workspace. Would you like me to create a note about it?`;
    }

    let response = `💡 **Information about "${topic}":**\n\n`;
    
    // Get content from the most relevant file
    try {
      const topResult = results[0];
      const content = await this.sendRequest('resources/read', {
        uri: topResult.uri || `file://${topResult.path}`
      });

      const fileContent = content.contents[0].text;
      const relevantSection = this.extractRelevantSection(fileContent, topic);
      
      response += `From **${topResult.name}**:\n\n`;
      response += relevantSection;
      
      if (results.length > 1) {
        response += `\n\n📚 I found information in ${results.length} files. Would you like me to check the others too?`;
      }
      
    } catch (error) {
      response += `Found references in ${results.length} files, but couldn't read the content.`;
    }

    return response;
  }

  extractRelevantSection(content, topic) {
    const lines = content.split('\n');
    const topicRegex = new RegExp(topic, 'gi');
    
    // Find lines that mention the topic
    const relevantLines = [];
    let context = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (topicRegex.test(line)) {
        // Include context around the match
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        context = lines.slice(start, end);
        relevantLines.push(...context);
        break; // Take first match for now
      }
    }

    if (relevantLines.length === 0) {
      return content.substring(0, 300) + '...';
    }

    return relevantLines.join('\n').substring(0, 500) + '...';
  }

  async handleGeneralQuery(input) {
    // For general queries, try to search and provide helpful suggestions
    const keywords = this.extractKeywords(input);
    
    if (keywords.length > 0) {
      const searchQuery = keywords.slice(0, 3).join(' ');
      
      try {
        const searchResult = await this.sendRequest('tools/call', {
          name: 'search_files',
          arguments: { query: searchQuery }
        });

        if (!searchResult.isError) {
          const results = this.parseSearchResults(searchResult.content[0].text);
          
          if (results.length > 0) {
            return `🤔 I found some potentially relevant files:\n\n${results.slice(0, 3).map((r, i) => `${i + 1}. ${r.name}`).join('\n')}\n\nWould you like me to search for something specific or tell you more about any of these files?`;
          }
        }
      } catch (error) {
        // Fall through to default response
      }
    }

    return `🤖 I'm here to help you with your Lokus workspace! I can:

• 🔍 **Search** your files: "search for project notes"
• 📝 **Create notes**: "create a note about meeting ideas"  
• 📋 **Summarize** content: "summarize my project plan"
• 📂 **List recent** files: "show me recent files"
• 💡 **Get information**: "what is project alpha?"

What would you like me to help you with?`;
  }

  parseSearchResults(searchText) {
    // Parse search tool output into structured results
    const lines = searchText.split('\n').filter(line => line.trim());
    const results = [];

    for (const line of lines) {
      if (line.includes('/workspace/') || line.includes('file://')) {
        const pathMatch = line.match(/([^\/\s]+\.(md|txt|json|yaml|js|py|html|css))/i);
        if (pathMatch) {
          results.push({
            name: pathMatch[1],
            path: line.trim(),
            uri: line.includes('file://') ? line.trim() : `file://${line.trim()}`
          });
        }
      }
    }

    return results;
  }

  startInteractiveSession() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '💬 You: '
    });

    console.log(`
🤖 **Lokus Bot is ready!**

I'm connected to your Lokus workspace and ready to help. Here are some things I can do:

• Search your files and content
• Create new notes and documents  
• Summarize existing content
• Answer questions about your workspace
• Show recent files and changes

Type 'help' for more commands or 'quit' to exit.
`);

    rl.prompt();

    rl.on('line', async (input) => {
      const trimmedInput = input.trim();
      
      if (trimmedInput === 'quit' || trimmedInput === 'exit') {
        console.log('👋 Goodbye!');
        rl.close();
        this.ws.close();
        return;
      }

      if (trimmedInput === 'help') {
        console.log(`
🤖 **Lokus Bot Commands:**

**Search & Discovery:**
• "search for [topic]" - Search your workspace
• "find files about [topic]" - Find relevant files
• "what is [topic]?" - Get information about a topic
• "recent files" - Show recently modified files

**Content Creation:**
• "create a note about [topic]" - Create a new note
• "create note titled [title]" - Create note with specific title

**Content Analysis:**
• "summarize [filename/topic]" - Summarize content
• "tell me about [topic]" - Get topic overview

**Workspace Management:**
• "recent" or "latest" - Show recent files
• "help" - Show this help message
• "quit" or "exit" - Exit the bot

Just type naturally and I'll try to understand what you want!
`);
        rl.prompt();
        return;
      }

      if (trimmedInput === '') {
        rl.prompt();
        return;
      }

      try {
        console.log('\n🤖 Lokus Bot: Processing your request...\n');
        const response = await this.processUserInput(trimmedInput);
        console.log(`🤖 Lokus Bot: ${response}\n`);
      } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\n👋 Session ended. Goodbye!');
      process.exit(0);
    });
  }
}

// Main execution
async function main() {
  const mcpUrl = process.env.LOKUS_MCP_URL || 'ws://localhost:3001/mcp';
  const apiKey = process.env.LOKUS_API_KEY;

  if (!apiKey) {
    console.error('❌ Please set LOKUS_API_KEY environment variable');
    process.exit(1);
  }

  const bot = new LokusBot(mcpUrl, apiKey);

  try {
    await bot.connect();
    bot.startInteractiveSession();
  } catch (error) {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LokusBot;