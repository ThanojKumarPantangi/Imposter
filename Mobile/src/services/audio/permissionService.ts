import { PermissionsAndroid, Platform, Linking, Alert } from 'react-native';

export type MicPermissionStatus = 'granted' | 'denied' | 'never_ask_again';

class PermissionService {
  /**
   * Check if RECORD_AUDIO permission is currently granted
   */
  async checkMicrophonePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    } catch (err) {
      console.warn('[MIC] Error checking RECORD_AUDIO permission:', err);
      return false;
    }
  }

  /**
   * Request RECORD_AUDIO runtime permission with rationale
   */
  async requestMicrophonePermission(): Promise<MicPermissionStatus> {
    if (Platform.OS !== 'android') return 'granted';

    try {
      console.log('[MIC] Requesting Android RECORD_AUDIO permission...');
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
        console.log('[MIC] RECORD_AUDIO permission GRANTED');
        return 'granted';
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        console.warn('[MIC] RECORD_AUDIO permission NEVER_ASK_AGAIN (permanently denied)');
        return 'never_ask_again';
      } else {
        console.warn('[MIC] RECORD_AUDIO permission DENIED');
        return 'denied';
      }
    } catch (err) {
      console.error('[MIC] Exception requesting microphone permission:', err);
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
  promptSettingsRedirect(onCancel?: () => void): void {
    Alert.alert(
      'Microphone Permission Required',
      'Microphone access is permanently disabled for Imposter. Please grant microphone permission in Android App Settings to use voice chat.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: 'Open Settings',
          onPress: () => this.openAppSettings(),
        },
      ]
    );
  }
}

export const permissionService = new PermissionService();
export default permissionService;

