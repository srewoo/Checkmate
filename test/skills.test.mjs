import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, loadProfile, saveProfile, recordGame, recordPuzzle, skillsForThemes, ranked, weakest } from '../skills.js';
import { coachCard, moveLabel } from '../coachcard.js';
import { near } from '../puzzles.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('profile round-trips and rejects junk', () => {
  const s = mem();
  assert.deepEqual(loadProfile(s), {});
  saveProfile(s, { fork: { score: 40, n: 2 } });
  assert.deepEqual(loadProfile(s), { fork: { score: 40, n: 2 } });
  s.setItem('checkmate.skills', '{"bogus":{"score":1,"n":1},"pin":{"score":"x","n":1}}');
  assert.deepEqual(loadProfile(s), {});
  s.setItem('checkmate.skills', 'not json');
  assert.deepEqual(loadProfile(s), {});
});

test('game mistakes pull a skill down, and the weakest is chosen', () => {
  let p = recordGame({}, [{ skill: 'fork', kind: 'blunder' }, { skill: 'pin', kind: 'inaccuracy' }]);
  assert.ok(p.fork.score < p.pin.score && p.pin.score < 50);
  assert.equal(weakest(p), 'fork');
  assert.equal(weakest({}), null);
  const before = p.fork.score;
  p = recordGame(p, []); // a clean game drifts measured skills up without counting as evidence
  assert.ok(p.fork.score > before);
  assert.equal(p.fork.n, 1);
});

test('scores keep responding after many results (no freezing)', () => {
  let p = {};
  for (let i = 0; i < 200; i++) p = recordPuzzle(p, ['fork'], false);
  assert.ok(p.fork.score < 1);
  for (let i = 0; i < 5; i++) p = recordPuzzle(p, ['fork'], true);
  assert.ok(p.fork.score > 40);
});

test('puzzle themes map onto skills', () => {
  assert.deepEqual(skillsForThemes(['fork', 'middlegame']), ['threats', 'fork']);
  assert.deepEqual(skillsForThemes(['short']), []);
  const p = recordPuzzle({}, ['pin'], true);
  assert.deepEqual(ranked(p).map((r) => r.skill), ['pin']);
  for (const k of Object.keys(SKILLS)) assert.ok(SKILLS[k].themes.length && SKILLS[k].tip);
});

test('near can stick to themes, and ignores a filter too narrow to use', () => {
  for (let i = 0; i < 20; i++) assert.ok(near(1500, new Set(), Math.random, undefined, ['fork']).themes.includes('fork'));
  assert.ok(near(1500, new Set(), () => 0, undefined, ['noSuchTheme']));
});

test('coach card picks the worst moment, praise and a focus', () => {
  const mistakes = [
    { ply: 4, san: 'Qh5', kind: 'mistake', drop: 22, skill: 'development', why: 'Early queen.' },
    { ply: 21, san: 'Nd5', kind: 'blunder', drop: 40, skill: 'hanging', why: 'Your knight on d5 can be taken.' },
    { ply: 31, san: 'a3', kind: 'blunder', drop: 35, skill: 'hanging', why: 'Loose.' },
  ];
  const c = coachCard(mistakes, 62);
  assert.equal(c.worst.ply, 21);
  assert.equal(c.worst.text, '11… Nd5: Your knight on d5 can be taken.');
  assert.equal(c.focus.skill, 'hanging');
  assert.match(c.good, /end/);
  const clean = coachCard([{ ply: 3, san: 'a6', kind: 'inaccuracy', drop: 11, skill: 'threats', why: '' }], 91);
  assert.equal(clean.worst, null);
  assert.equal(clean.focus, null);
  assert.match(clean.good, /accurate/);
  assert.equal(moveLabel(0, 'e4'), '1. e4');
});

test('findMistakes classifies one side and tags the serious ones', async () => {
  const { Chess } = await import('../vendor/chess.js');
  const { findMistakes } = await import('../coachcard.js');
  const c = new Chess();
  for (const san of ['e4', 'c6', 'Nc3', 'e5', 'Nd5']) c.move(san);
  const moves = c.history({ verbose: true });
  // side-to-move scores before each ply and after the last: white's Nd5 drops from +25 to -600 (black's +600)
  const scores = [20, -20, 30, -30, 25, 600];
  const w = findMistakes(moves, scores, 'w');
  assert.equal(w.length, 1);
  assert.deepEqual({ ply: w[0].ply, kind: w[0].kind, skill: w[0].skill }, { ply: 4, kind: 'blunder', skill: 'hanging' });
  assert.deepEqual(findMistakes(moves, scores, 'b'), []);
  assert.deepEqual(findMistakes(moves, [20, null, 30, -30, 25, 300], 'b'), []); // missing scores are skipped
  const mated = findMistakes(moves, [20, -20, 30, -30, 25, 100000], 'w');
  assert.equal(mated[0].skill, 'mate');
});
