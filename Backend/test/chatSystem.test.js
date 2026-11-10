import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import gameEngine from '../src/services/gameEngine.js';
import roomRepository from '../src/redis/roomRepository.js';
import { registerGameSocket } from '../src/sockets/gameSocket.js';

// Helper: Create a mock Socket.IO server & connected clients
class MockNamespace extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map(); // roomName -> Set of mock sockets
  }

  to(roomName) {
    const self = this;
    return {
      emit: (event, data) => {
        const sockets = self.rooms.get(roomName);
        if (sockets) {
          for (const s of sockets) {
            s.emit(event, data);
          }
        }
      }
    };
  }

  in(roomName) {
    const self = this;
    return {
      emit: (event, data) => self.to(roomName).emit(event, data),
      fetchSockets: async () => {
        const sockets = self.rooms.get(roomName);
        return sockets ? Array.from(sockets) : [];
      }
    };
  }
}

class MockSocket extends EventEmitter {
  constructor(id, nsp) {
    super();
    this.id = id;
    this.nsp = nsp;
    this.joinedRooms = new Set();
  }

  join(roomName) {
    this.joinedRooms.add(roomName);
    if (!this.nsp.rooms.has(roomName)) {
      this.nsp.rooms.set(roomName, new Set());
    }
    this.nsp.rooms.get(roomName).add(this);
  }

  leave(roomName) {
    this.joinedRooms.delete(roomName);
    if (this.nsp.rooms.has(roomName)) {
      this.nsp.rooms.get(roomName).delete(this);
    }
  }
}

