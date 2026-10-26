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

Ghost AI kinds (in `GHOST_STARTS`): `'hunter'` chases via Manhattan distance, `'random'` picks any non-reverse valid direction.

## Workflow

The project is for learning **Spec Driven Development** (see `README.md`). The `spec` and `spec-impl` skills are installed (`skills-lock.json`, from `klerith/fernando-skills`). For non-trivial features, prefer the spec workflow (design → approve → implement on a branch) over ad-hoc edits.

Code comments and `README.md` are in Spanish.
