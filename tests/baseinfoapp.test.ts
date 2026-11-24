import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { REGIONS } from '../src/core/world/planet';
import { LastMode, SaveStore, type SaveStorage } from '../src/save';
import { BUILDINGS } from '../src/screens/base';
import { PANEL } from '../src/screens/basepanels';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PLANET } from '../src/screens/planet';
import { SQUAD } from '../src/screens/squad';
import { TITLE } from '../src/screens/title';
import { STORY_SAVE_KEY, StoryStore } from '../src/storysave';
import { buildingInfo } from '../src/core/world/buildinginfo';
import { onText } from '../src/ui/text';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const region = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });
const NOWHERE = { x: 10, y: 395 };
const KIT = 'KIT IS CHOSEN BEFORE EACH FIGHT';

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
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
  const openPanel = (id: string) => {
    click(mid(PLANET.base));
    click(mid(BUILDINGS.find((b) => b.id === id)!));
  };
  const texts = (): string[] => {
    const out: string[] = [];
    const stop = onText((r) => out.push(r.text));
    app.draw(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D, 0);
    stop();
    return out;
  };
  const nameOf = (i: number) => ({ x: PANEL.rows[i].x + 10, y: PANEL.rows[i].y + 10 });
  const restOf = (i: number) => ({ x: PANEL.rows[i].x + 200, y: PANEL.rows[i].y + 10 });
  const priv = () => app as unknown as { panelSelected: number | null; squadPicked: string[]; cardName: string | null; openPanel(id: string): void };
  return { app, storage, click, press, openPanel, texts, nameOf, restOf, priv };
}

describe('the soldier card in the barracks', () => {
  it('opens from the name, selects the row, closes on any click, and changes nothing', () => {
    const s = setup();
    s.openPanel('barracks');
    const world = JSON.stringify(s.app.story);
    const saved = s.storage.data.get(STORY_SAVE_KEY);
    s.click(s.nameOf(1));
    expect(s.app.screen).toBe('panel');
    expect(s.priv().panelSelected).toBe(1);
    expect(s.texts()).toContain('Brandt');
    expect(s.texts()).toContain(KIT);
    s.click(NOWHERE);
    expect(s.texts()).not.toContain(KIT);
    expect(s.app.screen).toBe('panel');
    expect(JSON.stringify(s.app.story)).toBe(world);
    expect(s.storage.data.get(STORY_SAVE_KEY)).toBe(saved);
  });

  it('selects without a card when the rest of the row is clicked', () => {
    const s = setup();
    s.openPanel('barracks');
    s.click(s.restOf(2));
    expect(s.priv().panelSelected).toBe(2);
    expect(s.texts()).not.toContain(KIT);
  });

  it('closes on Escape without leaving the panel, and the next Escape goes back to the base', () => {
    const s = setup();
    s.openPanel('barracks');
    s.click(s.nameOf(0));
    expect(s.texts()).toContain(KIT);
    s.press('Escape');
    expect(s.texts()).not.toContain(KIT);
    expect(s.app.screen).toBe('panel');
    s.press('Escape');
    expect(s.app.screen).toBe('base');
  });
});

describe('the soldier card in the training panel', () => {
  it('opens from the name, while selecting by the rest of the row and pressing TRAIN still trains', () => {
    const s = setup();
    s.app.story = { ...s.app.story!, research: { done: ['training1'], active: null } };
    s.openPanel('training');
    s.click(s.nameOf(0));
    expect(s.texts()).toContain(KIT);
    s.click(NOWHERE);
    s.click(s.restOf(2));
    s.click(mid(PANEL.act));
    expect(s.app.story!.soldiers[2].status).toBe('training');
  });
});

