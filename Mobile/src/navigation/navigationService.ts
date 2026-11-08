import { createNavigationContainerRef, StackActions, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Safely navigate to a screen if navigation container is ready
 */
export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    const current = getCurrentRouteName();
    if (current === name) {
      console.log(`[NAVIGATION] Screen ${name} already active. Skipping redundant navigate.`);
      return;
    }
    (navigationRef as any).navigate(name, params);
  }
}

/**
 * Replace current screen with target screen
 */
export function replace<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    const current = getCurrentRouteName();
    if (current === name) {
      console.log(`[NAVIGATION] Screen ${name} already active. Skipping redundant replace.`);
      return;
    }
    navigationRef.dispatch(StackActions.replace(name, params));
  }
}

/**
 * Get current active route name
 */
export function getCurrentRouteName(): string | undefined {
  if (navigationRef.isReady()) {
    return navigationRef.getCurrentRoute()?.name;
  }
  return undefined;
}

/**
 * Restore screen based on authoritative session recovery
 */
export function restoreSessionScreen(
  targetScreen: 'Lobby' | 'GameView' | 'Home',
  roomCode?: string
) {
  if (!navigationRef.isReady()) {
    // Retry after a short delay if navigation is not mounted yet
    setTimeout(() => restoreSessionScreen(targetScreen, roomCode), 300);
    return;
  }

  const currentRoute = getCurrentRouteName();

  if (targetScreen === 'Home') {
    if (currentRoute === 'Lobby' || currentRoute === 'GameView') {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        })
      );
    }
    return;
  }

  if (!roomCode) return;

  // If already on the correct screen, do not disrupt the user
  if (currentRoute === targetScreen) {
    console.log('[SESSION-RESTORE] Navigation already correct');
    return;
  }

  // If currently on Home, navigate to target screen
  if (currentRoute === 'Home') {
    navigationRef.navigate(targetScreen, { roomCode });
    return;
  }

  // If transitioning between Lobby and GameView
  if (
    (currentRoute === 'Lobby' && targetScreen === 'GameView') ||
    (currentRoute === 'GameView' && targetScreen === 'Lobby')
  ) {
    navigationRef.dispatch(StackActions.replace(targetScreen, { roomCode }));
    return;
  }

  // Fallback if user was in another screen (e.g. Leaderboard, AdminLogin)
  navigationRef.navigate(targetScreen, { roomCode });
}
