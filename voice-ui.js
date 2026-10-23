// Voice input: spoken commands and moves ("knight to f3", "undo"), with Chrome AI as a fallback interpreter.
import { parseSpoken, matchMoves } from './parse.js';
import { createVoice } from './voice.js';
import { chromeAIStatus, chromeAIInterpret } from './ai.js';

const $ = (id) => document.getElementById(id);

export function setupVoice({ chess, commit, canHumanMove, runCmd, heard }) {
  const voice = createVoice({
    onInterim: (t) => heard(`“${t}”…`),
    onFinal: handleSpeech,
    onState: (on) => { $('mic').setAttribute('aria-pressed', String(on)); $('mic').querySelector('span').textContent = on ? 'Listening' : 'Speak'; },
    onError: heard,
  });
  if (voice) $('mic').onclick = () => voice.toggle();
  else { $('mic').disabled = true; heard('Speech recognition is not available in this browser. Click to move.'); }

  async function handleSpeech(alts) {
    heard(`“${alts[0]}”`);
    const cmd = alts.map(parseSpoken).find((i) => i?.cmd);
    if (cmd) return runCmd[cmd.cmd]();
    if (!canHumanMove()) return heard(`“${alts[0]}” · it's not your move.`);

    const legal = chess.moves({ verbose: true });
    let ambiguous;
    for (const a of alts) {
      const c = matchMoves(parseSpoken(a), legal);
      if (c.length === 1) return commit(c[0]);
      if (c.length > 1) ambiguous ??= c;
    }
    if (ambiguous) return heard(`Which one: ${ambiguous.map((m) => m.san).join(' or ')}? Say the starting square too, e.g. “${ambiguous[0].from} to ${ambiguous[0].to}”.`);
    if ((await chromeAIStatus()) === 'available') {
      try {
        const san = await chromeAIInterpret(alts[0], legal.map((m) => m.san));
        if (san && commit(san)) return;
      } catch (err) { console.warn('[checkmate] Chrome AI interpret failed:', err); }
    }
    heard(`No legal move in “${alts[0]}”. Try “knight to f3” or “e2 to e4”.`);
  }
}
