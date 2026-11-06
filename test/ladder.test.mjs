import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPPONENTS, loadLadder, saveLadder, recordResult, expected } from '../ladder.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('opponents get stronger up the ladder', () => {
  assert.equal(OPPONENTS.length, 8);
  for (let i = 1; i < OPPONENTS.length; i++) assert.ok(OPPONENTS[i].rating > OPPONENTS[i - 1].rating);
});

test('a win unlocks the next rung and raises the rating; a loss does neither', () => {
  const s0 = loadLadder(memory());
  const won = recordResult(s0, 1);
  assert.equal(won.rung, 1);
  assert.equal(won.beaten, 1);
  assert.ok(won.rating > s0.rating);
  const lost = recordResult(won, 0);
  assert.equal(lost.rung, 1);
  assert.ok(lost.rating < won.rating);
  assert.equal(lost.games, 2);
});

test('the top rung stays the top rung', () => {
  const top = { rung: OPPONENTS.length - 1, rating: 2000, games: 30, beaten: 7 };
  assert.equal(recordResult(top, 1).rung, OPPONENTS.length - 1);
  assert.equal(recordResult(top, 1).beaten, 8);
});

test('expected score is symmetric', () => {
  assert.equal(expected(1500, 1500), 0.5);
  assert.ok(Math.abs(expected(1200, 1600) + expected(1600, 1200) - 1) < 1e-9);
});

test('progress round-trips; junk or out-of-range storage is sanitised', () => {
  const s = memory();
  saveLadder(s, { rung: 3, rating: 1400, games: 5, beaten: 3 });
  assert.deepEqual(loadLadder(s), { rung: 3, rating: 1400, games: 5, beaten: 3 });
  s.setItem('checkmate.ladder', '{"rung":99,"rating":1000}');
  assert.equal(loadLadder(s).rung, OPPONENTS.length - 1);
  s.setItem('checkmate.ladder', 'nope');
  assert.equal(loadLadder(s).rung, 0);
});
