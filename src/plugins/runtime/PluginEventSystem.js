/**
 * Plugin Event System
 * Handles event communication between plugins, workspace events, and inter-plugin messaging
 */

import { EventEmitter } from '../../utils/EventEmitter.js'

export class PluginEventSystem extends EventEmitter {
  constructor() {
    super()
    this.eventChannels = new Map() // channelName -> EventChannel
    this.pluginSubscriptions = new Map() // pluginId -> Set<subscriptions>
    this.eventHistory = []
    this.eventFilters = new Map()
    this.isInitialized = false
    this.logger = console // TODO: Replace with proper logger
    
    this.setupBuiltInChannels()
  }

  /**
   * Initialize the event system
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Set up event processing
      this.setupEventProcessing()
      
      this.isInitialized = true
      this.emit('event_system_initialized')
      this.logger.info('Plugin event system initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize event system:', error)
      throw error
    }
  }

  /**
   * Set up built-in event channels
   */
  setupBuiltInChannels() {
    // Workspace events
    this.createChannel('workspace', {
      description: 'Workspace-related events',
      persistent: true,
      maxHistory: 100
    })
    
    // Editor events
    this.createChannel('editor', {
      description: 'Editor-related events',
      persistent: true,
      maxHistory: 50
    })
    
    // File system events
    this.createChannel('fs', {
      description: 'File system events',
      persistent: true,
      maxHistory: 200
    })
    
    // UI events
    this.createChannel('ui', {
      description: 'UI-related events',
      persistent: false,
      maxHistory: 20
    })
    
    // Plugin lifecycle events
    this.createChannel('lifecycle', {
      description: 'Plugin lifecycle events',
      persistent: true,
      maxHistory: 50
    })
    
    // Inter-plugin communication
    this.createChannel('plugins', {
      description: 'Inter-plugin communication',
      persistent: false,
      maxHistory: 100
    })
    
    // Commands
    this.createChannel('commands', {
      description: 'Command execution events',
      persistent: false,
      maxHistory: 50
    })
    
    // Debug events
    this.createChannel('debug', {
      description: 'Debug-related events',
      persistent: false,
      maxHistory: 30
    })
  }

  /**
   * Create an event channel
   */
  createChannel(channelName, options = {}) {
    if (this.eventChannels.has(channelName)) {
      this.logger.warn(`Event channel '${channelName}' already exists`)
      return this.eventChannels.get(channelName)
    }
    
    const channel = new EventChannel(channelName, {
      description: options.description || '',
      persistent: options.persistent !== false,
      maxHistory: options.maxHistory || 50,
      filter: options.filter || null
    })
    
    this.eventChannels.set(channelName, channel)
    this.emit('channel_created', { channelName, options })
    
    return channel
  }

  /**
   * Get event channel
   */
  getChannel(channelName) {
    return this.eventChannels.get(channelName)
  }

