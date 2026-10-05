import { describe, expect, it } from 'vitest';
import { flipHorizontal, parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';

describe('the sprite data', () => {
  it('has exactly the 41 named sprites', () => {
    expect(SPRITE_NAMES).toHaveLength(41);
    expect(Object.keys(SPRITE_ROWS).sort()).toEqual([...SPRITE_NAMES].sort());
  });

  it('every sprite is 16x16, uses only palette letters, has pixels, and flips back to itself', () => {
    for (const name of SPRITE_NAMES) {
      const s = parseSprite(name, SPRITE_ROWS[name]);
      expect(s.pixels.some((p) => p !== null), name).toBe(true);
      expect(flipHorizontal(flipHorizontal(s)).pixels, name).toEqual(s.pixels);
    }
  });

  it('the north soldier body (without the weapon) is left-right symmetric, so mirrored facings are right', () => {
    for (const row of SPRITE_ROWS.soldier_rifle_n) {
      for (let x = 0; x < 8; x++) {
        const left = row[x];
        const right = row[15 - x];
        if (/[af]/.test(left) || /[af]/.test(right)) continue; // the weapon is held on one side
        expect(left, row).toBe(right);
      }
    }
  });

  it('the weapon points the way the soldier faces, in every direction, for both weapons', () => {
    const dir: Record<string, [number, number]> = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1] };
    for (const [view, [vx, vy]] of Object.entries(dir)) {
      for (const weapon of ['rifle', 'pistol']) {
        const rows = SPRITE_ROWS[`soldier_${weapon}_${view}` as 'soldier_rifle_n'];
        const tips: { x: number; y: number }[] = [];
        rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'f') tips.push({ x, y }); }));
        expect(tips, `${weapon} ${view}`).toHaveLength(1);
        if (vx !== 0) expect(Math.sign(tips[0].x - 7.5), `${weapon} ${view} x`).toBe(vx);
        if (vy !== 0) expect(Math.sign(tips[0].y - 7.5), `${weapon} ${view} y`).toBe(vy);
      }
    }
  });

  it('a rifle is longer than a pistol in every direction', () => {
    const metal = (name: string) => SPRITE_ROWS[name as 'soldier_rifle_n'].join('').replace(/[^af]/g, '').length;
    for (const view of ['n', 'ne', 'e', 'se', 's']) {
      expect(metal(`soldier_rifle_${view}`), view).toBeGreaterThan(metal(`soldier_pistol_${view}`));
      expect(metal(`soldier_pistol_${view}`), view).toBeGreaterThanOrEqual(2);
    }
  });

  it('the front shows a face and the back does not', () => {
    const skinInHead = (name: string) => SPRITE_ROWS[name as 'soldier_rifle_n'].slice(0, 6).join('').replace(/[^s]/g, '').length;
    expect(skinInHead('soldier_rifle_s')).toBeGreaterThan(0);
    expect(skinInHead('soldier_rifle_n')).toBe(0);
    expect(skinInHead('soldier_rifle_e')).toBeGreaterThan(0);
  });

  it('every direction keeps a whole soldier (a similar number of opaque pixels)', () => {
    const count = (name: keyof typeof SPRITE_ROWS) => SPRITE_ROWS[name].join('').replace(/\./g, '').length;
    const n = count('soldier_rifle_n');
    for (const view of ['ne', 'e', 'se', 's']) {
      const c = count(`soldier_rifle_${view}` as 'soldier_rifle_n');
      expect(c, view).toBeGreaterThan(n * 0.8);
      expect(c, view).toBeLessThan(n * 1.2);
    }
  });

  it('the enemy is the soldier in red: no blue, some red, same shape', () => {
    for (const weapon of ['rifle', 'pistol']) {
      for (const suffix of ['n', 'ne', 'e', 'se', 's']) {
        const soldier = SPRITE_ROWS[`soldier_${weapon}_${suffix}` as 'soldier_rifle_n'].join('');
        const enemy = SPRITE_ROWS[`enemy_${weapon}_${suffix}` as 'enemy_rifle_n'].join('');
        expect(enemy).not.toMatch(/[BCN]/);
        expect(enemy).toMatch(/R/);
        expect(enemy.replace(/[^.]/g, 'x')).toBe(soldier.replace(/[^.]/g, 'x'));
      }
    }
  });

  it('the three floors differ from each other, and the walls and doors are solid tiles', () => {
    expect(SPRITE_ROWS.floor_0).not.toEqual(SPRITE_ROWS.floor_1);
    expect(SPRITE_ROWS.floor_1).not.toEqual(SPRITE_ROWS.floor_2);
    for (const name of ['wall', 'door_closed', 'door_open'] as const) {
      expect(SPRITE_ROWS[name].join('')).not.toMatch(/\./);
    }
  });
});
