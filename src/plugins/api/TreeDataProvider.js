import { EventEmitter } from '../../utils/EventEmitter.js';

/**
 * Adapter for plugin tree data providers
 * Wraps a plugin's tree data provider and manages its lifecycle
 */
export class TreeDataProviderAdapter extends EventEmitter {
  constructor(viewId, provider) {
    super();
    this.viewId = viewId;
    this.provider = provider;

    // Listen to provider's change events
    if (provider.onDidChangeTreeData) {
      provider.onDidChangeTreeData((element) => {
        this.emit('didChangeTreeData', element);
      });
    }
  }

  /**
   * Get children for a tree element
   * @param {any} element - Parent element or undefined for root
   * @returns {Promise<Array>} Array of child elements
   */
  async getChildren(element) {
    try {
      return await this.provider.getChildren(element);
    } catch (error) {
      console.error(`TreeDataProvider ${this.viewId} getChildren error:`, error);
      return [];
    }
  }

  /**
   * Get tree item representation for an element
   * @param {any} element - Element to get tree item for
   * @returns {Promise<Object>} Tree item with label, collapsibleState, etc.
   */
  async getTreeItem(element) {
    try {
      return await this.provider.getTreeItem(element);
    } catch (error) {
      console.error(`TreeDataProvider ${this.viewId} getTreeItem error:`, error);
      return { label: 'Error loading item' };
    }
  }

  /**
   * Get parent element (optional method)
   * @param {any} element - Element to get parent for
   * @returns {Promise<any>} Parent element or undefined
   */
  async getParent(element) {
    if (this.provider.getParent) {
      try {
        return await this.provider.getParent(element);
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Refresh the tree (optionally for a specific element)
   * @param {any} element - Element to refresh or undefined for full refresh
   */
  refresh(element) {
    this.emit('didChangeTreeData', element);
  }
}

export default TreeDataProviderAdapter;
