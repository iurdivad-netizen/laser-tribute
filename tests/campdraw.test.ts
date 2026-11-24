import { describe, expect, it } from 'vitest';
import { NO_ART, type Art } from '../src/art/planetimages';
import { newWorld, type World } from '../src/core/world/world';
import { BUILDINGS, drawBase } from '../src/screens/base';
import { CAMP_ART_IDS, SPRITE_SIZE, campLook, type CampArtId } from '../src/screens/campart';
import { unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';

interface Call { name: string; args: unknown[]; fill: string }

function recorder() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { fillStyle: '' };
  const ctx = new Proxy({}, {
    get: (_t, name: string) => {
      if (name in state) return state[name];
      return (...args: unknown[]) => { calls.push({ name, args, fill: String(state.fillStyle) }); };
    },
    set: (_t, name: string, value) => { state[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const artWith = (ids: readonly CampArtId[]): Art<CampArtId> => ({
  image: (id) => (ids.includes(id) ? ({ id } as unknown as CanvasImageSource) : null),
});
const ALL = artWith(CAMP_ART_IDS);
const fresh = () => newWorld(1, 'calm');
const images = (calls: Call[]) => calls.filter((c) => c.name === 'drawImage');
const idOf = (c: Call) => (c.args[0] as { id: string }).id;
const CHIP = 'rgba(8,10,18,0.85)';
const chips = (calls: Call[]) => calls.filter((c) => c.name === 'fillRect' && c.fill === CHIP);
const frames = (calls: Call[]) =>
  BUILDINGS.map((b) => calls.filter((c) => c.name === 'fillRect' && c.args[0] === b.x && c.args[1] === b.y && c.args[2] === b.w && c.args[3] === b.h).length);

function texts(draw: (ctx: CanvasRenderingContext2D) => void): string[] {
  const out: string[] = [];
  const stop = onText((r) => {
    out.push(r.text);
    expect(unsupportedChars(r.text), r.text).toEqual([]);
    const left = r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);
    expect(left, r.text).toBeGreaterThanOrEqual(0);
    expect(left + r.width, r.text).toBeLessThanOrEqual(480);
  });
  draw(recorder().ctx);
  stop();
  return out;
}

/** Where a text run lands: its left edge, top and width (glyphs are 7 px tall). */
function noticeBox(draw: (ctx: CanvasRenderingContext2D) => void, text: string) {
  let box: { x: number; y: number; w: number; h: number } | null = null;
  const stop = onText((r) => {
    if (r.text !== text) return;
    const left = r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);
    box = { x: left, y: r.y, w: r.width, h: 7 };
  });
  draw(recorder().ctx);
  stop();
  return box as { x: number; y: number; w: number; h: number } | null;
}
const meets = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

describe('the notice line', () => {
  it.each([['no art', NO_ART], ['all art', ALL]] as const)('stays clear of every building, in full, with %s', (_name, art) => {
    for (const notice of ['Hired Eriksen.', 'Researching Field Hospital 2.']) {
      const shown = notice.toUpperCase();
      const box = noticeBox((ctx) => drawBase(ctx, fresh(), notice, art), shown);
      expect(box, notice).not.toBeNull(); // drawn whole, not cut to dots
      for (const b of BUILDINGS) expect(meets(box!, b), `${notice} over ${b.id}`).toBe(false);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.w).toBeLessThanOrEqual(480);
    }
  });

  it('sits on a dark strip over the painting', () => {
    const { ctx, calls } = recorder();
    drawBase(ctx, fresh(), 'Hired Eriksen.', ALL);
    const box = noticeBox((c) => drawBase(c, fresh(), 'Hired Eriksen.', ALL), 'HIRED ERIKSEN.')!;
    const behind = chips(calls).some((c) => (c.args[0] as number) <= box.x && (c.args[1] as number) <= box.y
      && (c.args[0] as number) + (c.args[2] as number) >= box.x + box.w && (c.args[1] as number) + (c.args[3] as number) >= box.y + box.h);
    expect(behind).toBe(true);
  });
});

describe('the camp without art', () => {
  it('draws no image and a tile for every building', () => {
    const { ctx, calls } = recorder();
    drawBase(ctx, fresh(), '', NO_ART);
    expect(images(calls)).toHaveLength(0);
    expect(chips(calls)).toHaveLength(0);
    expect(frames(calls)).toEqual(BUILDINGS.map(() => 1));
  });
});

describe('the painted camp', () => {
  it('draws the backdrop, a sprite per building that has one, each centred in its rectangle, and a chip behind each label', () => {
    const w = fresh();
    const { ctx, calls } = recorder();
    drawBase(ctx, w, '', ALL);
    const drawn = images(calls);
    const back = drawn.filter((c) => idOf(c) === 'camp_backdrop');
    expect(back).toHaveLength(1);
    expect(back[0].args.slice(1)).toEqual([0, 0, 480, 400]);
    const look = campLook(w);
    const sprites = BUILDINGS.filter((b) => look[b.id] !== null);
    expect(drawn).toHaveLength(1 + sprites.length);
    for (const b of sprites) {
      const id = look[b.id]!;
      const size = SPRITE_SIZE[id];
      const call = drawn.find((c) => idOf(c) === id)!;
      expect(call.args.slice(3), id).toEqual([size.w, size.h]);
      expect(call.args[1] as number, id).toBe(b.x + Math.round((b.w - size.w) / 2));
      expect(call.args[2] as number, id).toBeGreaterThanOrEqual(b.y);
      expect((call.args[2] as number) + size.h, id).toBeLessThanOrEqual(b.y + b.h);
    }
    expect(frames(calls)).toEqual(BUILDINGS.map(() => 0)); // no tile where a sprite is, nor at the fire or the gate
    // a chip for every building, the fire (no sprite) included
    expect(chips(calls)).toHaveLength(BUILDINGS.length + 1); // and one behind the hint line
    for (const b of BUILDINGS) expect(chips(calls).some((c) => c.args[0] === b.x && c.args[2] === b.w), b.id).toBe(true);
  });

  it('keeps a tile for a building whose sprite is missing, and for all when only the backdrop loaded', () => {
    const { ctx, calls } = recorder();
    drawBase(ctx, fresh(), '', artWith(CAMP_ART_IDS.filter((id) => id !== 'lab_idle')));
    const f = frames(calls);
    expect(f[BUILDINGS.findIndex((b) => b.id === 'lab')]).toBe(1);
    expect(f.reduce((a, n) => a + n, 0)).toBe(1);
    const only = recorder();
    drawBase(only.ctx, fresh(), '', artWith(['camp_backdrop']));
    expect(images(only.calls)).toHaveLength(1);
    expect(frames(only.calls).filter((n) => n === 1)).toHaveLength(BUILDINGS.length - 2); // the fire and the gate are painted into the backdrop: a label, no tile
  });

  it('shows the state: built facilities and a hospital with patients', () => {
    const w: World = {
      ...fresh(),
      research: { done: ['training1', 'hospital1'], active: null },
      soldiers: fresh().soldiers.map((s, i) => (i === 0 ? { ...s, status: 'wounded' as const, daysLeft: 3 } : s)),
    };
    const { ctx, calls } = recorder();
    drawBase(ctx, w, '', ALL);
    const ids = images(calls).map(idOf);
    expect(ids).toContain('training_built');
    expect(ids).toContain('hospital_busy');
    expect(ids).toContain('lab_idle');
  });

  it('draws supported text inside the screen, with the same building names with or without art', () => {
    const w = fresh();
    const plain = texts((ctx) => drawBase(ctx, w, 'Hired Eriksen.', NO_ART));
    const painted = texts((ctx) => drawBase(ctx, w, 'Hired Eriksen.', ALL));
    for (const name of ['LAB', 'BARRACKS', 'MARKET', 'TRAINING', 'HOSPITAL', 'WAIT']) {
      expect(plain, name).toContain(name);
      expect(painted, name).toContain(name);
    }
    expect(painted).toContain('HIRED ERIKSEN.');
  });
});
