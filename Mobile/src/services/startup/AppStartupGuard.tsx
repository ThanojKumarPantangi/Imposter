import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  AppStateStatus,
  View,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { appConfigService } from './appConfigService';
import { startupGate } from './startupGate';
import { AppConfigData, StartupState } from './types';
import { MaintenanceScreen } from '../../screens/startup/MaintenanceScreen';
import { HardUpdateScreen } from '../../screens/startup/HardUpdateScreen';

interface AppStartupGuardProps {
  children: React.ReactNode;
}

export const AppStartupGuard: React.FC<AppStartupGuardProps> = ({ children }) => {
  const [startupState, setStartupState] = useState<StartupState>('LOADING');
  const [configData, setConfigData] = useState<AppConfigData | null>(null);
  const [installedVersionCode, setInstalledVersionCode] = useState<number>(1);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  const lastCheckedAt = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');

  const performCheck = useCallback(async (isUserRetry = false) => {
    if (isUserRetry) {
      setIsRetrying(true);
    }

    try {
      const versionCode = appConfigService.getInstalledVersionCode();
      setInstalledVersionCode(versionCode);

      const response = await appConfigService.fetchAppConfig(versionCode);
      const evaluation = appConfigService.evaluateStartup(response, versionCode);

      lastCheckedAt.current = Date.now();
      startupGate.setState(evaluation.state);
      setStartupState(evaluation.state);
      setConfigData(evaluation.config);

      if (evaluation.state === 'MAINTENANCE') {
        const offlineFailure = !response.success || !response.data;
        setIsOffline(offlineFailure);
        setMaintenanceMessage(evaluation.reason || '');
      } else {
        setIsOffline(false);
        setMaintenanceMessage('');
      }
    } catch (err: any) {
      console.warn('[StartupGuard] Unexpected check failure:', err);
      startupGate.setState('MAINTENANCE');
      setStartupState('MAINTENANCE');
      setIsOffline(true);
      setMaintenanceMessage(
        'Unable to connect to our servers right now. Please check your internet connection and try again.'
      );
    } finally {
      if (isUserRetry) {
        setIsRetrying(false);
      }
    }
  }, []);

  // 1. Initial startup check on mount
  useEffect(() => {
    performCheck(false);
  }, [performCheck]);

  // Listen to runtime startupGate changes (e.g. if HTTP 426 triggers HARD_UPDATE)
  useEffect(() => {
    const unsubscribe = startupGate.subscribe((newState, hardUpdatePayload) => {
      setStartupState(newState);
      if (newState === 'HARD_UPDATE' && hardUpdatePayload?.updateData) {
        setConfigData({
          server: { enabled: true, message: '' },
          appUpdate: {
            enabled: true,
            latestVersionCode: hardUpdatePayload.updateData.latestVersionCode,
            isUpdateRequired: true,
            isBlocked: true,
            updateUrl: hardUpdatePayload.updateData.updateUrl,
            title: hardUpdatePayload.updateData.title,
            message: hardUpdatePayload.updateData.updateMessage,
          },
          version: 1
        });
        if (hardUpdatePayload.installedVersionCode) {
          setInstalledVersionCode(hardUpdatePayload.installedVersionCode);
        }
      }
    });
    return unsubscribe;
  }, []);

  // 2. Hide native splash screen once startup check completes
  useEffect(() => {
    if (startupState !== 'LOADING') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [startupState]);

  // 3. Safety fallback: guarantee splash screen hides within 10 seconds under any condition
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // 4. Lifecycle handling: re-verify when returning to active foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Debounce: don't check more than once every 4 seconds
        const elapsed = Date.now() - lastCheckedAt.current;
        if (elapsed > 4000) {
          performCheck(false);
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [performCheck]);

  // While LOADING, render a solid background view matching the native splash screen color.
  // In React Native New Architecture (Fabric), root surface requires a non-null shadow node.
  if (startupState === 'LOADING') {
    return <View style={styles.loadingContainer} />;
  }

  if (startupState === 'MAINTENANCE') {
    return (
      <MaintenanceScreen
        message={maintenanceMessage}
        onRetry={() => performCheck(true)}
        isRetrying={isRetrying}
        isOffline={isOffline}
      />
    );
  }

  if (startupState === 'HARD_UPDATE') {
    if (configData?.appUpdate) {
      return (
        <HardUpdateScreen
          appUpdate={configData.appUpdate}
          installedVersionCode={installedVersionCode}
        />
      );
    }
    return (
      <MaintenanceScreen
        message="A mandatory update is required to continue. Please update your application."
        onRetry={() => performCheck(true)}
        isRetrying={isRetrying}
        isOffline={isOffline}
      />
    );
  }

  // State is NORMAL_APP: Allow full application entry and initialization
  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#07090e',
  },
});

export default AppStartupGuard;

