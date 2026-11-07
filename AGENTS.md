# AGENTS.md

Vanilla JS / HTML / CSS Pac-Man. No toolchain: no `package.json`, bundler, linter, typecheck, tests, or CI. Verification is manual — open `src/index.html` in a browser and play.

## Running

Open `src/index.html` directly (e.g. `start src/index.html` on Windows, or via any static server). No dev server is configured; `file://` works because everything is relative.

## Architecture (not obvious from filenames)

Scripts are plain `<script>` tags loaded in a **fixed order** in `src/index.html`:

```
maze.js -> game.js -> render.js -> main.js
```

They communicate **only through `window.*` globals** explicitly assigned at the end of each file (`window.MAZE`, `window.TUNNEL_ROW`, `window.PACMAN_START`, `window.GHOST_STARTS`, `window.createGame`, `window.update`, `window.DIRS`, `window.draw`). This is deliberate, not an oversight.

- Do **not** reorder the tags or convert to ES modules without refactoring every global export/import.
- `main.js` is the entry point (loop, keyboard, overlay) and consumes `createGame` / `update` / `draw`.

File responsibilities:

- `maze.js` — pristine `MAZE` grid (28×31) + constants. Never mutated; `createGame()` copies it per game.
- `game.js` — `createGame()` / `update()`. All rules and state live here.
- `render.js` — `draw()`. Pure drawing driven by `game.grid` (not `MAZE`, so eaten dots disappear).
- `main.js` — `requestAnimationFrame` loop, key → direction mapping, overlay/state transitions.

## Maze encoding (`maze.js`)

`MAZE_STR` is 31 rows × 28 chars, parsed by `parseTile`:

- `#` → wall (`1`)
- `.` → dot (`2`)
- ` `` → empty traversable (`0`)
- `-` → pen door (`3`) — blocks Pac-Man, **not** ghosts

Coordinates are cell `(x, y)`, origin top-left, `x ∈ [0,27]`, `y ∈ [0,30]`. Maze is vertically symmetric about the gap between columns 13 and 14.

Key constants: `TUNNEL_ROW = 14` (open-ended wrap row), `PACMAN_START = {x:13, y:23}`, `GHOST_STARTS` inside the pen at row 14.

## Game state machine!!

States: `'start'` | `'playing'` | `'won'` | `'lost'`. Transitions are driven by `main.js`'s `loop()`; `game.js` only sets `won`/`lost`. Lives = 3, ghost collision resets positions (not the score/grid).

Ghost AI kinds (in `GHOST_STARTS`): `'blinky'` aggressive — target = Pac-Man's cell; `'pinky'` ambusher — target = Pac-Man + 4 cells in his current direction; `'inky'` flanker — target = blinky + 2 × ((pac + 2 ahead) − blinky), falls back to blinky behavior if no blinky exists; `'clyde'` shy — target = Pac-Man beyond 8 Manhattan cells, else `CLYDE_CORNER` (1,29). All share the greedy selector in `decideGhost()`: valid non-reverse direction minimizing Manhattan distance to the target (180° only in dead ends). While inside the pen or on its door the target is fixed `PEN_EXIT` (13,11) so ghosts always leave. Speeds (`GHOST_SPEEDS`): blinky 1/9, pinky 1/10, inky 1/11, clyde 1/12 — all slower than Pac-Man (1/8). Colors are kind-bound in `GHOST_COLORS` (`render.js`), not index-based.

## Workflow

The project is for learning **Spec Driven Development** (see `README.md`). The `spec` and `spec-impl` skills are installed (`skills-lock.json`, from `klerith/fernando-skills`). For non-trivial features, prefer the spec workflow (design → approve → implement on a branch) over ad-hoc edits.

Code comments and `README.md` are in Spanish.
