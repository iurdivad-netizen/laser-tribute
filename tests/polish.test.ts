import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { defaultLoadout, fitLoadout, loadoutCost, type Loadout } from '../src/core/loadout';
import { createUiState } from '../src/input/uiState';
import { actionBlocked, drawPanel } from '../src/render/panel';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

describe('alert needs ammo', () => {
  it('refuses to go on alert with an empty gun and keeps the AP', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').ammo = 0;
    expect(reason(applyCommand(s, { type: 'Alert', unitId: 'p1', on: true }))).toBe('Out of ammo');
  });

  it('still lets a soldier with a loaded gun go on alert, and come off alert with an empty one', () => {
    const s = makeState(corridorRows('P...E'));
    const on = ok(applyCommand(s, { type: 'Alert', unitId: 'p1', on: true })).state;
    unit(on, 'p1').ammo = 0; // e.g. emptied by reaction fire
    expect(unit(ok(applyCommand(on, { type: 'Alert', unitId: 'p1', on: false })).state, 'p1').alert).toBe(false);
  });
});

describe('fitLoadout trims clips before giving up the kit', () => {
  const withClips = (n: number): Loadout => defaultLoadout().map((s) => ({ ...s, clips: n }));

  it('keeps the weapons and grenades when only the extra clips are over budget', () => {
    const big = withClips(4); // 162 credits
    const fitted = fitLoadout(big, 120);
    expect(fitted.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
    expect(fitted.map((s) => s.grenades)).toEqual([1, 1, 1, 1]);
    expect(fitted.every((s) => s.clips === 1)).toBe(true);
    expect(loadoutCost(fitted)).toBe(102);
  });

  it('still falls back to the cheap kit when even one clip each is too much', () => {
    const rich: Loadout = Array.from({ length: 4 }, () => ({ weapon: 'rifle' as const, grenades: 3, clips: 4 }));
    const fitted = fitLoadout(rich, 120);
    expect(fitted.every((s) => s.weapon === 'pistol' && s.grenades === 1 && s.clips === 1)).toBe(true);
  });
});

describe('panel details', () => {
  it('shows the throw button as blocked with no grenades, and not otherwise', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    expect(actionBlocked(p, 'throw')).toBe(false);
    p.grenades = 0;
    expect(actionBlocked(p, 'throw')).toBe(true);
  });

  it('keeps the turn text clear of the status line even at turn 99', () => {
    const s = makeState(corridorRows('P..E'));
    s.turnNumber = 99;
    s.turn = 'enemy';
    const ui = createUiState('p1');
    ui.message = 'Need 24 AP, have 15';
    ui.messageUntil = Infinity;
    const texts: { text: string; x: number }[] = [];
    const ctx = {
      fillText(text: string, x: number) { texts.push({ text, x }); },
      fillRect() {},
      measureText(t: string) { return { width: t.length * 4.8 }; },
      set fillStyle(_v: string) {}, set font(_v: string) {}, set textBaseline(_v: string) {},
    } as unknown as CanvasRenderingContext2D;
    drawPanel(ctx, s, ui, 0);
    const turn = texts.find((t) => t.text.startsWith('Turn 99'))!;
    const status = texts.find((t) => t.text === 'Need 24 AP, have 15')!;
    expect(status.x).toBeGreaterThanOrEqual(turn.x + turn.text.length * 4.8 + 2);
  });
});

describe('enemies without ammo (extra coverage)', () => {
  it('a reload is rejected for lack of AP, so the enemy moves on instead of stalling', () => {
    const s = makeState(corridorRows('P...E'));
    s.turn = 'enemy';
    unit(s, 'e1').facing = 6;
    unit(s, 'e1').ammo = 0;
    unit(s, 'e1').ap = 10; // a clip, but under 15 AP
    expect(aiNextCommand(s)).toMatchObject({ type: 'Move', unitId: 'e1' });
  });

  it('several dry enemies never shoot and the turn still ends', () => {
    const s = makeState(corridorRows('P...EE'));
    s.turn = 'enemy';
    for (const id of ['e1', 'e2']) {
      unit(s, id).facing = 6;
      unit(s, id).ammo = 0;
      unit(s, id).clips = 0;
    }
    const out = runEnemyTurn(s);
    expect(out.events.some((e) => e.type === 'shot')).toBe(false);
    expect(out.state.turn).toBe('player');
    expect(unit(out.state, 'p1').hp).toBe(50);
  });
});
