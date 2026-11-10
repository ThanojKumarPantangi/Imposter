import 'react-native-gesture-handler';
import { Alert } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Catch global unhandled JS exceptions in release mode to show user diagnostics
if ((globalThis as any).ErrorUtils) {
  const originalHandler = (globalThis as any).ErrorUtils.getGlobalHandler();
  (globalThis as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
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
