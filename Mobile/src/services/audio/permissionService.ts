import { PermissionsAndroid, Platform, Linking, Alert } from 'react-native';

export type MicPermissionStatus = 'granted' | 'denied' | 'never_ask_again' | 'undetermined';

class PermissionService {
  private currentStatus: MicPermissionStatus = 'undetermined';
  private hasWarnedForStatus: Partial<Record<MicPermissionStatus, boolean>> = {};
  private isPromptingSettings: boolean = false;
  private listeners: Set<(status: MicPermissionStatus) => void> = new Set();

  /**
   * Get the centrally tracked microphone permission status
   */
  getStatus(): MicPermissionStatus {
    return this.currentStatus;
  }

  /**
   * Check if user has already been warned for a given permission status
   */
  hasWarned(status: MicPermissionStatus): boolean {
    return !!this.hasWarnedForStatus[status];
  }

  /**
   * Record that a warning has been displayed for a given permission status
   */
  setWarned(status: MicPermissionStatus, warned: boolean = true): void {
    this.hasWarnedForStatus[status] = warned;
  }

  /**
   * Reset warning tracking (e.g. when permission is granted or changed)
   */
  resetWarnings(): void {
    this.hasWarnedForStatus = {};
  }

  /**
   * Subscribe to permission status updates
   */
  addStatusListener(listener: (status: MicPermissionStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(newStatus: MicPermissionStatus): void {
    if (this.currentStatus !== newStatus) {
      console.log(`[MIC] Permission status: ${newStatus}`);
      this.currentStatus = newStatus;
      if (newStatus === 'granted') {
        this.resetWarnings();
      }
      this.listeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.warn('[MIC] Error in permission listener:', e);
        }
      });
    }
  }

  /**
   * Check if RECORD_AUDIO permission is currently granted without triggering system dialogs
   */
  async checkMicrophonePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      this.updateStatus('granted');
      console.log('[MIC] Permission status: granted');
      return true;
    }

    try {
      const isGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (isGranted) {
        this.updateStatus('granted');
        console.log('[MIC] Permission status: granted');
        return true;
      }

      // If not granted, but previously detected as permanently denied, preserve 'never_ask_again'
      if (this.currentStatus === 'never_ask_again') {
        console.log('[MIC] Permission status: never_ask_again');
        return false;
      }

      // Otherwise if undetermined, mark as denied
      if (this.currentStatus === 'undetermined') {
        this.updateStatus('denied');
      }
      console.log('[MIC] Permission status: denied');
      return false;
    } catch (err) {
      console.warn('[MIC] Error checking RECORD_AUDIO permission:', err);
      return false;
    }
  }

  /**
   * Request RECORD_AUDIO runtime permission with rationale
   */
  async requestMicrophonePermission(): Promise<MicPermissionStatus> {
    if (Platform.OS !== 'android') {
      this.updateStatus('granted');
      console.log('[MIC] Permission granted: true');
      return 'granted';
    }

    // If already known to be permanently denied, avoid redundant system requests
    if (this.currentStatus === 'never_ask_again') {
      console.log('[MIC] Already known as NEVER_ASK_AGAIN. Skipping redundant request.');
      return 'never_ask_again';
    }

    try {
      console.log('[MIC] Requesting permission: android.permission.RECORD_AUDIO');
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission Needed',
          message:
            'Imposter needs microphone access so other players in the room can hear your voice clues and discussions.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[MIC] Permission granted: true');
        this.updateStatus('granted');
        return 'granted';
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        console.warn('[MIC] Permission status: never_ask_again');
        this.updateStatus('never_ask_again');
        return 'never_ask_again';
      } else {
        console.warn('[MIC] Permission status: denied');
        this.updateStatus('denied');
        return 'denied';
      }
    } catch (err) {
      console.error('[MIC] Exception requesting microphone permission:', err);
      this.updateStatus('denied');
      return 'denied';
    }
  }

  /**
   * Open Android App Settings when permission is permanently denied
   */
  async openAppSettings(): Promise<void> {
    try {
      console.log('[MIC] Opening Android app settings for manual permission grant...');
      await Linking.openSettings();
    } catch (err) {
      console.error('[MIC] Failed to open app settings:', err);
    }
  }

  /**
   * Prompt user with dialog to open Android Settings if permission was permanently denied
   */
  promptSettingsRedirect(onCancel?: () => void, onOpen?: () => void): void {
    if (this.isPromptingSettings) return;
    this.isPromptingSettings = true;

    Alert.alert(
      'Microphone Permission Required',
      'Microphone access is permanently disabled for Imposter. Please grant microphone permission in Android App Settings to use voice chat.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            this.isPromptingSettings = false;
            onCancel?.();
          },
        },
        {
          text: 'Open Settings',
          onPress: () => {
            this.isPromptingSettings = false;
            this.openAppSettings();
            onOpen?.();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          this.isPromptingSettings = false;
        },
      }
    );
  }
}

export const permissionService = new PermissionService();
export default permissionService;
