import { describe, expect, it } from 'vitest';
import { SOLDIER_NAMES } from '../src/core/campaign';
import { hire } from '../src/core/world/barracks';
import { RECRUIT_SURNAMES, recruitName } from '../src/core/world/names';
import { ORIGINALS } from '../src/core/world/story';
import { newWorld, type World } from '../src/core/world/world';
import { unsupportedChars } from '../src/ui/font';

const rich = (w: World): World => ({ ...w, credits: 99999, research: { done: ['beds1', 'beds2', 'beds3'], active: null } });
const lower = (list: readonly string[]) => list.map((n) => n.toLowerCase());

describe('recruit surname pool', () => {
  it('is big, unique, short, drawable and free of the old names', () => {
    expect(RECRUIT_SURNAMES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(lower(RECRUIT_SURNAMES)).size).toBe(RECRUIT_SURNAMES.length);
    for (const n of RECRUIT_SURNAMES) {
      expect(n.length, n).toBeLessThanOrEqual(10);
      expect(unsupportedChars(n), n).toEqual([]);
      expect(lower([...ORIGINALS, ...SOLDIER_NAMES]), n).not.toContain(n.toLowerCase());
    }
  });
});

describe('recruitName', () => {
  it('is the same for the same world and moves with the hire count', () => {
    const w = newWorld(7, 'calm');
    expect(recruitName(w)).toBe(recruitName(newWorld(7, 'calm')));
    const names = new Set(Array.from({ length: 30 }, (_, i) => recruitName({ ...w, namesUsed: 4 + i })));
    expect(names.size).toBeGreaterThanOrEqual(20);
  });

  it('never repeats a current, fallen or original name over many hires', () => {
    let w = rich(newWorld(3, 'calm'));
    const made: string[] = [];
    for (let i = 0; i < 40; i++) {
      w = { ...w, soldiers: w.soldiers.slice(0, 4), fallen: [...w.fallen, ...w.soldiers.slice(4)] }; // keep beds free, bury the rest
      w = hire(w);
      made.push(w.soldiers.at(-1)!.name);
    }
    expect(new Set(made).size).toBe(40);
    for (const n of made) expect(lower(ORIGINALS), n).not.toContain(n.toLowerCase());
  });

  it('still gives a unique name when the whole pool is taken', () => {
    const w = newWorld(1, 'calm');
    const fallen = RECRUIT_SURNAMES.map((name) => ({ name, kills: 0 }));
    const name = recruitName({ ...w, fallen });
    expect(RECRUIT_SURNAMES).not.toContain(name);
    expect(name).toMatch(/^[A-Za-z]+ \d+$/);
    expect(name.length).toBeLessThanOrEqual(12);
  });

  it('is what hire gives, and a new world still starts with the originals', () => {
    const w = rich(newWorld(5, 'calm'));
    expect(hire(w).soldiers.at(-1)!.name).toBe(recruitName(w));
    expect(newWorld(1, 'calm').soldiers.map((s) => s.name)).toEqual([...ORIGINALS]);
  });
});
