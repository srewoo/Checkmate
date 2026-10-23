import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { goCommands, parseBestMove, parseScore } from '../engine-stockfish.js';

// Drives the vendored WASM build the extension ships, over stdin/stdout like the worker does.
function bestMove(fen, level) {
  const sf = spawn(process.execPath, ['vendor/stockfish/stockfish.js']);
  return new Promise((resolve, reject) => {
    let out = '';
    sf.stdout.on('data', (d) => {
      out += d;
      if (out.includes('uciok') && !sf.started) { sf.started = true; sf.stdin.write(goCommands(fen, level).join('\n') + '\n'); }
      const line = out.split('\n').find((l) => l.startsWith('bestmove'));
      if (line) { sf.kill(); resolve(parseBestMove(line)); }
    });
    sf.on('error', reject);
    sf.stdin.write('uci\n');
  });
}

test('parseBestMove reads UCI output', () => {
  assert.deepEqual(parseBestMove('bestmove e2e4 ponder e7e5'), { from: 'e2', to: 'e4', promotion: undefined });
  assert.deepEqual(parseBestMove('bestmove a7a8q'), { from: 'a7', to: 'a8', promotion: 'q' });
  assert.equal(parseBestMove('bestmove (none)'), null);
});

test('parseScore reads cp and mate scores', () => {
  assert.equal(parseScore('info depth 12 seldepth 18 score cp -35 nodes 1'), -35);
  assert.equal(parseScore('info depth 3 score mate 2 pv a1a8'), 100000);
  assert.equal(parseScore('info depth 3 score mate -1 pv a1a8'), -100000);
  assert.equal(parseScore('info string NNUE loaded'), null);
  assert.match(goCommands('x', 'master', 400).at(-1), /movetime 400$/);
});

test('goCommands resets the strength limit for every level', () => {
  assert.match(goCommands('x', 'master').join('\n'), /UCI_LimitStrength value false[\s\S]*Skill Level value 20/);
  assert.match(goCommands('x', 'medium').join('\n'), /UCI_LimitStrength value true[\s\S]*UCI_Elo value 1500/);
  assert.match(goCommands('x', 'bogus').join('\n'), /UCI_Elo value 1500/);
});

test('Stockfish finds mate in one', { timeout: 30000 }, async () => {
  // back-rank mate: Ra8#
  assert.deepEqual(await bestMove('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'master'), { from: 'a1', to: 'a8', promotion: undefined });
});
