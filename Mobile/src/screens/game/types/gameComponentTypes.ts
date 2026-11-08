import { Player, RoomState, ClueEntry, EliminationResult, WinnerResult } from '../../../types';
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
}

export interface SpectatorVotingSectionProps {
  roomState: RoomState;
  activeSpeakerIds: string[];
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

