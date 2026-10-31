import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import gameEngine from '../src/services/gameEngine.js';
import roomRepository from '../src/redis/roomRepository.js';
import { clearRoomPhaseTimers } from '../src/sockets/gameSocket.js';

describe('⏱️ Authoritative Timer Synchronization Test Suite', () => {

  test('1. Room with 15s turn timer and 30s voting timer: Authoritative settings & deadlines', async () => {
    const host = { id: 'timer_h1', username: 'Host15', avatar: 'avatar-1' };
    const p2 = { id: 'timer_p2', username: 'Player2', avatar: 'avatar-2' };
    const p3 = { id: 'timer_p3', username: 'Player3', avatar: 'avatar-3' };

    // Create room with custom settings
    const room = await gameEngine.createRoom(host, {
      categorySlugs: ['fruits'],
      turnDurationSeconds: 15,
      votingDurationSeconds: 30
    });

    assert.equal(room.settings.turnDurationSeconds, 15, 'Host configured turn timer must be 15s');
    assert.equal(room.settings.votingDurationSeconds, 30, 'Host configured voting timer must be 30s');

    // Non-host players join
    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    // Verify sanitized room state for non-host player has identical timer settings
    const sanitizedP2 = gameEngine.sanitizeRoomForPlayer(room, p2.id);
    assert.equal(sanitizedP2.settings.turnDurationSeconds, 15);
    assert.equal(sanitizedP2.settings.votingDurationSeconds, 30);

    // Start game
    const started = await gameEngine.startGame(room.code, host.id);
    assert.equal(started.status, 'ROLE_REVEAL');
    assert.equal(started.settings.turnDurationSeconds, 15);
    assert.equal(started.settings.votingDurationSeconds, 30);

    // Transition to clue round
    const clueRound = await gameEngine.startClueRound(room.code);
    assert.equal(clueRound.status, 'CLUE_ROUND');
    assert.ok(clueRound.turnDeadline, 'turnDeadline must be set');

    const remainingTurnMs = clueRound.turnDeadline - Date.now();
    assert.ok(remainingTurnMs > 13000 && remainingTurnMs <= 15050, `Remaining turn ms (${remainingTurnMs}) must match 15s duration`);

    // Verify non-host sanitization preserves turnDeadline and exact settings
    const p2GameView = gameEngine.sanitizeRoomForPlayer(clueRound, p2.id);
    assert.equal(p2GameView.turnDeadline, clueRound.turnDeadline);
    assert.equal(p2GameView.settings.turnDurationSeconds, 15);
    assert.equal(p2GameView.settings.votingDurationSeconds, 30);

    // Living players submit clues until voting phase
    const activePlayer1 = clueRound.players.find(p => p.id === clueRound.activeTurnPlayerId);
    const clue1 = activePlayer1.role === 'IMPOSTER' ? 'Sweet' : 'Round';
    const adv1 = await gameEngine.submitClueOrGuess(room.code, activePlayer1.id, clue1);

    // If still clue round, check turn 2 deadline
    if (!adv1.phaseChanged) {
      assert.ok(adv1.room.turnDeadline, 'Next player must have turnDeadline');
      const rem2 = adv1.room.turnDeadline - Date.now();
      assert.ok(rem2 > 13000 && rem2 <= 15050, `Turn 2 duration (${rem2}) must also match 15s`);
    }

    // Clean up
    clearRoomPhaseTimers(room.code);
    await roomRepository.deleteRoom(room.code);
  });

  test('2. Room with 60s turn timer and 60s voting timer: Authoritative settings & deadlines', async () => {
    const host = { id: 'timer_h60', username: 'Host60', avatar: 'avatar-1' };
    const p2 = { id: 'timer_p60_2', username: 'Player2_60', avatar: 'avatar-2' };
    const p3 = { id: 'timer_p60_3', username: 'Player3_60', avatar: 'avatar-3' };

    const room = await gameEngine.createRoom(host, {
      categorySlugs: ['fruits'],
      turnDurationSeconds: 60,
      votingDurationSeconds: 60
    });

    assert.equal(room.settings.turnDurationSeconds, 60);
    assert.equal(room.settings.votingDurationSeconds, 60);

    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    // Host updates settings in lobby
    const updated = await gameEngine.updateSettings(room.code, host.id, {
      turnDurationSeconds: 60,
      votingDurationSeconds: 60
    });
    assert.equal(updated.settings.turnDurationSeconds, 60);
    assert.equal(updated.settings.votingDurationSeconds, 60);

    await gameEngine.startGame(room.code, host.id);
    const clueRound = await gameEngine.startClueRound(room.code);

    const remMs = clueRound.turnDeadline - Date.now();
    assert.ok(remMs > 57000 && remMs <= 60050, `Remaining turn ms (${remMs}) must match 60s duration`);

    // Verify all players see 60s
    const p3View = gameEngine.sanitizeRoomForPlayer(clueRound, p3.id);
    assert.equal(p3View.settings.turnDurationSeconds, 60);
    assert.equal(p3View.settings.votingDurationSeconds, 60);
    assert.equal(p3View.turnDeadline, clueRound.turnDeadline);

    clearRoomPhaseTimers(room.code);
    await roomRepository.deleteRoom(room.code);
  });

  test('3. Voting deadline uses configured votingDurationSeconds and transitions cleanly', async () => {
    const host = { id: 'v_host', username: 'VHost', avatar: 'avatar-1' };
    const p2 = { id: 'v_p2', username: 'VP2', avatar: 'avatar-2' };
    const p3 = { id: 'v_p3', username: 'VP3', avatar: 'avatar-3' };

    const room = await gameEngine.createRoom(host, {
      categorySlugs: ['fruits'],
      turnDurationSeconds: 15,
      votingDurationSeconds: 30
    });

    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    await gameEngine.startGame(room.code, host.id);
    await gameEngine.startClueRound(room.code);

    // Advance all turns until voting phase
    let current = await roomRepository.getRoom(room.code);
    while (current.status === 'CLUE_ROUND') {
      const activeId = current.activeTurnPlayerId;
      const adv = await gameEngine.submitClueOrGuess(room.code, activeId, `Clue_${current.activeTurnIndex}`);
      current = adv.room;
    }

    assert.equal(current.status, 'VOTING');
    assert.ok(current.votingDeadline, 'votingDeadline must be set');

    const remVotingMs = current.votingDeadline - Date.now();
    assert.ok(remVotingMs > 28000 && remVotingMs <= 30050, `Voting remaining ms (${remVotingMs}) must match 30s configured`);

    // Non-host player receives exact voting deadline and settings
    const p2VotingView = gameEngine.sanitizeRoomForPlayer(current, p2.id);
    assert.equal(p2VotingView.status, 'VOTING');
    assert.equal(p2VotingView.votingDeadline, current.votingDeadline);
    assert.equal(p2VotingView.settings.votingDurationSeconds, 30);

    clearRoomPhaseTimers(room.code);
    await roomRepository.deleteRoom(room.code);
  });

  test('4. Reconnection during active turn restores exact deadline and configured durations', async () => {
    const host = { id: 'rec_h', username: 'RecHost', avatar: 'avatar-1' };
    const p2 = { id: 'rec_p2', username: 'RecP2', avatar: 'avatar-2' };
    const p3 = { id: 'rec_p3', username: 'RecP3', avatar: 'avatar-3' };

    const room = await gameEngine.createRoom(host, {
      categorySlugs: ['fruits'],
      turnDurationSeconds: 45,
      votingDurationSeconds: 60
    });

    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    await gameEngine.startGame(room.code, host.id);
    const clueRound = await gameEngine.startClueRound(room.code);

    // Simulate p2 disconnecting then reconnecting
    const reconnectedRoom = await gameEngine.joinRoom(room.code, p2);
    assert.equal(reconnectedRoom.status, 'CLUE_ROUND');
    assert.equal(reconnectedRoom.settings.turnDurationSeconds, 45);
    assert.equal(reconnectedRoom.settings.votingDurationSeconds, 60);
    assert.equal(reconnectedRoom.turnDeadline, clueRound.turnDeadline);

    // Sanitize for reconnected player
    const sanitized = gameEngine.sanitizeRoomForPlayer(reconnectedRoom, p2.id);
    assert.equal(sanitized.turnDeadline, clueRound.turnDeadline);
    assert.equal(sanitized.settings.turnDurationSeconds, 45);
    assert.equal(sanitized.settings.votingDurationSeconds, 60);

    clearRoomPhaseTimers(room.code);
    await roomRepository.deleteRoom(room.code);
  });

  test('5. Reconnection during voting restores exact voting deadline and configured durations', async () => {
    const host = { id: 'rec_vh', username: 'RecVHost', avatar: 'avatar-1' };
    const p2 = { id: 'rec_vp2', username: 'RecVP2', avatar: 'avatar-2' };
    const p3 = { id: 'rec_vp3', username: 'RecVP3', avatar: 'avatar-3' };

    const room = await gameEngine.createRoom(host, {
      categorySlugs: ['fruits'],
      turnDurationSeconds: 30,
      votingDurationSeconds: 45
    });

    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    await gameEngine.startGame(room.code, host.id);
    await gameEngine.startClueRound(room.code);

    let current = await roomRepository.getRoom(room.code);
    while (current.status === 'CLUE_ROUND') {
      const activeId = current.activeTurnPlayerId;
      const adv = await gameEngine.submitClueOrGuess(room.code, activeId, `Clue_${current.activeTurnIndex}`);
      current = adv.room;
    }

    assert.equal(current.status, 'VOTING');
    const originalVotingDeadline = current.votingDeadline;

    // Simulate non-host browser refresh during voting
    const reconnected = await gameEngine.joinRoom(room.code, p2);
    assert.equal(reconnected.status, 'VOTING');
    assert.equal(reconnected.votingDeadline, originalVotingDeadline);
    assert.equal(reconnected.settings.votingDurationSeconds, 45);

    const refreshedView = gameEngine.sanitizeRoomForPlayer(reconnected, p2.id);
    assert.equal(refreshedView.status, 'VOTING');
    assert.equal(refreshedView.votingDeadline, originalVotingDeadline);
    assert.equal(refreshedView.settings.votingDurationSeconds, 45);

    clearRoomPhaseTimers(room.code);
    await roomRepository.deleteRoom(room.code);
  });

  test('6. Prevention of duplicate timeout execution and duplicate phase transitions', async () => {
    const host = { id: 'dup_h', username: 'DupHost', avatar: 'avatar-1' };
    const p2 = { id: 'dup_p2', username: 'DupP2', avatar: 'avatar-2' };
    const p3 = { id: 'dup_p3', username: 'DupP3', avatar: 'avatar-3' };

    const room = await gameEngine.createRoom(host, {
      categorySlugs: ['fruits'],
      turnDurationSeconds: 15,
      votingDurationSeconds: 30
    });

    await gameEngine.joinRoom(room.code, p2);
    await gameEngine.joinRoom(room.code, p3);

    await gameEngine.startGame(room.code, host.id);
    const clueRound = await gameEngine.startClueRound(room.code);

    const activePlayerId = clueRound.activeTurnPlayerId;
    const activeIndex = clueRound.activeTurnIndex;

    // First timeout execution
    const timeout1 = await gameEngine.handleTurnTimeout(room.code, activePlayerId, activeIndex);
    assert.ok(timeout1, 'First timeout call must succeed');
    assert.equal(timeout1.wasSkipped, true);

    // Stale duplicate timeout execution with same player and turn index
    const timeout2 = await gameEngine.handleTurnTimeout(room.code, activePlayerId, activeIndex);
    assert.equal(timeout2, null, 'Duplicate timeout execution must be rejected without advancing turn');

    clearRoomPhaseTimers(room.code);
    await roomRepository.deleteRoom(room.code);
  });
});
