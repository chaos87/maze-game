# 🦕 Dino Maze Lab — Project Handoff

A browser-based 2D top-down maze **creator + player** with a Jurassic Park
theme, built by a parent and their 7-year-old son.

Repo: `chaos87/maze-game`

---

## 1. Project Goals

- A 2D top-down **maze creator** the kid can paint in.
- **Playable**: the maze can be walked by a character after designing it.
- Supports: paths, rock walls, traps, monsters, portals.
- **Exactly one start 🚩 and one exit 🏁** per maze — enforced structurally.
- **Shareable** via URL — sending a link must fully reproduce the maze.
- **Jurassic / dinosaur theme**, 7-year-old friendly but not babyish.
- **Runs in a browser, deployed to Vercel**, no backend required for v1.

### Design decisions locked in
- **Tile grid** (not free-form drawing) — much easier to make monsters,
  portals, and pathfinding work.
- **Monsters patrol** (bounce off walls), not chase the player. Boss
  "guard the exit" mode is a future idea.
- **Emoji + procedural shapes** for graphics in v1 — no art assets.
  Drop-in spritesheet swap is planned but not yet needed.
- **Portals come in pairs**, auto-paired by placement order (1↔1, 2↔2, …).
- **Triangles** 🔺 are a sticky artifact: stepping on one freezes the ranger for 5
  seconds, then they can walk off. The tile persists forever and re-triggers
  every time the hero lands on it (serializes as glyph `x` in the maze URL).
- **Vanilla JS, no build step** — one `index.html` runs by double-clicking
  or drag-dropping into a static host.

---

## 2. Tech Stack

| Concern | Choice |
|--------------|--------------------------------------------|
| Rendering | HTML5 `<canvas>` + Canvas 2D API |
| Language | Vanilla JavaScript (ES2017+, ES modules ok)|
| Build step | None |
| Dependencies | None |
| Hosting | Vercel (static, drag-and-drop or GitHub) |
| Persistence | URL hash only — no database in v1 |

Why not Phaser? Overkill for a tile editor, and it hides the fundamentals.
The kid should be able to read the code later.

---

## 3. Graphics Approach

Everything is drawn **procedurally** with Canvas 2D primitives:

- **Rock walls** — `fillRect` layers (base / lighter top / darker bottom)
  producing a chunky stone look.
- **Path** — alternating checkerboard tints for readability.
- **Start / Exit pads** — radial-gradient glow, animated pulse.
- **Player, dinos, portals, traps** — drawn with `ctx.fillText` of emoji,
  centered in their tile. Portals additionally rotate.
- **Vignette** — radial gradient overlay for atmosphere.

All entity visuals are conceptually driven from a small table (in v1 the
switch is inline, but the intent is the same):

```js
const ENTITY_TYPES = {
  monster: { emoji: '🦖', anim: 'bob' },
  trap:    { emoji: '🕳️' },
  portal:  { emoji: '🌀', anim: 'spin' },
  triangle:{ emoji: '🔺', anim: 'bob' },
  start:   { emoji: '🚩' },
  exit:    { emoji: '🏁' },
};
```

**Upgrade path to real art:** swap the `drawEmoji` call for
`ctx.drawImage(atlas, …)`. Because all sprite knowledge is concentrated
in the render layer, this is a small, safe change.

---

## 4. Architecture

One global `state` object; two modes.

```js
const state = {
  w, h,             // grid size
  tiles: [[0|1]],   // 0 = path, 1 = rock
  start: { r, c },  // single cell
  exit: { r, c },   // single cell
  entities: [       // monsters / traps / portals
    { type:'monster', r, c, sr, sc, dir? },
    { type:'trap', r, c },
    { type:'portal', r, c },
  ],
  mode: 'edit' | 'play',
  difficultyKey: 'easy' | 'medium' | 'hard',  // affects generated mazes only, not shared links
  tool: 'hand' | 'wall' | 'floor' | 'start' | 'exit' | 'monster' | 'trap' | 'portal' | 'triangle' | 'eraser'
        | 'monster' | 'trap' | 'portal' | 'eraser',
};
```

### Difficulty presets (generation only — share format unchanged)

| Level | Grid | Braid | Dinos | Pits | Portal pairs | Triangles |
|--------|-------|-------------------|-------|------|---------------|-----------|
| 🟢 Easy | 9×7 | 0.85 — lots of loops | 0 | 1 | 1 | 1 |
| 🟠 Medium | 15×11 | 0.35 | 1 | 1 | 1 | 2 |
| 🔴 Hard | 21×15 | 0.08 — near-perfect maze | 3 | 2 | 2 | 3 |

