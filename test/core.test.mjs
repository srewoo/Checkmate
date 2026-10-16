import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { parseSpoken, matchMoves, sayMove } from '../parse.js';
import { classicMove, rankMoves } from '../ai.js';

const sanFor = (fen, said) => matchMoves(parseSpoken(said), new Chess(fen).moves({ verbose: true })).map((m) => m.san);
const START = new Chess().fen();

test('voice: common phrasings resolve to one legal move', () => {
  assert.deepEqual(sanFor(START, 'e4'), ['e4']);
  assert.deepEqual(sanFor(START, 'E2 to E4'), ['e4']);
  assert.deepEqual(sanFor(START, 'echo two echo four'), ['e4']);
  assert.deepEqual(sanFor(START, 'e two e four'), ['e4']);
  assert.deepEqual(sanFor(START, 'knight to f3'), ['Nf3']);
  assert.deepEqual(sanFor(START, 'night f three'), ['Nf3']);
  assert.deepEqual(sanFor(START, 'pawn to d four'), ['d4']);
});

test('voice: captures, castling, promotion, commands', () => {
  const ch = new Chess();
  ['e4', 'd5'].forEach((m) => ch.move(m));
  assert.deepEqual(sanFor(ch.fen(), 'e takes d5'), ['exd5']);
  assert.deepEqual(sanFor(ch.fen(), 'pawn takes d five'), ['exd5']);

  const castle = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  assert.deepEqual(sanFor(castle, 'castle kingside'), ['O-O']);
  assert.deepEqual(sanFor(castle, 'castles long'), ['O-O-O']);

  const promo = '8/P7/8/8/8/8/8/k6K w - - 0 1';
  assert.deepEqual(sanFor(promo, 'a8'), ['a8=Q+']);
  assert.deepEqual(sanFor(promo, 'a8 promote to knight'), ['a8=N']);

  assert.deepEqual(parseSpoken('undo that'), { cmd: 'undo' });
  assert.equal(parseSpoken('hello there'), null);
  assert.deepEqual(sanFor(START, 'e5'), []); // illegal -> nothing
});

test('sayMove reads moves aloud', () => {
  const ch = new Chess();
  assert.equal(sayMove(ch.move('Nf3')), 'Knight to f3');
});

test('engine: takes a free queen and finds mate in one', () => {
  assert.equal(classicMove('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1', 'medium').san, 'exd5');
  assert.equal(classicMove('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'hard').san, 'Rd8#');
  const t = performance.now();
  rankMoves(new Chess().fen(), 3);
  console.log(`hard search from start: ${Math.round(performance.now() - t)}ms`);
});
