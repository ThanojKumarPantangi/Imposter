import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { AudioRouteModule } = NativeModules;

export type AudioRouteType = 'speaker' | 'earpiece' | 'bluetooth' | 'headset' | 'unknown';

export interface AudioRouteInfo {
  currentRoute: AudioRouteType;
  availableRoutes: AudioRouteType[];
}

class AudioRouteService {
  private emitter: NativeEventEmitter | null = null;
  private isVoipActive = false;

  constructor() {
    if (Platform.OS === 'android' && AudioRouteModule) {
      this.emitter = new NativeEventEmitter(AudioRouteModule);
    }
  }

  /**
   * Start Android VoIP audio session (sets MODE_IN_COMMUNICATION & requests Audio Focus)
   */
  async startVoipSession(): Promise<AudioRouteType> {
    if (Platform.OS !== 'android' || !AudioRouteModule) {
      this.isVoipActive = true;
      return 'speaker';
    }

    try {
      console.log('[AUDIO-ROUTE] Starting native VoIP session...');
      const route = await AudioRouteModule.startVoipSession();
      this.isVoipActive = true;
      console.log(`[AUDIO-ROUTE] VoIP session active. Current route: ${route}`);
      return route as AudioRouteType;
    } catch (err) {
      console.error('[AUDIO-ROUTE] Failed to start VoIP session:', err);
      return 'speaker';
    }
  }

  /**
   * Stop Android VoIP audio session (restores MODE_NORMAL & releases Audio Focus)
   */
  async stopVoipSession(): Promise<void> {
    if (Platform.OS !== 'android' || !AudioRouteModule) {
      this.isVoipActive = false;
      return;
    }

    try {
      console.log('[AUDIO-ROUTE] Stopping native VoIP session...');
      await AudioRouteModule.stopVoipSession();
      this.isVoipActive = false;
      console.log('[AUDIO-ROUTE] VoIP session stopped');
    } catch (err) {
      console.error('[AUDIO-ROUTE] Failed to stop VoIP session:', err);
    }
  }

  /**
   * Set speakerphone routing:
   * enabled = true  -> Loudspeaker
   * enabled = false -> Private device (Bluetooth, Headset, or Earpiece)
   */
  async setSpeakerphoneOn(enabled: boolean): Promise<AudioRouteType> {
    if (Platform.OS !== 'android' || !AudioRouteModule) {
      return enabled ? 'speaker' : 'earpiece';
    }

    try {
      console.log(`[AUDIO-ROUTE] setSpeakerphoneOn(${enabled})`);
      const route = await AudioRouteModule.setSpeakerphoneOn(enabled);
      console.log(`[AUDIO-ROUTE] Route updated to: ${route}`);
      return route as AudioRouteType;
    } catch (err) {
      console.error(`[AUDIO-ROUTE] Failed to set speakerphone to ${enabled}:`, err);
      return enabled ? 'speaker' : 'earpiece';
    }
  }

  /**
   * Get the current active audio output route
   */
  async getCurrentRoute(): Promise<AudioRouteType> {
    if (Platform.OS !== 'android' || !AudioRouteModule) return 'speaker';
    try {
      return (await AudioRouteModule.getCurrentRoute()) as AudioRouteType;
    } catch {
      return 'speaker';
    }
  }

  /**
   * Get all currently available audio output routes
   */
  async getAvailableRoutes(): Promise<AudioRouteType[]> {
    if (Platform.OS !== 'android' || !AudioRouteModule) return ['speaker'];
    try {
      return (await AudioRouteModule.getAvailableRoutes()) as AudioRouteType[];
    } catch {
      return ['speaker'];
    }
  }

  /**
   * Listen for hardware audio route changes (Bluetooth connect/disconnect, headset plug)
   */
  addRouteChangeListener(listener: (info: AudioRouteInfo) => void): () => void {
    if (!this.emitter) return () => {};

    const subscription = this.emitter.addListener(
      'onAudioRouteChanged',
      (data: any) => {
        const info = data as AudioRouteInfo;
        console.log(`[AUDIO-ROUTE] Route changed: ${info.currentRoute}, available: [${(info.availableRoutes || []).join(', ')}]`);
        listener(info);
      }
    );

    return () => subscription.remove();
  }

  /**
   * Listen for audio focus interruptions (incoming call, alarm, other app audio)
   */
  addInterruptionListener(listener: (interruption: { event: 'focus_lost' | 'focus_gained' }) => void): () => void {
    if (!this.emitter) return () => {};

    const subscription = this.emitter.addListener('onAudioInterruption', (data: any) => {
      const interruption = data as { event: 'focus_lost' | 'focus_gained' };
      console.log(`[AUDIO-ROUTE] Audio interruption event: ${interruption.event}`);
      listener(interruption);
    });

    return () => subscription.remove();
  }
}

export const audioRouteService = new AudioRouteService();
export default audioRouteService;

