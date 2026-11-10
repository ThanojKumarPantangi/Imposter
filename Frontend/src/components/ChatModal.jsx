import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, X, Shield, Skull, Users, Lock, EyeOff
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

export function ChatModal() {
  const {
    isOpen,
    closeChat,
    activeTab,
    setActiveTab,
    isLobby,
    myRole,
    isImposterChatEnabled,
    lobbyMessages,
    gameGlobalMessages,
    teamMessages,
    unreadGlobalCount,
    unreadTeamCount,
    sendMessage,
  } = useChat();

  const { player } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  const messagesEndRef = useRef(null);

  const messages = isLobby
    ? lobbyMessages
    : activeTab === 'GLOBAL'
    ? gameGlobalMessages
    : teamMessages;

  const isTeamDisabled =
    !isLobby && activeTab === 'TEAM' && myRole === 'IMPOSTER' && !isImposterChatEnabled;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length, activeTab]);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending || isTeamDisabled) return;
    setErrorNotice(null);
    setIsSending(true);
    const textToSend = inputText.trim();
    setInputText('');

    const res = await sendMessage(textToSend);
    setIsSending(false);
    if (!res.success) {
      setErrorNotice(res.error || 'Failed to send message');
      setInputText(textToSend);
    }
  };

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTeamLabel = () => {
    if (myRole === 'IMPOSTER') return 'Imposter Chat';
    if (myRole === 'CIVILIAN') return 'Civilian Chat';
    return 'Team Chat';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-dark-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg h-[80vh] sm:h-[600px] bg-dark-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-dark-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base text-white">
                {isLobby ? 'Lobby Chat' : 'In-Game Chat'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isLobby
                  ? 'Global chat with everyone in room'
                  : activeTab === 'GLOBAL'
                  ? 'Visible to everyone in game'
                  : myRole === 'IMPOSTER'
                  ? 'Private imposter communication'
                  : 'Anonymous civilian communication'}
              </p>
            </div>
          </div>

          <button
            onClick={closeChat}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channels Tab Bar (In-Game only) */}
        {!isLobby && (
          <div className="flex items-center gap-2 px-4 py-2 bg-dark-950 border-b border-slate-800">
            {/* Global Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('GLOBAL')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'GLOBAL'
                  ? 'bg-dark-800 border border-slate-700 text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Global</span>
              {unreadGlobalCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {unreadGlobalCount}
                </span>
              )}
            </button>

            {/* Team Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('TEAM')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'TEAM'
                  ? myRole === 'IMPOSTER'
                    ? 'bg-rose-950/40 border border-rose-500/40 text-rose-300 shadow-sm'
                    : 'bg-dark-800 border border-slate-700 text-cyan-400 shadow-sm'
                  : isTeamDisabled
                  ? 'opacity-50 text-slate-500 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {myRole === 'IMPOSTER' ? (
                <Skull className="w-4 h-4" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              <span>{getTeamLabel()}</span>
              {isTeamDisabled && <Lock className="w-3 h-3 text-slate-500" />}
              {unreadTeamCount > 0 && !isTeamDisabled && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {unreadTeamCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Civilian Anonymous Banner */}
        {!isLobby && activeTab === 'TEAM' && myRole === 'CIVILIAN' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-950/20 border-b border-cyan-500/20 text-cyan-300 text-xs font-semibold">
            <EyeOff className="w-4 h-4 flex-shrink-0" />
            <span>Anonymous Channel • Usernames are hidden for all civilians</span>
          </div>
        )}

        {/* Imposter Disabled Banner */}
        {isTeamDisabled && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border-b border-amber-500/20 text-amber-300">
            <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Imposter Chat Disabled</div>
              <p className="text-xs text-slate-300 mt-0.5">
                Imposter Chat is only available when there are 2 or more imposters in the game.
              </p>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorNotice && (
          <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs font-bold text-center">
            {errorNotice}
          </div>
        )}

        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8 text-slate-500 text-xs">
              {isTeamDisabled
                ? 'Channel disabled for single imposter match.'
                : 'No messages yet. Send a message to get started!'}
            </div>
          ) : (
            messages.map((item) => {
              const isSelf = Boolean(player?.id && item.senderId && item.senderId === player.id);
              const isCivilianTeamChat = item.channel === 'GAME_CIVILIAN';

              if (isCivilianTeamChat) {
                // ANONYMOUS: No username, avatar, or sender ID
                return (
                  <div key={item.id} className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm p-3 bg-cyan-950/30 border border-cyan-500/20">
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-cyan-400">
                        <Shield className="w-3 h-3" />
                        <span>Civilian</span>
                        <span className="text-[10px] text-slate-500 ml-auto font-normal">
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 break-words leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                );
              }

              if (isSelf) {
                return (
                  <div key={item.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm p-3 bg-emerald-500/15 border border-emerald-500/30">
                      <div className="flex items-center justify-end gap-1.5 mb-1 text-[11px]">
                        <span className="text-[10px] text-slate-400">{formatTime(item.createdAt)}</span>
                        <span className="font-extrabold text-emerald-400 uppercase text-[10px]">You</span>
                      </div>
                      <p className="text-sm text-white break-words leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                );
              }

              const isImposterMsg = item.channel === 'GAME_IMPOSTER';

              return (
                <div key={item.id} className="flex justify-start">
                  <div
                    className={`max-w-[80%] rounded-2xl rounded-bl-sm p-3 border ${
                      isImposterMsg
                        ? 'bg-rose-950/30 border-rose-500/30'
                        : 'bg-dark-800 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                      {isImposterMsg && <Skull className="w-3 h-3 text-rose-400" />}
                      <span
                        className={`font-bold truncate max-w-[140px] ${
                          isImposterMsg ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {item.senderUsername || 'Player'}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 break-words leading-relaxed">{item.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-dark-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isTeamDisabled || isSending}
            maxLength={500}
            placeholder={
              isTeamDisabled
                ? 'Chat disabled for single imposter game'
                : isLobby
                ? 'Message lobby...'
                : activeTab === 'GLOBAL'
                ? 'Message everyone in game...'
                : myRole === 'IMPOSTER'
                ? 'Message fellow imposters...'
                : 'Send anonymous civilian clue/message...'
            }
            className="flex-1 bg-dark-900 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 px-4 py-2.5 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm font-semibold outline-none transition-all disabled:opacity-40"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending || isTeamDisabled}
            className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 flex items-center justify-center transition-all shadow-md flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

