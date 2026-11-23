import { describe, expect, it } from 'vitest';
import {
  BASE_RULES, NODES, bedCount, levelsOf, nodeById, researchDays, storyGearRules, unlocksOf,
} from '../src/core/world/base';

const row = (id: string) => {
  const n = nodeById(id)!;
  return [n.cost, n.days, [...n.needs]];
};

describe('research tree', () => {
  it('has unique ids, known prerequisites and no cycles', () => {
    const ids = NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of NODES) for (const need of n.needs) expect(ids).toContain(need);
    const done = new Set<string>();
    for (let pass = 0; pass < NODES.length; pass++) {
      for (const n of NODES) if (n.needs.every((d) => done.has(d))) done.add(n.id);
    }
    expect(done.size).toBe(NODES.length);
    expect(NODES.length).toBe(22);
  });

  it('holds the starting costs, days and prerequisites', () => {
    const table: Record<string, [number, number, string[]]> = {
      shotgun: [40, 4, []], smg: [70, 5, ['shotgun']], sniper: [110, 6, ['smg']],
      smoke: [30, 3, []], flash: [45, 4, ['smoke']], incendiary: [70, 5, ['flash']],
      armour: [50, 4, []], scanner: [45, 4, []], scope: [40, 3, []],
      beds1: [60, 4, []], beds2: [100, 5, ['beds1']], beds3: [140, 6, ['beds2']],
      labs1: [80, 5, []], labs2: [140, 6, ['labs1']],
      contracts1: [70, 4, []], contracts2: [110, 5, ['contracts1']], contracts3: [160, 6, ['contracts2']],
      hospital1: [80, 5, []], hospital2: [140, 6, ['hospital1']],
      training1: [80, 5, []], training2: [140, 6, ['training1']], training3: [200, 7, ['training2']],
    };
    for (const [id, [cost, days, needs]] of Object.entries(table)) expect(row(id), id).toEqual([cost, days, needs]);
  });

  it('covers every gear item that is locked at the start', () => {
    const gear = NODES.filter((n) => n.gives.weapon || n.gives.throwable || n.gives.gadget || n.gives.attachment);
    expect(gear.map((n) => n.id)).toEqual(['shotgun', 'smg', 'sniper', 'smoke', 'flash', 'incendiary', 'armour', 'scanner', 'scope']);
  });
});

describe('derived levels', () => {
  it('reads the highest level in each track', () => {
    expect(levelsOf([])).toEqual({ beds: 0, labs: 0, contracts: 0, hospital: 0, training: 0 });
    expect(levelsOf(['beds1', 'beds2', 'labs1'])).toMatchObject({ beds: 2, labs: 1 });
  });

  it('counts beds', () => {
    expect(bedCount([])).toBe(6);
    expect(bedCount(['beds1', 'beds2', 'beds3'])).toBe(12);
  });

  it('shortens research with labs, never below one day', () => {
    const sniper = nodeById('sniper')!;
    expect(researchDays(sniper, [])).toBe(6);
    expect(researchDays(sniper, ['labs1'])).toBe(5);
    expect(researchDays(sniper, ['labs1', 'labs2'])).toBe(3);
    expect(researchDays(nodeById('smoke')!, ['labs1', 'labs2'])).toBe(2);
  });
});

describe('unlocks', () => {
  it('starts with the pistol, rifle, frag and medkit', () => {
    const u = unlocksOf([]);
    expect([...u.weapons]).toEqual(['pistol', 'rifle']);
    expect([...u.throwables]).toEqual(['frag']);
    expect([...u.gadgets]).toEqual(['medkit']);
    expect([...u.attachments]).toEqual([]);
  });

  it('adds researched gear', () => {
    const u = unlocksOf(['shotgun', 'armour', 'scope', 'beds1']);
    expect(u.weapons).toContain('shotgun');
    expect(u.gadgets).toContain('armour');
    expect(u.attachments).toContain('scope');
  });

  it('carries the marketplace premium', () => {
    expect(storyGearRules([]).premium).toBe(BASE_RULES.premium);
    expect(BASE_RULES.premium).toBe(1.5);
  });
});