  /**
   * Subscribe to events on a channel
   */
  subscribe(pluginId, channelName, eventType, handler, options = {}) {
    const channel = this.getChannel(channelName)
    if (!channel) {
      throw new Error(`Event channel '${channelName}' does not exist`)
    }
    
    // Create subscription
    const subscription = {
      id: `${pluginId}_${channelName}_${eventType}_${Date.now()}`,
      pluginId,
      channelName,
      eventType,
      handler,
      options,
      createdAt: Date.now(),
      callCount: 0,
      lastCalled: null
    }
    
    // Add to channel
    channel.addSubscription(subscription)
    
    // Track for cleanup
    if (!this.pluginSubscriptions.has(pluginId)) {
      this.pluginSubscriptions.set(pluginId, new Set())
    }
    this.pluginSubscriptions.get(pluginId).add(subscription)
    
    this.logger.debug(`Plugin ${pluginId} subscribed to ${channelName}:${eventType}`)
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(subscription.id)
    }
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId) {
    for (const [channelName, channel] of this.eventChannels) {
      const subscription = channel.removeSubscription(subscriptionId)
      if (subscription) {
        // Remove from plugin subscriptions
        const pluginSubs = this.pluginSubscriptions.get(subscription.pluginId)
        if (pluginSubs) {
          pluginSubs.delete(subscription)
        }
        
        this.logger.debug(`Unsubscribed from ${channelName}:${subscription.eventType}`)
        return true
      }
    }
    
    return false
  }

  /**
   * Publish event to a channel
   */
  async publish(channelName, eventType, data, metadata = {}) {
    const channel = this.getChannel(channelName)
    if (!channel) {
      throw new Error(`Event channel '${channelName}' does not exist`)
    }
    
    const event = {
      id: `${channelName}_${eventType}_${Date.now()}_${Math.random()}`,
      channelName,
      eventType,
      data,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        source: metadata.source || 'system'
      }
    }
    
    // Apply channel filter if exists
    if (channel.options.filter && !channel.options.filter(event)) {
      return false
    }
    
    // Add to channel history
    channel.addEvent(event)
    
    // Add to global event history
    this.addToEventHistory(event)
    
    // Deliver to subscribers
    await this.deliverEvent(channel, event)
    
    this.emit('event_published', { channelName, eventType, eventId: event.id })
    
    return event.id
  }

  /**
   * Deliver event to subscribers
   */
  async deliverEvent(channel, event) {
    const subscribers = channel.getSubscribers(event.eventType)
    
    for (const subscription of subscribers) {
      try {
        // Check if subscription should receive this event
        if (!this.shouldDeliverEvent(subscription, event)) {
          continue
        }
        
        // Update subscription stats
        subscription.callCount++
        subscription.lastCalled = Date.now()
        
        // Call handler
        if (subscription.options.async !== false) {
          // Async delivery (default)
          setImmediate(() => {
            this.callEventHandler(subscription, event)
          })
        } else {
          // Sync delivery
          await this.callEventHandler(subscription, event)
        }
      } catch (error) {
        this.logger.error(`Error delivering event to subscription ${subscription.id}:`, error)
      }
    }
  }

  /**
   * Check if event should be delivered to subscription
   */
  shouldDeliverEvent(subscription, event) {
    // Check if subscription is for this specific event type or wildcard
    if (subscription.eventType !== '*' && subscription.eventType !== event.eventType) {
      return false
    }
    
    // Check subscription filters
    if (subscription.options.filter) {
      if (typeof subscription.options.filter === 'function') {
        return subscription.options.filter(event)
      } else if (typeof subscription.options.filter === 'object') {
        // Simple object matching
        for (const [key, value] of Object.entries(subscription.options.filter)) {
          if (event.data[key] !== value) {
            return false
          }
        }
      }
    }
    
    // Check if subscription has reached call limit
    if (subscription.options.maxCalls && subscription.callCount >= subscription.options.maxCalls) {
      // Auto-unsubscribe if reached limit
      this.unsubscribe(subscription.id)
      return false
    }
    
    return true
  }

  /**
   * Call event handler safely
   */
  async callEventHandler(subscription, event) {
    try {
      await subscription.handler(event)
    } catch (error) {
      this.logger.error(`Error in event handler for plugin ${subscription.pluginId}:`, error)
      this.emit('handler_error', {
        subscriptionId: subscription.id,
        pluginId: subscription.pluginId,
        error
      })
    }
  }

  /**
   * Set up event processing
   */
  setupEventProcessing() {
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupExpiredEvents()
    }, 60000) // Clean up every minute
  }

  /**
   * Add event to global history
   */
  addToEventHistory(event) {
    this.eventHistory.push({
      ...event,
      processingTime: Date.now()
    })
    
    // Limit history size
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-500)
    }
  }

  /**
   * Clean up expired events and subscriptions
   */
  cleanupExpiredEvents() {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    // Clean up event history
    this.eventHistory = this.eventHistory.filter(event => 
      now - event.timestamp < maxAge
    )
    
    // Clean up channel histories
    for (const channel of this.eventChannels.values()) {
      channel.cleanupHistory(maxAge)
    }
  }

  /**
   * Get events from channel history
   */
  getChannelHistory(channelName, eventType = null, limit = 50) {
    const channel = this.getChannel(channelName)
    if (!channel) {
      return []
    }
    
    return channel.getHistory(eventType, limit)
  }

  /**
   * Get plugin subscription info
   */
  getPluginSubscriptions(pluginId) {
    const subscriptions = this.pluginSubscriptions.get(pluginId)
    if (!subscriptions) {
      return []
    }
    
    return Array.from(subscriptions).map(sub => ({
      id: sub.id,
      channelName: sub.channelName,
      eventType: sub.eventType,
      createdAt: sub.createdAt,
      callCount: sub.callCount,
      lastCalled: sub.lastCalled
    }))
  }

  /**
   * Cleanup plugin subscriptions
   */
  cleanupPluginSubscriptions(pluginId) {
    const subscriptions = this.pluginSubscriptions.get(pluginId)
    if (!subscriptions) {
      return
    }
    
    for (const subscription of subscriptions) {
      this.unsubscribe(subscription.id)
    }
    
    this.pluginSubscriptions.delete(pluginId)
    this.logger.info(`Cleaned up subscriptions for plugin ${pluginId}`)
  }

  /**
   * Get event system statistics
   */
  getStats() {
    const channels = Array.from(this.eventChannels.values())
    const totalSubscriptions = Array.from(this.pluginSubscriptions.values())
      .reduce((total, subs) => total + subs.size, 0)
    
    return {
      channels: channels.length,
      totalSubscriptions,
      eventHistory: this.eventHistory.length,
      channelStats: channels.map(channel => ({
        name: channel.name,
        subscriptions: channel.getSubscriptionCount(),
        events: channel.getEventCount(),
        description: channel.options.description
      })),
      pluginStats: Array.from(this.pluginSubscriptions.entries()).map(([pluginId, subs]) => ({
        pluginId,
        subscriptions: subs.size
      }))
    }
  }

  /**
   * Create event filter
   */
  createEventFilter(name, filterFunction) {
    this.eventFilters.set(name, filterFunction)
  }

  /**
   * Apply event filter
   */
  applyEventFilter(filterName, event) {
    const filter = this.eventFilters.get(filterName)
    return filter ? filter(event) : true
  }

  /**
   * Shutdown event system
   */
  async shutdown() {
    // Clean up all subscriptions
    for (const pluginId of this.pluginSubscriptions.keys()) {
      this.cleanupPluginSubscriptions(pluginId)
    }
    
    // Clear channels
    this.eventChannels.clear()
    
    // Clear history
    this.eventHistory = []
    
    this.isInitialized = false
    this.emit('event_system_shutdown')
    this.removeAllListeners()
  }
}

