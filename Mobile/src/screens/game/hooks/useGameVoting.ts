import { useState, useEffect, useMemo, useCallback } from 'react';
import { Player, RoomState } from '../../../types';

interface UseGameVotingProps {
  roomState?: RoomState | null;
  roomCode: string;
  currentUserId?: string;
  isAlive: boolean;
  alivePlayers: Player[];
  totalAlive: number;
  submitVote: (roomCode: string, voterId: string, targetPlayerId: string) => void;
  submitSkipVote: (roomCode: string, voterId: string) => void;
  setErrorMessage: (msg: string) => void;
}

export const useGameVoting = ({
  roomState,
  roomCode,
  currentUserId,
  isAlive,
  alivePlayers,
  totalAlive,
  submitVote,
  submitSkipVote,
  setErrorMessage,
}: UseGameVotingProps) => {
  const [selectedVoteTarget, setSelectedVoteTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);

  // Reset vote submission when entering a new voting round
  useEffect(() => {
    if (roomState?.status === 'VOTING') {
      setHasVoted(false);
      setSelectedVoteTarget(null);
    }
  }, [roomState?.status, roomState?.currentRound]);

  const votedCount = useMemo(() => {
    return alivePlayers.filter(
      (p) => roomState?.votes?.[p.id] !== undefined && roomState?.votes?.[p.id] !== null
    ).length;
  }, [alivePlayers, roomState?.votes]);

  const votingProgress = useMemo(() => {
    return totalAlive > 0 ? (votedCount / totalAlive) * 100 : 0;
  }, [totalAlive, votedCount]);

  const playersNotVoted = useMemo(() => {
    return alivePlayers.filter(
      (p) => roomState?.votes?.[p.id] === undefined || roomState?.votes?.[p.id] === null
    );
  }, [alivePlayers, roomState?.votes]);

  const handleVoteSubmit = useCallback(() => {
    setErrorMessage('');
    if (!isAlive) return;
    if (!selectedVoteTarget) {
      setErrorMessage('Please select a player to vote for.');
      return;
    }
    if (currentUserId) {
      submitVote(roomCode, currentUserId, selectedVoteTarget);
      setHasVoted(true);
    }
  }, [isAlive, selectedVoteTarget, currentUserId, submitVote, roomCode, setErrorMessage]);

  const handleSkipVote = useCallback(() => {
    setErrorMessage('');
    if (!isAlive || hasVoted) return;
    if (currentUserId) {
      submitSkipVote(roomCode, currentUserId);
      setHasVoted(true);
    }
  }, [isAlive, hasVoted, currentUserId, submitSkipVote, roomCode, setErrorMessage]);

  return {
    selectedVoteTarget,
    setSelectedVoteTarget,
    hasVoted,
    setHasVoted,
    votedCount,
    votingProgress,
    playersNotVoted,
    handleVoteSubmit,
    handleSkipVote,
  };
};

