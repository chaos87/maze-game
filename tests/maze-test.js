// Difficulty + feasibility tests for Dino Maze Lab (runs the real game script, one eval scope)
const fs = require('fs');
const html = fs.readFileSync('/home/container/.openclaw/workspace/maze-game/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

global.btoa = s => Buffer.from(s, 'binary').toString('base64');
global.atob = s => Buffer.from(s, 'base64').toString('binary');
global.location = { hash: '', origin: 'https://x', pathname: '/' };

const PRIM = Symbol.toPrimitive;
const universal = new Proxy(function () {}, {
  get(t, k) {
    if (k === 'length') return 0;
    if (k === PRIM) return () => '';
    if (k === Symbol.iterator) return function* () {};
    return universal;
  },
  apply() { return universal; },
  construct() { return universal; },
});
global.document = universal;
global.window = universal;
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 0;
global.confirm = () => false;
global.prompt = () => '';
global.alert = () => '';
global.console.warn = () => {}; // keep output clean for the feasibility fallback

const tests = `
const snap = () => JSON.stringify({
  w: state.w, h: state.h, tiles: state.tiles,
  start: state.start, exit: state.exit, entities: state.entities,
});
const trapsOf = () => state.entities.filter(e => e.type === 'trap');
const dinosOf = () => state.entities.filter(e => e.type === 'monster');

/* boot smoke test: medium default */
if (!state.tiles.length || state.w !== 15 || state.h !== 11) throw new Error('boot: maze not generated');
if (state.entities.filter(e => e.type === 'portal').length !== 2) throw new Error('boot: expected paired portals');
if (state.entities.filter(e => e.type === 'monster').length !== 1) throw new Error('boot: expected one dino');
console.log('boot OK:', state.w + 'x' + state.h, '(medium default) | entities:', state.entities.map(e => e.type).join(','));

/* round-trip on generated maze */
const b0 = snap();
const code0 = encodeMaze();
decodeMaze(code0);
if (b0 !== snap()) throw new Error('round-trip mismatch (generated maze)');
console.log('round-trip OK (generated)');

/* hand-made maze incl. lone portal */
state.w = 5; state.h = 3;
state.tiles = [[1,1,1,1,1],[1,0,0,0,1],[1,1,1,1,1]];
state.start = { r: 1, c: 1 };
state.exit = { r: 1, c: 3 };
state.entities = [
  { type:'monster', r:1, c:2, sr:1, sc:2 },
  { type:'trap', r:0, c:0 },
  { type:'portal', r:1, c:2 },
  { type:'portal', r:0, c:1 },
];
const b1 = snap();
decodeMaze(encodeMaze());
if (b1 !== snap()) throw new Error('round-trip mismatch (custom maze)');
console.log('round-trip OK (custom, incl. lone portal)');

/* bad version must throw */
let threw = false;
try { decodeMaze(btoa('9,x,y,z')); } catch (_) { threw = true; }
if (!threw) throw new Error('bad-version did not throw');
console.log('bad-version rejection OK');

/* garbage must throw */
threw = false;
try { decodeMaze('!!!not-base64!!!'); } catch (_) { threw = true; }
if (!threw) throw new Error('garbage did not throw');
console.log('garbage rejection OK');

/* ---- difficulty presets ---- */
newMaze('easy');
if (state.w !== 9 || state.h !== 7) throw new Error('easy size wrong');
if (dinosOf().length !== 0) throw new Error('easy should have no dinos');
if (state.entities.filter(e => e.type === 'portal').length !== 2) throw new Error('easy portals');
console.log('easy OK: 9x7, entities:', state.entities.map(e => e.type).join(','));

newMaze('medium');
if (state.w !== 15 || state.h !== 11) throw new Error('medium size wrong');
if (dinosOf().length !== 1) throw new Error('medium dinos');
console.log('medium OK: 15x11, entities:', state.entities.map(e => e.type).join(','));

newMaze('hard');
if (state.w !== 21 || state.h !== 15) throw new Error('hard size wrong');
if (dinosOf().length !== 3) throw new Error('hard dinos');
if (trapsOf().length !== 2) throw new Error('hard pits');
if (state.entities.filter(e => e.type === 'portal').length !== 4) throw new Error('hard portals');
console.log('hard OK: 21x15, entities:', state.entities.map(e => e.type).join(','));

/* round-trip per difficulty */
for (const k of ['easy','medium','hard']) {
  newMaze(k);
  const b = snap();
  decodeMaze(encodeMaze());
  if (b !== snap()) throw new Error('round-trip mismatch (' + k + ')');
}
console.log('round-trip OK for all 3 difficulties');

/* ---- FEASIBILITY: 25 fresh generations per difficulty ----
   pits + dino patrol corridors are hard-blocked; the exit must still be
   reachable around them, every single time. */
let checked = 0;
for (const k of ['easy','medium','hard']) {
  for (let i = 0; i < 25; i++) {
    newMaze(k);
    if (!feasible(trapsOf(), dinosOf())) {
      throw new Error(k + ' gen ' + i + ': maze infeasible (dino/pit blocks the only route)');
    }
    checked++;
  }
}
console.log('feasibility OK: ' + checked + ' generated mazes all finishable');

/* spawn fairness: no entity within 2 tiles of start */
for (const k of ['easy','medium','hard']) {
  newMaze(k);
  for (const e of state.entities) {
    const d = Math.abs(e.r - state.start.r) + Math.abs(e.c - state.start.c);
    if (d <= 2) throw new Error(k + ': entity too close to spawn (' + d + ' tiles)');
  }
}
console.log('spawn fairness OK (no entity within 2 tiles of start)');

console.log('');
console.log('ALL TESTS PASSED');
`;

eval(script + '\n' + tests);