import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/core/world/world';
import { BUILDINGS, baseHit, buildingStatus, drawBase, type BuildingId } from '../src/screens/base';
import { unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const text = (w = newWorld(1, 'calm'), id: BuildingId) => buildingStatus(w, id).join(' ').toUpperCase();

function runs(draw: (ctx: CanvasRenderingContext2D) => void): TextRun[] {
  const out: TextRun[] = [];
  const stop = onText((r) => out.push(r));
  draw(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D);
  stop();
  return out;
}
const left = (r: TextRun): number => (r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2));

describe('base hub layout', () => {
  it('has the seven buildings inside the screen without overlapping', () => {
    expect(BUILDINGS.map((b) => b.id)).toEqual(['lab', 'barracks', 'market', 'training', 'hospital', 'wait', 'planet']);
    for (const b of BUILDINGS) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(480);
      expect(b.y + b.h).toBeLessThanOrEqual(400);
    }
    for (const a of BUILDINGS) for (const b of BUILDINGS) {
      if (a.id < b.id) {
        const apart = a.x + a.w <= b.x - 12 || b.x + b.w <= a.x - 12 || a.y + a.h <= b.y - 12 || b.y + b.h <= a.y - 12;
        expect(apart, `${a.id} ${b.id}`).toBe(true);
      }
    }
  });

  it('hits each building at its centre, and nothing on empty ground', () => {
    for (const b of BUILDINGS) expect(baseHit(centre(b).x, centre(b).y)).toBe(b.id);
    expect(baseHit(1, 1)).toBeNull();
    expect(baseHit(240, 395)).toBeNull();
  });

  it('widens for touch without reaching a neighbour', () => {
    const lab = BUILDINGS[0];
    expect(baseHit(lab.x - 3, centre(lab).y)).toBeNull();
    expect(baseHit(lab.x - 3, centre(lab).y, 5)).toBe('lab');
    for (const a of BUILDINGS) for (const b of BUILDINGS) {
      if (a.id === b.id) continue;
      expect(baseHit(b.x + b.w / 2, b.y + b.h / 2, 5)).toBe(b.id);
    }
  });
});

describe('building status lines', () => {
  it('describes a new world', () => {
    expect(text(newWorld(1, 'calm'), 'lab')).toContain('IDLE');
    expect(text(newWorld(1, 'calm'), 'barracks')).toContain('4/6');
    expect(text(newWorld(1, 'calm'), 'training')).toContain('NOT BUILT');
    expect(text(newWorld(1, 'calm'), 'hospital')).toContain('NOT BUILT');
    expect(text(newWorld(1, 'calm'), 'market')).toContain('+50%');
    const planet = text(newWorld(1, 'calm'), 'planet');
    expect(planet).toContain('DAY 0');
    expect(planet).toContain('150');
  });

  it('names the running project and the soldier in training', () => {
    const w = { ...newWorld(1, 'calm'), research: { done: ['training1', 'hospital1'], active: { node: 'shotgun', daysLeft: 3 } } };
    expect(text(w, 'lab')).toContain('SHOTGUN');
    expect(text(w, 'lab')).toContain('3');
    expect(text(w, 'hospital')).toContain('25%');
    const training = { ...w, soldiers: w.soldiers.map((s, i) => (i === 0 ? { ...s, status: 'training' as const, daysLeft: 2 } : s)) };
    expect(text(training, 'training')).toContain('ALVAREZ');
  });

  it('keeps every line short enough for its tile and font-supported', () => {
    const w = {
      ...newWorld(1, 'calm'),
      research: { done: ['training3', 'hospital2', 'beds3', 'labs2'], active: { node: 'training3', daysLeft: 12 } },
      credits: 999999,
      day: 99999,
    };
    for (const id of BUILDINGS.map((b) => b.id)) {
      for (const line of buildingStatus(w, id)) {
        expect(line.length, line).toBeLessThanOrEqual(22);
        expect(unsupportedChars(line), line).toEqual([]);
      }
    }
  });
});

describe('drawBase', () => {
  it('draws a new and a played world within the screen using supported characters', () => {
    const played = { ...newWorld(3, 'pressure'), credits: 12345, day: 77, research: { done: ['beds1'], active: { node: 'smg', daysLeft: 2 } } };
    for (const w of [newWorld(1, 'calm'), played]) {
      for (const r of runs((ctx) => drawBase(ctx, w, 'Hired Eriksen.'))) {
        expect(unsupportedChars(r.text), r.text).toEqual([]);
        expect(left(r), r.text).toBeGreaterThanOrEqual(0);
        expect(left(r) + r.width, r.text).toBeLessThanOrEqual(480);
      }
    }
  });
});
