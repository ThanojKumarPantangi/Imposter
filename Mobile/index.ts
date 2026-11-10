import 'react-native-gesture-handler';
import { Alert, LogBox } from 'react-native';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

import App from './App';

// Keep native splash screen visible while AppStartupGuard performs startup check
SplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress known non-fatal warnings in New Architecture
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  'setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.',
]);

// Catch global unhandled JS exceptions in release mode to show user diagnostics
if ((global as any).ErrorUtils) {
  const originalHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.error('GLOBAL_JS_FATAL_ERROR:', error);
    try {
      Alert.alert(
        'JS Fatal Error',
        String(error?.message || error) + '\n\n' + String(error?.stack || '')
      );
    } catch (_e) {}
    originalHandler?.(error, isFatal);
  });
}

registerRootComponent(App);