/**
 * Event Channel - Represents a specific event channel
 */
class EventChannel {
  constructor(name, options = {}) {
    this.name = name
    this.options = {
      description: options.description || '',
      persistent: options.persistent !== false,
      maxHistory: options.maxHistory || 50,
      filter: options.filter || null
    }
    this.subscriptions = new Map() // subscriptionId -> subscription
    this.eventHistory = []
    this.createdAt = Date.now()
  }

  /**
   * Add subscription to channel
   */
  addSubscription(subscription) {
    this.subscriptions.set(subscription.id, subscription)
  }

  /**
   * Remove subscription from channel
   */
  removeSubscription(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId)
    if (subscription) {
      this.subscriptions.delete(subscriptionId)
      return subscription
    }
    return null
  }

  /**
   * Get subscribers for event type
   */
  getSubscribers(eventType) {
    const subscribers = []
    
    for (const subscription of this.subscriptions.values()) {
      if (subscription.eventType === '*' || subscription.eventType === eventType) {
        subscribers.push(subscription)
      }
    }
    
    return subscribers
  }

  /**
   * Add event to channel history
   */
  addEvent(event) {
    if (!this.options.persistent) {
      return
    }
    
    this.eventHistory.push(event)
    
    // Limit history size
    if (this.eventHistory.length > this.options.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-Math.floor(this.options.maxHistory * 0.8))
    }
  }

  /**
   * Get channel event history
   */
  getHistory(eventType = null, limit = 50) {
    let events = this.eventHistory
    
    if (eventType) {
      events = events.filter(event => event.eventType === eventType)
    }
    
    return events.slice(-limit)
  }

  /**
   * Clean up old events from history
   */
  cleanupHistory(maxAge) {
    const now = Date.now()
    this.eventHistory = this.eventHistory.filter(event => 
      now - event.metadata.timestamp < maxAge
    )
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount() {
    return this.subscriptions.size
  }

  /**
   * Get event count
   */
  getEventCount() {
    return this.eventHistory.length
  }
}

export { EventChannel }
export default PluginEventSystem