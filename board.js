// Board rendering. All content is internal (piece glyphs / square names), never user text.

// Solid glyphs for both sides, coloured by CSS; ︎ stops the pawn rendering as an emoji.
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎' };
const FILES = 'abcdefgh';
const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

/**
 * @param {HTMLElement} el
 * @param {import('./vendor/chess.js').Chess} chess
 * @param {{flipped:boolean, selected?:string, targets:Map<string,boolean>, last?:{from:string,to:string}}} view
 */
export function renderBoard(el, chess, view) {
  const checkSq = chess.inCheck() ? kingSquare(chess, chess.turn()) : null;
  const html = [];
  for (let i = 0; i < 64; i++) {
    const r = view.flipped ? Math.floor(i / 8) : 7 - Math.floor(i / 8);
    const f = view.flipped ? 7 - (i % 8) : i % 8;
    const sq = FILES[f] + (r + 1);
    const p = chess.get(sq);
    const cls = ['sq', (r + f) % 2 ? 'light' : 'dark'];
    if (view.last && (sq === view.last.from || sq === view.last.to)) cls.push('last');
    if (sq === view.selected) cls.push('sel');
    if (view.targets.has(sq)) cls.push(view.targets.get(sq) ? 'hit' : 'go');
    if (sq === checkSq) cls.push('check');
    const rank = i % 8 === 0 ? `<i class="rk">${r + 1}</i>` : '';
    const file = i >= 56 ? `<i class="fl">${FILES[f]}</i>` : '';
    const piece = p ? `<b class="pc ${p.color}">${GLYPH[p.type]}</b>` : '';
    html.push(`<div class="${cls.join(' ')}" data-sq="${sq}" role="gridcell" tabindex="0" aria-label="${sq}${p ? ` ${p.color === 'w' ? 'white' : 'black'} ${NAMES[p.type]}` : ''}">${rank}${file}${piece}</div>`);
  }
  el.innerHTML = html.join('');
}

function kingSquare(chess, color) {
  for (const row of chess.board()) for (const p of row) if (p?.type === 'k' && p.color === color) return p.square;
  return null;
}
