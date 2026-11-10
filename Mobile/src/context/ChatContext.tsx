import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { showToast } from '../components/Toast';
import { ChatMessage, ChatChannel, Role } from '../types';

export interface ChatContextType {
  activeTab: 'GLOBAL' | 'TEAM';
  setActiveTab: (tab: 'GLOBAL' | 'TEAM') => void;
  isOpen: boolean;
  openChat: (tab?: 'GLOBAL' | 'TEAM') => void;
  closeChat: () => void;
  lobbyMessages: ChatMessage[];
  gameGlobalMessages: ChatMessage[];
  teamMessages: ChatMessage[];
  unreadGlobalCount: number;
  unreadTeamCount: number;
  totalUnreadCount: number;
  isLobby: boolean;
  myRole: Role | null;
  totalImposters: number;
  isImposterChatEnabled: boolean;
  sendMessage: (text: string) => Promise<{ success: boolean; error?: string }>;
  clearChat: () => void;
  clearGameChats: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, roomState, roomLifecycleState } = useSocket();
  const { player } = useAuth();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTabState] = useState<'GLOBAL' | 'TEAM'>('GLOBAL');

  const [lobbyMessages, setLobbyMessages] = useState<ChatMessage[]>([]);
  const [gameGlobalMessages, setGameGlobalMessages] = useState<ChatMessage[]>([]);
  const [teamMessages, setTeamMessages] = useState<ChatMessage[]>([]);

  const [unreadGlobalCount, setUnreadGlobalCount] = useState<number>(0);
  const [unreadTeamCount, setUnreadTeamCount] = useState<number>(0);

  // Synchronous refs for state inside socket listeners
  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;

  const activeTabRef = useRef<'GLOBAL' | 'TEAM'>(activeTab);
  activeTabRef.current = activeTab;

  const roomCodeRef = useRef<string | null>(roomState?.code || null);
  roomCodeRef.current = roomState?.code || null;

  const playerRef = useRef(player);
  playerRef.current = player;

  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;

  const isLobby = !roomState?.status || roomState.status === 'WAITING';
  const myRole = (roomState?.myRole as Role) || null;

  const totalImposters = (() => {
    if (typeof roomState?.totalImposters === 'number') {
      return roomState.totalImposters;
    }
    if (Array.isArray(roomState?.players)) {
      const impCount = roomState.players.filter((p) => p.role === 'IMPOSTER').length;
      if (impCount > 0) return impCount;
    }
    return roomState?.settings?.impostersCount || 1;
  })();

  const isImposterChatEnabled =
    typeof roomState?.isImposterChatEnabled === 'boolean'
      ? roomState.isImposterChatEnabled
      : totalImposters >= 2;

  const setActiveTab = useCallback((tab: 'GLOBAL' | 'TEAM') => {
    setActiveTabState(tab);
    activeTabRef.current = tab;
    if (tab === 'GLOBAL') {
      setUnreadGlobalCount(0);
    } else {
      setUnreadTeamCount(0);
    }
  }, []);

  const openChat = useCallback((tab?: 'GLOBAL' | 'TEAM') => {
    setIsOpen(true);
    isOpenRef.current = true;
    if (tab) {
      setActiveTabState(tab);
      activeTabRef.current = tab;
      if (tab === 'GLOBAL') {
        setUnreadGlobalCount(0);
      } else {
        setUnreadTeamCount(0);
      }
    } else {
      if (activeTabRef.current === 'GLOBAL') {
        setUnreadGlobalCount(0);
      } else {
        setUnreadTeamCount(0);
      }
    }
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    isOpenRef.current = false;
  }, []);

  const clearGameChats = useCallback(() => {
    setGameGlobalMessages([]);
    setTeamMessages([]);
    setUnreadTeamCount(0);
    setActiveTabState('GLOBAL');
    activeTabRef.current = 'GLOBAL';
  }, []);

  const clearChat = useCallback(() => {
    setLobbyMessages([]);
    setGameGlobalMessages([]);
    setTeamMessages([]);
    setUnreadGlobalCount(0);
    setUnreadTeamCount(0);
  }, []);

  // Reset when leaving room completely
  useEffect(() => {
    if (roomLifecycleState === 'NO_ROOM' || roomLifecycleState === 'INTENTIONAL_EXIT') {
      clearChat();
      setIsOpen(false);
    }
  }, [roomLifecycleState, clearChat]);

  // Reset game chats when gameSessionId changes or status changes to WAITING / FINISHED
  const lastSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentStatus = roomState?.status;
    const currentSession = roomState?.gameSessionId || null;

    if (currentStatus === 'WAITING' || currentStatus === 'FINISHED') {
      clearGameChats();
      lastSessionIdRef.current = null;
    } else if (currentSession && currentSession !== lastSessionIdRef.current) {
      clearGameChats();
      lastSessionIdRef.current = currentSession;
    }
  }, [roomState?.gameSessionId, roomState?.status, clearGameChats]);

  // Listen to lifecycle cleanup events from backend
  useEffect(() => {
    if (!socket) return;

    const handleClear = () => {
      clearGameChats();
    };

    socket.on('game_chats_cleared', handleClear);
    socket.on('game_finished', handleClear);
    socket.on('room_returned_to_lobby', handleClear);

    return () => {
      socket.off('game_chats_cleared', handleClear);
      socket.off('game_finished', handleClear);
      socket.off('room_returned_to_lobby', handleClear);
    };
  }, [socket, clearGameChats]);

  // Request chat history when entering room
  useEffect(() => {
    if (!socket || !roomState?.code || !player?.id) return;
    const normalizedCode = roomState.code.toUpperCase();

    if (roomState?.status === 'WAITING' || roomState?.status === 'FINISHED') {
      clearGameChats();
    }

    socket.emit('get_chat_history', { roomCode: normalizedCode, playerId: player.id }, (res: any) => {
      if (res?.success && res.history) {
        if (Array.isArray(res.history.LOBBY_GLOBAL) && res.history.LOBBY_GLOBAL.length > 0) {
          setLobbyMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of res.history.LOBBY_GLOBAL) {
              if (!existingIds.has(m.id)) merged.push(m);
            }
            return merged.sort((a, b) => a.createdAt - b.createdAt);
          });
        }
        if (roomState?.status !== 'WAITING' && roomState?.status !== 'FINISHED') {
          if (Array.isArray(res.history.GAME_GLOBAL)) {
            setGameGlobalMessages(res.history.GAME_GLOBAL);
          }
          const teamHistory = res.history.GAME_IMPOSTER || res.history.GAME_CIVILIAN;
          if (Array.isArray(teamHistory)) {
            setTeamMessages(teamHistory);
          }
        }
      }
    });
  }, [socket, roomState?.code, player?.id, roomState?.status, roomState?.gameSessionId, clearGameChats]);

  // Handle incoming real-time chat messages
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (msg: ChatMessage) => {
      if (!msg || !msg.channel) return;
      if (roomCodeRef.current && msg.roomCode && msg.roomCode.toUpperCase() !== roomCodeRef.current.toUpperCase()) {
        return; // Ignore messages from other rooms
      }

      // Ignore game messages if game ended, in lobby, or mismatched gameSessionId
      if (msg.channel !== 'LOBBY_GLOBAL') {
        const currentStatus = roomStateRef.current?.status;
        if (currentStatus === 'WAITING' || currentStatus === 'FINISHED') {
          return;
        }
        const currentSession = roomStateRef.current?.gameSessionId;
        if (msg.gameSessionId && currentSession && msg.gameSessionId !== currentSession) {
          return;
        }
      }

      const isSelf = Boolean(playerRef.current?.id && msg.senderId && msg.senderId === playerRef.current.id);

      switch (msg.channel) {
        case 'LOBBY_GLOBAL': {
          setLobbyMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          if (!isSelf) {
            if (!isOpenRef.current) {
              setUnreadGlobalCount((c) => c + 1);
              showToast('New message in Global Chat', () => openChat('GLOBAL'));
            }
          }
          break;
        }

        case 'GAME_GLOBAL': {
          setGameGlobalMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          if (!isSelf) {
            const isViewingThis = isOpenRef.current && activeTabRef.current === 'GLOBAL';
            if (!isViewingThis) {
              setUnreadGlobalCount((c) => c + 1);
              showToast('New message in Global Chat', () => openChat('GLOBAL'));
            }
          }
          break;
        }

        case 'GAME_IMPOSTER': {
          setTeamMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          if (!isSelf) {
            const isViewingThis = isOpenRef.current && activeTabRef.current === 'TEAM';
            if (!isViewingThis) {
              setUnreadTeamCount((c) => c + 1);
              showToast('New message in Imposter Chat', () => openChat('TEAM'));
            }
          }
          break;
        }

        case 'GAME_CIVILIAN': {
          setTeamMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // In Civilian Chat, senderId is not exposed. To avoid false toast if sent in current tab:
          const isViewingThis = isOpenRef.current && activeTabRef.current === 'TEAM';
          if (!isViewingThis) {
            setUnreadTeamCount((c) => c + 1);
            showToast('New message in Civilian Chat', () => openChat('TEAM'));
          }
          break;
        }
      }
    };

    socket.on('chat_message', handleChatMessage);
    return () => {
      socket.off('chat_message', handleChatMessage);
    };
  }, [socket, openChat]);

  // Send message method
  const sendMessage = useCallback(
    async (text: string): Promise<{ success: boolean; error?: string }> => {
      if (!socket || !roomState?.code || !player?.id) {
        return { success: false, error: 'Not connected to room' };
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return { success: false, error: 'Message cannot be empty' };
      }

      let channel: ChatChannel;
      if (isLobby) {
        channel = 'LOBBY_GLOBAL';
      } else if (activeTab === 'GLOBAL') {
        channel = 'GAME_GLOBAL';
      } else {
        if (myRole === 'IMPOSTER') {
          if (!isImposterChatEnabled) {
            return { success: false, error: 'Imposter Chat is disabled when there is only 1 imposter in the game' };
          }
          channel = 'GAME_IMPOSTER';
        } else if (myRole === 'CIVILIAN') {
          channel = 'GAME_CIVILIAN';
        } else {
          return { success: false, error: 'Spectators cannot send team messages' };
        }
      }

      return new Promise((resolve) => {
        socket.emit(
          'send_chat_message',
          {
            roomCode: roomState.code.toUpperCase(),
            playerId: player.id,
            channel,
            text: trimmed,
          },
          (res: any) => {
            if (res?.success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: res?.error || 'Failed to send message' });
            }
          }
        );
      });
    },
    [socket, roomState?.code, player?.id, isLobby, activeTab, myRole, isImposterChatEnabled]
  );

  const totalUnreadCount = isLobby ? unreadGlobalCount : unreadGlobalCount + unreadTeamCount;

  return (
    <ChatContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isOpen,
        openChat,
        closeChat,
        lobbyMessages,
        gameGlobalMessages,
        teamMessages,
        unreadGlobalCount,
        unreadTeamCount,
        totalUnreadCount,
        isLobby,
        myRole,
        totalImposters,
        isImposterChatEnabled,
        sendMessage,
        clearChat,
        clearGameChats,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

