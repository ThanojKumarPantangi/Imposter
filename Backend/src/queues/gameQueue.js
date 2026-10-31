class GameQueue {
  async addJob(name, data) {
    return { id: Date.now(), name, data };
  }
}

const gameQueue = new GameQueue();
export default gameQueue;
