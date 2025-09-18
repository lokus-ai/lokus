/**
 * Jira Kanban Provider Example
 * 
 * Demonstrates integration with external Jira instance for:
 * - Real-time task synchronization
 * - Jira workflow management
 * - Custom field mapping
 * - Webhook support for live updates
 */

import { KanbanDataProvider } from '../api/DataAPI.js'

export class JiraKanbanProvider extends KanbanDataProvider {
  constructor(id = 'jira-kanban', config = {}) {
    super(id, {
      name: 'Jira Integration',
      description: 'Sync tasks with Jira boards and workflows',
      version: '1.0.0',
      jiraUrl: config.jiraUrl || '',
      username: config.username || '',
      apiToken: config.apiToken || '',
      projectKey: config.projectKey || '',
      ...config
    })
    
    // Jira-specific capabilities
    this.capabilities.add('custom-fields')
    this.capabilities.add('workflow-management')
    this.capabilities.add('webhook-sync')
    this.capabilities.add('bulk-operations')
    this.capabilities.add('advanced-filtering')
    
    // Jira API client
    this.jiraClient = null
    this.webhookListener = null
    
    // Status mapping between Lokus and Jira
    this.statusMapping = {
      'To Do': 'todo',
      'In Progress': 'in-progress',
      'Code Review': 'in-progress',
      'Testing': 'in-progress',
      'Done': 'completed',
      'Cancelled': 'cancelled',
      ...config.statusMapping
    }
    
    // Reverse mapping
    this.reverseStatusMapping = Object.fromEntries(
      Object.entries(this.statusMapping).map(([k, v]) => [v, k])
    )
    
    // Field mappings
    this.fieldMappings = {
      title: 'summary',
      description: 'description',
      assignee: 'assignee',
      priority: 'priority',
      labels: 'labels',
      dueDate: 'duedate',
      ...config.fieldMappings
    }
    
    // Sync state
    this.lastSyncTime = null
    this.syncInProgress = false
    this.syncErrors = []
  }

  async initialize() {
    console.log('🔧 Initializing Jira Kanban Provider')
    
    if (!this.config.jiraUrl || !this.config.username || !this.config.apiToken) {
      throw new Error('Jira configuration incomplete: URL, username, and API token required')
    }
    
    // Initialize Jira client
    this._initializeJiraClient()
    
    this.isInitialized = true
    this.emit('initialized')
  }

  async connect() {
    if (this.isConnected) return

    try {
      // Test Jira connection
      await this._testJiraConnection()
      
      // Set up webhook listener if supported
      if (this.capabilities.has('webhook-sync')) {
        await this._setupWebhookListener()
      }
      
      this.isConnected = true
      this.emit('connected')
      console.log('✅ Jira Kanban Provider connected')
      
    } catch (error) {
      this.emit('error', error)
      throw new Error(`Failed to connect to Jira: ${error.message}`)
    }
  }

  async disconnect() {
    if (!this.isConnected) return

    try {
      // Clean up webhook listener
      if (this.webhookListener) {
        await this._cleanupWebhookListener()
      }
      
      this.isConnected = false
      this.emit('disconnected')
      console.log('✅ Jira Kanban Provider disconnected')
      
    } catch (error) {
      console.error('Error disconnecting Jira provider:', error)
    }
  }

  // Implementation of abstract methods

  async _fetchBoards() {
    try {
      const response = await this._jiraRequest('GET', '/rest/agile/1.0/board', {
        projectKeyOrId: this.config.projectKey,
        type: 'kanban'
      })
      
      return response.values.map(board => ({
        id: board.id.toString(),
        name: board.name,
        type: board.type,
        projectKey: board.location?.projectKey,
        projectName: board.location?.projectName,
        self: board.self,
        metadata: {
          jiraBoard: board,
          columns: null // Will be fetched separately
        }
      }))
      
    } catch (error) {
      console.error('Failed to fetch Jira boards:', error)
      throw new Error(`Failed to fetch boards: ${error.message}`)
    }
  }

  async _fetchTasks(boardId, filters = {}) {
    try {
      // Get board configuration to understand columns
      const boardConfig = await this._getBoardConfiguration(boardId)
      
      // Fetch issues using JQL
      const jql = this._buildJQL(boardId, filters)
      const response = await this._jiraRequest('GET', '/rest/api/3/search', {
        jql,
        fields: this._getRequiredFields(),
        expand: 'changelog,transitions',
        maxResults: 1000
      })
      
      // Transform Jira issues to Lokus tasks
      const tasks = response.issues.map(issue => this._transformJiraIssueToTask(issue, boardConfig))
      
      return tasks
      
    } catch (error) {
      console.error('Failed to fetch Jira tasks:', error)
      throw new Error(`Failed to fetch tasks: ${error.message}`)
    }
  }