`braidMaze` opens dead-end walls after generation so easier mazes have
multiple routes instead of one forced path. Entities are never placed
within 2 tiles (Manhattan) of the start spawn.

- **`edit`** — paint tiles; pan/zoom; place/move start & exit; place
  entities.
- **`play`** — grid-step movement with arrow keys / WASD; dinos patrol;
  pits and dinos kill; portals teleport; reaching exit wins.

### Rendering pipeline (per frame)
1. `ctx.setTransform(dpr,0,0,dpr,0,0)` + clear.
2. `ctx.save()` → translate/scale by camera.
3. Tiles → start/exit pads → entities → player.
4. `ctx.restore()` → vignette.

### Game loop
`requestAnimationFrame` → `updatePlay(dt)` (play mode only) → `render(t)`.

### Editor start/exit rule
`start` and `exit` are **single objects, not arrays**. Painting a new
start moves it. Painting an entity on a start/exit tile is blocked.
This makes "exactly one" impossible to violate from the UI.

### Sharing format
Maze is base64-url encoded into `location.hash`:

```
#m=<base64url of:>
  ver,w,h,
  tiles (comma-separated row strings of 0|1),
  start.r,start.c,exit.r,exit.c,
  entities ("; "-separated chunks: m<r>.<c> | t<r>.<c> | p<r>.<c>)
```

Version number is `1` for future migrations. Decode is defensive —
bad version / bad size / bad rows throw and the app falls back to a
fresh generated maze.

---

## 5. Local Development

No install step. Two options:

1. **Open directly:** double-click `index.html`. Works fine for the
   single-file build.
2. **Local server** (recommended once split into multiple files):
   ```bash
   python3 -m http.server 8000
   # or
   npx serve .
   ```
   Then open `http://localhost:8000`.

If you split into multiple files, use this structure:

```
dino-maze/
├── index.html
├── styles.css
├── src/
│   ├── main.js      // boot, event wiring, RAF loop
│   ├── state.js     // state object + maze generation
│   ├── render.js    // all canvas drawing
│   ├── edit.js      // editor tools + pointer handlers
│   ├── play.js      // play mode, movement, monsters
│   └── share.js     // encodeMaze / decodeMaze
└── PROJECT.md       // this file
```

Use `<script type="module" src="src/main.js">` in `index.html`.

---

## 6. Deployment — Vercel

### Drag & drop (fastest)
1. Create a folder with `index.html` in it.
2. Visit <https://vercel.com/new>.
3. Drag the folder onto the page.
4. Framework preset: **Other**. Build command: *(empty)*. Output: `./`.
5. Deploy → you get `dino-maze.vercel.app`.

### Via GitHub (recommended for ongoing work)
1. `git init`, commit, push to GitHub.
2. In Vercel, **Add New → Project → Import** the repo.
3. Every `git push` redeploys automatically.

### Via CLI
```bash
npm i -g vercel
vercel  # from the project folder, accept defaults
```

No environment variables, no serverless functions, no database.

---

## 7. Share Link Format (detail)

The whole maze lives in the URL hash, so nothing is stored server-side.

Example (truncated): `https://dino-maze.vercel.app/#m=MSwxNSwxMSwwMDE...`

Encode/decode helpers live in `share.js`. The **fragile part** is the
base64url round-trip — verify it manually after any refactor with a
save→copy→open-in-new-tab cycle.

---

## 8. Feature Status (v1)

| Feature | Status |
|-----------------------------------------------------|--------|
| 2D top-down grid maze | ✅ |
| Pan (drag) + zoom (wheel) | ✅ |
| Paint rock/path, drag-paint | ✅ |
| One 🚩 start / one 🏁 exit (structurally enforced) | ✅ |
| 🦖 dinos that patrol horizontally, bounce off rock | ✅ |
| 🌀 portals in pairs, auto-numbered | ✅ |
| 🕳️ pit traps (respawn at start) | ✅ |
| Play mode (ranger 🤠, arrow keys/WASD) | ✅ |
| Win/lose overlay + replay | ✅ |
| Procedural starter maze ("New maze" button) | ✅ |
| Difficulty levels 🟢 / 🟠 / 🔴 for auto-generated mazes | ✅ |
| Share via URL | ✅ |
| Jurassic aesthetic (rock, amber, vignette) | ✅ |
| Undo (Ctrl+Z) | ❌ |
| Sound | ❌ |
| Save multiple mazes locally | ❌ |
| Dino "guards the exit" mode | ❌ |
| Spritesheet art | ❌ |

