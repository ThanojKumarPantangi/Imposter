import { StartupState } from './types';

type Listener = (state: StartupState) => void;

class StartupGate {
  private currentState: StartupState = 'LOADING';
  private listeners: Set<Listener> = new Set();

  getState(): StartupState {
    return this.currentState;
  }

  setState(newState: StartupState): void {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.listeners.forEach((listener) => {
      try {
        listener(newState);
      } catch (err) {
        console.error('[StartupGate] Listener error:', err);
      }
    });
  }

  /**
   * Returns true if application is currently blocked by loading, maintenance, or hard update.
   */
  isBlocked(): boolean {
    return this.currentState !== 'NORMAL_APP';
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const startupGate = new StartupGate();
export default startupGate;