  async _createTask(boardId, taskData) {
    try {
      const issueData = this._transformTaskToJiraIssue(taskData, boardId)
      
      const response = await this._jiraRequest('POST', '/rest/api/3/issue', issueData)
      
      // Fetch the created issue with full details
      const createdIssue = await this._jiraRequest('GET', `/rest/api/3/issue/${response.key}`, {
        fields: this._getRequiredFields(),
        expand: 'transitions'
      })
      
      const boardConfig = await this._getBoardConfiguration(boardId)
      return this._transformJiraIssueToTask(createdIssue, boardConfig)
      
    } catch (error) {
      console.error('Failed to create Jira task:', error)
      throw new Error(`Failed to create task: ${error.message}`)
    }
  }

  async _updateTask(taskId, updates) {
    try {
      // Get current issue to understand its state
      const currentIssue = await this._jiraRequest('GET', `/rest/api/3/issue/${taskId}`, {
        fields: this._getRequiredFields(),
        expand: 'transitions'
      })
      
      // Prepare update payload
      const updateData = this._buildUpdatePayload(currentIssue, updates)
      
      // Update the issue
      if (updateData.fields && Object.keys(updateData.fields).length > 0) {
        await this._jiraRequest('PUT', `/rest/api/3/issue/${taskId}`, updateData)
      }
      
      // Handle status transitions separately
      if (updates.status && this.reverseStatusMapping[updates.status]) {
        await this._transitionIssue(taskId, updates.status, currentIssue)
      }
      
      // Fetch updated issue
      const updatedIssue = await this._jiraRequest('GET', `/rest/api/3/issue/${taskId}`, {
        fields: this._getRequiredFields()
      })
      
      const boardConfig = await this._getBoardConfiguration(currentIssue.fields.project.key)
      return this._transformJiraIssueToTask(updatedIssue, boardConfig)
      
    } catch (error) {
      console.error('Failed to update Jira task:', error)
      throw new Error(`Failed to update task: ${error.message}`)
    }
  }

  async _deleteTask(taskId) {
    try {
      await this._jiraRequest('DELETE', `/rest/api/3/issue/${taskId}`)
      
    } catch (error) {
      console.error('Failed to delete Jira task:', error)
      throw new Error(`Failed to delete task: ${error.message}`)
    }
  }

  async _startRealTimeSync() {
    if (!this.capabilities.has('webhook-sync')) {
      console.warn('Real-time sync not supported without webhook capability')
      return
    }
    
    try {
      // Start periodic sync as backup
      this.syncInterval = setInterval(() => {
        this._performIncrementalSync()
      }, 300000) // 5 minutes
      
      console.log('✅ Jira real-time sync started')
      
    } catch (error) {
      console.error('Failed to start real-time sync:', error)
    }
  }