describe('the building info boxes', () => {
  const TITLES: [string, string][] = [
    ['lab', 'LAB'], ['barracks', 'BARRACKS'], ['market', 'MARKET'], ['training', 'TRAINING'], ['hospital', 'FIELD HOSPITAL'], ['wait', 'WAIT'],
  ];
  it.each(TITLES)('INFO on the %s panel opens its box, and a click or Escape closes it', (id, title) => {
    const s = setup();
    s.openPanel(id);
    const world = JSON.stringify(s.app.story);
    // the first words of the explanation: text that only the open box draws (the panel header already says the title)
    const first = buildingInfo(id as 'lab', s.app.story!).lines[0].slice(0, 24).toLowerCase();
    const shown = () => s.texts().some((t) => t.toLowerCase().includes(first));
    expect(shown(), id).toBe(false);
    s.click(mid(PANEL.info));
    expect(shown(), id).toBe(true);
    expect(s.texts(), id).toContain(title);
    s.click(NOWHERE);
    expect(s.app.screen).toBe('panel');
    expect(shown(), id).toBe(false); // a click closed it
    s.click(mid(PANEL.info));
    expect(shown(), id).toBe(true);
    s.press('Escape');
    expect(shown(), id).toBe(false); // Escape closed it
    expect(s.app.screen).toBe('panel');
    expect(JSON.stringify(s.app.story)).toBe(world);
  });

  it('shows the live numbers: the lab explanation follows the labs level', () => {
    const s = setup();
    s.app.story = { ...s.app.story!, research: { done: ['labs1'], active: null } };
    s.openPanel('lab');
    s.click(mid(PANEL.info));
    expect(s.texts().join(' ')).toContain('75%');
  });
});

describe('opening and closing safely', () => {
  it('does not close a card with the second click of a double-click', () => {
    const s = setup();
    s.openPanel('barracks');
    s.click(s.nameOf(0));
    expect(s.texts()).toContain(KIT);
    s.app.click(s.nameOf(0)); // the second click of a double-click, a few milliseconds later: no time passes
    expect(s.texts()).toContain(KIT);
  });

  it('does not leave the panel when Escape is held down after it closed the card', () => {
    const s = setup();
    s.openPanel('barracks');
    s.click(s.nameOf(0));
    s.press('Escape');
    expect(s.texts()).not.toContain(KIT);
    s.app.key('Escape', true);
    s.app.key('Escape', true);
    expect(s.app.screen).toBe('panel');
  });
});

describe('the soldier card in the squad step', () => {
  const toSquad = (s: ReturnType<typeof setup>) => {
    s.click(region(1));
    s.click(mid(PLANET.act));
    expect(s.app.screen).toBe('squad');
  };

  it('opens from the name without changing the picked squad, and the rest of the row still picks', () => {
    const s = setup();
    toSquad(s);
    const before = [...s.priv().squadPicked];
    const row = SQUAD.rows[0];
    s.click({ x: row.x + 10, y: row.y + 10 });
    expect(s.priv().squadPicked).toEqual(before);
    expect(s.texts()).toContain(KIT);
    s.click(NOWHERE);
    s.click({ x: row.x + 200, y: row.y + 10 });
    expect(s.priv().squadPicked).not.toEqual(before);
  });

  it('gives a soldier in training a card from the name', () => {
    const s = setup();
    const w = s.app.story!;
    s.app.story = {
      ...w,
      soldiers: w.soldiers.map((x, i) => (i === 3 ? { ...x, status: 'training' as const, daysLeft: 2 } : x)),
      squad: ['Alvarez', 'Brandt', 'Chen'],
    };
    toSquad(s);
    const row = SQUAD.rows[3];
    s.click({ x: row.x + 10, y: row.y + 10 });
    expect(s.texts()).toContain('Dubois');
    expect(s.texts()).toContain(KIT);
  });
});

describe('leaving a screen with a card open', () => {
  it('never leaves it drawn on the next panel', () => {
    const s = setup();
    s.openPanel('barracks');
    s.click(s.nameOf(0));
    s.priv().openPanel('lab');
    expect(s.texts()).not.toContain(KIT);
    expect(s.priv().cardName).toBeNull();
  });
});
