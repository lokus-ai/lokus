/**
 * Dependency Resolution Utilities
 * Advanced dependency resolution algorithms for plugin management
 */

import { SemverUtils, VERSION_COMPARE } from './semver.js'

/**
 * Resolution strategies
 */
export const RESOLUTION_STRATEGY = {
  STRICT: 'strict',        // Exact version matches only
  COMPATIBLE: 'compatible', // Semver-compatible versions
  LATEST: 'latest',        // Latest compatible versions
  OPTIMISTIC: 'optimistic', // Resolve conflicts optimistically
  CONSERVATIVE: 'conservative' // Resolve conflicts conservatively
}

/**
 * Conflict types
 */
export const CONFLICT_TYPE = {
  VERSION: 'version',      // Version conflict
  CIRCULAR: 'circular',    // Circular dependency
  MISSING: 'missing',      // Missing dependency
  INCOMPATIBLE: 'incompatible' // Incompatible constraints
}

/**
 * Dependency node structure
 */
class DependencyNode {
  constructor(id, version = null, constraints = null) {
    this.id = id
    this.version = version
    this.constraints = constraints || new Map() // Map<dependencyId, versionRange>
    this.dependents = new Set() // Nodes that depend on this
    this.dependencies = new Set() // Nodes this depends on
    this.resolved = false
    this.locked = false // Prevents version changes
    this.source = null // Where this dependency came from
  }

  addConstraint(dependencyId, versionRange, source = null) {
    if (!this.constraints.has(dependencyId)) {
      this.constraints.set(dependencyId, [])
    }
    
    this.constraints.get(dependencyId).push({
      range: versionRange,
      source: source || this.id
    })
  }

  getConstraints(dependencyId) {
    return this.constraints.get(dependencyId) || []
  }

  hasConstraint(dependencyId) {
    return this.constraints.has(dependencyId)
  }

  toString() {
    return `${this.id}@${this.version || 'unresolved'}`
  }
}

/**
 * Dependency resolution graph
 */
export class DependencyGraph {
  constructor() {
    this.nodes = new Map() // Map<id, DependencyNode>
    this.resolved = new Map() // Map<id, resolvedVersion>
    this.conflicts = []
    this.circularDependencies = []
  }

  /**
   * Add a plugin and its dependencies to the graph
   */
  addPlugin(pluginId, version, dependencies = {}, options = {}) {
    const { locked = false, source = 'root' } = options
    
    // Create or get existing node
    let node = this.nodes.get(pluginId)
    if (!node) {
      node = new DependencyNode(pluginId, version)
      this.nodes.set(pluginId, node)
    }
    
    // Update node properties
    if (version && !node.locked) {
      node.version = version
    }
    
    node.locked = locked
    node.source = source

    // Add dependencies
    for (const [depId, versionRange] of Object.entries(dependencies)) {
      node.addConstraint(depId, versionRange, pluginId)
      
      // Create dependency node if it doesn't exist
      if (!this.nodes.has(depId)) {
        const depNode = new DependencyNode(depId)
        this.nodes.set(depId, depNode)
      }
      
      const depNode = this.nodes.get(depId)
      node.dependencies.add(depNode)
      depNode.dependents.add(node)
    }

    return node
  }

  /**
   * Remove a plugin from the graph
   */
  removePlugin(pluginId) {
    const node = this.nodes.get(pluginId)
    if (!node) return false

    // Remove from dependents' dependency lists
    for (const dependent of node.dependents) {
      dependent.dependencies.delete(node)
      dependent.constraints.delete(pluginId)
    }

    // Remove from dependencies' dependent lists
    for (const dependency of node.dependencies) {
      dependency.dependents.delete(node)
    }

    this.nodes.delete(pluginId)
    this.resolved.delete(pluginId)
    
    return true
  }

