import { describe, expect, it } from 'vitest';
import { SCENE, drawScene, sceneHit, wrapText, type SceneView } from '../src/screens/scene';
import { ADVANCE, textWidth, unsupportedChars } from '../src/ui/font';
import type { Rect } from '../src/ui/frame';
import { onText, type TextRun } from '../src/ui/text';

const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const overlap = (a: Rect, b: Rect) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

function runs(view: SceneView): TextRun[] {
  const out: TextRun[] = [];
  const stop = onText((r) => out.push(r));
  drawScene(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D, view);
  stop();
  return out;
}
const left = (r: TextRun): number => (r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2));
const line: SceneView = { speaker: 'ALVAREZ', text: 'Meridian Holdings took this colony with a private army. The settlers hired us.', choices: null, skippable: true };
const ask: SceneView = { speaker: 'CHEN', text: '', choices: ['TAKE IT', 'BURN IT'], skippable: true };

describe('wrapText', () => {
  it('never exceeds the width, splits on spaces and keeps the words', () => {
    const rows = wrapText(line.text, 200);
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) expect(textWidth(r)).toBeLessThanOrEqual(200);
    expect(rows.join(' ')).toBe(line.text);
  });

  it('keeps an over-long word whole on its own row', () => {
    const long = 'x'.repeat(60);
    expect(wrapText(`a ${long} b`, 100)).toEqual(['a', long, 'b']);
    expect(wrapText('', 100)).toEqual([]);
  });
});

describe('scene hits', () => {
  it('maps the skip button, the text box and (when asking) the two choices', () => {
    expect(sceneHit(centre(SCENE.skip).x, centre(SCENE.skip).y, line)).toBe('skip');
    expect(sceneHit(5, 5, line)).toBe('next');
    expect(sceneHit(centre(SCENE.choices[0]).x, centre(SCENE.choices[0]).y, ask)).toEqual({ kind: 'choice', index: 0 });
    expect(sceneHit(centre(SCENE.choices[1]).x, centre(SCENE.choices[1]).y, ask)).toEqual({ kind: 'choice', index: 1 });
    expect(sceneHit(5, 5, ask)).toBeNull();
    expect(sceneHit(centre(SCENE.skip).x, centre(SCENE.skip).y, ask)).toBe('skip');
  });

  it('keeps every rectangle inside the screen and the buttons apart', () => {
    const rects = [SCENE.box, SCENE.portrait, SCENE.skip, ...SCENE.choices];
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(480);
      expect(r.y + r.h).toBeLessThanOrEqual(400);
    }
    for (const a of [SCENE.skip, ...SCENE.choices, SCENE.portrait]) {
      for (const b of [SCENE.skip, ...SCENE.choices, SCENE.portrait]) if (a !== b) expect(overlap(a, b)).toBe(false);
    }
  });
});

describe('drawing a scene', () => {
  it('draws the speaker, the portrait letter and text that fits, in supported characters', () => {
    const all = runs(line);
    expect(all.map((r) => r.text)).toContain('ALVAREZ');
    expect(all.map((r) => r.text)).toContain('A');
    for (const r of all) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(0);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(480);
    }
  });

  it('draws the choice labels instead of a line, and a hint when there are none', () => {
    const texts = runs(ask).map((r) => r.text);
    expect(texts).toContain('TAKE IT');
    expect(texts).toContain('BURN IT');
    expect(runs(line).map((r) => r.text)).toContain('CLICK OR SPACE');
    expect(ADVANCE).toBeGreaterThan(0);
  });

  it('hides SKIP when the scene cannot be skipped', () => {
    expect(runs({ ...line, skippable: false }).map((r) => r.text)).not.toContain('SKIP');
    expect(runs(line).map((r) => r.text)).toContain('SKIP');
  });
});