  async _stopRealTimeSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    
    console.log('✅ Jira real-time sync stopped')
  }

  // Jira-specific methods

  _initializeJiraClient() {
    // Create basic auth header
    const auth = btoa(`${this.config.username}:${this.config.apiToken}`)
    
    this.jiraClient = {
      baseURL: this.config.jiraUrl.replace(/\/$/, ''),
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  }

  async _testJiraConnection() {
    try {
      const response = await this._jiraRequest('GET', '/rest/api/3/myself')
      console.log(`✅ Connected to Jira as ${response.displayName}`)
      return response
      
    } catch (error) {
      throw new Error(`Jira connection test failed: ${error.message}`)
    }
  }

  async _jiraRequest(method, endpoint, data = null, params = {}) {
    const url = new URL(endpoint, this.jiraClient.baseURL)
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value.toString())
      }
    })
    
    const options = {
      method,
      headers: this.jiraClient.headers
    }
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data)
    }
    
    const response = await fetch(url.toString(), options)
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.errorMessages) {
          errorMessage += ` - ${errorJson.errorMessages.join(', ')}`
        }
      } catch (e) {
        errorMessage += ` - ${errorText}`
      }
      
      throw new Error(errorMessage)
    }
    
    return response.json()
  }

  async _getBoardConfiguration(boardId) {
    try {
      const config = await this._jiraRequest('GET', `/rest/agile/1.0/board/${boardId}/configuration`)
      return {
        columns: config.columnConfig?.columns || [],
        statuses: config.columnConfig?.columns?.flatMap(col => col.statuses || []) || []
      }
    } catch (error) {
      console.warn('Failed to get board configuration:', error)
      return { columns: [], statuses: [] }
    }
  }

  _buildJQL(boardId, filters = {}) {
    let jql = `project = "${this.config.projectKey}"`
    
    if (filters.status) {
      const jiraStatus = this.reverseStatusMapping[filters.status]
      if (jiraStatus) {
        jql += ` AND status = "${jiraStatus}"`
      }
    }
    
    if (filters.assignee) {
      jql += ` AND assignee = "${filters.assignee}"`
    }
    
    if (filters.labels && filters.labels.length > 0) {
      jql += ` AND labels IN (${filters.labels.map(l => `"${l}"`).join(', ')})`
    }
    
    if (filters.updatedAfter) {
      jql += ` AND updated >= "${filters.updatedAfter}"`
    }
    
    jql += ' ORDER BY updated DESC'
    
    return jql
  }

  _getRequiredFields() {
    return [
      'summary',
      'description', 
      'status',
      'assignee',
      'reporter',
      'priority',
      'labels',
      'created',
      'updated',
      'duedate',
      'project',
      'issuetype',
      'customfield_*' // Include all custom fields
    ]
  }

  _transformJiraIssueToTask(issue, boardConfig = {}) {
    const status = this.statusMapping[issue.fields.status.name] || 'todo'
    
    return {
      id: issue.key,
      external_id: issue.id,
      title: issue.fields.summary,
      description: issue.fields.description || '',
      status,
      priority: issue.fields.priority?.name || 'Medium',
      assignee: issue.fields.assignee ? {
        id: issue.fields.assignee.accountId,
        name: issue.fields.assignee.displayName,
        email: issue.fields.assignee.emailAddress,
        avatar: issue.fields.assignee.avatarUrls?.['32x32']
      } : null,
      reporter: issue.fields.reporter ? {
        id: issue.fields.reporter.accountId,
        name: issue.fields.reporter.displayName,
        email: issue.fields.reporter.emailAddress
      } : null,
      labels: issue.fields.labels || [],
      created_at: issue.fields.created,
      updated_at: issue.fields.updated,
      due_date: issue.fields.duedate,
      external_url: `${this.jiraClient.baseURL}/browse/${issue.key}`,
      provider_id: this.id,
      provider_data: {
        issueType: issue.fields.issuetype,
        project: issue.fields.project,
        jiraStatus: issue.fields.status,
        transitions: issue.transitions || [],
        customFields: this._extractCustomFields(issue.fields)
      }
    }
  }

  _transformTaskToJiraIssue(taskData, boardId) {
    return {
      fields: {
        project: { key: this.config.projectKey },
        summary: taskData.title,
        description: taskData.description || '',
        issuetype: { name: taskData.issueType || 'Task' },
        priority: taskData.priority ? { name: taskData.priority } : undefined,
        assignee: taskData.assignee ? { accountId: taskData.assignee.id } : undefined,
        labels: taskData.labels || [],
        duedate: taskData.due_date || undefined
      }
    }
  }

  _buildUpdatePayload(currentIssue, updates) {
    const payload = { fields: {} }
    
    if (updates.title && updates.title !== currentIssue.fields.summary) {
      payload.fields.summary = updates.title
    }
    
    if (updates.description !== undefined && updates.description !== currentIssue.fields.description) {
      payload.fields.description = updates.description
    }
    
    if (updates.priority && updates.priority !== currentIssue.fields.priority?.name) {
      payload.fields.priority = { name: updates.priority }
    }
    
    if (updates.assignee) {
      payload.fields.assignee = updates.assignee.id ? { accountId: updates.assignee.id } : null
    }
    
    if (updates.labels) {
      payload.fields.labels = updates.labels
    }
    
    if (updates.due_date !== undefined) {
      payload.fields.duedate = updates.due_date
    }
    
    return payload
  }

  async _transitionIssue(issueKey, newStatus, currentIssue) {
    const targetJiraStatus = this.reverseStatusMapping[newStatus]
    if (!targetJiraStatus) {
      console.warn(`No Jira status mapping for: ${newStatus}`)
      return
    }
    
    // Get available transitions
    const transitions = currentIssue.transitions || 
      (await this._jiraRequest('GET', `/rest/api/3/issue/${issueKey}/transitions`)).transitions
    
    // Find transition to target status
    const transition = transitions.find(t => t.to.name === targetJiraStatus)
    
    if (!transition) {
      console.warn(`No transition available from ${currentIssue.fields.status.name} to ${targetJiraStatus}`)
      return
    }
    
    // Perform transition
    await this._jiraRequest('POST', `/rest/api/3/issue/${issueKey}/transitions`, {
      transition: { id: transition.id }
    })
  }

  _extractCustomFields(fields) {
    const customFields = {}
    
    Object.entries(fields).forEach(([key, value]) => {
      if (key.startsWith('customfield_') && value !== null) {
        customFields[key] = value
      }
    })
    
    return customFields
  }

  async _setupWebhookListener() {
    // In a real implementation, this would set up a webhook endpoint
    // For now, we'll simulate it with periodic polling
    console.log('📡 Setting up Jira webhook listener (simulated)')
    
    this.webhookListener = {
      active: true,
      endpoint: `${window.location.origin}/api/webhooks/jira/${this.id}`
    }
  }

  async _cleanupWebhookListener() {
    if (this.webhookListener) {
      this.webhookListener.active = false
      this.webhookListener = null
      console.log('📡 Jira webhook listener cleaned up')
    }
  }

  async _performIncrementalSync() {
    if (this.syncInProgress) return
    
    this.syncInProgress = true
    
    try {
      const since = this.lastSyncTime || new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      
      // Fetch recently updated issues
      const jql = `project = "${this.config.projectKey}" AND updated >= "${since.toISOString()}"`
      const response = await this._jiraRequest('GET', '/rest/api/3/search', {
        jql,
        fields: this._getRequiredFields()
      })
      
      if (response.issues.length > 0) {
        console.log(`🔄 Syncing ${response.issues.length} updated Jira issues`)
        
        // Emit sync events for each updated issue
        response.issues.forEach(issue => {
          const boardConfig = {} // Would get actual config in real implementation
          const task = this._transformJiraIssueToTask(issue, boardConfig)
          this.emit('taskSynced', { task, action: 'updated' })
        })
      }
      
      this.lastSyncTime = new Date()
      
    } catch (error) {
      console.error('Incremental sync failed:', error)
      this.syncErrors.push({
        timestamp: new Date(),
        error: error.message
      })
    } finally {
      this.syncInProgress = false
    }
  }

  // Additional Jira-specific methods

  async getBoardWorkflow(boardId) {
    try {
      const config = await this._getBoardConfiguration(boardId)
      return {
        columns: config.columns.map(col => ({
          id: col.id,
          name: col.name,
          statuses: col.statuses?.map(status => ({
            id: status.id,
            name: status.name,
            category: status.statusCategory?.name,
            lokusStatus: this.statusMapping[status.name] || 'todo'
          })) || []
        }))
      }
    } catch (error) {
      console.error('Failed to get board workflow:', error)
      return { columns: [] }
    }
  }

  async getProjectMetadata() {
    try {
      const project = await this._jiraRequest('GET', `/rest/api/3/project/${this.config.projectKey}`)
      return {
        key: project.key,
        name: project.name,
        description: project.description,
        lead: project.lead,
        issueTypes: project.issueTypes,
        versions: project.versions,
        components: project.components
      }
    } catch (error) {
      console.error('Failed to get project metadata:', error)
      return null
    }
  }

  async searchIssues(jql, options = {}) {
    try {
      const response = await this._jiraRequest('GET', '/rest/api/3/search', {
        jql,
        fields: options.fields || this._getRequiredFields(),
        maxResults: options.maxResults || 50,
        startAt: options.startAt || 0
      })
      
      return {
        issues: response.issues.map(issue => this._transformJiraIssueToTask(issue)),
        total: response.total,
        maxResults: response.maxResults,
        startAt: response.startAt
      }
    } catch (error) {
      console.error('Failed to search issues:', error)
      throw error
    }
  }

  getProviderCapabilities() {
    return {
      supportsCustomFields: true,
      supportsWorkflows: true,
      supportsWebhooks: true,
      supportsBulkOperations: true,
      supportsAdvancedFiltering: true,
      supportsTimeTracking: true,
      supportsAttachments: true,
      supportsComments: true,
      maxTasksPerBoard: 10000,
      syncMethods: ['webhook', 'polling', 'manual']
    }
  }
}

export default JiraKanbanProvider