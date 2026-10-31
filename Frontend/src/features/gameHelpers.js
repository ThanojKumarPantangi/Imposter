export function calculateLivingCount(players = []) {
  return players.filter(p => p.isAlive !== false).length;
}

export function isUserActiveTurn(activePlayerId, currentUserId) {
  return activePlayerId && currentUserId && activePlayerId === currentUserId;
}

export function formatTimeSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
