import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { LastMode, SaveStore, type SaveStorage } from '../src/save';
import { BUILDINGS } from '../src/screens/base';
import { PANEL } from '../src/screens/basepanels';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PLANET } from '../src/screens/planet';
import { TITLE } from '../src/screens/title';
import { StoryStore } from '../src/storysave';
import { onText } from '../src/ui/text';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function memory(): SaveStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function setup() {
  const storage = memory();
  let t = 0;
  const app = new App({
    clock: () => t,
    newSeed: () => 5,
    store: new SaveStore(storage, 3),
    campaignStore: new SaveStore(storage, CAMPAIGN_LENGTH, 'campaign'),
    storyStore: new StoryStore(storage),
    last: new LastMode(storage),
    createMission: () => makeState(corridorRows('PPPP.')),
    scenes: false,
  });
  const click = (p: { x: number; y: number }) => { t += 500; app.click(p); };
  const press = (k: string) => { t += 500; app.key(k); };
  click(mid(TITLE.story));
  click(mid(DIFFICULTY_SCREEN.calm));
  click(mid(PLANET.base));
  click(mid(BUILDINGS.find((b) => b.id === 'lab')!));
  const texts = (): string[] => {
    const out: string[] = [];
    const stop = onText((r) => out.push(r.text));
    app.draw(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D, 0);
    stop();
    return out;
  };
  const nameOf = (i: number) => ({ x: PANEL.rows[i].x + 10, y: PANEL.rows[i].y + 10 });
  const restOf = (i: number) => ({ x: PANEL.rows[i].x + 200, y: PANEL.rows[i].y + 10 });
  const priv = () => app as unknown as { panelSelected: number | null; cardItem: unknown };
  return { app, click, press, texts, nameOf, restOf, priv, t: () => t };
}

describe('the research upgrade card in the Lab', () => {
  it('opens from the name of an upgrade row and draws its title and status', () => {
    const s = setup();
    s.click(s.nameOf(9)); // beds1
    expect(s.priv().cardItem).toEqual({ kind: 'node', id: 'beds1' });
    const texts = s.texts();
    expect(texts).toContain('BARRACKS I');
    expect(texts).toContain('AVAILABLE');
  });

  it('closes on click, BACK and Escape without researching or leaving the Lab', () => {
    const s = setup();
    const credits = s.app.story!.credits;
    for (const close of [() => s.click({ x: 20, y: 20 }), () => s.click({ x: 240, y: 340 }), () => s.press('Escape')]) {
      s.click(s.nameOf(9));
      expect(s.priv().cardItem).not.toBeNull();
      close();
      expect(s.priv().cardItem).toBeNull();
      expect(s.app.screen).toBe('panel');
      expect(s.app.story!.credits).toBe(credits);
      expect(s.app.story!.research.active).toBeNull();
    }
  });

  it('a double-click on BACK neither starts research nor leaves the Lab', () => {
    // the card's BACK (x 190-290) sits over the Lab's ACT (x 18-218) on its left part and over the Lab's BACK (x 262-462) on its right
    for (const x of [200, 280]) {
      const s = setup();
      s.click(s.nameOf(9)); // beds1, which a pressed ACT would start
      const credits = s.app.story!.credits;
      s.click({ x, y: 345 });
      s.app.click({ x, y: 345 }); // the second click of the double-click, no time passed
      expect(s.app.story!.credits, `x ${x}`).toBe(credits);
      expect(s.app.story!.research.active, `x ${x}`).toBeNull();
      expect(s.app.screen, `x ${x}`).toBe('panel');
    }
  });

  it('a click right of the name still selects the row, and a later page opens the right card', () => {
    const s = setup();
    s.click(s.restOf(9));
    expect(s.priv().panelSelected).toBe(9);
    expect(s.priv().cardItem).toBeNull();
  });
});
