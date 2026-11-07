/**
 * Authoritative Server Clock Synchronization Service (React Native)
 *
 * Provides monotonic, client-clock-independent server time estimation.
 * Uses performance.now() to measure elapsed time without trusting
 * the client device's local system clock.
 */

class ServerTimeSync {
  private serverOffset = 0;
  private isSynchronized = false;
  private lastSyncMonotonic = 0;
  private lowestRtt = Infinity;
  private syncInProgress = false;
  private subscribers = new Set<(serverNow: number, isSync: boolean) => void>();

  private getMonotonicNow(): number {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  subscribe(callback: (serverNow: number, isSync: boolean) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const estimated = this.getEstimatedServerTime();
    for (const cb of this.subscribers) {
      try {
        cb(estimated, this.isSynchronized);
      } catch (e) {
        console.error('Error in clock sync subscriber:', e);
      }
    }
  }

  async syncWithSocket(socket: any): Promise<number> {
    if (!socket || !socket.connected) return this.serverOffset;
    if (this.syncInProgress) return this.serverOffset;

    this.syncInProgress = true;
    const t0 = this.getMonotonicNow();

    return new Promise((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.syncInProgress = false;
          resolve(this.serverOffset);
        }
      }, 3000);

      const handleResponse = (response: { serverTime: number; clientSendTime?: number }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.syncInProgress = false;

        const t1 = this.getMonotonicNow();
        const rtt = Math.max(0, t1 - (response.clientSendTime || t0));
        const serverTimeAtT1 = response.serverTime + rtt / 2;
        const newOffset = serverTimeAtT1 - t1;

        if (!this.isSynchronized || rtt < this.lowestRtt) {
          this.serverOffset = newOffset;
          this.lowestRtt = rtt;
        } else {
          this.serverOffset = this.serverOffset * 0.75 + newOffset * 0.25;
        }

        this.isSynchronized = true;
        this.lastSyncMonotonic = t1;
        this.notifySubscribers();
        resolve(this.serverOffset);
      };

      try {
        socket.emit('sync_time', { clientSendTime: t0 }, (response: any) => {
          if (response && response.serverTime) {
            handleResponse(response);
          }
        });

        socket.once('sync_time_response', handleResponse);
      } catch {
        clearTimeout(timeout);
        this.syncInProgress = false;
        resolve(this.serverOffset);
      }
    });
  }

  getEstimatedServerTime(): number {
    if (this.isSynchronized) {
      return this.getMonotonicNow() + this.serverOffset;
    }
    return Date.now();
  }

  getRemainingSeconds(serverDeadline?: number | null): number {
    if (!serverDeadline) return 0;
    const estimatedServerNow = this.getEstimatedServerTime();
    return Math.max(0, Math.ceil((serverDeadline - estimatedServerNow) / 1000));
  }
}

export const serverTimeSync = new ServerTimeSync();
export default serverTimeSync;

