import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { PUZZLES } from '../puzzles-data.js';
import { toPuzzle, daily, near, judge, fromUci, rushRating } from '../puzzles.js';

const seq = () => { let i = 0; return () => ((i++ * 0.37) % 1); }; // deterministic "random"

test('bundled puzzles are well-formed and sorted by rating', () => {
  assert.equal(PUZZLES.length, 1200);
  for (let i = 1; i < PUZZLES.length; i++) assert.ok(PUZZLES[i][3] >= PUZZLES[i - 1][3]);
  const p = toPuzzle(PUZZLES[0]);
  assert.ok(p.moves.length >= 2 && p.moves.length % 2 === 0);
});

test('daily is stable for a date, differs across days, and is mid-rated', () => {
  const a = daily(new Date(2026, 10, 5));
  assert.equal(daily(new Date(2026, 10, 5, 23, 59)).id, a.id);
  assert.notEqual(daily(new Date(2026, 10, 6)).id, a.id);
  assert.ok(a.rating >= 1200 && a.rating <= 1800);
});

test('near picks within the window and skips seen ids', () => {
  const p = near(1500, new Set(), seq());
  assert.ok(Math.abs(p.rating - 1500) <= 100);
  const first = near(1500, new Set(), () => 0);
  assert.notEqual(near(1500, new Set([first.id]), () => 0).id, first.id);
  assert.ok(near(5000, new Set(), seq()).rating > 2000); // widens to the top of the set
});

test('judge walks a real puzzle: correct, then solved; a wrong move is wrong', () => {
  const p = toPuzzle(PUZZLES.find((x) => x[2].split(' ').length === 4));
  const c = new Chess(p.fen);
  c.move(fromUci(p.moves[0]));
  const right = c.move(fromUci(p.moves[1]));
  assert.equal(judge(p, 1, right, c.isCheckmate()), c.isCheckmate() ? 'solved' : 'correct');
  c.move(fromUci(p.moves[2]));
  const last = c.move(fromUci(p.moves[3]));
  assert.equal(judge(p, 3, last, c.isCheckmate()), 'solved');
  assert.equal(judge(p, 1, { from: 'a1', to: 'a2' }, false), 'wrong');
  assert.equal(judge(p, 1, { from: 'a1', to: 'a2' }, true), 'solved'); // an alternative mate also solves
});

test('rush gets harder as you solve', () => {
  assert.ok(rushRating(10) > rushRating(0));
});
