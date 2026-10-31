import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const VoiceChatContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function VoiceChatProvider({ children }) {
  const { socket, roomState } = useSocket();
  const { player } = useAuth();

  // Specification 11.3: Mic default OFF, Speaker default ON
  const [micEnabled, setMicEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState({}); // { [playerId]: boolean }
  const [voiceError, setVoiceError] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // { [peerSocketId]: { pc: RTCPeerConnection, playerId: string } }
  const remoteAudiosRef = useRef({}); // { [peerSocketId]: HTMLAudioElement }

  // Join Voice room when player enters room
  useEffect(() => {
    if (!socket || !roomState || !player) return;

    setInVoiceRoom(true);
    socket.emit('voice_signal_join', { roomCode: roomState.code, playerId: player.id });

    // Signaling handlers
    const handlePeerJoined = async ({ peerSocketId, playerId }) => {
      try {
        const pc = createPeerConnection(peerSocketId, playerId);
        // Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice_signal_offer', { targetSocketId: peerSocketId, offer, callerId: player.id });
      } catch (err) {
        console.error('Error creating voice offer:', err);
      }
    };

    const handleSignalOffer = async ({ callerSocketId, callerId, offer }) => {
      try {
        const pc = createPeerConnection(callerSocketId, callerId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice_signal_answer', { targetSocketId: callerSocketId, answer, responderId: player.id });
      } catch (err) {
        console.error('Error answering voice offer:', err);
      }
    };

    const handleSignalAnswer = async ({ responderSocketId, answer }) => {
      try {
        const peer = peersRef.current[responderSocketId];
        if (peer && peer.pc) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.error('Error setting remote description from answer:', err);
      }
    };

    const handleSignalIceCandidate = async ({ senderSocketId, candidate }) => {
      try {
        const peer = peersRef.current[senderSocketId];
        if (peer && peer.pc && candidate) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    };

    const handlePeerLeft = ({ peerSocketId, playerId }) => {
      cleanupPeer(peerSocketId);
    };

    socket.on('voice_peer_joined', handlePeerJoined);
    socket.on('voice_signal_offer', handleSignalOffer);
    socket.on('voice_signal_answer', handleSignalAnswer);
    socket.on('voice_signal_ice_candidate', handleSignalIceCandidate);
    socket.on('voice_peer_left', handlePeerLeft);

    return () => {
      socket.off('voice_peer_joined', handlePeerJoined);
      socket.off('voice_signal_offer', handleSignalOffer);
      socket.off('voice_signal_answer', handleSignalAnswer);
      socket.off('voice_signal_ice_candidate', handleSignalIceCandidate);
      socket.off('voice_peer_left', handlePeerLeft);
      cleanupAllPeers();
    };
  }, [socket, roomState?.code, player?.id]);

  function createPeerConnection(peerSocketId, peerPlayerId) {
    if (peersRef.current[peerSocketId]) {
      return peersRef.current[peerSocketId].pc;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_signal_ice_candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate,
          senderId: player?.id
        });
      }
    };

    // Receive remote audio track
    pc.ontrack = (event) => {
      let audio = remoteAudiosRef.current[peerSocketId];
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        remoteAudiosRef.current[peerSocketId] = audio;
      }
      audio.srcObject = event.streams[0];
      audio.muted = !speakerEnabled;
    };

    peersRef.current[peerSocketId] = { pc, playerId: peerPlayerId };
    return pc;
  }

  function cleanupPeer(peerSocketId) {
    if (peersRef.current[peerSocketId]) {
      try {
        peersRef.current[peerSocketId].pc.close();
      } catch (e) {
        // ignore
      }
      delete peersRef.current[peerSocketId];
    }
    if (remoteAudiosRef.current[peerSocketId]) {
      remoteAudiosRef.current[peerSocketId].srcObject = null;
      delete remoteAudiosRef.current[peerSocketId];
    }
  }

  function cleanupAllPeers() {
    Object.keys(peersRef.current).forEach(cleanupPeer);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setInVoiceRoom(false);
  }

  // Toggle Microphone
  const toggleMicrophone = async () => {
    try {
      setVoiceError(null);
      if (!micEnabled) {
        // Turning ON
        let stream = localStreamRef.current;
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;

          // Add track to all active peer connections
          const audioTrack = stream.getAudioTracks()[0];
          Object.values(peersRef.current).forEach(({ pc }) => {
            pc.addTrack(audioTrack, stream);
          });
        }
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
        setMicEnabled(true);
        if (socket && roomState) {
          socket.emit('voice_mute_state', { roomCode: roomState.code, playerId: player.id, isMuted: false });
        }
      } else {
        // Turning OFF
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
        }
        setMicEnabled(false);
        if (socket && roomState) {
          socket.emit('voice_mute_state', { roomCode: roomState.code, playerId: player.id, isMuted: true });
        }
      }
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err.message);
      setVoiceError('Microphone permission required for voice chat.');
      setMicEnabled(false);
    }
  };

  // Toggle Speaker / Deafen
  const toggleSpeaker = () => {
    const newState = !speakerEnabled;
    setSpeakerEnabled(newState);
    Object.values(remoteAudiosRef.current).forEach(audio => {
      audio.muted = !newState;
    });
    if (socket && roomState) {
      socket.emit('voice_mute_state', { roomCode: roomState.code, playerId: player.id, isDeafened: !newState });
    }
  };

  return (
    <VoiceChatContext.Provider
      value={{
        micEnabled,
        speakerEnabled,
        inVoiceRoom,
        voiceError,
        toggleMicrophone,
        toggleSpeaker
      }}
    >
      {children}
    </VoiceChatContext.Provider>
  );
}

export function useVoiceChat() {
  const context = useContext(VoiceChatContext);
  if (!context) {
    throw new Error('useVoiceChat must be used within a VoiceChatProvider');
  }
  return context;
}
