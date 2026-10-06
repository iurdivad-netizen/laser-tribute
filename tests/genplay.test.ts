import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { generateMission } from '../src/core/gen';
import { RECIPES } from '../src/core/gen/recipes';
import { createMission } from '../src/core/missions';
import { findPath, pathStats } from '../src/core/path';
import { computeVisible } from '../src/core/vision';
import { createCamera, defaultZoom, followTile, tileCss } from '../src/render/camera';
import { computeLayout } from '../src/ui/layout';

describe.each(RECIPES.map((r, i) => [r.name, i] as const))('playing %s', (_name, type) => {
  const r = RECIPES[type];

  it('starts with the recipe size, four soldiers and its enemies, and the squad can see something', () => {
    const s = createMission(generateMission(type, 0), 3);
    expect([s.width, s.height]).toEqual([r.width, r.height]);
    expect(s.units.filter((u) => u.side === 'player')).toHaveLength(4);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(r.enemies);
    const seen = computeVisible(s, 'player').flat().filter(Boolean).length;
    expect(seen).toBeGreaterThan(4);
    expect(s.explored.flat().filter(Boolean).length).toBeGreaterThan(4);
  });

  it('lets a soldier path to every enemy over the terrain (doors counted as openable, other units ignored)', () => {
    const s = createMission(generateMission(type, 0), 3);
    for (const e of s.units.filter((u) => u.side === 'enemy')) {
      // a unit standing in a one-tile doorway can block a real path for a while; the map itself must connect
      const alone = { ...s, units: s.units.filter((u) => u.id === 'p1' || u.id === e.id) };
      const path = findPath(alone, 'p1', e.pos, { ignoreOccupantAtGoal: true, openDoors: true });
      expect(path, `${e.id}`).not.toBeNull();
    }
  });

  it('runs a whole enemy turn with a bounded number of path searches and leaves a valid state', () => {
    const s = createMission(generateMission(type, 0), 3);
    s.turn = 'enemy';
    pathStats.calls = 0;
    const t0 = performance.now();
    const out = runEnemyTurn(s);
    // measured at most 236 searches for a whole turn on any type; a count does not flake under a busy machine like a clock does
    expect(pathStats.calls).toBeLessThan(600);
    expect(performance.now() - t0).toBeLessThan(60_000); // only a hang guard
    expect(out.state.units.every((u) => u.pos.x >= 0 && u.pos.y >= 0 && u.pos.x < r.width && u.pos.y < r.height)).toBe(true);
    expect(['playing', 'won', 'lost']).toContain(out.state.status);
  }, 60_000); // a whole turn on the big maps takes up to 8 s when the suite runs in parallel on a busy machine
});

describe('the camera on the biggest map', () => {
  const [W, H] = [48, 32];
  it('keeps close-up tiles at 32 px or more on a phone and a readable whole map on a desktop', () => {
    const phone = computeLayout(390, 844, 3);
    const wide = computeLayout(1366, 768, 1);
    expect(tileCss(phone, 'close', W, H)).toBeGreaterThanOrEqual(32);
    expect(tileCss(wide, 'whole', W, H)).toBeGreaterThanOrEqual(8);
    expect(tileCss(wide, 'close', W, H)).toBeGreaterThanOrEqual(tileCss(wide, 'whole', W, H));
    expect(['close', 'whole']).toContain(defaultZoom(wide, W, H));
  });

  it('follows a soldier in the far corners without leaving the map', () => {
    const wide = computeLayout(1366, 768, 1);
    for (const pos of [{ x: 0, y: 0 }, { x: 47, y: 0 }, { x: 0, y: 31 }, { x: 47, y: 31 }]) {
      const cam = followTile(createCamera(wide, W, H), pos, wide, W, H);
      expect(cam.cx).toBeGreaterThanOrEqual(0);
      expect(cam.cx).toBeLessThanOrEqual(W);
      expect(cam.cy).toBeGreaterThanOrEqual(0);
      expect(cam.cy).toBeLessThanOrEqual(H);
    }
  });
});