test('💬 Authoritative Imposter Chat System Test Suite', async (t) => {
  const mockNsp = new MockNamespace();
  const rootNsp = new MockNamespace();
  const mockIo = {
    of: (name) => (name === '/game' ? mockNsp : rootNsp)
  };

  registerGameSocket(mockIo);

  // Helper to simulate client emitting socket event with callback promise
  const emitWithAck = (socket, event, data) => {
    return new Promise((resolve) => {
      socket.emit(event, data, (response) => {
        resolve(response);
      });
    });
  };

  await t.test('Scenario 1: Lobby Chat - Global only, non-anonymous, room-isolated', async () => {
    const host = { id: 'p_host_1', username: 'Thanoj', avatar: 'avatar-1' };
    const p2 = { id: 'p_join_2', username: 'Arun', avatar: 'avatar-2' };
    const p3 = { id: 'p_join_3', username: 'Kumar', avatar: 'avatar-3' };
    const p4 = { id: 'p_join_4', username: 'Rahul', avatar: 'avatar-4' };

    const room = await gameEngine.createRoom(host, { impostersCount: 1 });
    const code = room.code;

    await gameEngine.joinRoom(code, p2);
    await gameEngine.joinRoom(code, p3);
    await gameEngine.joinRoom(code, p4);

    const s1 = new MockSocket('s1', mockNsp);
    const s2 = new MockSocket('s2', mockNsp);
    mockNsp.emit('connection', s1);
    mockNsp.emit('connection', s2);

    s1.emit('join_room', { roomCode: code, player: host });
    s2.emit('join_room', { roomCode: code, player: p2 });
    await new Promise(r => setTimeout(r, 50));

    // Track messages received on s2
    const receivedOnS2 = [];
    s2.on('chat_message', (msg) => receivedOnS2.push(msg));

    // Thanoj sends: "Let's start the game!"
    const res = await emitWithAck(s1, 'send_chat_message', {
      roomCode: code,
      playerId: host.id,
      channel: 'LOBBY_GLOBAL',
      text: "Let's start the game!"
    });
    assert.equal(res.success, true);
    assert.equal(res.message.channel, 'LOBBY_GLOBAL');
    assert.equal(res.message.senderUsername, 'Thanoj');
    assert.equal(res.message.senderId, host.id);
    assert.equal(res.message.text, "Let's start the game!");

    // Verify S2 received it with sender username
    assert.equal(receivedOnS2.length, 1);
    assert.equal(receivedOnS2[0].senderUsername, 'Thanoj');
    assert.equal(receivedOnS2[0].text, "Let's start the game!");

    // Verify In-Game channels rejected in Lobby
    await new Promise(r => setTimeout(r, 310));
    const impRes = await emitWithAck(s1, 'send_chat_message', {
      roomCode: code,
      playerId: host.id,
      channel: 'GAME_IMPOSTER',
      text: 'Secret imposter test'
    });
    assert.equal(impRes.success, false);
    assert.match(impRes.error, /only available during an active game/);

    // Verify history retrieval
    const histRes = await emitWithAck(s1, 'get_chat_history', {
      roomCode: code,
      playerId: host.id
    });
    assert.equal(histRes.success, true);
    assert.equal(histRes.history.LOBBY_GLOBAL.length, 1);
    assert.equal(histRes.history.LOBBY_GLOBAL[0].senderUsername, 'Thanoj');
  });

  await t.test('Scenario 2: In-Game Global Chat - accessible to everyone, usernames visible', async () => {
    const host = { id: 'p2_host', username: 'Thanoj', avatar: 'avatar-1' };
    const p2 = { id: 'p2_p2', username: 'Arun', avatar: 'avatar-2' };
    const p3 = { id: 'p2_p3', username: 'Kumar', avatar: 'avatar-3' };
    const p4 = { id: 'p2_p4', username: 'Rahul', avatar: 'avatar-4' };

    const room = await gameEngine.createRoom(host, { impostersCount: 2 });
    const code = room.code;
    await gameEngine.joinRoom(code, p2);
    await gameEngine.joinRoom(code, p3);
    await gameEngine.joinRoom(code, p4);

    const s1 = new MockSocket('s2_1', mockNsp);
    const s2 = new MockSocket('s2_2', mockNsp);
    mockNsp.emit('connection', s1);
    mockNsp.emit('connection', s2);

    s1.emit('join_room', { roomCode: code, player: host });
    s2.emit('join_room', { roomCode: code, player: p2 });
    await new Promise(r => setTimeout(r, 50));

    await gameEngine.startGame(code, host.id);

    const receivedOnS2 = [];
    s2.on('chat_message', (msg) => receivedOnS2.push(msg));

    const res = await emitWithAck(s1, 'send_chat_message', {
      roomCode: code,
      playerId: host.id,
      channel: 'GAME_GLOBAL',
      text: 'Who do you think is suspicious?'
    });

    assert.equal(res.success, true);
    assert.equal(res.message.channel, 'GAME_GLOBAL');
    assert.equal(res.message.senderUsername, 'Thanoj');

    assert.equal(receivedOnS2.length, 1);
    assert.equal(receivedOnS2[0].text, 'Who do you think is suspicious?');
    assert.equal(receivedOnS2[0].senderUsername, 'Thanoj');
  });

  await t.test('Scenario 3 & 4: Imposter & Civilian Team Chat - Isolation and Anonymity', async () => {
    // 2 Imposters and 2 Civilians
    const host = { id: 'sec_imp1', username: 'Thanoj', avatar: 'avatar-1' };
    const p2 = { id: 'sec_imp2', username: 'Arun', avatar: 'avatar-2' };
    const p3 = { id: 'sec_civ1', username: 'Kumar', avatar: 'avatar-3' };
    const p4 = { id: 'sec_civ2', username: 'Rahul', avatar: 'avatar-4' };

    const room = await gameEngine.createRoom(host, { impostersCount: 2 });
    const code = room.code;
    await gameEngine.joinRoom(code, p2);
    await gameEngine.joinRoom(code, p3);
    await gameEngine.joinRoom(code, p4);

    const started = await gameEngine.startGame(code, host.id);
    const imposter1 = started.players.find(p => p.role === 'IMPOSTER');
    const otherImposter = started.players.find(p => p.role === 'IMPOSTER' && p.id !== imposter1.id);
    const civilian1 = started.players.find(p => p.role === 'CIVILIAN');
    const otherCivilian = started.players.find(p => p.role === 'CIVILIAN' && p.id !== civilian1.id);

    const sImp1 = new MockSocket('s_imp1', mockNsp);
    const sImp2 = new MockSocket('s_imp2', mockNsp);
    const sCiv1 = new MockSocket('s_civ1', mockNsp);
    const sCiv2 = new MockSocket('s_civ2', mockNsp);

    mockNsp.emit('connection', sImp1);
    mockNsp.emit('connection', sImp2);
    mockNsp.emit('connection', sCiv1);
    mockNsp.emit('connection', sCiv2);

    sImp1.emit('join_room', { roomCode: code, player: imposter1 });
    sImp2.emit('join_room', { roomCode: code, player: otherImposter });
    sCiv1.emit('join_room', { roomCode: code, player: civilian1 });
    sCiv2.emit('join_room', { roomCode: code, player: otherCivilian });
    await new Promise(r => setTimeout(r, 50));

    const imp2Messages = [];
    const civ1Messages = [];
    const civ2Messages = [];
    sImp2.on('chat_message', (m) => imp2Messages.push(m));
    sCiv1.on('chat_message', (m) => civ1Messages.push(m));
    sCiv2.on('chat_message', (m) => civ2Messages.push(m));

    // Imposter 1 sends private message
    const impSendRes = await emitWithAck(sImp1, 'send_chat_message', {
      roomCode: code,
      playerId: imposter1.id,
      channel: 'GAME_IMPOSTER',
      text: 'Eliminate Kumar first!'
    });

    assert.equal(impSendRes.success, true);
    assert.equal(impSendRes.message.senderUsername, imposter1.username);

    // Imposter 2 must receive it
    assert.equal(imp2Messages.length, 1);
    assert.equal(imp2Messages[0].text, 'Eliminate Kumar first!');
    assert.equal(imp2Messages[0].senderUsername, imposter1.username);

    // Civilians must NEVER receive imposter messages!
    assert.equal(civ1Messages.length, 0);
    assert.equal(civ2Messages.length, 0);

    // Civilian tries to send to Imposter Chat -> MUST BE REJECTED
    const civIllegalSend = await emitWithAck(sCiv1, 'send_chat_message', {
      roomCode: code,
      playerId: civilian1.id,
      channel: 'GAME_IMPOSTER',
      text: 'Can I see imposter chat?'
    });
    assert.equal(civIllegalSend.success, false);
    assert.match(civIllegalSend.error, /Only imposters can access Imposter Chat/);

    // Imposter tries to send to Civilian Chat -> MUST BE REJECTED
    await new Promise(r => setTimeout(r, 310));
    const impIllegalSend = await emitWithAck(sImp1, 'send_chat_message', {
      roomCode: code,
      playerId: imposter1.id,
      channel: 'GAME_CIVILIAN',
      text: 'Imposter spoofing civilian'
    });
    assert.equal(impIllegalSend.success, false);
    assert.match(impIllegalSend.error, /Only civilians can access Civilian Chat/);

    // Civilian 1 sends civilian message
    const civSendRes = await emitWithAck(sCiv1, 'send_chat_message', {
      roomCode: code,
      playerId: civilian1.id,
      channel: 'GAME_CIVILIAN',
      text: 'I think Thanoj is the imposter.'
    });

    assert.equal(civSendRes.success, true);
    // MUST BE COMPLETELY ANONYMOUS
    assert.equal(civSendRes.message.senderUsername, undefined);
    assert.equal(civSendRes.message.senderId, undefined);
    assert.equal(civSendRes.message.avatar, undefined);
    assert.equal(civSendRes.message.text, 'I think Thanoj is the imposter.');

    // Civilian 2 received anonymous message
    assert.equal(civ2Messages.length, 1);
    assert.equal(civ2Messages[0].text, 'I think Thanoj is the imposter.');
    assert.equal(civ2Messages[0].senderUsername, undefined);
    assert.equal(civ2Messages[0].senderId, undefined);

    // Imposters must NEVER receive civilian messages!
    assert.equal(imp2Messages.length, 1); // still only the 1 imposter message
  });

  await t.test('Scenario 5, 6, 7: Imposter Chat Availability Rules', async () => {
    // Scenario 5: Single imposter -> Imposter Chat is DISABLED
    const h1 = { id: 's5_h', username: 'P1', avatar: 'avatar-1' };
    const p2 = { id: 's5_2', username: 'P2', avatar: 'avatar-2' };
    const p3 = { id: 's5_3', username: 'P3', avatar: 'avatar-3' };

    const room1 = await gameEngine.createRoom(h1, { impostersCount: 1 });
    await gameEngine.joinRoom(room1.code, p2);
    await gameEngine.joinRoom(room1.code, p3);

    const started1 = await gameEngine.startGame(room1.code, h1.id);
    const singleImposter = started1.players.find(p => p.role === 'IMPOSTER');

    const sSingle = new MockSocket('s_single', mockNsp);
    mockNsp.emit('connection', sSingle);
    sSingle.emit('join_room', { roomCode: room1.code, player: singleImposter });
    await new Promise(r => setTimeout(r, 50));

    // Try sending in single imposter game -> REJECTED
    const singleRes = await emitWithAck(sSingle, 'send_chat_message', {
      roomCode: room1.code,
      playerId: singleImposter.id,
      channel: 'GAME_IMPOSTER',
      text: 'Talking to myself'
    });
    assert.equal(singleRes.success, false);
    assert.match(singleRes.error, /disabled when there is only 1 imposter/);

    // Check sanitizeRoomForPlayer reflects isImposterChatEnabled: false
    const sanitized = gameEngine.sanitizeRoomForPlayer(started1, singleImposter.id);
    assert.equal(sanitized.totalImposters, 1);
    assert.equal(sanitized.isImposterChatEnabled, false);

    // Scenario 6 & 7: 2 imposters, 1 dead or both dead -> ENABLED
    const h2 = { id: 's6_h', username: 'H6', avatar: 'avatar-1' };
    const pB = { id: 's6_b', username: 'PB', avatar: 'avatar-2' };
    const pC = { id: 's6_c', username: 'PC', avatar: 'avatar-3' };
    const pD = { id: 's6_d', username: 'PD', avatar: 'avatar-4' };

    const room2 = await gameEngine.createRoom(h2, { impostersCount: 2 });
    await gameEngine.joinRoom(room2.code, pB);
    await gameEngine.joinRoom(room2.code, pC);
    await gameEngine.joinRoom(room2.code, pD);

    const started2 = await gameEngine.startGame(room2.code, h2.id);
    const imposters = started2.players.filter(p => p.role === 'IMPOSTER');
    assert.equal(imposters.length, 2);

    // Kill 1 imposter
    imposters[0].isAlive = false;
    await roomRepository.saveRoom(room2.code, started2);

    // Even with 1 alive + 1 dead, total = 2 -> ENABLED
    const sanitizedDead1 = gameEngine.sanitizeRoomForPlayer(started2, imposters[1].id);
    assert.equal(sanitizedDead1.totalImposters, 2);
    assert.equal(sanitizedDead1.isImposterChatEnabled, true);

    const sDead = new MockSocket('s_dead', mockNsp);
    mockNsp.emit('connection', sDead);
    sDead.emit('join_room', { roomCode: room2.code, player: imposters[1] });
    await new Promise(r => setTimeout(r, 50));

    const deadTestRes = await emitWithAck(sDead, 'send_chat_message', {
      roomCode: room2.code,
      playerId: imposters[1].id,
      channel: 'GAME_IMPOSTER',
      text: 'My partner is dead, but chat works!'
    });
    assert.equal(deadTestRes.success, true);
  });

  await t.test('Scenario 8: Background Messages and History Synchronization', async () => {
    // 2 imposters, 2 civilians
    const h = { id: 's8_h', username: 'Host8', avatar: 'avatar-1' };
    const pB = { id: 's8_b', username: 'PlayerB', avatar: 'avatar-2' };
    const pC = { id: 's8_c', username: 'PlayerC', avatar: 'avatar-3' };
    const pD = { id: 's8_d', username: 'PlayerD', avatar: 'avatar-4' };

    const room = await gameEngine.createRoom(h, { impostersCount: 2 });
    await gameEngine.joinRoom(room.code, pB);
    await gameEngine.joinRoom(room.code, pC);
    await gameEngine.joinRoom(room.code, pD);

    const started = await gameEngine.startGame(room.code, h.id);
    const imposters = started.players.filter(p => p.role === 'IMPOSTER');
    const civilians = started.players.filter(p => p.role === 'CIVILIAN');

    const sImp = new MockSocket('s8_imp', mockNsp);
    const sCiv = new MockSocket('s8_civ', mockNsp);
    mockNsp.emit('connection', sImp);
    mockNsp.emit('connection', sCiv);

    sImp.emit('join_room', { roomCode: room.code, player: imposters[0] });
    sCiv.emit('join_room', { roomCode: room.code, player: civilians[0] });
    await new Promise(r => setTimeout(r, 50));

    const imposterInbox = [];
    sImp.on('chat_message', (msg) => imposterInbox.push(msg));

    // Send a message in GAME_GLOBAL from civilian
    await emitWithAck(sCiv, 'send_chat_message', {
      roomCode: room.code,
      playerId: civilians[0].id,
      channel: 'GAME_GLOBAL',
      text: 'Global message from civilian'
    });

    // Imposter should receive the global message
    assert.equal(imposterInbox.length, 1);
    assert.equal(imposterInbox[0].channel, 'GAME_GLOBAL');
    assert.equal(imposterInbox[0].text, 'Global message from civilian');

    // Imposter fetches history: should receive both GAME_GLOBAL and GAME_IMPOSTER, but NEVER GAME_CIVILIAN
    const historyRes = await emitWithAck(sImp, 'get_chat_history', {
      roomCode: room.code,
      playerId: imposters[0].id
    });
    assert.equal(historyRes.success, true);
    assert.equal(historyRes.history.GAME_GLOBAL.length, 1);
    assert.equal(historyRes.history.GAME_GLOBAL[0].text, 'Global message from civilian');
    assert.equal(historyRes.history.GAME_CIVILIAN.length, 0); // Strictly isolated!
  });

  await t.test('Scenario 9 & 10: Spam protection, message validation, session security', async () => {
    const host = { id: 'sec_h', username: 'SecHost', avatar: 'avatar-1' };
    const p2 = { id: 'sec_2', username: 'Sec2', avatar: 'avatar-2' };
    const p3 = { id: 'sec_3', username: 'Sec3', avatar: 'avatar-3' };

    const room = await gameEngine.createRoom(host, { impostersCount: 1 });
    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    const s = new MockSocket('s_sec', mockNsp);
    mockNsp.emit('connection', s);
    s.emit('join_room', { roomCode: room.code, player: host });
    await new Promise(r => setTimeout(r, 50));

    // Empty message
    const emptyRes = await emitWithAck(s, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'LOBBY_GLOBAL',
      text: '   '
    });
    assert.equal(emptyRes.success, false);
    assert.match(emptyRes.error, /cannot be empty/);

    // Exceed max length (> 500 chars)
    const longRes = await emitWithAck(s, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'LOBBY_GLOBAL',
      text: 'a'.repeat(501)
    });
    assert.equal(longRes.success, false);
    assert.match(longRes.error, /exceeds maximum length/);

    // Rate limiting: send twice rapidly
    await emitWithAck(s, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'LOBBY_GLOBAL',
      text: 'Hello 1'
    });
    const rapidRes = await emitWithAck(s, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'LOBBY_GLOBAL',
      text: 'Hello 2 immediately'
    });
    assert.equal(rapidRes.success, false);
    assert.match(rapidRes.error, /Rate limit exceeded/);

    // Non-member cannot send
    const outsiderRes = await emitWithAck(s, 'send_chat_message', {
      roomCode: room.code,
      playerId: 'stranger_danger',
      channel: 'LOBBY_GLOBAL',
      text: 'Hacking in'
    });
    assert.equal(outsiderRes.success, false);
    assert.match(outsiderRes.error, /not a member of this room/);
  });

  await t.test('Scenario 11: Game End Chat Cleanup - Automatic deletion, subscription invalidation, rejection of new messages', async () => {
    const host = { id: 'cl_h', username: 'HostClean', avatar: 'avatar-1' };
    const p2 = { id: 'cl_2', username: 'P2Clean', avatar: 'avatar-2' };
    const p3 = { id: 'cl_3', username: 'P3Clean', avatar: 'avatar-3' };
    const p4 = { id: 'cl_4', username: 'P4Clean', avatar: 'avatar-4' };

    const room = await gameEngine.createRoom(host, { impostersCount: 2 });
    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);
    await gameEngine.joinRoom(room.code, p4);

    const sHost = new MockSocket('s_cl_h', mockNsp);
    mockNsp.emit('connection', sHost);
    sHost.emit('join_room', { roomCode: room.code, player: host });
    await new Promise(r => setTimeout(r, 50));

    // Start game
    const startedRoom = await gameEngine.startGame(room.code, host.id);
    assert.ok(startedRoom.gameSessionId, 'gameSessionId must be assigned');
    const sessionId = startedRoom.gameSessionId;

    // Send game global message
    const sendGlobal = await emitWithAck(sHost, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'GAME_GLOBAL',
      text: 'Global clue active'
    });
    assert.equal(sendGlobal.success, true);
    assert.equal(sendGlobal.message.gameSessionId, sessionId);

    // Verify messages exist in Redis before completion
    const preHistory = await roomRepository.getChatHistory(room.code, 'GAME_GLOBAL');
    assert.equal(preHistory.length, 1);

    // End game
    const endResult = await gameEngine.endGameWithWinner(startedRoom, 'CIVILIAN', 'CIVILIANS_ELIMINATED_ALL_IMPOSTERS');
    assert.equal(endResult.room.status, 'FINISHED');
    assert.equal(endResult.room.gameSessionId, null);

    // Verify Redis game chat keys were cleared immediately by endGameWithWinner
    const postHistoryGlobal = await roomRepository.getChatHistory(room.code, 'GAME_GLOBAL');
    const postHistoryImp = await roomRepository.getChatHistory(room.code, 'GAME_IMPOSTER');
    const postHistoryCiv = await roomRepository.getChatHistory(room.code, 'GAME_CIVILIAN');
    assert.equal(postHistoryGlobal.length, 0);
    assert.equal(postHistoryImp.length, 0);
    assert.equal(postHistoryCiv.length, 0);

    // In-game chat API get_chat_history must return empty arrays for all game channels
    const fetchRes = await emitWithAck(sHost, 'get_chat_history', {
      roomCode: room.code,
      playerId: host.id
    });
    assert.equal(fetchRes.success, true);
    assert.equal(fetchRes.history.GAME_GLOBAL.length, 0);
    assert.equal(fetchRes.history.GAME_IMPOSTER.length, 0);
    assert.equal(fetchRes.history.GAME_CIVILIAN.length, 0);

    // Sending messages in finished game must be rejected
    await new Promise(r => setTimeout(r, 310));
    const lateSend = await emitWithAck(sHost, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'GAME_GLOBAL',
      text: 'Late message after game ended'
    });
    assert.equal(lateSend.success, false);
    assert.match(lateSend.error, /game has ended/);
  });

  await t.test('Scenario 12: Return to Lobby - Preserves lobby chat while game chats remain deleted', async () => {
    const host = { id: 'ret_h', username: 'RetHost', avatar: 'avatar-1' };
    const p2 = { id: 'ret_2', username: 'Ret2', avatar: 'avatar-2' };
    const p3 = { id: 'ret_3', username: 'Ret3', avatar: 'avatar-3' };

    const room = await gameEngine.createRoom(host, { impostersCount: 1 });
    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    const sHost = new MockSocket('s_ret_h', mockNsp);
    mockNsp.emit('connection', sHost);
    sHost.emit('join_room', { roomCode: room.code, player: host });
    await new Promise(r => setTimeout(r, 50));

    // Send a lobby chat message
    const lobbyMsg = await emitWithAck(sHost, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'LOBBY_GLOBAL',
      text: 'Good luck everyone!'
    });
    assert.equal(lobbyMsg.success, true);

    // Start game
    const started = await gameEngine.startGame(room.code, host.id);
    await emitWithAck(sHost, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'GAME_GLOBAL',
      text: 'In game message'
    });

    // End game
    await gameEngine.endGameWithWinner(started, 'IMPOSTER', 'IMPOSTER_GUESSED_WORD');

    // Return to lobby
    const lobbyRoom = await gameEngine.returnToLobby(room.code, host.id);
    assert.equal(lobbyRoom.status, 'WAITING');
    assert.equal(lobbyRoom.gameSessionId, null);

    // Fetch history in lobby: LOBBY_GLOBAL is preserved! Old game messages never appear
    const historyRes = await emitWithAck(sHost, 'get_chat_history', {
      roomCode: room.code,
      playerId: host.id
    });
    assert.equal(historyRes.success, true);
    assert.equal(historyRes.history.LOBBY_GLOBAL.length, 1);
    assert.equal(historyRes.history.LOBBY_GLOBAL[0].text, 'Good luck everyone!');
    assert.equal(historyRes.history.GAME_GLOBAL.length, 0);
  });

  await t.test('Scenario 13: New Game Session - Completely fresh session ID and independent chat histories', async () => {
    const host = { id: 'ses_h', username: 'SesHost', avatar: 'avatar-1' };
    const p2 = { id: 'ses_2', username: 'Ses2', avatar: 'avatar-2' };
    const p3 = { id: 'ses_3', username: 'Ses3', avatar: 'avatar-3' };
    const p4 = { id: 'ses_4', username: 'Ses4', avatar: 'avatar-4' };

    const room = await gameEngine.createRoom(host, { impostersCount: 2 });
    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);
    await gameEngine.joinRoom(room.code, p4);

    const sHost = new MockSocket('s_ses_h', mockNsp);
    mockNsp.emit('connection', sHost);
    sHost.emit('join_room', { roomCode: room.code, player: host });
    await new Promise(r => setTimeout(r, 50));

    // Game 1
    const game1 = await gameEngine.startGame(room.code, host.id);
    const session1Id = game1.gameSessionId;
    assert.ok(session1Id);

    await emitWithAck(sHost, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'GAME_GLOBAL',
      text: 'Message in Game 1'
    });

    // Finish Game 1 and return to lobby
    await gameEngine.endGameWithWinner(game1, 'CIVILIAN', 'CIVILIANS_ELIMINATED_ALL_IMPOSTERS');
    await gameEngine.returnToLobby(room.code, host.id);

    // Game 2 starts
    const game2 = await gameEngine.startGame(room.code, host.id);
    const session2Id = game2.gameSessionId;
    assert.ok(session2Id);
    assert.notEqual(session1Id, session2Id, 'Each match must receive a unique gameSessionId');

    // History for Game 2 must be completely fresh (0 messages)
    const historyGame2 = await emitWithAck(sHost, 'get_chat_history', {
      roomCode: room.code,
      playerId: host.id
    });
    assert.equal(historyGame2.history.GAME_GLOBAL.length, 0);
    assert.equal(historyGame2.history.GAME_IMPOSTER.length, 0);
    assert.equal(historyGame2.history.GAME_CIVILIAN.length, 0);

    // Send new message in Game 2
    await new Promise(r => setTimeout(r, 310));
    const send2 = await emitWithAck(sHost, 'send_chat_message', {
      roomCode: room.code,
      playerId: host.id,
      channel: 'GAME_GLOBAL',
      text: 'Fresh message in Game 2'
    });
    assert.equal(send2.success, true);
    assert.equal(send2.message.gameSessionId, session2Id);
  });
});
