export function formatGameResult(winnerRole, secretWord, hint, players) {
  return {
    winnerRole,
    secretWord,
    hint,
    totalPlayers: players.length,
    timestamp: new Date().toISOString()
  };
}

export default { formatGameResult };
