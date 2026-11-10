import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { VoiceChatProvider } from './context/VoiceChatContext';
import { ChatProvider } from './context/ChatContext';
import { ChatModal } from './components/ChatModal';
import App from './App';

export default function Root() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <VoiceChatProvider>
            <ChatProvider>
              <App />
              <ChatModal />
            </ChatProvider>
          </VoiceChatProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
