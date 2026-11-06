import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, check, loadUnlocked, saveUnlocked } from '../achievements.js';

const none = new Set();

test('a quick knight mate on Hard without hints earns the lot, once', () => {
  const ctx = { level: 'hard', hints: 0, plies: 40, mateBy: 'n' };
  assert.deepEqual(check('win', ctx, none).sort(), ['firstWin', 'hardWin', 'knightMate', 'noHints', 'quick']);
  assert.deepEqual(check('win', ctx, new Set(['firstWin', 'hardWin', 'knightMate', 'noHints', 'quick'])), []);
});

test('a win with hints only earns the first win, however it was won', () => {
  assert.deepEqual(check('win', { level: 'easy', hints: 2, plies: 90, mateBy: null }, none), ['firstWin']);
  assert.deepEqual(check('win', { level: 'master', hints: 1, plies: 20, mateBy: 'n' }, none), ['firstWin']);
  assert.deepEqual(check('summary', { accuracy: 98, hints: 15 }, none), []);
});

test('thresholds: ladder, puzzles, rush, streak, accuracy, great move', () => {
  assert.deepEqual(check('ladder', { beaten: 3, total: 8 }, none), ['rung3']);
  assert.deepEqual(check('ladder', { beaten: 8, total: 8 }, none).sort(), ['ladder', 'rung3']);
  assert.deepEqual(check('puzzle', { solved: 9 }, none), []);
  assert.deepEqual(check('puzzle', { solved: 50 }, none).sort(), ['puzzles10', 'puzzles50']);
  assert.deepEqual(check('rush', { score: 12 }, none), ['rush10']);
  assert.deepEqual(check('daily', { streak: 7 }, none), ['streak7']);
  assert.deepEqual(check('summary', { accuracy: 89, hints: 0 }, none), []);
  assert.deepEqual(check('summary', { accuracy: 92, hints: 0 }, none), ['sharp']);
  assert.deepEqual(check('reaction', { kind: 'great' }, none), ['greatMove']);
});

test('every id checked exists, and unlocks round-trip through storage', () => {
  const m = new Map();
  const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  saveUnlocked(s, new Set(['firstWin']));
  assert.deepEqual([...loadUnlocked(s)], ['firstWin']);
  m.set('checkmate.achievements', 'garbage');
  assert.equal(loadUnlocked(s).size, 0);
  assert.equal(Object.keys(ACHIEVEMENTS).length, 15);
});
