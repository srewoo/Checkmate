import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { tagMistake, enPrise, pins, allowsFork } from '../motifs.js';

/** Plays `sans` from the start (or `fen`) and returns what tagMistake needs for the last move. */
function last(sans, fen) {
  const c = fen ? new Chess(fen) : new Chess();
  let prevMove;
  let fenBefore;
  let move;
  sans.forEach((san, i) => {
    if (i === sans.length - 1) fenBefore = c.fen();
    const m = c.move(san);
    if (i === sans.length - 2) prevMove = m;
    move = m;
  });
  return { fenBefore, fenAfter: c.fen(), move, prevMove, ply: c.history().length - 1 + (fen ? 30 : 0), kind: 'blunder' };
}

test('enPrise: undefended, or attacked by something cheaper', () => {
  const c = new Chess('6k1/8/2b5/8/4N3/8/8/4R1K1 w - - 0 1');
  assert.equal(enPrise(c, 'e4'), false); // bishop for a defended knight is an even trade
  c.move('Ra1');
  assert.equal(enPrise(c, 'e4'), true);
  assert.equal(enPrise(new Chess('4k3/8/8/3p4/4Q3/8/8/4K3 w - - 0 1'), 'e4'), true); // pawn hits queen
});

test('missed and allowed mates are tagged as checkmate patterns', () => {
  const x = last(['e4', 'e5', 'Nf3']);
  assert.equal(tagMistake({ ...x, kind: 'missed-mate' }).skill, 'mate');
  assert.equal(tagMistake({ ...x, allowedMate: true }).skill, 'mate');
});

test('moving a piece where a pawn takes it is a loose piece', () => {
  const t = tagMistake(last(['e4', 'e5', 'Nc3', 'c6', 'Nd5']));
  assert.equal(t.skill, 'hanging');
  assert.match(t.why, /knight on d5/);
});

test('moving the only defender away leaves a piece loose', () => {
  const t = tagMistake(last(['Ra1'], '6k1/8/2b5/8/4N3/8/8/4R1K1 w - - 0 1'));
  assert.equal(t.skill, 'hanging');
  assert.match(t.why, /knight on e4/);
});

test('allowing a knight fork, and not escaping one', () => {
  const fen = '7k/8/8/8/1n6/8/7P/R3K3 w - - 0 1';
  assert.equal(allowsFork(new Chess(fen).fen(), 'w'), null); // white to move: not asked from this side
  const t = tagMistake(last(['h3'], fen));
  assert.equal(t.skill, 'fork');
  assert.match(t.why, /Nc2/);
  const forked = last(['h3', 'Nc2+', 'Kd2'], fen);
  assert.equal(tagMistake(forked).skill, 'fork');
});

test('opening a pin on your own knight', () => {
  const ruy = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
  assert.equal(pins(new Chess(ruy), 'b').length, 0);
  const t = tagMistake(last(['d6'], ruy));
  assert.equal(t.skill, 'pin');
  assert.match(t.why, /knight on c6.*king/);
});

test('early queen sorties with pieces at home are development', () => {
  assert.equal(tagMistake(last(['e4', 'e5', 'Qh5'])).skill, 'development');
});

test('pushing a pawn in front of the castled king is king safety', () => {
  const fen = 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
  assert.equal(tagMistake(last(['h3'], fen)).skill, 'kingSafety');
});

test('quiet endgame slips are endgames; anything else is threat awareness', () => {
  assert.equal(tagMistake(last(['Kd2'], '8/5k2/8/3p4/3P4/8/8/4K3 w - - 0 50')).skill, 'endgame');
  const mid = 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
  assert.equal(tagMistake(last(['a3'], mid)).skill, 'threats');
});

test('ignoring an attack on a piece is threat awareness', () => {
  // black's knight on f6 is hit by a pawn; black plays elsewhere
  const t = tagMistake(last(['a6'], 'r1bqkb1r/pppp1ppp/2n2n2/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 4'));
  assert.equal(t.skill, 'threats');
  assert.match(t.why, /knight on f6/);
});
