import roomRepository from '../redis/roomRepository.js';

export async function cleanupStaleRooms() {
  try {
    const codes = await roomRepository.getAllActiveRoomCodes();
    const now = Date.now();
    for (const code of codes) {
      const room = await roomRepository.getRoom(code);
      if (!room) {
        await roomRepository.deleteRoom(code);
        continue;
      }
      if (room.updatedAt && now - room.updatedAt > 48 * 60 * 60 * 1000) {
        console.log(`[Cron] Cleaning up stale room: ${code}`);
        await roomRepository.deleteRoom(code);
      }
    }
  } catch (err) {
    console.error('[Cron] Error during room cleanup:', err.message);
  }
}

export default {
  cleanupStaleRooms
};
