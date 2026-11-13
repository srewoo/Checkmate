// Why was a move a mistake? Board heuristics over chess.js that name the skill behind a bad move (a loose piece,
// a fork, a pin, an ignored threat...). Pure functions, unit-tested; the engine decides *whether* a move was bad,
// this only guesses *why*, so every answer is a hint, not a proof.
import { Chess } from './vendor/chess.js';

export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const other = (c) => (c === 'w' ? 'b' : 'w');
const piecesOf = (ch, color) => ch.board().flat().filter((p) => p && p.color === color);
const named = (p) => `${NAME[p.type]} on ${p.square}`;
const at = (ch, sq) => ({ ...ch.get(sq), square: sq });

/** True when the piece on `sq` can be won: attacked and undefended, or attacked by something cheaper. */
export function enPrise(ch, sq) {
  const p = ch.get(sq);
  if (!p || p.type === 'k') return false;
  const attackers = ch.attackers(sq, other(p.color));
  if (!attackers.length) return false;
  if (!ch.attackers(sq, p.color).length) return true;
  const cheapest = Math.min(...attackers.map((s) => ch.get(s).type).filter((t) => t !== 'k').map((t) => VALUE[t]));
  return cheapest < VALUE[p.type];
}

/** Squares of `color`'s pieces (kings excluded) that are en prise. */
const looseSquares = (ch, color) => piecesOf(ch, color).filter((p) => enPrise(ch, p.square)).map((p) => p.square);

/** Enemy pieces worth forking that the piece on `from` attacks: the king, anything dearer, or anything loose. */
function forkTargets(ch, from) {
  const me = ch.get(from);
  return piecesOf(ch, other(me.color)).filter((t) => ch.attackers(t.square, me.color).includes(from) &&
    (t.type === 'k' || VALUE[t.type] > VALUE[me.type] || (VALUE[t.type] >= 3 && !ch.attackers(t.square, t.color).length)));
}

/** Fork targets when the piece on `from` forks two or more and can't just be taken, else null. */
function fork(ch, from) {
  const t = forkTargets(ch, from);
  return t.length >= 2 && (t.some((x) => x.type === 'k') || !enPrise(ch, from)) ? t : null;
}

/** After `color` moved (opponent to move in `fenAfter`): an opponent reply that forks, as {san, targets}, or null. */
export function allowsFork(fenAfter, color) {
  const ch = new Chess(fenAfter);
  if (ch.turn() === color) return null;
  for (const m of ch.moves({ verbose: true })) {
    ch.move({ from: m.from, to: m.to, promotion: m.promotion });
    const t = fork(ch, m.to);
    ch.undo();
    if (t) return { san: m.san, piece: m.piece, targets: t };
  }
  return null;
}

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const RAYS = { r: ORTHO, b: DIAG, q: [...ORTHO, ...DIAG] };

/** Pins against `color`: an enemy slider, then a piece of `color`, then a dearer piece of `color` behind it. */
export function pins(ch, color) {
  const out = [];
  for (const s of piecesOf(ch, other(color)).filter((p) => p.type in RAYS)) {
    for (const [df, dr] of RAYS[s.type]) {
      const hit = [];
      let f = s.square.charCodeAt(0) - 97 + df;
      let r = +s.square[1] - 1 + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8 && hit.length < 2) {
        const sq = String.fromCharCode(97 + f) + (r + 1);
        if (ch.get(sq)) hit.push(at(ch, sq));
        f += df;
        r += dr;
      }
      const [a, b] = hit;
      if (b && a.color === color && b.color === color && a.type !== 'k' && VALUE[b.type] > VALUE[a.type]) out.push({ pinned: a, behind: b, by: s });
    }
  }
  return out;
}

