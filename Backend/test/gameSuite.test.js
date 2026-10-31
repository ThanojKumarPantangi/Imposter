import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import gameEngine from '../src/services/gameEngine.js';
import roomRepository from '../src/redis/roomRepository.js';

describe('🎮 Authoritative Imposter Multiplayer Test Suite', () => {

  beforeEach(async () => {
    // Clear any test keys if needed
  });

  describe('1. Room Lifecycle & Recovery', () => {
    test('1-6. Create room, join players, and recover room state on refresh', async () => {
      const host = { id: 'p1', username: 'HostUser', avatar: 'avatar-1' };
      const room = await gameEngine.createRoom(host, {
        categorySlugs: ['fruits', 'animals'],
        categoryNames: ['Fruits', 'Animals'],
        impostersCount: 1,
        turnDurationSeconds: 15,
        votingDurationSeconds: 30
      });

      assert.ok(room.code, 'Room code should be generated');
      assert.equal(room.status, 'WAITING');
      assert.equal(room.players.length, 1);
      assert.equal(room.hostId, host.id);

      // Join player 2 and player 3
      const p2 = { id: 'p2', username: 'Player2', avatar: 'avatar-2' };
      const p3 = { id: 'p3', username: 'Player3', avatar: 'avatar-3' };
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      const updated = await roomRepository.getRoom(room.code);
      assert.equal(updated.players.length, 3);

      // Verify player room mapping in Redis
      const mapping = await roomRepository.getPlayerRoomMapping('p2');
      assert.equal(mapping, room.code);

      // Test Refresh during lobby: sanitizeRoomForPlayer restores valid lobby
      const sanitized = gameEngine.sanitizeRoomForPlayer(updated, 'p2');
      assert.equal(sanitized.code, room.code);
      assert.equal(sanitized.status, 'WAITING');
      assert.equal(sanitized.players.length, 3);
    });

    test('7-9. Intentional leave removes player, cleans mapping, and deletes zero-member room', async () => {
      const host = { id: 'u1', username: 'HostA' };
      const room = await gameEngine.createRoom(host);
      const guest = { id: 'u2', username: 'GuestB' };
      await gameEngine.joinRoom(room.code, guest);

      // Guest leaves
      const leaveRes = await gameEngine.leaveRoom(room.code, guest.id);
      assert.equal(leaveRes.roomDeleted, false);
      const afterLeave = await roomRepository.getRoom(room.code);
      assert.equal(afterLeave.players.length, 1);
      const guestMap = await roomRepository.getPlayerRoomMapping(guest.id);
      assert.equal(guestMap, null, 'Guest room mapping should be deleted');

      // Host leaves -> room should be deleted
      const hostLeave = await gameEngine.leaveRoom(room.code, host.id);
      assert.equal(hostLeave.roomDeleted, true, 'Zero-member room must be deleted');
      const deletedRoom = await roomRepository.getRoom(room.code);
      assert.equal(deletedRoom, null, 'Room state key in Redis should be gone');
    });

    test('10. Username update preserves player identity, role, and room membership', async () => {
      const host = { id: 'user_x', username: 'OldName' };
      const room = await gameEngine.createRoom(host);
      assert.equal(room.players[0].username, 'OldName');

      // Update username in room
      room.players[0].username = 'NewName';
      await roomRepository.saveRoom(room.code, room);

      const refreshed = await roomRepository.getRoom(room.code);
      assert.equal(refreshed.players[0].id, 'user_x', 'Player ID must be preserved');
      assert.equal(refreshed.players[0].username, 'NewName');
      assert.equal(refreshed.hostId, 'user_x');
    });

    test('11-12. Return to Lobby resets match to WAITING while preserving room code and settings', async () => {
      const host = { id: 'h1', username: 'Host1' };
      const room = await gameEngine.createRoom(host, { categorySlug: 'fruits', impostersCount: 1 });
      await gameEngine.joinRoom(room.code, { id: 'p2', username: 'P2' });
      await gameEngine.joinRoom(room.code, { id: 'p3', username: 'P3' });

      // Simulate a finished game
      room.status = 'FINISHED';
      room.currentRound = 3;
      room.winnerResult = { winnerRole: 'CIVILIAN', winCondition: 'ALL_IMPOSTERS_ELIMINATED' };
      room.players.forEach(p => { p.role = 'CIVILIAN'; p.clues = ['fruit']; });
      await roomRepository.saveRoom(room.code, room);

      // Execute returnToLobby
      const lobbyRoom = await gameEngine.returnToLobby(room.code, host.id);
      assert.equal(lobbyRoom.status, 'WAITING', 'Room status must reset to WAITING');
      assert.equal(lobbyRoom.code, room.code, 'Room code must remain identical');
      assert.equal(lobbyRoom.currentRound, 1, 'Current round must reset to 1');
      assert.equal(lobbyRoom.winnerResult, null, 'Winner result must be cleared');
      assert.equal(lobbyRoom.players[0].role, null, 'Roles must be cleared');
      assert.equal(lobbyRoom.players[0].clues.length, 0, 'Clues must be cleared');
    });
  });

  describe('2. Clue Submission & Authoritative Turn Timers', () => {
    test('14-17. Clue submission validation, duplicate rejection, civilian secret-word rejection, imposter word guess win', async () => {
      const r = {
        code: 'TEST',
        status: 'CLUE_ROUND',
        currentRound: 1,
        secretWord: 'Banana',
        hint: 'Yellow tropical fruit',
        activeTurnIndex: 0,
        activeTurnPlayerId: 'civ1',
        turnOrder: ['civ1', 'imp1'],
        settings: { turnDurationSeconds: 30, votingDurationSeconds: 45 },
        clueHistory: [],
        players: [
          { id: 'civ1', username: 'Civ', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false, clues: [] },
          { id: 'imp1', username: 'Imp', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false, clues: [] }
        ]
      };
      await roomRepository.saveRoom(r.code, r);

      // Civilian cannot submit the exact secret word
      await assert.rejects(
        async () => await gameEngine.submitClueOrGuess('TEST', 'civ1', 'banana'),
        /Civilians cannot submit the exact secret word/
      );

      // Valid clue accepted
      const clueRes = await gameEngine.submitClueOrGuess('TEST', 'civ1', 'Peel');
      assert.equal(clueRes.room.activeTurnPlayerId, 'imp1');
      assert.equal(clueRes.room.clueHistory.length, 1);
      assert.equal(clueRes.room.clueHistory[0].clue, 'Peel');

      // Duplicate clue rejected
      await assert.rejects(
        async () => await gameEngine.submitClueOrGuess('TEST', 'imp1', 'Peel'),
        /This word has already been entered/
      );

      // Imposter typing exact secret word -> Instant win!
      const imposterWinRes = await gameEngine.submitClueOrGuess('TEST', 'imp1', 'Banana');
      assert.equal(imposterWinRes.gameOver, true);
      assert.equal(imposterWinRes.winnerResult.winnerRole, 'IMPOSTER');
      assert.equal(imposterWinRes.winnerResult.winCondition, 'IMPOSTER_GUESSED_WORD');
    });

    test('18-21. Turn timeout records SKIPPED turn and advances to next player', async () => {
      const r = {
        code: 'TIME',
        status: 'CLUE_ROUND',
        currentRound: 1,
        secretWord: 'Orange',
        hint: 'Citrus',
        activeTurnIndex: 0,
        activeTurnPlayerId: 'p1',
        turnOrder: ['p1', 'p2'],
        settings: { turnDurationSeconds: 30, votingDurationSeconds: 45 },
        clueHistory: [],
        players: [
          { id: 'p1', username: 'Thanoj', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false, clues: [] },
          { id: 'p2', username: 'Player2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false, clues: [] }
        ]
      };
      await roomRepository.saveRoom(r.code, r);

      // Timeout expires on turn 0 for p1
      const timeoutRes = await gameEngine.handleTurnTimeout('TIME', 'p1', 0);
      assert.ok(timeoutRes, 'Timeout should be processed');
      assert.equal(timeoutRes.wasSkipped, true);
      assert.equal(timeoutRes.room.clueHistory.length, 1);
      assert.equal(timeoutRes.room.clueHistory[0].skipped, true);
      assert.equal(timeoutRes.room.clueHistory[0].username, 'Thanoj');
      assert.equal(timeoutRes.room.activeTurnPlayerId, 'p2', 'Turn must advance to p2');

      // Second player also times out -> transitions to VOTING phase
      const timeoutRes2 = await gameEngine.handleTurnTimeout('TIME', 'p2', 1);
      assert.equal(timeoutRes2.room.status, 'VOTING');
      assert.equal(timeoutRes2.phaseChanged, true);
      assert.ok(timeoutRes2.room.votingDeadline > Date.now());
    });
  });

  describe('3. Randomization & Fairness', () => {
    test('24-25. Starting player and turn order are randomized', async () => {
      const r = {
        code: 'RAND',
        status: 'ROLE_REVEAL',
        settings: { turnDurationSeconds: 30 },
        players: [
          { id: 'host1', username: 'Host', isAlive: true, permanentlyDeparted: false },
          { id: 'user2', username: 'User2', isAlive: true, permanentlyDeparted: false },
          { id: 'user3', username: 'User3', isAlive: true, permanentlyDeparted: false },
          { id: 'user4', username: 'User4', isAlive: true, permanentlyDeparted: false }
        ]
      };
      await roomRepository.saveRoom(r.code, r);

      const clueRound = await gameEngine.startClueRound('RAND');
      assert.equal(clueRound.status, 'CLUE_ROUND');
      assert.equal(clueRound.turnOrder.length, 4);
      assert.ok(clueRound.turnOrder.includes(clueRound.activeTurnPlayerId));
    });

    test('26-27. Imposter selection assigns correct number of roles without duplicates', async () => {
      const host = { id: 'h', username: 'H' };
      const room = await gameEngine.createRoom(host, { impostersCount: 2 });
      await gameEngine.joinRoom(room.code, { id: 'p2', username: 'P2' });
      await gameEngine.joinRoom(room.code, { id: 'p3', username: 'P3' });
      await gameEngine.joinRoom(room.code, { id: 'p4', username: 'P4' });
      await gameEngine.joinRoom(room.code, { id: 'p5', username: 'P5' });

      const started = await gameEngine.startGame(room.code, host.id);
      const imposters = started.players.filter(p => p.role === 'IMPOSTER');
      const civilians = started.players.filter(p => p.role === 'CIVILIAN');

      assert.equal(imposters.length, 2, 'Must have exactly 2 imposters');
      assert.equal(civilians.length, 3, 'Must have exactly 3 civilians');
      assert.notEqual(imposters[0].id, imposters[1].id, 'Imposters must be distinct players');
    });
  });

  describe('4. Centralized Victory Calculation (Section 10-12)', () => {
    test('31. Four players (1 Imposter, 3 Civilians) -> 1 Civilian eliminated -> GAME CONTINUES (Final Showdown)', () => {
      const room = {
        players: [
          { id: 'c1', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c3', role: 'CIVILIAN', isAlive: false, permanentlyDeparted: false }, // Eliminated
          { id: 'imp', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false }
        ]
      };

      const result = gameEngine.evaluateWinner(room);
      assert.equal(result.gameOver, false, 'Game must NOT end when 1 civilian is eliminated from 4 players');
      assert.equal(result.isFinalShowdown, true, 'Must enter final showdown threshold (1 Imposter vs 2 Civilians)');
    });

    test('32. Final Showdown (1 Imposter, 2 Civilians) -> Imposter eliminated -> Civilians win', () => {
      const room = {
        players: [
          { id: 'c1', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'imp', role: 'IMPOSTER', isAlive: false, permanentlyDeparted: false } // Voted out
        ]
      };

      const result = gameEngine.evaluateWinner(room);
      assert.equal(result.gameOver, true);
      assert.equal(result.winnerRole, 'CIVILIAN');
      assert.equal(result.winCondition, 'ALL_IMPOSTERS_ELIMINATED');
    });

    test('33. Final Showdown (1 Imposter, 2 Civilians) -> Civilian eliminated -> Imposters win (parity 1 vs 1)', () => {
      const room = {
        players: [
          { id: 'c1', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c2', role: 'CIVILIAN', isAlive: false, permanentlyDeparted: false }, // Voted out
          { id: 'imp', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false }
        ]
      };

      const result = gameEngine.evaluateWinner(room);
      assert.equal(result.gameOver, true);
      assert.equal(result.winnerRole, 'IMPOSTER');
      assert.equal(result.winCondition, 'IMPOSTERS_PARITY');
    });

    test('34. Two Imposters and Two Civilians -> One Imposter eliminated -> Game continues (1 Imposter vs 2 Civilians)', () => {
      const room = {
        players: [
          { id: 'imp1', role: 'IMPOSTER', isAlive: false, permanentlyDeparted: false }, // Eliminated
          { id: 'imp2', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false },
          { id: 'civ1', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'civ2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false }
        ]
      };

      const result = gameEngine.evaluateWinner(room);
      assert.equal(result.gameOver, false);
      assert.equal(result.isFinalShowdown, true, '1 Imposter vs 2 Civilians enters final showdown');
    });

    test('35. Two Imposters and Two Civilians -> One Civilian eliminated -> Imposters win immediately (2 Imposters vs 1 Civilian)', () => {
      const room = {
        players: [
          { id: 'imp1', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false },
          { id: 'imp2', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false },
          { id: 'civ1', role: 'CIVILIAN', isAlive: false, permanentlyDeparted: false }, // Eliminated
          { id: 'civ2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false }
        ]
      };

      const result = gameEngine.evaluateWinner(room);
      assert.equal(result.gameOver, true);
      assert.equal(result.winnerRole, 'IMPOSTER');
      assert.equal(result.winCondition, 'IMPOSTERS_PARITY');
    });

    test('39-40. Eliminated player permanently leaving does NOT alter victory calculation', async () => {
      const room = {
        code: 'SPEC',
        status: 'CLUE_ROUND',
        players: [
          { id: 'c1', username: 'C1', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c2', username: 'C2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c3', username: 'C3', role: 'CIVILIAN', isAlive: false, permanentlyDeparted: false }, // Spectator
          { id: 'imp', username: 'Imp', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false }
        ]
      };
      await roomRepository.saveRoom('SPEC', room);

      // Eliminated spectator leaves
      const leaveRes = await gameEngine.leaveRoom('SPEC', 'c3');
      assert.equal(leaveRes.gameOver, undefined, 'Leaving spectator must not trigger game over');

      const updated = await roomRepository.getRoom('SPEC');
      const livingCivs = updated.players.filter(p => p.isAlive && !p.permanentlyDeparted && p.role === 'CIVILIAN');
      assert.equal(livingCivs.length, 2, 'Living civilian count must remain unchanged');
    });

    test('41-42. Living player permanently leaving triggers centralized victory calculation', async () => {
      // Case A: Only living Imposter leaves -> Civilians win
      const roomA = {
        code: 'LEAVE_A',
        status: 'CLUE_ROUND',
        players: [
          { id: 'c1', username: 'C1', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c2', username: 'C2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'imp', username: 'Imp', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false }
        ]
      };
      await roomRepository.saveRoom('LEAVE_A', roomA);

      const resA = await gameEngine.leaveRoom('LEAVE_A', 'imp');
      assert.equal(resA.gameOver, true);
      assert.equal(resA.winnerResult.winnerRole, 'CIVILIAN');
      assert.equal(resA.winnerResult.winCondition, 'ALL_IMPOSTERS_ELIMINATED');

      // Case B: In Final Showdown (2 Civilians, 1 Imposter), 1 Civilian permanently leaves -> Imposters win
      const roomB = {
        code: 'LEAVE_B',
        status: 'CLUE_ROUND',
        players: [
          { id: 'c1', username: 'C1', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'c2', username: 'C2', role: 'CIVILIAN', isAlive: true, permanentlyDeparted: false },
          { id: 'imp', username: 'Imp', role: 'IMPOSTER', isAlive: true, permanentlyDeparted: false }
        ]
      };
      await roomRepository.saveRoom('LEAVE_B', roomB);

      const resB = await gameEngine.leaveRoom('LEAVE_B', 'c2');
      assert.equal(resB.gameOver, true);
      assert.equal(resB.winnerResult.winnerRole, 'IMPOSTER');
      assert.equal(resB.winnerResult.winCondition, 'IMPOSTERS_PARITY');
    });
  });

  describe('5. Multi-Category Word Selection & Zero-Member Cleanup', () => {
    test('48-50. Multi-category settings and legacy compatibility', async () => {
      const host = { id: 'host_cat', username: 'HostCat' };
      // Legacy single category string
      const r1 = await gameEngine.createRoom(host, { categorySlug: 'movies', categoryName: 'Movies' });
      assert.deepEqual(r1.settings.categorySlugs, ['movies']);

      // Modern multi-category array
      const r2 = await gameEngine.createRoom(host, {
        categorySlugs: ['fruits', 'animals'],
        categoryNames: ['Fruits', 'Animals']
      });
      assert.deepEqual(r2.settings.categorySlugs, ['fruits', 'animals']);
      assert.equal(r2.settings.categoryNames.length, 2);
    });

    test('51-54. Zero-member room completely deleted from Redis and indexes', async () => {
      const host = { id: 'alone', username: 'Alone' };
      const room = await gameEngine.createRoom(host);

      // Verify active room index
      const activeCodesBefore = await roomRepository.getAllActiveRoomCodes();
      assert.ok(activeCodesBefore.includes(room.code));

      // Leave
      await gameEngine.leaveRoom(room.code, host.id);

      // Verify room state is deleted
      const checkRoom = await roomRepository.getRoom(room.code);
      assert.equal(checkRoom, null);

      // Verify active room index is cleaned
      const activeCodesAfter = await roomRepository.getAllActiveRoomCodes();
      assert.ok(!activeCodesAfter.includes(room.code), 'Room code must be removed from active index');

      // Verify player mapping is cleaned
      const playerMap = await roomRepository.getPlayerRoomMapping(host.id);
      assert.equal(playerMap, null);
    });
  });

  describe('6. Host-Only Settings & Player-Specific Category Preferences', () => {
    test('55-58. Host can modify global settings; Non-host is strictly rejected', async () => {
      const host = { id: 'host_auth', username: 'HostAuth' };
      const guest = { id: 'guest_auth', username: 'GuestAuth' };
      const p3 = { id: 'p3_auth', username: 'P3Auth' };
      const p4 = { id: 'p4_auth', username: 'P4Auth' };
      const room = await gameEngine.createRoom(host, { impostersCount: 1, turnDurationSeconds: 30 });
      await gameEngine.joinRoom(room.code, guest);
      await gameEngine.joinRoom(room.code, p3);
      await gameEngine.joinRoom(room.code, p4);

      // 1. Host updates settings successfully
      const updated = await gameEngine.updateSettings(room.code, host.id, {
        impostersCount: 2,
        turnDurationSeconds: 45,
        votingDurationSeconds: 60,
        lobbyDisconnectTimeout: 10
      });
      assert.equal(updated.settings.impostersCount, 2);
      assert.equal(updated.settings.turnDurationSeconds, 45);
      assert.equal(updated.settings.votingDurationSeconds, 60);
      assert.equal(updated.settings.lobbyDisconnectTimeout, 10);

      // 2. Guest/Non-host attempts to update settings -> MUST REJECT
      await assert.rejects(
        async () => {
          await gameEngine.updateSettings(room.code, guest.id, {
            impostersCount: 1,
            turnDurationSeconds: 15
          });
        },
        /Only the room host can modify settings/
      );

      // Verify Redis state was not mutated by guest attempt
      const refreshed = await roomRepository.getRoom(room.code);
      assert.equal(refreshed.settings.turnDurationSeconds, 45);
      assert.equal(refreshed.settings.impostersCount, 2);
    });

    test('59-62. One Shared Room Category Selection per room — any member can change, all players synchronized', async () => {
      const host = { id: 'h_cat', username: 'HostCat' };
      const p2 = { id: 'p2_cat', username: 'Player2Cat' };
      const p3 = { id: 'p3_cat', username: 'Player3Cat' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      // Normal player (p2) updates shared room categories to 3 categories
      const update1 = await gameEngine.updateRoomCategories(
        room.code,
        p2.id,
        ['fruits', 'vegetables', 'gaming'],
        ['Fruits', 'Vegetables', 'Video Games']
      );

      assert.deepEqual(update1.categorySlugs, ['fruits', 'vegetables', 'gaming']);
      assert.equal(update1.categorySlugs.length, 3);

      const latestRoom1 = await roomRepository.getRoom(room.code);
      // Verify authoritative shared categories in Redis settings
      assert.deepEqual(latestRoom1.settings.categorySlugs, ['fruits', 'vegetables', 'gaming']);
      assert.deepEqual(latestRoom1.settings.selectedCategories, ['fruits', 'vegetables', 'gaming']);

      // Verify all players see the exact same 3 categories in sanitized views
      const sanitizedHost = gameEngine.sanitizeRoomForPlayer(latestRoom1, host.id);
      const sanitizedP2 = gameEngine.sanitizeRoomForPlayer(latestRoom1, p2.id);
      const sanitizedP3 = gameEngine.sanitizeRoomForPlayer(latestRoom1, p3.id);

      assert.deepEqual(sanitizedHost.settings.categorySlugs, ['fruits', 'vegetables', 'gaming']);
      assert.deepEqual(sanitizedP2.settings.categorySlugs, ['fruits', 'vegetables', 'gaming']);
      assert.deepEqual(sanitizedP3.settings.categorySlugs, ['fruits', 'vegetables', 'gaming']);
      assert.equal(sanitizedHost.settings.categorySlugs.length, 3);
      assert.equal(sanitizedP2.settings.categorySlugs.length, 3);
      assert.equal(sanitizedP3.settings.categorySlugs.length, 3);

      // Another player (p3) deselects gaming -> 2 categories remain
      await gameEngine.updateRoomCategories(
        room.code,
        p3.id,
        ['fruits', 'vegetables'],
        ['Fruits', 'Vegetables']
      );

      const latestRoom2 = await roomRepository.getRoom(room.code);
      assert.deepEqual(latestRoom2.settings.categorySlugs, ['fruits', 'vegetables']);

      const sanitizedHostAfter = gameEngine.sanitizeRoomForPlayer(latestRoom2, host.id);
      const sanitizedP2After = gameEngine.sanitizeRoomForPlayer(latestRoom2, p2.id);
      assert.deepEqual(sanitizedHostAfter.settings.categorySlugs, ['fruits', 'vegetables']);
      assert.deepEqual(sanitizedP2After.settings.categorySlugs, ['fruits', 'vegetables']);
      assert.equal(sanitizedHostAfter.settings.categorySlugs.length, 2);
      assert.equal(sanitizedP2After.settings.categorySlugs.length, 2);

      // Verify empty selection is rejected
      await assert.rejects(
        async () => {
          await gameEngine.updateRoomCategories(room.code, p2.id, []);
        },
        /You must select at least one word category/
      );

      // Verify unauthorized non-member is rejected
      await assert.rejects(
        async () => {
          await gameEngine.updateRoomCategories(room.code, 'stranger_id', ['fruits']);
        },
        /Player is not an active member of this room/
      );
    });

    test('63-66. Match start uses shared room category word pool; secret word is identical for all Civilians', async () => {
      const host = { id: 'h_val', username: 'HostVal' };
      const p2 = { id: 'p2_val', username: 'Player2Val' };
      const p3 = { id: 'p3_val', username: 'Player3Val' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      // Player 2 sets room categories to Animals and Movies
      await gameEngine.updateRoomCategories(room.code, p2.id, ['animals', 'movies'], ['Animals & Pets', 'Movies & Cinema']);

      // Start game
      const started = await gameEngine.startGame(room.code, host.id);
      assert.equal(started.status, 'ROLE_REVEAL');

      const imposter = started.players.find(p => p.role === 'IMPOSTER');
      const civilians = started.players.filter(p => p.role === 'CIVILIAN');

      assert.ok(imposter, 'Must have at least 1 imposter');
      assert.equal(civilians.length, 2, 'Must have 2 civilians');

      // Imposter receives null secretWord and the hint
      assert.equal(imposter.secretWord, null, 'Imposter must not receive secretWord directly');
      assert.ok(imposter.hint, 'Imposter must receive hint');

      // All Civilians receive the EXACT SAME secret word and hint
      assert.ok(civilians[0].secretWord, 'Civilian 1 has secret word');
      assert.ok(civilians[1].secretWord, 'Civilian 2 has secret word');
      assert.equal(civilians[0].secretWord, civilians[1].secretWord, 'All Civilians must receive identical secret word');
      assert.equal(civilians[0].hint, civilians[1].hint, 'All Civilians must receive identical hint');
      assert.equal(civilians[0].hint, imposter.hint, 'Civilian and Imposter share the same hint');

      // Category update during active match is rejected
      await assert.rejects(
        async () => {
          await gameEngine.updateRoomCategories(room.code, p2.id, ['fruits'], ['Fruits']);
        },
        /Categories can only be modified in the lobby/
      );
    });

    test('67-68. Empty shared category settings blocks match start', async () => {
      const host = { id: 'h_empty', username: 'HostEmpty' };
      const p2 = { id: 'p2_empty', username: 'P2Empty' };
      const p3 = { id: 'p3_empty', username: 'P3Empty' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      const r = await roomRepository.getRoom(room.code);
      r.settings.categorySlugs = [];
      r.settings.selectedCategories = [];
      await roomRepository.saveRoom(room.code, r);

      const readiness = gameEngine.canStartGame(r);
      assert.equal(readiness.ready, false);
      assert.ok(readiness.reason.includes('At least one word category must be selected for the room'));
    });
  });

  describe('9. Host Kick & Rejoin Approval + Turn Timeout Auto-Skip', () => {
    test('69-72. Host kick records kick in Redis and blocks automatic rejoin', async () => {
      const host = { id: 'host_k', username: 'HostKick' };
      const p2 = { id: 'p2_k', username: 'PlayerToKick' };
      const p3 = { id: 'p3_k', username: 'Player3' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      // Host kicks p2
      const kickRes = await gameEngine.removePlayerByHost(room.code, host.id, p2.id);
      assert.equal(kickRes.removedPlayerId, p2.id);

      const afterKick = await roomRepository.getRoom(room.code);
      assert.equal(afterKick.players.length, 2);
      assert.ok(afterKick.kickedPlayerIds.includes(p2.id), 'Kicked player ID must be recorded in room.kickedPlayerIds');

      // Player to kick cannot auto-rejoin
      await assert.rejects(
        async () => {
          await gameEngine.joinRoom(room.code, p2);
        },
        (err) => {
          assert.equal(err.code, 'KICKED_REJOIN_REQUIRES_APPROVAL');
          return true;
        }
      );
    });

    test('73-76. Rejoin request and host approval workflow', async () => {
      const host = { id: 'host_app', username: 'HostApproval' };
      const p2 = { id: 'p2_app', username: 'KickedP2' };
      const p3 = { id: 'p3_app', username: 'P3' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      // Kick p2
      await gameEngine.removePlayerByHost(room.code, host.id, p2.id);

      // p2 creates a rejoin request
      const req = await gameEngine.createRejoinRequest(room.code, p2);
      assert.ok(req.requestId, 'Rejoin request must have requestId');
      assert.equal(req.status, 'PENDING');

      // Non-host cannot approve
      await assert.rejects(
        async () => {
          await gameEngine.approveRejoin(room.code, 'p3_app', p2.id, req.requestId);
        },
        /Host authority required to approve rejoin/
      );

      // Host approves
      const approved = await gameEngine.approveRejoin(room.code, host.id, p2.id, req.requestId);
      assert.ok(approved.room.players.some(p => p.id === p2.id), 'Player must be restored to room');
      assert.ok(!approved.room.kickedPlayerIds.includes(p2.id), 'Kick record must be cleared');

      // Attempting to reuse or approve the same request fails
      await assert.rejects(
        async () => {
          await gameEngine.approveRejoin(room.code, host.id, p2.id, req.requestId);
        },
        /Rejoin request has expired or was already handled/
      );
    });

    test('77-79. Host denial rejects rejoin request and prevents entry', async () => {
      const host = { id: 'host_den', username: 'HostDeny' };
      const p2 = { id: 'p2_den', username: 'P2Deny' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.removePlayerByHost(room.code, host.id, p2.id);

      const req = await gameEngine.createRejoinRequest(room.code, p2);
      const denied = await gameEngine.denyRejoin(room.code, host.id, p2.id, req.requestId);
      assert.equal(denied.status, 'DENIED');

      // Room still does not contain p2
      const r = await roomRepository.getRoom(room.code);
      assert.ok(!r.players.some(p => p.id === p2.id));
      assert.ok(r.kickedPlayerIds.includes(p2.id));
    });

    test('80-83. Authoritative turn timeout marks clue as SKIPPED and advances turn', async () => {
      const host = { id: 't_h', username: 'TurnHost' };
      const p2 = { id: 't_p2', username: 'TurnP2' };
      const p3 = { id: 't_p3', username: 'TurnP3' };
      const room = await gameEngine.createRoom(host, { turnDurationSeconds: 10 });
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      await gameEngine.startGame(room.code, host.id);
      await gameEngine.startClueRound(room.code);

      const r1 = await roomRepository.getRoom(room.code);
      assert.equal(r1.status, 'CLUE_ROUND');
      const firstPlayerId = r1.activeTurnPlayerId;
      assert.ok(firstPlayerId);

      // Trigger authoritative timeout for firstPlayerId
      const timeoutRes = await gameEngine.handleTurnTimeout(room.code, firstPlayerId);
      assert.equal(timeoutRes.skippedPlayerId, firstPlayerId);

      const r2 = await roomRepository.getRoom(room.code);
      // Clue history must have explicit SKIPPED status
      const historyEntry = r2.clueHistory.find(c => c.playerId === firstPlayerId);
      assert.ok(historyEntry, 'Must have clueHistory entry for timed out player');
      assert.equal(historyEntry.status, 'SKIPPED');
      assert.equal(historyEntry.clue, null);
      assert.equal(historyEntry.skipped, true);

      // Turn must have advanced to next player
      assert.notEqual(r2.activeTurnPlayerId, firstPlayerId, 'Active turn must advance to next player');
    });

    test('84-86. Last player timeout transitions round directly to VOTING', async () => {
      const host = { id: 'lp_h', username: 'LastHost' };
      const p2 = { id: 'lp_p2', username: 'LastP2' };
      const p3 = { id: 'lp_p3', username: 'LastP3' };
      const room = await gameEngine.createRoom(host, { turnDurationSeconds: 10, votingDurationSeconds: 30 });
      await gameEngine.joinRoom(room.code, p2);
      await gameEngine.joinRoom(room.code, p3);

      await gameEngine.startGame(room.code, host.id);
      await gameEngine.startClueRound(room.code);

      const r = await roomRepository.getRoom(room.code);
      const turnOrder = r.turnOrder; // [p1, p2, p3]

      // First two players submit valid clues
      await gameEngine.submitClueOrGuess(room.code, turnOrder[0], 'ClueOne');
      await gameEngine.submitClueOrGuess(room.code, turnOrder[1], 'ClueTwo');

      const rBeforeLast = await roomRepository.getRoom(room.code);
      assert.equal(rBeforeLast.activeTurnPlayerId, turnOrder[2]);

      // Last player times out
      const lastTimeout = await gameEngine.handleTurnTimeout(room.code, turnOrder[2]);
      assert.equal(lastTimeout.phaseChanged, true);
      assert.equal(lastTimeout.newStatus, 'VOTING');

      const rAfterLast = await roomRepository.getRoom(room.code);
      assert.equal(rAfterLast.status, 'VOTING', 'Room must transition immediately to VOTING phase');
      assert.ok(rAfterLast.votingDeadline, 'Voting deadline must be set');

      // Verify all 3 clues in history: 2 submitted, 1 skipped
      assert.equal(rAfterLast.clueHistory.length, 3);
      assert.equal(rAfterLast.clueHistory[2].status, 'SKIPPED');
    });
  });

  describe('10. Configurable Game Disconnect Timeout & Rejoin Status Verification', () => {
    test('87-90. Host can configure gameDisconnectTimeout; non-host and invalid values are rejected', async () => {
      const host = { id: 'gdt_host', username: 'GDTHost' };
      const nonHost = { id: 'gdt_player', username: 'GDTPlayer' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, nonHost);

      // Default game disconnect timeout should be 15
      assert.equal(room.settings.gameDisconnectTimeout, 15);
      assert.equal(room.settings.gameDisconnectGracePeriod, 15);

      // Host can update to 3, 5, 10, 15, 30
      const updated30 = await gameEngine.updateSettings(room.code, host.id, { gameDisconnectTimeout: 30 });
      assert.equal(updated30.settings.gameDisconnectTimeout, 30);
      assert.equal(updated30.settings.gameDisconnectGracePeriod, 30);

      const updated3 = await gameEngine.updateSettings(room.code, host.id, { gameDisconnectTimeout: 3 });
      assert.equal(updated3.settings.gameDisconnectTimeout, 3);

      // Non-host cannot update
      await assert.rejects(
        async () => {
          await gameEngine.updateSettings(room.code, nonHost.id, { gameDisconnectTimeout: 10 });
        },
        /Only the room host can modify settings/
      );

      // Invalid value rejected
      await assert.rejects(
        async () => {
          await gameEngine.updateSettings(room.code, host.id, { gameDisconnectTimeout: 99 });
        },
        /gameDisconnectTimeout must be one of: 3, 5, 10, 15, 30 seconds/
      );
    });

    test('91-94. getRejoinStatus returns accurate status across request lifecycle', async () => {
      const host = { id: 'rejoin_status_host', username: 'RSHost' };
      const kickedP = { id: 'rejoin_status_kicked', username: 'RSKicked' };
      const room = await gameEngine.createRoom(host);
      await gameEngine.joinRoom(room.code, kickedP);

      // Host kicks player
      await gameEngine.removePlayerByHost(room.code, host.id, kickedP.id);

      // Before request is created, not pending
      const initialStatus = await gameEngine.getRejoinStatus(room.code, kickedP.id);
      assert.notEqual(initialStatus?.status, 'PENDING');

      // Request rejoin -> PENDING
      const req = await gameEngine.createRejoinRequest(room.code, kickedP);
      const pendingStatus = await gameEngine.getRejoinStatus(room.code, kickedP.id);
      assert.ok(pendingStatus);
      assert.equal(pendingStatus.status, 'PENDING');
      assert.equal(pendingStatus.roomCode, room.code);

      // Host approves -> APPROVED
      await gameEngine.approveRejoin(room.code, host.id, kickedP.id, req.requestId);
      const approvedStatus = await gameEngine.getRejoinStatus(room.code, kickedP.id);
      assert.ok(approvedStatus);
      assert.equal(approvedStatus.status, 'APPROVED');
      assert.equal(approvedStatus.roomCode, room.code);
      assert.ok(approvedStatus.room);
      assert.ok(approvedStatus.room.players.some(p => p.id === kickedP.id));
    });
  });
});
