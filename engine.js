const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, z: -1 }),
  down: Object.freeze({ x: 0, z: 1 }),
  left: Object.freeze({ x: -1, z: 0 }),
  right: Object.freeze({ x: 1, z: 0 }),
});

const sameCell = (a, b) => a.x === b.x && a.z === b.z;

/** Grid rules only. Coordinates map directly to the 3D scene's x/z plane. */
export class SnakeGame {
  constructor({ size = 18, random = Math.random } = {}) {
    if (!Number.isInteger(size) || size < 3) {
      throw new RangeError('The board size must be an integer of at least 3.');
    }
    this.size = size;
    this.random = random;
    this.reset();
  }

  reset() {
    const x = Math.min(10, this.size - 2);
    const z = Math.min(8, this.size - 3);
    this.snake = this.size >= 5
      ? [
          { x, z },
          { x: x - 1, z },
          { x: x - 2, z },
          { x: x - 3, z },
          { x: x - 3, z: z + 1 },
          { x: x - 3, z: z + 2 },
        ]
      : [
          { x: 1, z: 1 },
          { x: 0, z: 1 },
          { x: 0, z: 2 },
          { x: 1, z: 2 },
          { x: 2, z: 2 },
          { x: 2, z: 1 },
        ];
    this.direction = { ...DIRECTIONS.right };
    this.turnQueue = [];
    this.score = 0;
    this.foodsEaten = 0;
    this.status = 'ready';
    this.food = this.spawnFood();
    return this;
  }

  start() {
    if (this.status === 'ready' || this.status === 'paused') this.status = 'running';
    return this;
  }

  pause() {
    if (this.status === 'running') this.status = 'paused';
    return this;
  }

  resume() {
    if (this.status === 'paused') this.status = 'running';
    return this;
  }

  /** Buffer two turns, comparing each against the previously accepted turn. */
  turn(name) {
    const next = DIRECTIONS[name];
    if (!next || this.status === 'over' || this.status === 'won') return false;
    const previous = this.turnQueue.at(-1) ?? this.direction;
    if (sameCell(next, previous)) return false;
    if (next.x === -previous.x && next.z === -previous.z) return false;
    if (this.turnQueue.length >= 2) return false;
    this.turnQueue.push({ ...next });
    return true;
  }

  /** Select uniformly from free cells, so a nearly full board cannot hang. */
  spawnFood() {
    const occupied = new Set(this.snake.map(({ x, z }) => `${x},${z}`));
    const free = [];
    for (let z = 0; z < this.size; z += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (!occupied.has(`${x},${z}`)) free.push({ x, z });
      }
    }
    if (!free.length) return null;
    const sample = this.random();
    const index = Number.isFinite(sample)
      ? Math.max(0, Math.min(free.length - 1, Math.floor(sample * free.length)))
      : 0;
    return free[index];
  }

  step() {
    if (this.status !== 'running') {
      return { ate: false, ended: this.status === 'over' || this.status === 'won' };
    }
    if (this.turnQueue.length) this.direction = this.turnQueue.shift();
    const head = {
      x: this.snake[0].x + this.direction.x,
      z: this.snake[0].z + this.direction.z,
    };
    if (head.x < 0 || head.z < 0 || head.x >= this.size || head.z >= this.size) {
      this.status = 'over';
      return { ate: false, ended: true, reason: 'wall' };
    }
    const ate = this.food !== null && sameCell(head, this.food);
    // On a normal move the tail vacates its cell at the same instant.
    const collisionLength = this.snake.length - (ate ? 0 : 1);
    if (this.snake.slice(0, collisionLength).some(segment => sameCell(head, segment))) {
      this.status = 'over';
      return { ate: false, ended: true, reason: 'self' };
    }
    this.snake.unshift(head);
    if (!ate) {
      this.snake.pop();
      return { ate: false, ended: false };
    }
    this.foodsEaten += 1;
    this.score += 10;
    this.food = this.spawnFood();
    if (!this.food) {
      this.status = 'won';
      return { ate: true, ended: true, reason: 'win' };
    }
    return { ate: true, ended: false };
  }
}