function kingSafety(ch, move, ply) {
  const queens = ch.board().flat().some((p) => p && p.type === 'q' && p.color !== move.color);
  if (!queens) return null;
  const king = piecesOf(ch, move.color).find((p) => p.type === 'k');
  const back = move.color === 'w' ? '1' : '8';
  const kFile = king.square.charCodeAt(0);
  if (move.piece === 'p' && king.square[1] === back && 'abcgh'.includes(king.square[0]) && Math.abs(move.from.charCodeAt(0) - kFile) <= 1)
    return 'Pushing the pawns in front of your king opened it up.';
  if (move.piece === 'k' && !/[kq]/.test(move.flags) && ply < 60) return 'Walking your king out with queens on the board exposes it.';
  if (ply >= 20 && king.square === `e${back}`) return 'Your king is still in the centre. Castle early.';
  return null;
}

function development(ch, move, ply) {
  if (ply >= 24) return null;
  const home = move.color === 'w' ? ['b1', 'g1', 'c1', 'f1'] : ['b8', 'g8', 'c8', 'f8'];
  const athome = home.filter((sq) => { const p = ch.get(sq); return p && p.color === move.color && 'nb'.includes(p.type); }).length;
  if (move.piece === 'q' && ply < 16 && athome >= 2) return 'An early queen move with your knights and bishops still at home.';
  if (athome >= 3) return 'Most of your knights and bishops are still at home.';
  return null;
}

const isEndgame = (ch) => ch.board().flat().filter((p) => p && 'nbrq'.includes(p.type)).length <= 6;

/**
 * Guesses the skill behind one bad move. `move` is the chess.js verbose move, `prevMove` the opponent's move before
 * it, `ply` its 0-based index, `kind` the engine's verdict ('blunder' | 'mistake' | 'missed-mate' ...),
 * `allowedMate` true when the engine sees a forced mate for the opponent afterwards. Returns {skill, why}.
 */
export function tagMistake({ fenBefore, fenAfter, move, prevMove, ply, kind, allowedMate }) {
  if (kind === 'missed-mate') return { skill: 'mate', why: 'You had a forced checkmate here and let it slip.' };
  if (allowedMate) return { skill: 'mate', why: 'This lets your opponent force checkmate.' };
  const before = new Chess(fenBefore);
  const after = new Chess(fenAfter);
  if (prevMove && fork(before, prevMove.to)) {
    return { skill: 'fork', why: `Their ${named(at(before, prevMove.to))} was forking your pieces.` };
  }
  const threatened = looseSquares(before, move.color).filter((sq) => sq !== move.from && looseSquares(after, move.color).includes(sq));
  if (threatened.length) return { skill: 'threats', why: `Your ${named(at(after, threatened[0]))} was under attack and stayed that way.` };
  const trade = move.captured && VALUE[move.captured] >= VALUE[move.piece];
  if (!trade && enPrise(after, move.to)) return { skill: 'hanging', why: `Your ${named(at(after, move.to))} can be taken.` };
  const newlyLoose = looseSquares(after, move.color).filter((sq) => sq !== move.to && !looseSquares(before, move.color).includes(sq));
  if (newlyLoose.length) return { skill: 'hanging', why: `This left your ${named(at(after, newlyLoose[0]))} undefended.` };
  const f = allowsFork(fenAfter, move.color);
  if (f) return { skill: 'fork', why: `This allows ${f.san}, a ${NAME[f.piece]} fork.` };
  const was = new Set(pins(before, move.color).map((p) => p.pinned.square + p.behind.square));
  const pin = pins(after, move.color).find((p) => !was.has(p.pinned.square + p.behind.square));
  if (pin) return { skill: 'pin', why: `Now your ${named(pin.pinned)} is pinned to your ${NAME[pin.behind.type]}.` };
  const k = kingSafety(after, move, ply);
  if (k) return { skill: 'kingSafety', why: k };
  const d = development(after, move, ply);
  if (d) return { skill: 'development', why: d };
  if (isEndgame(after)) return { skill: 'endgame', why: 'An endgame slip: king activity and passed pawns decide these.' };
  return { skill: 'threats', why: 'Your opponent had a tactic here. Check what each of their pieces attacks.' };
}
