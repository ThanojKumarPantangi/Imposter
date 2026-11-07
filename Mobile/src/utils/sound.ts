import * as Haptics from 'expo-haptics';

class MobileSoundEffects {
  private enabled = true;

  playClick() {
    if (!this.enabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // safe fallback
    }
  }

  playTurnAlert() {
    if (!this.enabled) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // safe fallback
    }
  }

  playReveal() {
    if (!this.enabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // safe fallback
    }
  }

  playWin() {
    if (!this.enabled) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // safe fallback
    }
  }

  playSuccess() {
    this.playWin();
  }

  toggleSound(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

export const sounds = new MobileSoundEffects();
export default sounds;

