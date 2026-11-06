# Checkmate · Voice Chess (Chrome extension)

3D chess you play by voice or mouse. No backend, no build step.

## Install
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this folder.
2. Click the toolbar icon. The game opens in its own popup window. On first **Speak**, allow the microphone.

## Modes (⚙ settings)
- **2 players · this device**: take turns by clicking or speaking.
- **vs Computer**: Easy / Medium / Hard / Master. Engine **Stockfish 17.1** (WASM, runs offline; Easy = skill 0,
  Medium ≈ 1500 Elo, Hard ≈ 2100 Elo, Master = full strength) or **Chrome built-in AI** (Gemini Nano via the Prompt API,
  Chrome 138+). Nano picks from a small built-in search's top moves for the chosen level and explains its choice; it
  falls back to Stockfish if the model is unavailable. If Stockfish can't load, the built-in search plays.
- **Opponent ladder** (Difficulty → Opponent ladder): eight named computer opponents from Pip the Pawn-pusher (~700) to
  The Grandmaster (full Stockfish). Beat the next one to unlock the one above; your local rating moves with each result,
  and each opponent greets you, gloats over captures and reacts to the result (spoken when "Read moves aloud" is on).
- **Puzzles**: 1,200 puzzles from the Lichess database bundled offline. **Puzzle Rush** (3 minutes, 3 strikes, gets harder),
  **Practice** (rated, picks puzzles near your puzzle rating) and **Daily puzzle** (same for everyone that day, with a streak).
  Any checkmate solves a mate puzzle. Hints show the solution but the puzzle then doesn't count for score or rating.
- **Online · 2 extension users**: peer-to-peer WebRTC. Host → send invite code → friend pastes it and sends back a
  reply code → host pastes it → play. Host is White. Only Google's public STUN server is contacted (NAT discovery);
  very strict networks (symmetric NAT) may fail without a TURN relay.

Chess clock (⚙ settings): Off, 3+2, 5 min, 10 min (default), 15+10, for local and vs-computer games. Time starts after White's
first move, increment is added after each move, undo restores both clocks, and running out of time loses. No clock in online games.

During a game: pawn promotion asks which piece (queen, rook, bishop, knight), a material count shows who is ahead,
**Offer draw** / **Resign** (press twice to confirm; online they go to your opponent, and the computer accepts a draw only when
Stockfish rates its own position as worse, or as level late in the game), and an end-of-game card with the result, **Rematch** and
**Copy PGN** (Rematch vs the computer swaps colours). The result card adds a Stockfish accuracy summary per side
(blunders, mistakes, inaccuracies) and **Watch replay**, which plays the game back in 3D. Click any move in the list, or use
←/→ and Home/End, to review the game; click the board to return. Vs the computer, **move reactions** rate each of your moves
("Great move" sparkles, "Blunder" shakes the table) and an optional **evaluation bar** shows who is winning (settings).
15 **achievements** (settings → Achievements); apart from the first win, they only count games played without hints.
Online games have four **emotes** (👏 😮 🤔 😅) that float up on both screens. Checkmate gets a slow camera move to the king. **Hint** (vs Computer) highlights a strong move; the result card counts
hints used. **New game** mid-game takes two presses. An unfinished game is saved and restored when the window reopens
(not online games; the clock resumes paused until the next move). Move sounds (move, capture, castle, check, promotion, game end, low time) are generated in code and can be
turned off in settings. Pieces & board themes: Wood, Marble, Glass, Metal.

Backgrounds: Indoor courtyard, Park, Office, Swimming pool. In 3D each is a full room around the table (chairs, plants, chess
clock, vase) with a subtle synthesized ambient sound (toggle in settings). Captured pieces line up beside the board and the
turn is printed on the table. Drag to look around, scroll to zoom, double-click to reset the view. Keyboard: focus the board, arrow keys move
the cursor, Enter picks and drops, Escape cancels.

## Voice
"e4", "e2 to e4", "knight to f3", "night f three", "e takes d5", "castle kingside", "castles long",
"a8 promote to knight", "undo", "flip", "new game". NATO letters (alpha, bravo…) work too.
Ambiguous phrases ask which piece; unrecognised ones go to Chrome AI when it's available.

## Files
`game.js` entry point · `state.js` shared state + event bus · `hud.js` rendering · `play.js` moves and commands ·
`ladder.js` + `ladder-ui.js` opponent ladder · `coach.js` + `analysis.js` move reactions, eval bar, accuracy ·
`puzzles.js` + `puzzle-mode.js` + `puzzles-data.js` puzzles · `replay.js` review, replay, summary ·
`achievements.js` + `achievements-ui.js` · `emotes.js` · `toast.js` · `renderer3d.js` · `board3d.js` + `pieces3d.js` WebGL board and procedural pieces · `input3d.js` hover, drag-and-drop,
keyboard · `motion3d.js` + `fx3d.js` move animation, capture dust, confetti · `squares3d.js` · `clock3d.js` 3D chess clock ·
`themes3d.js` Wood/Marble/Glass/Metal · `camera3d.js` framing · `scene3d.js` + `textures3d.js` table and labels ·
`room-*.js` + `room-kit.js` + `textures-rooms.js` the four rooms · `board.js` 2D fallback ·
`parse.js` speech→move · `engines.js` + `engine-stockfish.js` Stockfish (with fallback) · `clock.js` chess clock · `persist.js` saved game · `result.js` game result, material, move sounds · `sfx.js` sound effects · `dialogs.js` promotion + result card · `settings-ui.js` · `voice-ui.js` · `ai.js` + `engine-worker.js` built-in search and Chrome AI · `net.js` + `online.js` P2P · `voice.js` · `ambient.js` · `scenes.css`

## Tests and packaging
`npm test` (Node 18+): voice parser, built-in engine, the vendored Stockfish build, clock, saved games, ladder,
move analysis, puzzles and achievements.
`npm run build` copies the extension files into `dist/`. `npm run zip` runs the tests, builds, and writes
`checkmate-<manifest version>.zip` for upload to the Chrome Web Store (needs the `zip` command, standard on macOS/Linux).

## Licenses
Checkmate is licensed under **GPL-3.0-or-later** (`LICENSE`).

Third-party code, with license files in `vendor/`:
- [Stockfish.js v17.1.0](https://github.com/nmrugg/stockfish.js/tree/v17.1.0) (lite single-threaded build of
  [Stockfish sf_17.1](https://github.com/official-stockfish/Stockfish/tree/sf_17.1)), GPL-3.0, `vendor/stockfish/LICENSE`, unmodified.
  It runs as a separate worker over UCI. The source links above meet the GPL's source-offer requirement; keep them in the
  store listing too. They also appear in the extension under ⚙ settings → Open-source licenses.
- [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause.
- Puzzles: 1,200 from the [Lichess puzzle database](https://database.lichess.org/#puzzles), CC0 (`puzzles-data.js`).
- [three.js](https://threejs.org) r170 incl. OrbitControls and RoomEnvironment, MIT.

Everything else (3D pieces, wood textures, scenes, sounds, icons) is generated in code in this repo. Nothing was copied
from the reference repos, which publish no license file.
