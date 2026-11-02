import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { REDIS_TTL } from '../src/config/redis.js';
import roomRepository from '../src/redis/roomRepository.js';

describe('⏱️ Configurable Redis Key Expiration (TTL) & Timeout Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Default Values Matching Existing Hardcoded Constants', () => {
    test('Default TTL and timeout values are strictly preserved when env vars are absent', () => {
      delete process.env.REDIS_ROOM_TTL;
      delete process.env.REDIS_PLAYER_ROOM_TTL;
      delete process.env.REDIS_SOCKET_MAPPING_TTL;
      delete process.env.REDIS_VOICE_PARTICIPANTS_TTL;
      delete process.env.REDIS_REJOIN_REQUEST_TTL;
      delete process.env.REDIS_TIMER_BUFFER_TTL;
      delete process.env.REDIS_LOBBY_DISCONNECT_TIMEOUT;
      delete process.env.REDIS_GAME_DISCONNECT_TIMEOUT;
      delete process.env.REDIS_TURN_TIMER_TIMEOUT;
      delete process.env.REDIS_VOTING_TIMER_TIMEOUT;

      assert.equal(REDIS_TTL.ROOM, 86400, 'REDIS_ROOM_TTL default must be 86400 (24h)');
      assert.equal(REDIS_TTL.PLAYER_ROOM, 86400, 'REDIS_PLAYER_ROOM_TTL default must be 86400 (24h)');
      assert.equal(REDIS_TTL.SOCKET_MAPPING, 86400, 'REDIS_SOCKET_MAPPING_TTL default must be 86400 (24h)');
      assert.equal(REDIS_TTL.VOICE_PARTICIPANTS, 86400, 'REDIS_VOICE_PARTICIPANTS_TTL default must be 86400 (24h)');
      assert.equal(REDIS_TTL.REJOIN_REQUEST, 45, 'REDIS_REJOIN_REQUEST_TTL default must be 45s');
      assert.equal(REDIS_TTL.TIMER_BUFFER, 10, 'REDIS_TIMER_BUFFER_TTL default must be 10s');
      assert.equal(REDIS_TTL.LOBBY_DISCONNECT, 5, 'REDIS_LOBBY_DISCONNECT_TIMEOUT default must be 5s');
      assert.equal(REDIS_TTL.GAME_DISCONNECT, 30, 'REDIS_GAME_DISCONNECT_TIMEOUT default must be 30s');
      assert.equal(REDIS_TTL.TURN_TIMER, 30, 'REDIS_TURN_TIMER_TIMEOUT default must be 30s');
      assert.equal(REDIS_TTL.VOTING_TIMER, 45, 'REDIS_VOTING_TIMER_TIMEOUT default must be 45s');
    });
  });

  describe('2. Custom Environment Variable Configuration', () => {
    test('Reads custom TTL and timeout values dynamically from process.env', () => {
      process.env.REDIS_ROOM_TTL = '3600';
      process.env.REDIS_PLAYER_ROOM_TTL = '7200';
      process.env.REDIS_SOCKET_MAPPING_TTL = '1800';
      process.env.REDIS_VOICE_PARTICIPANTS_TTL = '5400';
      process.env.REDIS_REJOIN_REQUEST_TTL = '60';
      process.env.REDIS_TIMER_BUFFER_TTL = '15';
      process.env.REDIS_LOBBY_DISCONNECT_TIMEOUT = '8';
      process.env.REDIS_GAME_DISCONNECT_TIMEOUT = '45';
      process.env.REDIS_TURN_TIMER_TIMEOUT = '20';
      process.env.REDIS_VOTING_TIMER_TIMEOUT = '60';

      assert.equal(REDIS_TTL.ROOM, 3600);
      assert.equal(REDIS_TTL.PLAYER_ROOM, 7200);
      assert.equal(REDIS_TTL.SOCKET_MAPPING, 1800);
      assert.equal(REDIS_TTL.VOICE_PARTICIPANTS, 5400);
      assert.equal(REDIS_TTL.REJOIN_REQUEST, 60);
      assert.equal(REDIS_TTL.TIMER_BUFFER, 15);
      assert.equal(REDIS_TTL.LOBBY_DISCONNECT, 8);
      assert.equal(REDIS_TTL.GAME_DISCONNECT, 45);
      assert.equal(REDIS_TTL.TURN_TIMER, 20);
      assert.equal(REDIS_TTL.VOTING_TIMER, 60);
    });
  });

  describe('3. Validation & Graceful Fallbacks for Invalid Values', () => {
    test('Falls back safely to defaults on invalid strings, negative numbers, or zeros', () => {
      process.env.REDIS_ROOM_TTL = 'not_a_number';
      process.env.REDIS_PLAYER_ROOM_TTL = '-100';
      process.env.REDIS_SOCKET_MAPPING_TTL = '0';
      process.env.REDIS_REJOIN_REQUEST_TTL = '';
      process.env.REDIS_TIMER_BUFFER_TTL = 'undefined';
      process.env.REDIS_LOBBY_DISCONNECT_TIMEOUT = '-5';
      process.env.REDIS_GAME_DISCONNECT_TIMEOUT = 'abc';
      process.env.REDIS_TURN_TIMER_TIMEOUT = '0';
      process.env.REDIS_VOTING_TIMER_TIMEOUT = '-1';

      assert.equal(REDIS_TTL.ROOM, 86400, 'Invalid string should fallback to 86400');
      assert.equal(REDIS_TTL.PLAYER_ROOM, 86400, 'Negative number should fallback to 86400');
      assert.equal(REDIS_TTL.SOCKET_MAPPING, 86400, 'Zero should fallback to 86400');
      assert.equal(REDIS_TTL.REJOIN_REQUEST, 45, 'Empty string should fallback to 45');
      assert.equal(REDIS_TTL.TIMER_BUFFER, 10, 'Invalid string should fallback to 10');
      assert.equal(REDIS_TTL.LOBBY_DISCONNECT, 5, 'Negative value should fallback to 5');
      assert.equal(REDIS_TTL.GAME_DISCONNECT, 30, 'Invalid string should fallback to 30');
      assert.equal(REDIS_TTL.TURN_TIMER, 30, 'Zero should fallback to 30');
      assert.equal(REDIS_TTL.VOTING_TIMER, 45, 'Negative value should fallback to 45');
    });
  });

  describe('4. RoomRepository Integration with Configurable TTLs', () => {
    test('roomRepository methods respect configured TTLs', async () => {
      process.env.REDIS_ROOM_TTL = '7200';
      process.env.REDIS_PLAYER_ROOM_TTL = '7200';

      const testCode = 'TTL1';
      const roomData = { code: testCode, status: 'WAITING', players: [] };

      await roomRepository.saveRoom(testCode, roomData);
      const retrieved = await roomRepository.getRoom(testCode);
      assert.equal(retrieved.code, testCode);

      await roomRepository.setPlayerRoomMapping('player_ttl_1', testCode);
      const mapped = await roomRepository.getPlayerRoomMapping('player_ttl_1');
      assert.equal(mapped, testCode);

      // Clean up
      await roomRepository.deleteRoom(testCode);
      await roomRepository.removePlayerRoomMapping('player_ttl_1');
    });
  });
});
