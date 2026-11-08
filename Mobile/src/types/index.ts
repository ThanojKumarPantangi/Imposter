export type Role = 'IMPOSTER' | 'CIVILIAN' | 'SPECTATOR';

export type RoomStatus =
  | 'WAITING'
  | 'ROLE_REVEAL'
  | 'CLUE_ROUND'
  | 'VOTING'
  | 'RESULTS'
  | 'FINISHED';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  civilianWins?: number;
  imposterWins?: number;
}

export interface Player {
  id: string;
  deviceId?: string;
  username: string;
  avatar: string;
  isHost?: boolean;
  isConnected?: boolean;
  isAlive?: boolean;
  role?: Role;
  permanentlyDeparted?: boolean;
  connectionStatus?: string;
  disconnectDeadline?: number | null;
  gameDisconnectTimeout?: number;
  clues?: string[];
  stats?: PlayerStats;
}

export interface RoomSettings {
  categorySlug?: string;
  categoryName?: string;
  categorySlugs?: string[];
  categoryNames?: string[];
  selectedCategories?: string[];
  impostersCount: number;
  turnDurationSeconds: number;
  votingDurationSeconds: number;
  lobbyDisconnectTimeout: number;
  gameDisconnectTimeout?: number;
  gameDisconnectGracePeriod?: number;
  duration?: number;
}

export interface ClueEntry {
  playerId: string;
  username: string;
  round: number;
  clue?: string;
  status?: 'SUBMITTED' | 'SKIPPED' | string;
  skipped?: boolean;
}

export interface EliminationResult {
  eliminatedPlayer?: Player | null;
  wasSkipped?: boolean;
  tie?: boolean;
  wasTie?: boolean;
  round?: number;
  resultsDeadline?: number | null;
  duration?: number;
}

export interface WinnerResult {
  winnerRole: 'IMPOSTER' | 'CIVILIAN';
  winCondition:
    | 'IMPOSTER_GUESSED_WORD'
    | 'ALL_IMPOSTERS_ELIMINATED'
    | 'IMPOSTERS_PARITY'
    | 'FINAL_SHOWDOWN_DECISIVE'
    | string;
  secretWord: string;
  hint: string;
  imposters: Array<{ id: string; username: string }>;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  currentRound: number;
  turnOrder?: string[];
  activeTurnPlayerId?: string | null;
  activeTurnIndex?: number;
  turnDeadline?: number | null;
  votingDeadline?: number | null;
  roleRevealDeadline?: number | null;
  resultsDeadline?: number | null;
  clueHistory?: ClueEntry[];
  votes?: Record<string, string>;
  myRole?: Role;
  myWord?: string;
  myHint?: string;
  eliminationResult?: EliminationResult;
  winnerResult?: WinnerResult;
}

export interface WordItem {
  word: string;
  hint: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface Category {
  id?: string;
  _id?: string;
  slug: string;
  name: string;
  group?: string;
  description?: string;
  featured?: boolean;
  words?: WordItem[];
}

export interface DisconnectAlert {
  playerId: string;
  username: string;
  deadline?: number;
  disconnectDeadline?: number;
  timeoutSeconds?: number;
  gameDisconnectTimeout?: number;
}

export interface RejoinRequest {
  requestId: string;
  roomCode: string;
  player: Player;
}

export interface RejoinState {
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'TIMEOUT' | 'ERROR';
  requestId?: string;
  roomCode?: string;
  message?: string;
  expiresInSeconds?: number;
  room?: RoomState;
  player?: Player;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export interface MatchHistoryEntry {
  id: string;
  roomCode: string;
  winnerRole: 'IMPOSTER' | 'CIVILIAN';
  winCondition: string;
  secretWord: string;
  categoryName: string;
  playerCount: number;
  durationSeconds: number;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  adminEmail: string;
  action: string;
  details: string;
  createdAt: string;
}

