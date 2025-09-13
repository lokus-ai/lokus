/**
 * Faulty Plugin - Intentionally fails for testing error handling
 */

export default class FaultyPlugin {
  constructor() {
    this.api = null
  }

  /**
   * Plugin activation - intentionally fails
   */
  async activate(api) {
    this.api = api
    
    // Simulate activation failure
    throw new Error('Faulty plugin intentionally failed to activate')
  }

  /**
   * Plugin deactivation
   */
  async deactivate() {
    // This won't be called since activation fails
    console.log('Faulty Plugin deactivated')
  }
}