  /**
   * Resolve all dependencies
   */
  async resolve(availableVersions, strategy = RESOLUTION_STRATEGY.COMPATIBLE) {
    this.conflicts = []
    this.circularDependencies = []
    this.resolved.clear()

    try {
      // Check for circular dependencies
      this.detectCircularDependencies()
      
      if (this.circularDependencies.length > 0) {
        throw new Error(`Circular dependencies detected: ${this.circularDependencies.map(cycle => cycle.join(' -> ')).join(', ')}`)
      }

      // Resolve dependencies using topological sort
      const sortedNodes = this.topologicalSort()
      
      for (const node of sortedNodes) {
        await this.resolveNode(node, availableVersions, strategy)
      }

      // Validate final resolution
      this.validateResolution()

      return {
        success: true,
        resolved: Object.fromEntries(this.resolved),
        conflicts: this.conflicts
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        resolved: Object.fromEntries(this.resolved),
        conflicts: this.conflicts,
        circularDependencies: this.circularDependencies
      }
    }
  }

  /**
   * Resolve a single node
   */
  async resolveNode(node, availableVersions, strategy) {
    if (node.resolved || this.resolved.has(node.id)) {
      return
    }

    // If already has a locked version, use it
    if (node.locked && node.version) {
      this.resolved.set(node.id, node.version)
      node.resolved = true
      return
    }

    // Get available versions for this plugin
    const versions = availableVersions.get ? 
      availableVersions.get(node.id) || [] : 
      availableVersions[node.id] || []

    if (versions.length === 0) {
      throw new Error(`No versions available for ${node.id}`)
    }

    // Collect all constraints for this node
    const constraints = []
    
    for (const dependent of node.dependents) {
      const depConstraints = dependent.getConstraints(node.id)
      constraints.push(...depConstraints)
    }

    // If node has a preferred version, add it as a constraint
    if (node.version) {
      constraints.push({
        range: `=${node.version}`,
        source: node.source || 'preferred'
      })
    }

    // Resolve version based on strategy
    const resolvedVersion = this.selectVersion(versions, constraints, strategy)
    
    if (!resolvedVersion) {
      const conflictInfo = {
        type: CONFLICT_TYPE.INCOMPATIBLE,
        pluginId: node.id,
        constraints,
        availableVersions: versions
      }
      
      this.conflicts.push(conflictInfo)
      throw new Error(`Cannot resolve version for ${node.id}: incompatible constraints`)
    }

    this.resolved.set(node.id, resolvedVersion)
    node.version = resolvedVersion
    node.resolved = true
  }

