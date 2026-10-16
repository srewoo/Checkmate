# Checkmate · Voice Chess (Chrome extension)

3D chess you play by voice or mouse. No backend, no build step.

## Install
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this folder.
2. Click the toolbar icon. The game opens in its own popup window. On first **Speak**, allow the microphone.

## Modes (⚙ settings)
- **2 players · this device**: take turns by clicking or speaking.
- **vs Computer**: Easy / Medium / Hard. Engine **Classic** (built-in alpha-beta) or **Chrome built-in AI**
  (Gemini Nano via the Prompt API, Chrome 138+). Nano picks from the engine's top moves for the chosen level and
  explains its choice; it falls back to Classic if the model is unavailable.
- **Online · 2 extension users**: peer-to-peer WebRTC. Host → send invite code → friend pastes it and sends back a
  reply code → host pastes it → play. Host is White. Only Google's public STUN server is contacted (NAT discovery);
  very strict networks (symmetric NAT) may fail without a TURN relay.

Backgrounds: Indoor courtyard, Park, Office, Swimming pool. In 3D each is a full room around the table (chairs, plants, chess
clock, vase) with a subtle synthesized ambient sound (toggle in settings). Captured pieces line up beside the board and the
turn is printed on the table. Drag to look around, scroll to zoom, double-click to reset the view.

## Voice
"e4", "e2 to e4", "knight to f3", "night f three", "e takes d5", "castle kingside", "castles long",
"a8 promote to knight", "undo", "flip", "new game". NATO letters (alpha, bravo…) work too.
Ambiguous phrases ask which piece; unrecognised ones go to Chrome AI when it's available.

## Files
`game.js` controller · `board3d.js` + `pieces3d.js` WebGL board and procedural pieces · `scene3d.js` + `textures3d.js`
rooms, table and props · `board.js` 2D fallback ·
`parse.js` speech→move · `ai.js` + `engine-worker.js` engine · `net.js` + `online.js` P2P · `voice.js` · `ambient.js` · `scenes.css`

## Tests and packaging
`npm test` (Node 18+): voice parser + engine.
`npm run build` copies the extension files into `dist/`. `npm run zip` runs the tests, builds, and writes
`checkmate-<manifest version>.zip` for upload to the Chrome Web Store (needs the `zip` command, standard on macOS/Linux).

## Licenses
Third-party code: [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause) and [three.js](https://threejs.org) r170
incl. OrbitControls (MIT); license files are in `vendor/`. Everything else (3D pieces, wood textures, scenes,
sounds, icons) is generated in code in this repo. Nothing was copied from the reference repos, which publish no license file.
