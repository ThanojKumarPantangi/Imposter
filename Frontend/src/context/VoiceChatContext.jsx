import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const VoiceChatContext = createContext(null);

const getIceServers = () => {
  const iceServers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl) {
    const urls = [];
    if (turnUrl.includes('?')) {
      urls.push(turnUrl);
    } else {
      urls.push(`${turnUrl}?transport=udp`);
      urls.push(`${turnUrl}?transport=tcp`);
    }

    iceServers.push({
      urls,
      username: turnUsername,
      credential: turnCredential
    });
  }

  return { iceServers };
};

const ICE_SERVERS = getIceServers();

export function VoiceChatProvider({ children }) {
  const { socket, roomState } = useSocket();
  const { player } = useAuth();

  // Specification: Mic default OFF, Speaker default ON
  const [micEnabled, setMicEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // { [peerSocketId]: { pc: RTCPeerConnection, playerId: string } }
  const remoteAudiosRef = useRef({}); // { [peerSocketId]: HTMLAudioElement }

  // Join Voice room when player enters room
  useEffect(() => {
    if (!socket || !roomState?.code || !player?.id) {
      cleanupAllPeers();
      return;
    }

    setInVoiceRoom(true);
    socket.emit('voice_signal_join', { roomCode: roomState.code, playerId: player.id });

    // Signaling handlers
    const handlePeerJoined = async ({ peerSocketId, playerId }) => {
      try {
        const pc = createPeerConnection(peerSocketId, playerId);
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

    const handlePeerLeft = ({ peerSocketId }) => {
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

    // CRITICAL WEBRTC FIX: Add audio transceiver upfront with sendrecv direction
    // This guarantees the initial SDP offer/answer includes the audio media section
    // Even when the microphone starts in the disabled state!
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    } catch (e) {
      console.warn('Could not add audio transceiver:', e);
    }

    // Attach active microphone track if already enabled
    if (localStreamRef.current && micEnabled) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio' || s.dtmf != null);
        if (sender) {
          sender.replaceTrack(audioTrack).catch(err => console.warn('replaceTrack error:', err));
        } else {
          pc.addTrack(audioTrack, localStreamRef.current);
        }
      }
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

    // Receive remote audio track and attach with autoplay fallback
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      let audio = remoteAudiosRef.current[peerSocketId];
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;
        remoteAudiosRef.current[peerSocketId] = audio;
      }
      audio.srcObject = stream;
      audio.muted = !speakerEnabled;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Browser autoplay policy: resume on first user interaction
          const resumeAudio = () => {
            audio.play().catch(() => {});
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
          };
          window.addEventListener('click', resumeAudio, { once: true });
          window.addEventListener('keydown', resumeAudio, { once: true });
        });
      }
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
      try {
        remoteAudiosRef.current[peerSocketId].pause();
        remoteAudiosRef.current[peerSocketId].srcObject = null;
      } catch (e) {
        // ignore
      }
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

  // Toggle Microphone (Default OFF -> ON)
  const toggleMicrophone = async () => {
    try {
      setVoiceError(null);
      if (!micEnabled) {
        // Turning ON
        let stream = localStreamRef.current;
        if (!stream || !stream.active) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          localStreamRef.current = stream;
        }

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;

          // Replace track seamlessly across all active peer connections
          for (const { pc } of Object.values(peersRef.current)) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio' || s.dtmf != null);
            if (sender) {
              await sender.replaceTrack(audioTrack);
            } else {
              pc.addTrack(audioTrack, stream);
            }
          }
        }

        setMicEnabled(true);
        if (socket && roomState) {
          socket.emit('voice_mute_state', { roomCode: roomState.code, playerId: player.id, isMuted: false });
        }
      } else {
        // Turning OFF
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
        }

        // Replace track with null so remote peers receive absolute silence
        for (const { pc } of Object.values(peersRef.current)) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio' || s.dtmf != null);
          if (sender) {
            sender.replaceTrack(null).catch(() => {});
          }
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

  // Toggle Speaker / Deafen (Default ON -> OFF)
  const toggleSpeaker = () => {
    const newState = !speakerEnabled;
    setSpeakerEnabled(newState);
    Object.values(remoteAudiosRef.current).forEach(audio => {
      if (audio) audio.muted = !newState;
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
        toggleSpeaker,
        cleanupVoiceRoom: cleanupAllPeers
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
