import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export function ChatButton({ compact = false }) {
  const { openChat, totalUnreadCount } = useChat();

  return (
    <button
      type="button"
      onClick={() => openChat()}
      className={`relative inline-flex items-center justify-center rounded-xl border border-slate-800 bg-dark-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-md ${
        compact ? 'h-9 px-2.5 text-xs' : 'h-11 px-3.5 text-sm'
      }`}
      title={`Open chat${totalUnreadCount > 0 ? ` (${totalUnreadCount} unread)` : ''}`}
    >
      <MessageSquare className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
      {totalUnreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-extrabold text-[10px] flex items-center justify-center border-2 border-dark-950 shadow-md animate-pulse">
          {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
        </span>
      )}
    </button>
  );
}

