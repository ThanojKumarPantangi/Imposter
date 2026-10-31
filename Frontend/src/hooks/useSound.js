import { sounds } from '../utils/sound';

export function useSound() {
  return {
    playClick: () => sounds.playClick(),
    playTurnAlert: () => sounds.playTurnAlert(),
    playReveal: () => sounds.playReveal(),
    playWin: () => sounds.playWin(),
    toggleSound: () => sounds.toggleSound()
  };
}
