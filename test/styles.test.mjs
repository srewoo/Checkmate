import { test } from 'node:test';
import assert from 'node:assert/strict';
import { features, pickStyled, STYLES } from '../styles.js';
import { parseInfo, goCommands } from '../engine-stockfish.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Italian-ish middlegame, white to move: Bxf7+ is a check and a capture, O-O castles, Ng5 eyes f7 by the king
const MID = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5';

test('features describe a move', () => {
  assert.deepEqual(features(START, 'g1f3'), { capture: false, check: false, pawn: false, develop: true, castle: false, retreat: false, kingZone: false });
  const f = features(MID, 'c4f7');
  assert.ok(f.capture && f.check && f.kingZone);
  assert.ok(features(MID, 'e1g1').castle);
  assert.equal(features(MID, 'e1e5'), null);
});

test('balanced or empty input keeps the engine move', () => {
  assert.equal(pickStyled([{ uci: 'c4f7', score: 0 }], 'e1g1', MID, 'balanced'), 'e1g1');
  assert.equal(pickStyled([], 'e1g1', MID, 'aggressive'), 'e1g1');
  assert.equal(STYLES.balanced, null);
});

test('styles lean their way among equal moves', () => {
  const lines = [{ uci: 'e1g1', score: 30 }, { uci: 'c4f7', score: 25 }, { uci: 'b1c3', score: 28 }];
  const count = (style) => {
    let i = 0;
    const tally = {};
    for (let n = 0; n < 300; n++) { const u = pickStyled(lines, 'b1c3', MID, style, () => ((i++ * 0.6180339) % 1)); tally[u] = (tally[u] ?? 0) + 1; }
    return tally;
  };
  const agg = count('aggressive');
  const def = count('defensive');
  assert.ok(agg.c4f7 > def.c4f7);
  assert.ok(def.e1g1 > agg.e1g1);
});

test('a style never picks a move far worse than the engine choice', () => {
  const lines = [{ uci: 'e1g1', score: 40 }, { uci: 'c4f7', score: -300 }];
  for (let i = 0; i < 50; i++) assert.equal(pickStyled(lines, 'e1g1', MID, 'tactical', () => i / 50), 'e1g1');
});

test('parseInfo reads MultiPV lines; goCommands sets MultiPV', () => {
  assert.deepEqual(parseInfo('info depth 9 seldepth 12 multipv 2 score cp -14 nodes 900 nps 1 pv d2d4 d7d5'), { multipv: 2, score: -14, uci: 'd2d4' });
  assert.deepEqual(parseInfo('info depth 5 score mate 3 nodes 1 pv a1a8'), { multipv: 1, score: 100000, uci: 'a1a8' });
  assert.equal(parseInfo('info string hi'), null);
  assert.ok(goCommands(START, 'medium', undefined, 4).includes('setoption name MultiPV value 4'));
  assert.ok(goCommands(START, 'medium').includes('setoption name MultiPV value 1'));
});
