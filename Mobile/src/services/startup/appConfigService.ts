import { Platform, NativeModules } from 'react-native';
import { getApiBaseUrl } from '../api/client';
import { AppConfigResponse, StartupEvaluation } from './types';

class AppConfigService {
  /**
   * Retrieves native Android version code from native metadata or runtime config.
   */
  getInstalledVersionCode(): number {
    let versionCode: number | null = null;

    if (Platform.OS === 'android') {
      try {
        const audioRoute = NativeModules.AudioRouteModule;
        const nativeCode = audioRoute?.versionCode ?? (audioRoute?.getConstants ? audioRoute.getConstants().versionCode : null);
        if (typeof nativeCode === 'number' && nativeCode > 0) {
          versionCode = nativeCode;
        }
      } catch (err) {
        console.warn('[AppConfigService] Error reading native module constants:', err);
      }
    }

    return versionCode || 1;
  }

  /**
   * Calls public configuration API: GET /api/v1/app/config?versionCode={code}
   * Completely unauthenticated, robust timeout handling, validates response.
   */
  async fetchAppConfig(versionCode: number, timeoutMs = 8000): Promise<AppConfigResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const baseUrl = await getApiBaseUrl();
      const url = `${baseUrl}/app/config?versionCode=${encodeURIComponent(versionCode)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        return {
          success: false,
          error: json?.message || json?.error || `HTTP ${res.status}: Unable to retrieve app configuration`,
        };
      }

      // Validate core data structure
      if (!this.isValidConfigPayload(json)) {
        return {
          success: false,
          error: 'Invalid configuration payload received from server',
        };
      }

      return json as AppConfigResponse;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      return {
        success: false,
        error: isTimeout
          ? 'Configuration request timed out. Please check your network connection.'
          : err?.message || 'Network error while retrieving app configuration',
      };
    }
  }

  /**
   * Validates server response payload schema
   */
  private isValidConfigPayload(payload: any): boolean {
    if (!payload || typeof payload !== 'object' || payload.success !== true || !payload.data) {
      return false;
    }
    const { server, appUpdate } = payload.data;
    if (!server || typeof server.enabled !== 'boolean') {
      return false;
    }
    if (
      !appUpdate ||
      typeof appUpdate.enabled !== 'boolean' ||
      typeof appUpdate.latestVersionCode !== 'number'
    ) {
      return false;
    }
    return true;
  }

  /**
   * Evaluates startup conditions strictly according to the specified priority matrix.
   */
  evaluateStartup(
    response: AppConfigResponse,
    installedVersionCode: number,
    platform: string = Platform.OS
  ): StartupEvaluation {
    // Priority 1: API Failure / Network Timeout / Malformed Response -> FAIL CLOSED to MAINTENANCE
    if (!response || !response.success || !response.data) {
      return {
        state: 'MAINTENANCE',
        config: null,
        reason: response?.error || 'Unable to establish server connection',
      };
    }

    const { data } = response;

    // Priority 2: Server Under Maintenance (server.enabled === false)
    if (!data.server || data.server.enabled === false) {
      return {
        state: 'MAINTENANCE',
        config: data,
        reason: data.server?.message || "We're currently performing scheduled maintenance.",
      };
    }

    // Priority 3: Mandatory Hard Update (Exclusive to Android)
    if (platform === 'android') {
      const { appUpdate } = data;
      if (
        appUpdate &&
        appUpdate.enabled === true &&
        appUpdate.isUpdateRequired === true &&
        installedVersionCode < appUpdate.latestVersionCode &&
        appUpdate.isBlocked === true
      ) {
        return {
          state: 'HARD_UPDATE',
          config: data,
          reason: appUpdate.message || 'A mandatory update is required to continue playing.',
        };
      }
    }

    // Priority 4: Normal application entry allowed
    return {
      state: 'NORMAL_APP',
      config: data,
    };
  }
}

export const appConfigService = new AppConfigService();
export default appConfigService;

