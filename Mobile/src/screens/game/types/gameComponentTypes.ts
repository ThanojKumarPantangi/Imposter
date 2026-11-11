import { Player, RoomState, ClueEntry, EliminationResult, WinnerResult, DisconnectAlert } from '../../../types';
import { TurnNotificationVariant } from '../../../components/TurnNotificationBanner';

export interface GameTopBarProps {
  roundNumber: number;
  onLeaveGame: () => void;
  isLeaving: boolean;
}

export interface GameTurnBannerProps {
  roomStatus: string;
  showTurnNotification: boolean;
  turnNotificationVariant: TurnNotificationVariant;
  turnNotificationText: string;
  deadline?: number | null;
  totalDurationSeconds: number;
}

export interface GameLoadingProps {
  isLeaving?: boolean;
}

export interface RoleRevealSectionProps {
  deadline?: number | null;
}

export interface EliminatedBannerProps { }

export interface DisconnectCountdownBadgeProps {
  deadline?: number | null;
  timeout?: number;
  isGameOver?: boolean;
}

export interface CluePlayerRowProps {
  player: Player;
  isCurrentPlayer: boolean;
  activeTurnPlayerId?: string | null;
  currentRound: number;
  clueEntry?: ClueEntry;
  isSpeaking: boolean;
  isGameOver: boolean;
  clueInput?: string;
  onClueInputChange?: (text: string) => void;
  onClueSubmit?: () => void;
  isImposter?: boolean;
  disconnectDeadline?: number | null;
  disconnectTimeout?: number;
}

export interface ClueRoundSectionProps {
  roomState: RoomState;
  currentPlayerId?: string;
  orderedPlayers: Player[];
  isMyTurn: boolean;
  isAlive: boolean;
  isImposter: boolean;
  clueInput: string;
  onClueInputChange: (text: string) => void;
  onClueSubmit: () => void;
  activeSpeakerIds: string[];
  disconnectAlert?: DisconnectAlert | null;
}

export interface VotingProgressProps {
  votedCount: number;
  totalAlive: number;
  votingProgress: number;
  playersNotVoted: Player[];
}

export interface VotePlayerCardProps {
  player: Player;
  isSelf: boolean;
  isSelected: boolean;
  hasVoted: boolean;
  isSpeaking: boolean;
  onSelect: (playerId: string) => void;
  disconnectDeadline?: number | null;
  disconnectTimeout?: number;
  isGameOver?: boolean;
}

export interface VotingSectionProps {
  roomState: RoomState;
  currentPlayerId?: string;
  selectedVoteTarget: string | null;
  hasVoted: boolean;
  votedCount: number;
  totalAlive: number;
  votingProgress: number;
  playersNotVoted: Player[];
  activeSpeakerIds: string[];
  onSelectTarget: (playerId: string) => void;
  onVoteSubmit: () => void;
  onSkipVote: () => void;
  disconnectAlert?: DisconnectAlert | null;
}

export interface SpectatorVotingSectionProps {
  roomState: RoomState;
  activeSpeakerIds: string[];
  disconnectAlert?: DisconnectAlert | null;
}

export interface ResultsSectionProps {
  eliminationResult: EliminationResult;
  deadline?: number | null;
  roomState?: RoomState;
  impostersRemaining?: number;
}

export interface FinishedSectionProps {
  winnerResult: WinnerResult;
  onLeaveGame: () => void;
  onReturnToLobby: () => void;
}

