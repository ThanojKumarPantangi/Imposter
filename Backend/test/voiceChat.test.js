import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ClientIo } from 'file:///d:/Game/Frontend/node_modules/socket.io-client/build/esm/index.js';
import gameEngine from '../src/services/gameEngine.js';
import roomRepository from '../src/redis/roomRepository.js';
import { registerGameSocket } from '../src/sockets/gameSocket.js';

describe('🎙️ WebRTC Voice Chat Signaling & Redis State Test Suite', () => {
  let httpServer;
  let ioServer;
  let serverPort;

  before(async () => {
    httpServer = http.createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: '*' }
    });
    registerGameSocket(ioServer);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    ioServer?.close();
    httpServer?.close();
  });

  test('1. Voice participants lifecycle, Redis mappings, and cleanup', async () => {
    const host = { id: 'voice_host_1', username: 'HostUser', avatar: 'avatar-1' };
    const room = await gameEngine.createRoom(host, {
      categorySlugs: ['fruits'],
      categoryNames: ['Fruits'],
      impostersCount: 1
    });

    const roomCode = room.code;
    assert.ok(roomCode);

    const player2 = { id: 'voice_p2', username: 'PlayerTwo', avatar: 'avatar-2' };
    await gameEngine.joinRoom(roomCode, player2);

    // Initial voice participants list should be empty
    let participants = await roomRepository.getVoiceParticipants(roomCode);
    assert.equal(participants.length, 0);

    // Add host to voice participants
    const hostSocketId = 'socket_host_123';
    await roomRepository.addVoiceParticipant(roomCode, host.id, hostSocketId);

    participants = await roomRepository.getVoiceParticipants(roomCode);
    assert.equal(participants.length, 1);
    assert.equal(participants[0].playerId, host.id);
    assert.equal(participants[0].socketId, hostSocketId);

    // Add player 2 to voice participants
    const p2SocketId = 'socket_p2_456';
    await roomRepository.addVoiceParticipant(roomCode, player2.id, p2SocketId);

    participants = await roomRepository.getVoiceParticipants(roomCode);
    assert.equal(participants.length, 2);

    // Test Refresh Reconnection: Player 2 refreshes and gets a NEW socket ID
    const p2NewSocketId = 'socket_p2_789_refreshed';
    await roomRepository.addVoiceParticipant(roomCode, player2.id, p2NewSocketId);

    // Still exactly 2 participants because player2's socket was updated in Redis hash!
    participants = await roomRepository.getVoiceParticipants(roomCode);
    assert.equal(participants.length, 2);
    const p2Participant = participants.find(p => p.playerId === player2.id);
    assert.equal(p2Participant.socketId, p2NewSocketId, 'Player 2 socket mapping should be updated to refreshed socket');

    // Remove Player 2 on leave/disconnect
    await roomRepository.removeVoiceParticipant(roomCode, player2.id);
    participants = await roomRepository.getVoiceParticipants(roomCode);
    assert.equal(participants.length, 1);
    assert.equal(participants[0].playerId, host.id);

    // Delete room cleans all voice participants
    await roomRepository.deleteRoom(roomCode);
    participants = await roomRepository.getVoiceParticipants(roomCode);
    assert.equal(participants.length, 0);
  });

  test('2. Two-client Socket.IO WebRTC voice signaling & refresh recovery', async () => {
    const hostPlayer = { id: 'voice_client_1', username: 'VoiceHost', avatar: 'avatar-1' };
    const guestPlayer = { id: 'voice_client_2', username: 'VoiceGuest', avatar: 'avatar-2' };

    const room = await gameEngine.createRoom(hostPlayer, {
      categorySlugs: ['fruits'],
      categoryNames: ['Fruits'],
      impostersCount: 1
    });
    const roomCode = room.code;

    // Connect Client 1 (/game namespace)
    const client1 = ClientIo(`http://localhost:${serverPort}/game`, {
      transports: ['websocket'],
      forceNew: true
    });
    await new Promise((resolve) => client1.on('connect', resolve));

    // Connect Client 2 (/game namespace)
    const client2 = ClientIo(`http://localhost:${serverPort}/game`, {
      transports: ['websocket'],
      forceNew: true
    });
    await new Promise((resolve) => client2.on('connect', resolve));

    // Both join the room via socket and wait for server confirmation
    const c1Joined = new Promise(resolve => client1.once('player_connected', resolve));
    client1.emit('join_room', { roomCode, player: hostPlayer });
    await c1Joined;

    const c2Joined = new Promise(resolve => client2.once('player_connected', resolve));
    client2.emit('join_room', { roomCode, player: guestPlayer });
    await c2Joined;

    // Client 1 joins voice chat
    client1.emit('voice_signal_join', { roomCode, playerId: hostPlayer.id });
    await new Promise(r => setTimeout(r, 400));

    // Setup listener for Client 2 joining voice
    const peerJoinedPromise = new Promise((resolve) => {
      client1.on('voice_peer_joined', (data) => {
        resolve(data);
      });
    });

    const participantsListPromise = new Promise((resolve) => {
      client2.on('voice_participants_list', (data) => {
        resolve(data);
      });
    });

    // Client 2 joins voice chat
    client2.emit('voice_signal_join', { roomCode, playerId: guestPlayer.id });

    const [peerJoinedData, participantsListData] = await Promise.all([
      peerJoinedPromise,
      participantsListPromise
    ]);

    // Verify client 1 detected client 2
    assert.equal(peerJoinedData.playerId, guestPlayer.id);
    assert.equal(peerJoinedData.peerSocketId, client2.id);

    // Verify client 2 received authoritative list of existing participants (client 1)
    assert.ok(Array.isArray(participantsListData.participants));
    assert.equal(participantsListData.participants.length, 1);
    assert.equal(participantsListData.participants[0].playerId, hostPlayer.id);
    assert.equal(participantsListData.participants[0].socketId, client1.id);

    // Test SDP Offer signaling (Client 1 -> Client 2)
    const offerReceivedPromise = new Promise((resolve) => {
      client2.on('voice_signal_offer', resolve);
    });

    client1.emit('voice_signal_offer', {
      targetSocketId: client2.id,
      offer: { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\nm=audio 5004 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv' },
      callerId: hostPlayer.id
    });

    const offerData = await offerReceivedPromise;
    assert.equal(offerData.callerId, hostPlayer.id);
    assert.equal(offerData.callerSocketId, client1.id);
    assert.equal(offerData.offer.type, 'offer');

    // Test SDP Answer signaling (Client 2 -> Client 1)
    const answerReceivedPromise = new Promise((resolve) => {
      client1.on('voice_signal_answer', resolve);
    });

    client2.emit('voice_signal_answer', {
      targetSocketId: client1.id,
      answer: { type: 'answer', sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\nm=audio 5004 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv' },
      responderId: guestPlayer.id
    });

    const answerData = await answerReceivedPromise;
    assert.equal(answerData.responderId, guestPlayer.id);
    assert.equal(answerData.responderSocketId, client2.id);
    assert.equal(answerData.answer.type, 'answer');

    // Test ICE Candidate signaling
    const iceCandidatePromise = new Promise((resolve) => {
      client2.on('voice_signal_ice_candidate', resolve);
    });

    client1.emit('voice_signal_ice_candidate', {
      targetSocketId: client2.id,
      candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
      senderId: hostPlayer.id
    });

    const iceData = await iceCandidatePromise;
    assert.equal(iceData.senderId, hostPlayer.id);
    assert.equal(iceData.senderSocketId, client1.id);
    assert.ok(iceData.candidate.candidate.includes('candidate:1'));

    // Test Voice Mute State broadcast
    const muteStatePromise = new Promise((resolve) => {
      client1.on('voice_user_state_changed', resolve);
    });

    client2.emit('voice_mute_state', {
      roomCode,
      playerId: guestPlayer.id,
      isMuted: false,
      isDeafened: false
    });

    const muteData = await muteStatePromise;
    assert.equal(muteData.playerId, guestPlayer.id);
    assert.equal(muteData.isMuted, false);

    // Test Refresh Reconnection (Client 2 disconnects and reconnects with new socket ID)
    const peerLeftPromise = new Promise((resolve) => {
      client1.on('voice_peer_left', resolve);
    });

    client2.disconnect();
    const leftData = await peerLeftPromise;
    assert.equal(leftData.playerId, guestPlayer.id);

    // Client 2 creates fresh connection (simulating browser reload)
    const client2Reloaded = ClientIo(`http://localhost:${serverPort}/game`, {
      transports: ['websocket'],
      forceNew: true
    });
    await new Promise((resolve) => client2Reloaded.on('connect', resolve));

    // Client 2 recovers session & rejoins voice
    client2Reloaded.emit('recover_session', { playerId: guestPlayer.id });
    await new Promise(r => setTimeout(r, 400));

    const reconnectedPeerPromise = new Promise((resolve) => {
      client1.on('voice_peer_joined', resolve);
    });

    client2Reloaded.emit('voice_signal_join', { roomCode, playerId: guestPlayer.id });
    const reconnectedData = await reconnectedPeerPromise;

    assert.equal(reconnectedData.playerId, guestPlayer.id);
    assert.equal(reconnectedData.peerSocketId, client2Reloaded.id);
    assert.notEqual(client2Reloaded.id, client2.id, 'New socket ID must be distinct');

    // Clean up
    client1.disconnect();
    client2Reloaded.disconnect();
    await roomRepository.deleteRoom(roomCode);
  });
});
