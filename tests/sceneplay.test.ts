import { describe, expect, it } from 'vitest';
import type { Scene } from '../src/core/world/story';
import { forward, pick, shownLine, skip, startPlay, type ScenePlay } from '../src/sceneplay';

const l = (text: string) => ({ by: ['Alvarez'], text });
const plain: Scene = { id: 'p', when: () => true, lines: [l('one'), l('two')] };
const asking: Scene = {
  id: 'c', when: () => true, lines: [l('one'), l('two')],
  choice: [
    { label: 'A', effect: {}, reply: [l('a1'), l('a2')] },
    { label: 'B', effect: {}, reply: [l('b1')] },
  ],
};
const step = (p: ScenePlay | 'done'): ScenePlay => {
  if (p === 'done') throw new Error('already done');
  return p;
};

describe('a scene without a choice', () => {
  it('walks its lines and ends', () => {
    let p = startPlay(plain);
    expect(shownLine(p)?.text).toBe('one');
    p = step(forward(p));
    expect(shownLine(p)?.text).toBe('two');
    expect(forward(p)).toBe('done');
  });

  it('skips straight to the end', () => {
    expect(skip(startPlay(plain))).toBe('done');
  });
});

describe('a scene with a choice', () => {
  const atChoice = () => step(forward(step(forward(startPlay(asking)))));

  it('stops at the choice after its last line, and forward cannot leave it', () => {
    const p = atChoice();
    expect(p.phase).toBe('choice');
    expect(shownLine(p)).toBeNull();
    expect(forward(p)).toBe(p);
  });

  it('shows the reply to the option picked, then ends', () => {
    let p = pick(atChoice(), 0);
    expect(p).toMatchObject({ phase: 'reply', picked: 0, index: 0 });
    expect(shownLine(p)?.text).toBe('a1');
    p = step(forward(p));
    expect(shownLine(p)?.text).toBe('a2');
    expect(forward(p)).toBe('done');
    expect(shownLine(pick(atChoice(), 1))?.text).toBe('b1');
  });

  it('skip jumps to the choice and never makes it', () => {
    const p = step(skip(startPlay(asking)));
    expect(p.phase).toBe('choice');
    expect(p.picked).toBeNull();
    expect(skip(p)).toBe(p);
  });

  it('skip ends a reply', () => {
    expect(skip(pick(atChoice(), 0))).toBe('done');
  });

  it('cannot pick outside the choice', () => {
    expect(() => pick(startPlay(asking), 0)).toThrow('no choice to pick');
  });
});