  /**
   * Select the best version based on constraints and strategy
   */
  selectVersion(versions, constraints, strategy) {
    if (constraints.length === 0) {
      return SemverUtils.getLatestVersion(versions)
    }

    // Find versions that satisfy ALL constraints
    const satisfyingVersions = versions.filter(version => {
      return constraints.every(constraint => {
        try {
          return SemverUtils.satisfiesRange(version, constraint.range)
        } catch (error) {
          return false
        }
      })
    })

    if (satisfyingVersions.length === 0) {
      return null
    }

    // Apply strategy
    switch (strategy) {
      case RESOLUTION_STRATEGY.STRICT:
        // Return exact matches only
        return satisfyingVersions.find(v => {
          return constraints.some(c => c.range === `=${v}`)
        }) || null

      case RESOLUTION_STRATEGY.CONSERVATIVE:
        // Return lowest satisfying version
        return satisfyingVersions.sort(SemverUtils.compareVersions)[0]

      case RESOLUTION_STRATEGY.LATEST:
      case RESOLUTION_STRATEGY.OPTIMISTIC:
      default:
        // Return highest satisfying version
        return SemverUtils.getLatestVersion(satisfyingVersions)
    }
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCircularDependencies() {
    const visited = new Set()
    const recursionStack = new Set()
    const cycles = []

    const dfs = (node, path = []) => {
      if (recursionStack.has(node.id)) {
        // Found a cycle
        const cycleStart = path.indexOf(node.id)
        const cycle = path.slice(cycleStart).concat([node.id])
        cycles.push(cycle)
        return
      }

      if (visited.has(node.id)) {
        return
      }

      visited.add(node.id)
      recursionStack.add(node.id)
      path.push(node.id)

      for (const dependency of node.dependencies) {
        dfs(dependency, [...path])
      }

      recursionStack.delete(node.id)
    }

    for (const node of this.nodes.values()) {
      if (!visited.has(node.id)) {
        dfs(node)
      }
    }

    this.circularDependencies = cycles
  }

  /**
   * Topological sort of dependency graph
   */
  topologicalSort() {
    const sorted = []
    const visited = new Set()
    const temp = new Set()

    const visit = (node) => {
      if (temp.has(node.id)) {
        throw new Error(`Circular dependency detected involving ${node.id}`)
      }
      
      if (visited.has(node.id)) {
        return
      }

      temp.add(node.id)
      
      for (const dependency of node.dependencies) {
        visit(dependency)
      }
      
      temp.delete(node.id)
      visited.add(node.id)
      sorted.push(node)
    }

    for (const node of this.nodes.values()) {
      if (!visited.has(node.id)) {
        visit(node)
      }
    }

    return sorted
  }

  /**
   * Validate the final resolution
   */
  validateResolution() {
    for (const [nodeId, version] of this.resolved) {
      const node = this.nodes.get(nodeId)
      
      for (const dependent of node.dependents) {
        const constraints = dependent.getConstraints(nodeId)
        
        for (const constraint of constraints) {
          if (!SemverUtils.satisfiesRange(version, constraint.range)) {
            this.conflicts.push({
              type: CONFLICT_TYPE.VERSION,
              pluginId: nodeId,
              resolvedVersion: version,
              constraint: constraint.range,
              source: constraint.source
            })
          }
        }
      }
    }
  }

  /**
   * Get the installation order
   */
  getInstallationOrder() {
    try {
      const sorted = this.topologicalSort()
      return sorted
        .filter(node => this.resolved.has(node.id))
        .map(node => ({
          id: node.id,
          version: this.resolved.get(node.id),
          dependencies: Array.from(node.dependencies).map(dep => ({
            id: dep.id,
            version: this.resolved.get(dep.id)
          }))
        }))
    } catch (error) {
      return []
    }
  }

  /**
   * Check if a plugin can be safely removed
   */
  canRemove(pluginId) {
    const node = this.nodes.get(pluginId)
    if (!node) return true

    const dependents = Array.from(node.dependents)
      .filter(dep => this.resolved.has(dep.id))
      .map(dep => dep.id)

    return {
      canRemove: dependents.length === 0,
      dependents,
      blockedBy: dependents
    }
  }

  /**
   * Get dependency tree for a plugin
   */
  getDependencyTree(pluginId, maxDepth = 10) {
    const node = this.nodes.get(pluginId)
    if (!node) return null

    const buildTree = (currentNode, depth = 0, visited = new Set()) => {
      if (depth >= maxDepth || visited.has(currentNode.id)) {
        return {
          id: currentNode.id,
          version: this.resolved.get(currentNode.id) || currentNode.version,
          circular: visited.has(currentNode.id),
          dependencies: []
        }
      }

      visited.add(currentNode.id)

      return {
        id: currentNode.id,
        version: this.resolved.get(currentNode.id) || currentNode.version,
        dependencies: Array.from(currentNode.dependencies).map(dep => 
          buildTree(dep, depth + 1, new Set(visited))
        )
      }
    }

    return buildTree(node)
  }

  /**
   * Generate a resolution report
   */
  getResolutionReport() {
    return {
      totalPlugins: this.nodes.size,
      resolved: this.resolved.size,
      conflicts: this.conflicts.length,
      circularDependencies: this.circularDependencies.length,
      installationOrder: this.getInstallationOrder().map(item => `${item.id}@${item.version}`),
      conflictDetails: this.conflicts,
      circularDependencyDetails: this.circularDependencies
    }
  }

  /**
   * Clone the graph
   */
  clone() {
    const cloned = new DependencyGraph()
    
    // Clone nodes
    for (const [id, node] of this.nodes) {
      const clonedNode = new DependencyNode(id, node.version)
      clonedNode.constraints = new Map(node.constraints)
      clonedNode.resolved = node.resolved
      clonedNode.locked = node.locked
      clonedNode.source = node.source
      cloned.nodes.set(id, clonedNode)
    }

    // Rebuild relationships
    for (const [id, node] of this.nodes) {
      const clonedNode = cloned.nodes.get(id)
      
      for (const dep of node.dependencies) {
        const clonedDep = cloned.nodes.get(dep.id)
        if (clonedDep) {
          clonedNode.dependencies.add(clonedDep)
          clonedDep.dependents.add(clonedNode)
        }
      }
    }

    cloned.resolved = new Map(this.resolved)
    cloned.conflicts = [...this.conflicts]
    cloned.circularDependencies = [...this.circularDependencies]

    return cloned
  }
}

/**
 * Dependency resolver utility functions
 */
export const DependencyUtils = {
  /**
   * Create a dependency graph from plugin manifests
   */
  createGraphFromManifests(manifests, installedPlugins = {}) {
    const graph = new DependencyGraph()
    
    // Add installed plugins first (locked)
    for (const [pluginId, version] of Object.entries(installedPlugins)) {
      graph.addPlugin(pluginId, version, {}, { locked: true, source: 'installed' })
    }

    // Add plugins from manifests
    for (const manifest of manifests) {
      graph.addPlugin(
        manifest.id || manifest.name,
        manifest.version,
        manifest.dependencies || {},
        { source: 'manifest' }
      )
    }

    return graph
  },

  /**
   * Resolve a simple dependency list
   */
  async resolveDependencies(dependencies, availableVersions, strategy = RESOLUTION_STRATEGY.COMPATIBLE) {
    const graph = new DependencyGraph()
    
    // Add root plugin
    graph.addPlugin('__root__', '1.0.0', dependencies, { locked: true, source: 'root' })
    
    const result = await graph.resolve(availableVersions, strategy)
    
    // Remove root from resolved dependencies
    delete result.resolved['__root__']
    
    return result
  },

  /**
   * Check for version conflicts
   */
  checkConflicts(dependencies, availableVersions) {
    const conflicts = []
    
    for (const [pluginId, versionRange] of Object.entries(dependencies)) {
      const versions = availableVersions.get ? 
        availableVersions.get(pluginId) || [] : 
        availableVersions[pluginId] || []
      
      const satisfying = SemverUtils.getVersionsInRange(versions, versionRange)
      
      if (satisfying.length === 0) {
        conflicts.push({
          type: CONFLICT_TYPE.MISSING,
          pluginId,
          constraint: versionRange,
          availableVersions: versions
        })
      }
    }
    
    return conflicts
  },

  /**
   * Suggest resolution for conflicts
   */
  suggestResolution(conflict, availableVersions) {
    const suggestions = []
    
    switch (conflict.type) {
      case CONFLICT_TYPE.MISSING:
        // Suggest closest available versions
        if (conflict.availableVersions.length > 0) {
          const latest = SemverUtils.getLatestVersion(conflict.availableVersions)
          suggestions.push({
            type: 'use_latest',
            version: latest,
            description: `Use latest available version: ${latest}`
          })
        }
        break
        
      case CONFLICT_TYPE.INCOMPATIBLE:
        // Suggest version range adjustments
        suggestions.push({
          type: 'relax_constraint',
          description: 'Consider relaxing version constraints'
        })
        break
    }
    
    return suggestions
  }
}

export default DependencyUtils