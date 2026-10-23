import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, parseControl, formatClock } from '../clock.js';

const fake = () => { const f = () => f.t; f.t = 0; return f; };

test('parseControl and formatClock', () => {
  assert.deepEqual(parseControl('3+2'), { base: 180000, inc: 2000 });
  assert.equal(parseControl('off'), null);
  assert.equal(parseControl(undefined), null);
  assert.equal(formatClock(600000), '10:00');
  assert.equal(formatClock(61001), '1:02');
  assert.equal(formatClock(9950), '9.9');
  assert.equal(formatClock(-5), '0.0');
});

test('clock waits for the first move, runs for the side to move, adds increment', () => {
  const now = fake();
  const c = createClock(parseControl('1+2'), now);
  now.t = 5000;
  assert.equal(c.state().w, 60000); // nothing runs before White moves
  c.moved('w');
  assert.equal(c.state().w, 62000);
  now.t = 15000;
  assert.deepEqual(c.state(), { w: 62000, b: 50000, turn: 'b', running: true, flagged: null });
  c.moved('b');
  assert.equal(c.state().b, 52000);
});

test('flag fall, undo restores both clocks, stop freezes', () => {
  const now = fake();
  const c = createClock(parseControl('1+0'), now);
  c.moved('w');
  now.t = 61000;
  assert.equal(c.state().flagged, 'b');
  c.moved('b'); // ignored after the flag
  assert.equal(c.state().turn, 'b');
  c.undo();
  assert.deepEqual(c.state(), { w: 60000, b: 60000, turn: 'w', running: false, flagged: null });
  c.moved('w');
  now.t = 71000;
  c.stop();
  now.t = 99000;
  assert.equal(c.state().b, 50000);
});
