import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winChance, moveAccuracy, classify, summarize } from '../analysis.js';

test('win chance is 50 at equality, monotonic, and saturates for mates', () => {
  assert.equal(winChance(0), 50);
  assert.ok(winChance(200) > winChance(100));
  assert.ok(winChance(100000) > 99);
  assert.ok(winChance(-100000) < 1);
  assert.equal(Math.round(winChance(300) + winChance(-300)), 100);
});

test('accuracy is ~100 for no loss and falls with the drop', () => {
  assert.ok(moveAccuracy(60, 60) > 99.9);
  assert.ok(moveAccuracy(60, 40) < moveAccuracy(60, 55));
  assert.ok(moveAccuracy(90, 10) < 10);
});

test('classify: blunder, mistake, inaccuracy, quiet, missed mate, great', () => {
  // before: mover's score; after: opponent's score after the move
  assert.equal(classify(50, 600).kind, 'blunder'); // went from +0.5 to -6
  assert.equal(classify(0, 200).kind, 'inaccuracy');
  assert.equal(classify(0, 350).kind, 'mistake');
  assert.equal(classify(30, -20).kind, null);
  assert.equal(classify(100000, -800).kind, 'missed-mate');
  assert.equal(classify(100, -500, { capture: true }).kind, 'great');
  assert.equal(classify(100, -500).kind, null); // a quiet move into a big edge is good, not flagged
});

test('summarize counts errors and averages accuracy', () => {
  const s = summarize([[0, 0], [0, 600], [20, -20]]);
  assert.equal(s.counts.blunder, 1);
  assert.ok(s.accuracy > 40 && s.accuracy < 80);
  assert.equal(summarize([]).accuracy, null);
});
