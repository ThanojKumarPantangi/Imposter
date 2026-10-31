/**
 * Authoritative Server Clock Synchronization Service
 * 
 * Provides monotonic, client-clock-independent server time estimation.
 * Uses window.performance.now() to measure elapsed time without trusting
 * the client device's local system clock (which may be inaccurate, modified,
 * in a different timezone, or changed during runtime).
 */

class ServerTimeSync {
  constructor() {
    this.serverOffset = 0; // Difference: estimatedServerTime - performance.now()
    this.isSynchronized = false;
    this.lastSyncMonotonic = 0;
    this.lowestRtt = Infinity;
    this.syncInProgress = false;
    this.subscribers = new Set();
  }

  /**
   * Subscribe to clock synchronization updates
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    for (const cb of this.subscribers) {
      try {
        cb(this.getEstimatedServerTime(), this.isSynchronized);
      } catch (e) {
        console.error('Error in clock sync subscriber:', e);
      }
    }
  }

  /**
   * Perform a clock synchronization request over Socket.IO
   * @param {Object} socket Socket.IO client instance
   * @returns {Promise<number>} estimated server offset
   */
  async syncWithSocket(socket) {
    if (!socket || !socket.connected) return this.serverOffset;
    if (this.syncInProgress) return this.serverOffset;

    this.syncInProgress = true;
    const t0 = performance.now();

    return new Promise((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.syncInProgress = false;
          resolve(this.serverOffset);
        }
      }, 3000);

      const handleResponse = ({ serverTime, clientSendTime }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.syncInProgress = false;

        const t1 = performance.now();
        const rtt = Math.max(0, t1 - (clientSendTime || t0));
        // Estimated server time at monotonic timestamp t1:
        const serverTimeAtT1 = serverTime + (rtt / 2);
        const newOffset = serverTimeAtT1 - t1;

        if (!this.isSynchronized || rtt < this.lowestRtt) {
          this.serverOffset = newOffset;
          this.lowestRtt = rtt;
        } else {
          // Smooth filtering to prevent visible timer jumps
          this.serverOffset = (this.serverOffset * 0.75) + (newOffset * 0.25);
        }

        this.isSynchronized = true;
        this.lastSyncMonotonic = t1;
        this.notifySubscribers();
        resolve(this.serverOffset);
      };

      try {
        socket.emit('sync_time', { clientSendTime: t0 }, (response) => {
          if (response && response.serverTime) {
            handleResponse(response);
          }
        });

        // Also listen once for event-based response if callback isn't used
        socket.once('sync_time_response', handleResponse);
      } catch (err) {
        clearTimeout(timeout);
        this.syncInProgress = false;
        resolve(this.serverOffset);
      }
    });
  }

  /**
   * Returns current estimated server timestamp (ms since epoch)
   * Monotonically increases regardless of client system clock changes.
   * @returns {number}
   */
  getEstimatedServerTime() {
    if (this.isSynchronized) {
      return performance.now() + this.serverOffset;
    }
    // Fallback before initial sync
    return Date.now();
  }

  /**
   * Calculate remaining seconds for a given server deadline
   * Strictly independent of local client wall-clock time.
   * @param {number|null} serverDeadline Server timestamp in ms
   * @returns {number} Remaining seconds (>= 0)
   */
  getRemainingSeconds(serverDeadline) {
    if (!serverDeadline) return 0;
    const estimatedServerNow = this.getEstimatedServerTime();
    return Math.max(0, Math.ceil((serverDeadline - estimatedServerNow) / 1000));
  }
}

export const serverTimeSync = new ServerTimeSync();
export default serverTimeSync;
