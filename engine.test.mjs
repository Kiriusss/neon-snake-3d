import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeGame } from './engine.js';

test('reset produces a valid six-cell bent snake and unoccupied food', () => {
  for (const size of [3, 4, 5, 18]) {
    const game = new SnakeGame({ size, random: () => 0.5 });
    assert.equal(game.status, 'ready');
    assert.equal(game.snake.length, 6);
    assert.equal(new Set(game.snake.map(p => `${p.x},${p.z}`)).size, 6);
    assert.ok(game.snake.every(p => p.x >= 0 && p.x < size && p.z >= 0 && p.z < size));
    assert.ok(!game.snake.some(p => p.x === game.food.x && p.z === game.food.z));
  }
});

test('turns reject reversal and buffer a pair of sequential legal turns', () => {
  const game = new SnakeGame();
  assert.equal(game.turn('left'), false);
  assert.equal(game.turn('right'), false);
  assert.equal(game.turn('up'), true);
  assert.equal(game.turn('down'), false);
  assert.equal(game.turn('left'), true);
  assert.equal(game.turn('down'), false, 'a third turn cannot overflow the buffer');
  assert.equal(game.status, 'ready', 'turning does not implicitly start');
  game.start();
  game.step();
  assert.deepEqual(game.snake[0], { x: 10, z: 7 });
  game.step();
  assert.deepEqual(game.snake[0], { x: 9, z: 7 });
});

test('food grows the snake by one, adds ten points, and respawns in a free cell', () => {
  const game = new SnakeGame({ random: () => 0 });
  game.food = { x: 11, z: 8 };
  game.start();
  assert.deepEqual(game.step(), { ate: true, ended: false });
  assert.equal(game.snake.length, 7);
  assert.equal(game.score, 10);
  assert.equal(game.foodsEaten, 1);
  assert.ok(!game.snake.some(p => p.x === game.food.x && p.z === game.food.z));
  game.step();
  assert.equal(game.snake.length, 7);
  assert.equal(game.score, 10);
});

test('wall collisions end the game and preserve the last valid snake', () => {
  const game = new SnakeGame();
  game.snake = [{ x: 17, z: 8 }, { x: 16, z: 8 }];
  const before = structuredClone(game.snake);
  game.start();
  assert.deepEqual(game.step(), { ate: false, ended: true, reason: 'wall' });
  assert.equal(game.status, 'over');
  assert.deepEqual(game.snake, before);
  assert.equal(game.turn('up'), false);
});

test('moving into a body cell ends the game', () => {
  const game = new SnakeGame();
  game.snake = [
    { x: 5, z: 5 }, { x: 5, z: 6 }, { x: 6, z: 6 },
    { x: 6, z: 5 }, { x: 6, z: 4 },
  ];
  game.start();
  assert.deepEqual(game.step(), { ate: false, ended: true, reason: 'self' });
  assert.equal(game.status, 'over');
});

test('moving into the tail is legal when that tail is vacating', () => {
  const game = new SnakeGame();
  game.snake = [
    { x: 5, z: 5 }, { x: 5, z: 6 }, { x: 6, z: 6 }, { x: 6, z: 5 },
  ];
  game.food = { x: 0, z: 0 };
  game.start();
  assert.deepEqual(game.step(), { ate: false, ended: false });
  assert.deepEqual(game.snake[0], { x: 6, z: 5 });
  assert.equal(game.snake.length, 4);
});

test('eating the final free cell wins and produces no food', () => {
  const game = new SnakeGame({ size: 3 });
  game.snake = [
    { x: 1, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 2 },
    { x: 1, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 1 }, { x: 1, z: 1 },
  ];
  game.food = { x: 2, z: 0 };
  game.start();
  assert.deepEqual(game.step(), { ate: true, ended: true, reason: 'win' });
  assert.equal(game.status, 'won');
  assert.equal(game.snake.length, 9);
  assert.equal(game.food, null);
});

test('ready and paused states do not advance, resume continues, reset clears state', () => {
  const game = new SnakeGame();
  const initial = structuredClone(game.snake);
  assert.deepEqual(game.step(), { ate: false, ended: false });
  assert.deepEqual(game.snake, initial);
  game.start().pause();
  assert.equal(game.status, 'paused');
  game.step();
  assert.deepEqual(game.snake, initial);
  game.resume();
  game.step();
  assert.equal(game.snake[0].x, initial[0].x + 1);
  game.turn('up');
  game.score = 30;
  game.foodsEaten = 3;
  game.reset();
  assert.equal(game.status, 'ready');
  assert.equal(game.score, 0);
  assert.equal(game.foodsEaten, 0);
  assert.equal(game.turnQueue.length, 0);
  assert.deepEqual(game.snake, initial);
});

test('food selection handles extreme random samples and a full board', () => {
  const game = new SnakeGame({ size: 3, random: () => 1 });
  assert.ok(game.food);
  game.random = () => Number.NaN;
  assert.ok(game.spawnFood());
  game.snake = Array.from({ length: 9 }, (_, i) => ({ x: i % 3, z: Math.floor(i / 3) }));
  assert.equal(game.spawnFood(), null);
});
