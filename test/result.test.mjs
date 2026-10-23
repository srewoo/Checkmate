import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { materialBalance, resultOf, moveSound } from '../result.js';

test('materialBalance counts points, promotions included', () => {
  assert.equal(materialBalance(new Chess()), 0);
  assert.equal(materialBalance(new Chess('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')), 9);
  assert.equal(materialBalance(new Chess('4k3/3rn3/8/8/8/8/8/4K3 w - - 0 1')), -8);
});

test('resultOf covers mate, flag, flag vs bare king, resignation, ongoing', () => {
  const mated = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  mated.move('Ra8#');
  assert.deepEqual(resultOf(mated, null, null), { winner: 'w', reason: 'Checkmate' });
  assert.equal(resultOf(new Chess(), null, null), null);
  assert.deepEqual(resultOf(new Chess(), 'w', null), { winner: 'b', reason: 'Time' });
  // Black flags, but White has king + knight only: draw
  assert.equal(resultOf(new Chess('4k3/8/8/8/8/8/8/1N2K2q b - - 0 1'), 'b', null).winner, null);
  const resigned = { winner: 'b', reason: 'White resigned' };
  assert.equal(resultOf(new Chess(), null, resigned), resigned);
});

test('moveSound picks the right cue', () => {
  const ch = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(moveSound(ch.move('O-O'), ch), 'castle');
  const c2 = new Chess();
  assert.equal(moveSound(c2.move('e4'), c2), 'move');
  ['d5'].forEach((m) => c2.move(m));
  assert.equal(moveSound(c2.move('exd5'), c2), 'capture');
});
