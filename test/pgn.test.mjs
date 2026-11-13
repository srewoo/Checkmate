import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePgn, MAX_PGN } from '../pgn.js';

test('parsePgn reads a game with headers', () => {
  const r = parsePgn('[White "Ann"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0');
  assert.equal(r.plies, 7);
  assert.equal(r.headers.White, 'Ann');
  assert.match(r.pgn, /Qxf7#/);
});

test('parsePgn explains what it rejects', () => {
  assert.match(parsePgn('  ').error, /Paste/);
  assert.match(parsePgn('1. e4 e5 2. Ke3 Ke6 3. Qxh8').error, /legal/);
  assert.match(parsePgn('[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Kb1 Kg1').error, /starting position/);
  assert.match(parsePgn('1. e4').error, /fewer/);
  assert.match(parsePgn('1. e4 '.repeat(MAX_PGN / 4)).error, /too long/);
});
