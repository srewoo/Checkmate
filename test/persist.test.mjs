import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveGame, loadGame } from '../persist.js';
import { createClock, parseControl } from '../clock.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const SETTINGS = { mode: 'ai', color: 'b', clock: '10+0' };
const GAME = { pgn: '1. e4 e5', mode: 'ai', color: 'b', clockSetting: '10+0', hintsUsed: 1, clock: { w: 590000, b: 595000, turn: 'w' } };

test('saved game round-trips and is cleared by null', () => {
  const s = memory();
  saveGame(s, GAME);
  assert.deepEqual(loadGame(s, SETTINGS), GAME);
  saveGame(s, null);
  assert.equal(loadGame(s, SETTINGS), null);
});

test('a game played with other settings is not resumed', () => {
  const s = memory();
  saveGame(s, GAME);
  assert.equal(loadGame(s, { ...SETTINGS, color: 'w' }), null);
  assert.equal(loadGame(s, { ...SETTINGS, clock: '5+0' }), null);
  assert.equal(loadGame(s, { ...SETTINGS, mode: 'local' }), null);
});

test('corrupt or blocked storage reads as no saved game', () => {
  const s = memory();
  s.setItem('checkmate.game', '{not json');
  assert.equal(loadGame(s, SETTINGS), null);
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  assert.doesNotThrow(() => saveGame(blocked, GAME));
  assert.equal(loadGame(blocked, SETTINGS), null);
});

test('resumed clock is paused with the saved times, then runs and undoes normally', () => {
  const now = () => now.t; now.t = 0;
  const c = createClock(parseControl('10+0'), now, { w: 590000, b: 595000, turn: 'w', plies: 2 });
  now.t = 5000;
  assert.deepEqual(c.state(), { w: 590000, b: 595000, turn: 'w', running: false, flagged: null });
  c.moved('w');
  now.t = 8000;
  assert.equal(c.state().b, 592000);
  c.undo();
  c.undo(); // past the resume point: keeps the saved times, turn still alternates
  assert.equal(c.state().turn, 'b');
  assert.equal(c.state().w, 590000);
});
