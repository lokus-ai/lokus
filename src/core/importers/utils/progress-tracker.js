/**
 * Progress Tracker
 *
 * Tracks import progress with file counts and status
 */

export class ProgressTracker {
  constructor(totalFiles = 0) {
    this.total = totalFiles;
    this.current = 0;
    this.status = 'idle'; // idle, running, completed, error
    this.currentFile = '';
    this.startTime = null;
    this.endTime = null;
    this.callbacks = [];
  }

  /**
   * Set total number of files
   */
  setTotal(total) {
    this.total = total;
    this.notify();
  }

  /**
   * Start tracking
   */
  start() {
    this.status = 'running';
    this.startTime = Date.now();
    this.current = 0;
    this.notify();
  }

  /**
   * Update progress
   * @param {string} fileName - Current file being processed
   */
  update(fileName) {
    this.current++;
    this.currentFile = fileName;
    this.notify();
  }

  /**
   * Mark as completed
   */
  complete() {
    this.status = 'completed';
    this.endTime = Date.now();
    this.current = this.total;
    this.notify();
  }

  /**
   * Mark as error
   */
  error(message = '') {
    this.status = 'error';
    this.endTime = Date.now();
    this.errorMessage = message;
    this.notify();
  }

  /**
   * Get progress percentage
   */
  getPercentage() {
    if (this.total === 0) return 0;
    return Math.round((this.current / this.total) * 100);
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || Date.now();
    return Math.round((endTime - this.startTime) / 1000);
  }

  /**
   * Get estimated time remaining in seconds
   */
  getEstimatedTimeRemaining() {
    if (this.current === 0 || !this.startTime) return 0;

    const elapsed = Date.now() - this.startTime;
    const avgTimePerFile = elapsed / this.current;
    const remaining = this.total - this.current;

    return Math.round((remaining * avgTimePerFile) / 1000);
  }

  /**
   * Get current state
   */
  getState() {
    return {
      status: this.status,
      current: this.current,
      total: this.total,
      percentage: this.getPercentage(),
      currentFile: this.currentFile,
      elapsedTime: this.getElapsedTime(),
      estimatedTimeRemaining: this.getEstimatedTimeRemaining(),
      errorMessage: this.errorMessage
    };
  }

  /**
   * Register progress callback
   * @param {Function} callback
   */
  onProgress(callback) {
    this.callbacks.push(callback);
  }

  /**
   * Notify all callbacks
   */
  notify() {
    const state = this.getState();
    this.callbacks.forEach(cb => cb(state));
  }

  /**
   * Reset tracker
   */
  reset() {
    this.current = 0;
    this.status = 'idle';
    this.currentFile = '';
    this.startTime = null;
    this.endTime = null;
    this.errorMessage = '';
    this.notify();
  }
}

/**
 * Format time in human-readable format
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

export default ProgressTracker;
