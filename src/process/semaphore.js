// Simple semaphore implementation for controlling concurrency
class Semaphore {
  constructor(max) {
    this.max = max;
    this.count = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.count < this.max) {
      this.count++;
      return this._createRelease();
    }

    // Create a promise that will be resolved when a resource is released
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.count++;
        resolve(this._createRelease());
      });
    });
  }

  _createRelease() {
    return () => {
      this.count--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    };
  }
}

module.exports = { Semaphore };
