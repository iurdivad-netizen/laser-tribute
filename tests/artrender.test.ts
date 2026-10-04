import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import type { SpriteName } from '../src/art/sprites';
import { createMission, MISSIONS } from '../src/core/missions';
import { computeVisible } from '../src/core/vision';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

/** An atlas that records what it is asked to draw. */
function spyAtlas() {
  const drawn: { name: SpriteName; x: number; y: number; flip: boolean }[] = [];
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.draw.bind(atlas);
  atlas.draw = (ctx, name, x, y, opts = {}) => {
    drawn.push({ name, x, y, flip: !!opts.flip });
    return real(ctx, name, x, y, opts);
  };
  return { atlas, drawn };
}

const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

const roster = [
  { name: 'A', kills: 9 }, { name: 'B', kills: 5 }, { name: 'C', kills: 2 }, { name: 'D', kills: 0 },
];

describe('drawGame with sprites', () => {
  it('draws explored tiles, units and items without throwing', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const { atlas, drawn } = spyAtlas();
    expect(() => drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas)).not.toThrow();
    const names = new Set(drawn.map((d) => d.name));
    expect(names.has('wall')).toBe(true);
    expect([...names].some((n) => n.startsWith('floor_'))).toBe(true);
    expect([...names].some((n) => n.startsWith('soldier_'))).toBe(true);
  });

  it('draws a soldier sprite per living soldier, mirrored for facings 5 to 7', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldiers = state.units.filter((u) => u.side === 'player');
    soldiers[0].facing = 6; // west: the mirror of east
    soldiers[1].facing = 0;
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const units = drawn.filter((d) => d.name.startsWith('soldier_'));
    expect(units).toHaveLength(4);
    expect(units.find((d) => d.name === 'soldier_e')!.flip).toBe(true);
    expect(units.find((d) => d.name === 'soldier_n')!.flip).toBe(false);
  });

  it('does not draw an enemy that is out of sight, and draws one that is seen', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const visible = computeVisible(state, 'player');
    const seenEnemies = state.units.filter((u) => u.side === 'enemy' && u.alive && visible[u.pos.y][u.pos.x]).length;
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.filter((d) => d.name.startsWith('enemy_')).length).toBe(seenEnemies);

    const enemy = state.units.find((u) => u.side === 'enemy')!;
    const soldier = state.units.find((u) => u.side === 'player')!;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y }; // next to a soldier: always seen
    const second = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, second.atlas);
    expect(second.drawn.some((d) => d.name.startsWith('enemy_'))).toBe(true);
  });

  it('draws a corpse only when it is seen', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    const near = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, near.atlas);
    expect(near.drawn.some((d) => d.name === 'corpse_enemy')).toBe(true);
    enemy.pos = { x: 28, y: 18 }; // far away, in the dark
    const far = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, far.atlas);
    expect(far.drawn.some((d) => d.name === 'corpse_enemy')).toBe(false);
  });

  it('draws corpses before the living, so a soldier standing on a corpse stays visible', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { ...soldier.pos }; // the dead lie where the soldier now stands
    state.units.push(state.units.splice(state.units.indexOf(enemy), 1)[0]); // listed after the soldier: drawn after him unless corpses get their own pass
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const corpse = drawn.findIndex((d) => d.name === 'corpse_enemy');
    const alive = drawn.findIndex((d) => d.name.startsWith('soldier_') && d.x === soldier.pos.x * 16 && d.y === soldier.pos.y * 16);
    expect(corpse).toBeGreaterThanOrEqual(0);
    expect(alive).toBeGreaterThan(corpse);
  });

  it('draws a corpse after the item lying under it', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    state.items.push({ id: 'i77', pos: { ...enemy.pos }, kind: 'rifle' });
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.findIndex((d) => d.name === 'item_rifle')).toBeLessThan(drawn.findIndex((d) => d.name === 'corpse_enemy'));
  });

  it('draws item icons where the player can see them', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    state.items.push({ id: 'i99', pos: { x: soldier.pos.x, y: soldier.pos.y }, kind: 'grenade' });
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.some((d) => d.name === 'item_grenade')).toBe(true);
  });

  it('completes with an atlas that has no canvas (nothing is drawn)', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const empty = new Atlas(() => null);
    expect(() => drawGame(ctx, state, createUiState('p1'), new Effects(), 0, empty)).not.toThrow();
  });
});

describe('Effects.unitBob', () => {
  it('lifts a walking unit by one pixel for the first half of its step, then settles', () => {
    const fx = new Effects();
    fx.add([{ type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }], 1000);
    expect(fx.unitBob('p1', 1010)).toBe(-1);
    expect(fx.unitBob('p1', 1090)).toBe(0);
    expect(fx.unitBob('p1', 2000)).toBe(0);
    expect(fx.unitBob('p2', 1010)).toBe(0);
  });
});
