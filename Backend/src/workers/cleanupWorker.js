import { cleanupStaleRooms } from '../cron/roomCleanupCron.js';

export async function runWorker() {
  console.log('[Worker] Running background cleanup tasks...');
  await cleanupStaleRooms();
}

export default { runWorker };
