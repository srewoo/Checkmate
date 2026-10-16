// Spoken text -> chess move. Pure functions, no DOM, so they run under `node --test`.

const PIECES = {
  king: 'k', queen: 'q', rook: 'r', rock: 'r', ruck: 'r', bishop: 'b',
  knight: 'n', night: 'n', nite: 'n', horse: 'n', pawn: 'p', pond: 'p', prawn: 'p',
};
const CHARS = {
  alpha: 'a', alfa: 'a', bravo: 'b', bee: 'b', charlie: 'c', see: 'c', sea: 'c',
  delta: 'd', dee: 'd', echo: 'e', foxtrot: 'f', eff: 'f', golf: 'g', gee: 'g',
  hotel: 'h', aitch: 'h', one: '1', won: '1', two: '2', too: '2', three: '3', tree: '3',
  four: '4', for: '4', fore: '4', five: '5', six: '6', seven: '7', eight: '8', ate: '8',
};
const PROMO = /\b(?:promot\w*|equals|becomes)\s+(?:to\s+|a\s+|an\s+)?(queen|rook|bishop|knight|night)\b/;
const NAMES = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };

/** @returns {{cmd:string}|{castle:string}|{piece?:string, from?:string, to?:string, file?:string, promo?:string, capture:boolean}|null} */
export function parseSpoken(raw) {
  const text = String(raw).toLowerCase().replace(/[-,.!?]/g, ' ').trim();
  if (!text) return null;
  if (/\b(undo|take ?back)\b/.test(text)) return { cmd: 'undo' };
  if (/\bflip\b/.test(text)) return { cmd: 'flip' };
  if (/\b(new game|restart)\b/.test(text)) return { cmd: 'new' };
  if (/\b(castle|castles|castling)\b|\bo o\b/.test(text)) {
    return { castle: /\b(long|queen ?side)\b|\bo o o\b/.test(text) ? 'O-O-O' : 'O-O' };
  }

  const promoMatch = text.match(PROMO);
  const promo = promoMatch ? PIECES[promoMatch[1]] : undefined;
  const body = promoMatch ? text.replace(PROMO, ' ') : text;

  let piece;
  let stream = '';
  for (const tok of body.split(/\s+/)) {
    if (PIECES[tok] && !piece) { piece = PIECES[tok]; continue; }
    if (tok === 'to' || tok === 'two') {
      // "e two e four" -> rank 2; "knight to f3" -> filler
      if (/[a-h]$/.test(stream)) stream += '2';
      continue;
    }
    const c = CHARS[tok] ?? tok;
    if (/^[a-h1-8]+$/.test(c)) stream += c;
  }

  const squares = [];
  let file;
  for (let i = 0; i < stream.length; i++) {
    const a = stream[i];
    const b = stream[i + 1];
    if (/[a-h]/.test(a) && b && /[1-8]/.test(b)) { squares.push(a + b); i++; }
    else if (/[a-h]/.test(a) && !squares.length) file = a;
  }
  if (!squares.length) return null;

  const capture = /\b(takes|take|captures|capture|x)\b/.test(body);
  const [from, to] = squares.length >= 2 ? squares.slice(-2) : [undefined, squares[0]];
  return { piece, from, to, file, promo, capture };
}

/** Narrow chess.js verbose moves to the ones an intent could mean. */
export function matchMoves(intent, moves) {
  if (!intent || intent.cmd) return [];
  if (intent.castle) return moves.filter((m) => m.san.replace(/[+#]/g, '') === intent.castle);

  let c = moves.filter((m) => m.to === intent.to);
  if (intent.from) c = c.filter((m) => m.from === intent.from);
  if (intent.piece) c = c.filter((m) => m.piece === intent.piece);
  if (intent.file) c = c.filter((m) => m.from[0] === intent.file);
  if (intent.promo) c = c.filter((m) => m.promotion === intent.promo);
  else if (c.some((m) => m.promotion)) c = c.filter((m) => m.promotion === 'q');

  // Only use these as tie-breakers: "e4" means the pawn, "takes" means the capture.
  const narrow = (f) => { const n = c.filter(f); if (n.length) c = n; };
  if (c.length > 1 && !intent.piece && !intent.from) narrow((m) => m.piece === 'p');
  if (c.length > 1 && intent.capture) narrow((m) => m.captured);
  return c;
}

/** chess.js verbose move -> words for speech synthesis. */
export function sayMove(m) {
  const tail = m.san.endsWith('#') ? ', checkmate' : m.san.endsWith('+') ? ', check' : '';
  if (m.san.startsWith('O-O-O')) return `castles queenside${tail}`;
  if (m.san.startsWith('O-O')) return `castles kingside${tail}`;
  const promo = m.promotion ? `, promotes to ${NAMES[m.promotion]}` : '';
  return `${NAMES[m.piece]} ${m.captured ? 'takes' : 'to'} ${m.to}${promo}${tail}`;
}
