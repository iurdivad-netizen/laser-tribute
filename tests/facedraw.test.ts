import { describe, expect, it } from 'vitest';
import { NO_ART, type Art } from '../src/art/planetimages';
import { newWorld, type World } from '../src/core/world/world';
import { PANEL, drawPanel } from '../src/screens/basepanels';
import { CAMP_ART_IDS, type CampArtId } from '../src/screens/campart';
import { SCENE, drawScene, type SceneView } from '../src/screens/scene';
import { unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';

interface Call { name: string; args: unknown[] }
function recorder() {
  const calls: Call[] = [];
  const ctx = new Proxy({}, {
    get: (_t, name: string) => (...args: unknown[]) => { calls.push({ name, args }); },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
const artWith = (ids: readonly CampArtId[]): Art<CampArtId> => ({
  image: (id) => (ids.includes(id) ? ({ id } as unknown as CanvasImageSource) : null),
});
const ALL = artWith(CAMP_ART_IDS);
const images = (calls: Call[]) => calls.filter((c) => c.name === 'drawImage');
const idOf = (c: Call) => (c.args[0] as { id: string }).id;
const line = (speaker: string): SceneView => ({ speaker, text: 'We hold the ridge.', choices: null, skippable: true });

function textRuns(draw: (ctx: CanvasRenderingContext2D) => void) {
  const out: { text: string; x: number; width: number; align: string }[] = [];
  const stop = onText((r) => out.push(r));
  draw(recorder().ctx);
  stop();
  return out;
}

describe('faces in a scene', () => {
  it('draws the speaker\'s face in the portrait slot, and the recruit face for RECRUIT', () => {
    const a = recorder();
    drawScene(a.ctx, line('Alvarez'), ALL);
    const drawn = images(a.calls);
    expect(drawn).toHaveLength(1);
    expect(idOf(drawn[0])).toBe('face_alvarez');
    expect(drawn[0].args.slice(1)).toEqual([SCENE.portrait.x, SCENE.portrait.y, 64, 64]);
    const r = recorder();
    drawScene(r.ctx, line('RECRUIT'), ALL);
    expect(idOf(images(r.calls)[0])).toBe('face_recruit');
  });

  it('draws the initial when the face is missing, exactly as with no art', () => {
    const missing = textRuns((ctx) => drawScene(ctx, line('Chen'), artWith(['face_alvarez'])));
    const none = textRuns((ctx) => drawScene(ctx, line('Chen'), NO_ART));
    expect(missing.map((r) => r.text)).toContain('C');
    expect(missing).toEqual(none);
    const { ctx, calls } = recorder();
    drawScene(ctx, line('Chen'), artWith(['face_alvarez']));
    expect(images(calls)).toHaveLength(0);
  });

  it('draws no initial over a painted face', () => {
    expect(textRuns((ctx) => drawScene(ctx, line('Brandt'), ALL)).map((r) => r.text)).not.toContain('B');
  });
});

describe('faces in the barracks list', () => {
  const rowsOf = () => PANEL.rows;
  const hired = (w: World, name: string): World => ({
    ...w, soldiers: [...w.soldiers, { name, kills: 0, trained: 0, status: 'ready' as const, daysLeft: 0 }],
  });

  it('draws a small face at each row, with the label moved right', () => {
    const w = newWorld(1, 'calm');
    const { ctx, calls } = recorder();
    drawPanel(ctx, 'barracks', w, null, 0, '', ALL);
    const drawn = images(calls);
    expect(drawn.map(idOf)).toEqual(['face_alvarez_s', 'face_brandt_s', 'face_chen_s', 'face_dubois_s']);
    drawn.forEach((c, i) => expect(c.args.slice(1)).toEqual([rowsOf()[i].x + 3, rowsOf()[i].y + 2, 16, 16]));
    const labels = textRuns((c) => drawPanel(c, 'barracks', w, null, 0, '', ALL));
    expect(labels.filter((t) => t.align === 'left' && t.x === rowsOf()[0].x + 26).map((t) => t.text)[0]).toMatch(/^ALVAREZ/);
  });

  it('lines the rows up when only some faces are painted', () => {
    const w = newWorld(1, 'calm');
    const art = artWith(['face_alvarez_s']);
    const { ctx, calls } = recorder();
    drawPanel(ctx, 'barracks', w, null, 0, '', art);
    expect(images(calls).map(idOf)).toEqual(['face_alvarez_s']);
    const labels = textRuns((c) => drawPanel(c, 'barracks', w, null, 0, '', art)).filter((t) => t.align === 'left' && /^(ALVAREZ|BRANDT|CHEN|DUBOIS)/.test(t.text));
    expect(labels).toHaveLength(4);
    for (const l of labels) expect(l.x).toBe(rowsOf()[0].x + 26);
  });

  it('gives hires, including a name like Alvarez 2, the recruit face', () => {
    const w = hired(hired(newWorld(1, 'calm'), 'Eriksen'), 'Alvarez 2');
    const { ctx, calls } = recorder();
    drawPanel(ctx, 'barracks', w, null, 0, '', ALL);
    expect(images(calls).map(idOf).slice(4)).toEqual(['face_recruit_s', 'face_recruit_s']);
  });

  it('draws no face and keeps the label in place with no art, and for the other panels', () => {
    const w = newWorld(1, 'calm');
    const none = textRuns((ctx) => drawPanel(ctx, 'barracks', w, null, 0, '', NO_ART));
    expect(none.some((t) => t.align === 'left' && t.x === rowsOf()[0].x + 8)).toBe(true);
    for (const id of ['lab', 'market', 'training', 'hospital', 'wait'] as const) {
      const { ctx, calls } = recorder();
      drawPanel(ctx, id, w, null, 0, '', ALL);
      expect(images(calls), id).toHaveLength(0);
    }
  });

  it('keeps a full barracks inside the screen in supported characters', () => {
    const pool = Array.from({ length: 12 }, (_, i) => ({
      name: `Lindqvist ${i + 2}`, kills: 9999, trained: 9999, status: (i % 2 ? 'ready' : 'wounded') as 'ready', daysLeft: i % 2 ? 0 : 3,
    }));
    const w = { ...newWorld(1, 'calm'), soldiers: pool, research: { done: ['beds1', 'beds2', 'beds3'], active: null } };
    for (const r of textRuns((ctx) => drawPanel(ctx, 'barracks', w, null, 0, '', ALL))) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      const left = r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);
      expect(left, r.text).toBeGreaterThanOrEqual(0);
      expect(left + r.width, r.text).toBeLessThanOrEqual(480);
    }
  });
});
