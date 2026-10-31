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
  const { socket, roomState, roomLifecycleState } = useSocket();
  const { player } = useAuth();

  // Restore persisted preferences or defaults: Mic default OFF, Speaker default ON
  const savedMic = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('voice_mic_enabled') === 'true' : false;
  const savedSpeaker = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('voice_speaker_enabled') !== 'false' : true;

  const [micEnabled, setMicEnabled] = useState(savedMic);
  const [speakerEnabled, setSpeakerEnabled] = useState(savedSpeaker);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // Synchronous refs to prevent stale closure bugs in WebRTC events
  const micEnabledRef = useRef(savedMic);
  const speakerEnabledRef = useRef(savedSpeaker);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // { [peerSocketId]: { pc: RTCPeerConnection, playerId: string, makingOffer: boolean } }
  const remoteAudiosRef = useRef({}); // { [peerSocketId]: HTMLAudioElement }
  const iceCandidateQueuesRef = useRef({}); // { [peerSocketId]: Array<RTCIceCandidateInit> }

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    speakerEnabledRef.current = speakerEnabled;
  }, [speakerEnabled]);

  // Acquire or retrieve local microphone stream
  async function acquireLocalStream() {
    let stream = localStreamRef.current;
    const track = stream?.getAudioTracks()[0];
    if (stream && stream.active && track && track.readyState === 'live') {
      track.enabled = true;
      return stream;
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    localStreamRef.current = stream;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = true;
    }
    return stream;
  }

  // Flush queued ICE candidates that arrived before remoteDescription was set
  const flushQueuedCandidates = async (peerSocketId) => {
    const peer = peersRef.current[peerSocketId];
    const queue = iceCandidateQueuesRef.current[peerSocketId];
    if (peer && peer.pc && queue && queue.length > 0) {
      const toFlush = [...queue];
      iceCandidateQueuesRef.current[peerSocketId] = [];
      for (const cand of toFlush) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error applying queued ICE candidate:', e);
        }
      }
    }
  };

  // Create or retrieve an RTCPeerConnection for a remote peer
  function getOrCreatePeerConnection(peerSocketId, peerPlayerId) {
    if (peersRef.current[peerSocketId]) {
      return peersRef.current[peerSocketId].pc;
    }

    // Clean up any stale peer connection for the SAME player (from before page refresh / socket reconnection)
    for (const [oldSocketId, existingPeer] of Object.entries(peersRef.current)) {
      if (existingPeer.playerId === peerPlayerId && oldSocketId !== peerSocketId) {
        console.log(`🧹 [Voice] Cleaning up stale peer connection for player ${peerPlayerId} (old socket: ${oldSocketId})`);
        cleanupPeer(oldSocketId);
      }
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Attach active local audio track if mic is currently ON
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack && audioTrack.readyState === 'live' && micEnabledRef.current) {
      pc.addTrack(audioTrack, localStreamRef.current);
    } else {
      // Add audio transceiver upfront with sendrecv direction so SDP offer/answer includes the audio media section
      try {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      } catch (e) {
        console.warn('Could not add audio transceiver:', e);
      }
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_signal_ice_candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate,
          senderId: player?.id
        });
      }
    };

    // Connection state monitoring & recovery
    pc.onconnectionstatechange = () => {
      console.log(`📶 [WebRTC] Peer ${peerSocketId} connectionState:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch (e) {
          // ignore
        }
      }
    };

    // Receive remote audio track
    pc.ontrack = (event) => {
      console.log(`🔊 [WebRTC] ontrack received for peer ${peerSocketId}, track kind:`, event.track.kind);
      const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);

      let audio = remoteAudiosRef.current[peerSocketId];
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;
        audio.id = `remote-audio-${peerSocketId}`;
        // Append to DOM to prevent Chrome from garbage-collecting unattached Audio elements
        document.body.appendChild(audio);
        remoteAudiosRef.current[peerSocketId] = audio;
      }

      audio.srcObject = stream;
      audio.muted = !speakerEnabledRef.current;
      audio.volume = 1.0;

      const playAudio = () => {
        if (!audio.srcObject) return;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.log('🔇 Autoplay waiting for user gesture:', err?.message);
            const resumeAudio = () => {
              if (audio && audio.srcObject) {
                audio.play().catch(() => {});
              }
              window.removeEventListener('click', resumeAudio);
              window.removeEventListener('keydown', resumeAudio);
              window.removeEventListener('touchstart', resumeAudio);
            };
            window.addEventListener('click', resumeAudio, { once: true });
            window.addEventListener('keydown', resumeAudio, { once: true });
            window.addEventListener('touchstart', resumeAudio, { once: true });
          });
        }
      };

      playAudio();

      event.track.addEventListener('unmute', () => {
        console.log(`🔊 Remote track unmuted for peer ${peerSocketId}`);
        playAudio();
      });
    };

    peersRef.current[peerSocketId] = {
      pc,
      playerId: peerPlayerId,
      makingOffer: false
    };

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
      const audio = remoteAudiosRef.current[peerSocketId];
      try {
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      } catch (e) {
        // ignore
      }
      delete remoteAudiosRef.current[peerSocketId];
    }
    delete iceCandidateQueuesRef.current[peerSocketId];
  }

  function cleanupAllPeers() {
    Object.keys(peersRef.current).forEach(cleanupPeer);
    peersRef.current = {};
    iceCandidateQueuesRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setInVoiceRoom(false);
  }

  // Join Voice Room effect with lifecycle handling & refresh recovery
  useEffect(() => {
    if (
      !socket ||
      !roomState?.code ||
      !player?.id ||
      roomLifecycleState === 'INTENTIONAL_EXIT' ||
      roomLifecycleState === 'NO_ROOM'
    ) {
      if (roomLifecycleState === 'INTENTIONAL_EXIT' || roomLifecycleState === 'NO_ROOM') {
        sessionStorage.removeItem('voice_mic_enabled');
        sessionStorage.removeItem('voice_speaker_enabled');
        setMicEnabled(false);
        micEnabledRef.current = false;
        setSpeakerEnabled(true);
        speakerEnabledRef.current = true;
      }
      cleanupAllPeers();
      return;
    }

    setInVoiceRoom(true);

    // Auto-restore microphone stream if previously saved as ON
    if (micEnabledRef.current) {
      acquireLocalStream().catch(err => {
        console.warn('Could not auto-restore mic stream on room join/refresh:', err.message);
        setMicEnabled(false);
        micEnabledRef.current = false;
        sessionStorage.setItem('voice_mic_enabled', 'false');
      });
    }

    // Join voice signaling room on backend
    socket.emit('voice_signal_join', { roomCode: roomState.code, playerId: player.id });

    // Handle authoritative list of active participants returned by backend
    const handleVoiceParticipantsList = async ({ participants }) => {
      if (!Array.isArray(participants)) return;
      for (const p of participants) {
        const targetSocketId = p.socketId || p.peerSocketId;
        if (!targetSocketId || targetSocketId === socket.id) continue;

        // Clean up any stale peer for this player
        if (p.playerId) {
          for (const [oldSocketId, existingPeer] of Object.entries(peersRef.current)) {
            if (existingPeer.playerId === p.playerId && oldSocketId !== targetSocketId) {
              cleanupPeer(oldSocketId);
            }
          }
        }

        // Initialize peer connection so it is ready to receive negotiation
        getOrCreatePeerConnection(targetSocketId, p.playerId);
      }
    };

    // Another peer joined or refreshed in the room -> initiate offer to them
    const handlePeerJoined = async ({ peerSocketId, playerId }) => {
      if (!peerSocketId || peerSocketId === socket.id) return;
      try {
        const pc = getOrCreatePeerConnection(peerSocketId, playerId);
        const peer = peersRef.current[peerSocketId];
        if (peer) peer.makingOffer = true;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('voice_signal_offer', {
          targetSocketId: peerSocketId,
          offer,
          callerId: player.id
        });
      } catch (err) {
        console.error('Error creating voice offer:', err);
      } finally {
        if (peersRef.current[peerSocketId]) {
          peersRef.current[peerSocketId].makingOffer = false;
        }
      }
    };

    // Incoming offer from a peer -> create answer
    const handleSignalOffer = async ({ callerSocketId, callerId, offer }) => {
      if (!callerSocketId || callerSocketId === socket.id) return;
      try {
        const pc = getOrCreatePeerConnection(callerSocketId, callerId);
        const peer = peersRef.current[callerSocketId];

        // Polite peer glare resolution
        const isPolite = player?.id && callerId ? player.id.localeCompare(callerId) > 0 : false;
        const offerCollision = pc.signalingState !== 'stable' || (peer && peer.makingOffer);

        if (offerCollision) {
          if (!isPolite) {
            console.log(`[WebRTC] Glare collision: impolite peer ignoring offer from ${callerSocketId}`);
            return;
          }
          console.log(`[WebRTC] Glare collision: polite peer rolling back for offer from ${callerSocketId}`);
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushQueuedCandidates(callerSocketId);

        // Ensure our audio track is attached if mic is ON
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack && audioTrack.readyState === 'live' && micEnabledRef.current) {
          const transceiver = pc.getTransceivers().find(
            t => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
          );
          if (transceiver && transceiver.sender) {
            await transceiver.sender.replaceTrack(audioTrack);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('voice_signal_answer', {
          targetSocketId: callerSocketId,
          answer,
          responderId: player.id
        });
      } catch (err) {
        console.error('Error answering voice offer:', err);
      }
    };

    // Incoming answer from remote peer
    const handleSignalAnswer = async ({ responderSocketId, answer }) => {
      try {
        const peer = peersRef.current[responderSocketId];
        if (peer && peer.pc) {
          if (peer.pc.signalingState === 'have-local-offer') {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
            await flushQueuedCandidates(responderSocketId);
          } else {
            console.warn(`[WebRTC] Ignoring answer in state: ${peer.pc.signalingState}`);
          }
        }
      } catch (err) {
        console.error('Error setting remote description from answer:', err);
      }
    };

    // Incoming ICE candidate
    const handleSignalIceCandidate = async ({ senderSocketId, candidate }) => {
      try {
        if (!candidate) return;
        const peer = peersRef.current[senderSocketId];
        if (peer && peer.pc && peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Queue candidate until remote description is applied
          if (!iceCandidateQueuesRef.current[senderSocketId]) {
            iceCandidateQueuesRef.current[senderSocketId] = [];
          }
          iceCandidateQueuesRef.current[senderSocketId].push(candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    };

    // Remote peer left
    const handlePeerLeft = ({ peerSocketId, playerId }) => {
      if (peerSocketId) cleanupPeer(peerSocketId);
      if (playerId) {
        for (const [sId, p] of Object.entries(peersRef.current)) {
          if (p.playerId === playerId) {
            cleanupPeer(sId);
          }
        }
      }
    };

    socket.on('voice_participants_list', handleVoiceParticipantsList);
    socket.on('voice_peer_joined', handlePeerJoined);
    socket.on('voice_signal_offer', handleSignalOffer);
    socket.on('voice_signal_answer', handleSignalAnswer);
    socket.on('voice_signal_ice_candidate', handleSignalIceCandidate);
    socket.on('voice_peer_left', handlePeerLeft);

    // Socket reconnection handler
    const handleSocketConnect = () => {
      console.log('🔄 [Voice] Socket reconnected, re-initializing voice peers with new socket ID:', socket.id);
      cleanupAllPeers();
      socket.emit('voice_signal_join', { roomCode: roomState.code, playerId: player.id });
    };

    socket.on('connect', handleSocketConnect);

    return () => {
      socket.off('voice_participants_list', handleVoiceParticipantsList);
      socket.off('voice_peer_joined', handlePeerJoined);
      socket.off('voice_signal_offer', handleSignalOffer);
      socket.off('voice_signal_answer', handleSignalAnswer);
      socket.off('voice_signal_ice_candidate', handleSignalIceCandidate);
      socket.off('voice_peer_left', handlePeerLeft);
      socket.off('connect', handleSocketConnect);
      cleanupAllPeers();
    };
  }, [socket, roomState?.code, player?.id, roomLifecycleState]);

  // Toggle Microphone (Default OFF -> ON)
  const toggleMicrophone = async () => {
    try {
      setVoiceError(null);
      if (!micEnabledRef.current) {
        // Turning ON
        const stream = await acquireLocalStream();
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;

          // Attach or replace track across all active peer connections
          for (const { pc } of Object.values(peersRef.current)) {
            const transceiver = pc.getTransceivers().find(
              t => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
            );
            if (transceiver && transceiver.sender) {
              await transceiver.sender.replaceTrack(audioTrack);
            } else {
              const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
              if (sender) {
                await sender.replaceTrack(audioTrack);
              } else {
                pc.addTrack(audioTrack, stream);
              }
            }
          }
        }

        setMicEnabled(true);
        micEnabledRef.current = true;
        sessionStorage.setItem('voice_mic_enabled', 'true');
        if (socket && roomState?.code) {
          socket.emit('voice_mute_state', { roomCode: roomState.code, playerId: player.id, isMuted: false });
        }
      } else {
        // Turning OFF
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => {
            t.enabled = false;
            t.stop();
          });
          localStreamRef.current = null;
        }

        // Replace track with null across all active peer connections so remote peers receive silence
        for (const { pc } of Object.values(peersRef.current)) {
          const transceiver = pc.getTransceivers().find(
            t => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
          );
          if (transceiver && transceiver.sender) {
            transceiver.sender.replaceTrack(null).catch(() => {});
          } else {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
            if (sender) {
              sender.replaceTrack(null).catch(() => {});
            }
          }
        }

        setMicEnabled(false);
        micEnabledRef.current = false;
        sessionStorage.setItem('voice_mic_enabled', 'false');
        if (socket && roomState?.code) {
          socket.emit('voice_mute_state', { roomCode: roomState.code, playerId: player.id, isMuted: true });
        }
      }
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err.message);
      setVoiceError('Microphone permission required for voice chat.');
      setMicEnabled(false);
      micEnabledRef.current = false;
      sessionStorage.setItem('voice_mic_enabled', 'false');
    }
  };

  // Toggle Speaker / Deafen (Default ON -> OFF)
  const toggleSpeaker = () => {
    const newState = !speakerEnabledRef.current;
    setSpeakerEnabled(newState);
    speakerEnabledRef.current = newState;
    sessionStorage.setItem('voice_speaker_enabled', newState.toString());

    Object.values(remoteAudiosRef.current).forEach(audio => {
      if (audio) {
        audio.muted = !newState;
        if (newState) {
          audio.play().catch(() => {});
        }
      }
    });

    if (socket && roomState?.code) {
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
