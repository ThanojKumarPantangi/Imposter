import { useMemo } from 'react';
import { Player, RoomState } from '../../../types';

interface UseGamePlayersProps {
  roomState?: RoomState | null;
  currentUserId?: string;
  currentUsername?: string;
  currentAvatar?: string;
}

export const useGamePlayers = ({
  roomState,
  currentUserId,
  currentUsername,
  currentAvatar,
}: UseGamePlayersProps) => {
  // Authoritative Turn Order:
  // Players are ordered in the exact sequence determined by the backend game engine (roomState.turnOrder),
  // followed by any non-participating/eliminated players.
  const orderedPlayers = useMemo(() => {
    if (!roomState?.players || roomState.players.length === 0) return [];

    const turnOrder = roomState.turnOrder;
    if (Array.isArray(turnOrder) && turnOrder.length > 0) {
      const playerMap = new Map<string, Player>();
      roomState.players.forEach((p) => {
        playerMap.set(p.id, p);
      });

      const ordered: Player[] = [];
      const seenIds = new Set<string>();

      // 1. Position players in exact authoritative turn order
      for (const id of turnOrder) {
        const p = playerMap.get(id);
        if (p) {
          ordered.push(p);
          seenIds.add(id);
        }
      }

      // 2. Append any remaining players (eliminated in previous rounds or departed)
      for (const p of roomState.players) {
        if (!seenIds.has(p.id)) {
          ordered.push(p);
        }
      }

      return ordered;
    }

    return roomState.players;
  }, [roomState?.players, roomState?.turnOrder]);

  const livingParticipants = useMemo(() => {
    if (!roomState?.turnOrder) return [];
    const playerMap = new Map<string, Player>();
    roomState.players?.forEach((p) => playerMap.set(p.id, p));
    return roomState.turnOrder.filter((id) => {
      const p = playerMap.get(id);
      return p && p.isAlive && !p.permanentlyDeparted;
    });
  }, [roomState?.turnOrder, roomState?.players]);

  const alivePlayers = useMemo(() => {
    if (!roomState?.players) return [];
    return roomState.players.filter((p) => p.isAlive && !p.permanentlyDeparted);
  }, [roomState?.players]);

  const totalAlive = alivePlayers.length;

  const me = useMemo(() => {
    const found = roomState?.players?.find((p) => p.id === currentUserId);
    if (found) return found;
    return {
      id: currentUserId || '',
      username: currentUsername || 'You',
      avatar: currentAvatar || 'avatar-1',
    } as Player;
  }, [roomState?.players, currentUserId, currentUsername, currentAvatar]);

  const isAlive = me.isAlive !== false && !me.permanentlyDeparted;
  const isImposter = me.role === 'IMPOSTER';
  const isCivilian = me.role === 'CIVILIAN';

  return {
    orderedPlayers,
    livingParticipants,
    alivePlayers,
    totalAlive,
    me,
    isAlive,
    isImposter,
    isCivilian,
  };
};

