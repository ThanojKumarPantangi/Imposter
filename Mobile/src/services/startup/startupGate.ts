import { StartupState, AppConfigData } from './types';

type Listener = (state: StartupState, hardUpdateData?: any) => void;

class StartupGate {
  private currentState: StartupState = 'LOADING';
  private hardUpdatePayload: any = null;
  private listeners: Set<Listener> = new Set();

  getState(): StartupState {
    return this.currentState;
  }

  getHardUpdateData(): any {
    return this.hardUpdatePayload;
  }

  setState(newState: StartupState): void {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.listeners.forEach((listener) => {
      try {
        listener(newState, this.hardUpdatePayload);
      } catch (err) {
        console.error('[StartupGate] Listener error:', err);
      }
    });
  }

  /**
   * Triggers the hard update state immediately when HTTP 426 is received from backend
   */
  triggerHardUpdate(updateData: any, installedVersionCode: number): void {
    this.hardUpdatePayload = {
      updateData,
      installedVersionCode
    };
    this.setState('HARD_UPDATE');
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