---

## 9. Roadmap (ordered by value / effort)

1. **Dino guards the exit** — the kid's favorite idea. Add a `guard`
   flag on a monster; guard dinos oscillate within N tiles of the exit
   instead of wandering. Small change to `pickDir` + generation.
2. **Undo / redo** — Ctrl+Z is essential once mazes get big. Implement
   as a stack of `JSON.stringify(state)` snapshots, capped at ~50.
3. **Smoother movement** — 150ms grid steps feel stiff. Tween the
   player between tiles over ~120ms.
4. **Sound effects** — footstep, portal whoosh, dino roar, win/lose
   jingle. Use `Audio` with tiny data-URI clips, no asset files.
5. **Decorations** — fossil / bone / fern tiles that are non-interactive
   but sell the Jurassic theme cheaply.
6. **Spritesheet swap** — replace emoji with a small PNG atlas when you
   want to move past emoji.
7. **Local save** — "My mazes" list in `localStorage` with thumbnails.
8. **Share with a name** — append `&n=MazeName` to the hash for nicer
   links and title display.

---

## 10. Known Issues / Fragile Areas

- **Base64 round-trip** — the most fragile part. Watch for `+`/`/`/`=`
  handling after any change to encoding. Add a unit test if you can.
- **Monster patrol logic** — `pickDir` currently prefers horizontal,
  falls back to vertical. It can get stuck in a corner with no
  vertical neighbors — rare but possible. A proper patrol path
  (BFS between two anchor points) is a better long-term fix.
- **Portal pairs on odd counts** — a lone portal renders faded and
  non-functional. This is intentional but should probably show a
  warning in the editor toolbar.
- **Mobile / touch** — pointer events work but there's no on-screen
  d-pad for play mode. Kids on tablets can't move yet.
- **No collision check on start/exit cell for entity drop** — the
  paint function returns early, so it's blocked, but a user might be
  confused if a click "doesn't work." Consider a toast.

---

## 11. Instructions for an AI Agent Continuing This Project

If you're an agent picking this up:

- **Preserve the invariant**: exactly one `start` and one `exit`, both
  single-cell. Never let UI introduce a second start via painting.
- **Keep graphics data-driven.** Do not hardcode sprite strings into
  gameplay code. If you add an entity, add it to the
  `ENTITY_TYPES`-style table and the render switch.
- **Respect the single-file default.** If you split into modules, keep
  the `<script type="module">` path so `index.html` still runs by
  double-click. Only introduce a bundler if the user explicitly asks.
- **Test the share round-trip** on every change to `encodeMaze`,
  `decodeMaze`, or `state.entities` shape.
- **Prefer additions over rewrites.** The user's kid knows the current
  UI; a rename or layout shuffle is a bug, not a feature.
- **When adding features**, extend the roadmap table (section 9) and
  update the status table (section 8).
- **Ask before assuming**: theme changes, difficulty, and target age
  are sensitive; the 7-year-old's preferences were explicit
  (dinos, portals, not too childish).

### Questions to ask before any major feature
1. Does this change touch the start/exit invariant? (If yes, verify.)
2. Does this change the share format? (If yes, bump the version byte
   and add a decoder fallback.)
3. Does this change the visuals of an entity? (If yes, update the
   entity table, not the gameplay code.)
4. Will the 7-year-old understand what's on screen? (If unsure, ask
   the parent.)

---

## 12. Full Source

The complete v1 source is [`index.html`](./index.html) in this repo.

---

## 13. Quick-Start Checklist for the Next Session

- [x] Save this file as `PROJECT.md` and the source block above as `index.html`.
- [ ] Open `index.html` in a browser → confirm the editor loads.
- [ ] Draw a wall, place a dino, copy the link, open it in a new tab → confirm round-trip.
- [x] Push to a GitHub repo (private is fine) → `chaos87/maze-game`.
- [ ] Import the repo into Vercel → confirm it deploys.
- [ ] Pick the **next feature** from section 9 (recommended: dino guards the exit).
- [ ] Hand this file + the current source to your coding agent as context.

---

*End of handoff. Keep this file updated as the project evolves — the AI agent's future context depends on it.*