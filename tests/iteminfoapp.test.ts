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
import { itemCard } from '../src/core/world/iteminfo';
import { EQ, equipmentInfoRects } from '../src/screens/equipment';
import { STORY_EQUIPMENT_BACK } from '../src/screens/planet';
import { onText } from '../src/ui/text';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const region = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });
const NOWHERE = { x: 10, y: 395 };
const SCANNER = itemCard({ kind: 'gadget', id: 'scanner' }, null).title;
const SHOTGUN = itemCard({ kind: 'weapon', id: 'shotgun' }, null).title;

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
  const priv = () => app as unknown as { panelSelected: number | null; squadPicked: string[]; cardName: string | null; cardItem: unknown; openPanel(id: string): void };
  return { app, storage, click, press, openPanel, texts, nameOf, restOf, priv };
}


describe('the item card from the Market and the Lab', () => {
  it('opens from a gear row name, shows the item with its status, and any click closes it', () => {
    const s = setup();
    s.openPanel('market');
    s.click(s.nameOf(0)); // the shotgun, the first gear node
    expect(s.texts()).toContain(SHOTGUN);
    expect(s.texts()).toContain('PRICE');
    expect(s.priv().cardItem).not.toBeNull();
    s.click(NOWHERE);
    expect(s.priv().cardItem).toBeNull();
    expect(s.texts()).not.toContain('PRICE');
    expect(s.app.screen).toBe('panel');
  });

  it('leaves the rest of the row selecting, and the Lab upgrade rows without a card', () => {
    const s = setup();
    s.openPanel('market');
    s.click(s.restOf(1));
    expect(s.priv().panelSelected).toBe(1);
    expect(s.priv().cardItem).toBeNull();
    s.priv().openPanel('lab');
    s.click(s.nameOf(9)); // beds1, an upgrade
    expect(s.priv().cardItem).toBeNull();
    s.click(s.nameOf(0));
    expect(s.texts()).toContain(SHOTGUN);
  });

  it('closes on Escape without leaving the panel, and is gone on the next panel', () => {
    const s = setup();
    s.openPanel('market');
    s.click(s.nameOf(0));
    s.press('Escape');
    expect(s.priv().cardItem).toBeNull();
    expect(s.app.screen).toBe('panel');
    s.click(s.nameOf(0));
    s.priv().openPanel('lab');
    expect(s.priv().cardItem).toBeNull();
  });
});

describe('the item card on the equipment screen', () => {
  const toEquipment = (s: ReturnType<typeof setup>) => {
    s.click(region(1));
    s.click(mid(PLANET.act));
    s.click(mid(SQUAD.start));
    expect(s.app.screen).toBe('equipment');
  };
  const loadoutOf = (s: ReturnType<typeof setup>) => (s.app as unknown as { loadout: Parameters<typeof equipmentInfoRects>[0] }).loadout;
  const rect = (s: ReturnType<typeof setup>, kind: string, index = 0) =>
    mid(equipmentInfoRects(loadoutOf(s)).find((x) => x.kind === kind && x.index === index)!);

  it('draws the ? buttons in a story fight and opens the card of the item in the kit', () => {
    const s = setup();
    toEquipment(s);
    expect(s.texts().filter((t) => t === '?').length).toBeGreaterThanOrEqual(3 * 4);
    s.click(rect(s, 'weapon'));
    const weapon = loadoutOf(s)[0].weapon;
    expect(s.priv().cardItem).toEqual({ kind: 'weapon', id: weapon });
    expect(s.texts()).toContain('PRICE');
    s.click(NOWHERE);
    expect(s.priv().cardItem).toBeNull();
    expect(s.app.screen).toBe('equipment');
  });

  it('is modal: a click on a real button or BACK only closes the card, and Escape and Enter close it first', () => {
    const s = setup();
    toEquipment(s);
    const kit = () => JSON.stringify(loadoutOf(s));
    const before = kit();
    s.click(rect(s, 'scope'));
    expect(s.priv().cardItem).toEqual({ kind: 'scope' });
    s.click({ x: EQ.weapon.x + 10, y: EQ.rowTop + 10 });
    expect(kit()).toBe(before);
    expect(s.priv().cardItem).toBeNull();
    s.click(rect(s, 'weapon'));
    s.click(mid(STORY_EQUIPMENT_BACK));
    expect(s.app.screen).toBe('equipment');
    s.click(rect(s, 'weapon'));
    s.press('Enter');
    expect(s.app.screen).toBe('equipment');
    expect(s.priv().cardItem).toBeNull();
    s.click(rect(s, 'weapon'));
    s.press('Escape');
    expect(s.app.screen).toBe('equipment');
    expect(s.priv().cardItem).toBeNull();
    s.press('Escape');
    expect(s.app.screen).toBe('squad');
  });

  it('a held Escape closes the card but does not also leave', () => {
    const s = setup();
    toEquipment(s);
    s.click(rect(s, 'weapon'));
    s.app.key('Escape', true);
    s.app.key('Escape', true);
    expect(s.app.screen).toBe('equipment');
  });

  it('the tutorial and campaign equipment screens have no ? buttons', () => {
    const s = setup();
    s.app.screen = 'equipment' as never;
    expect(s.texts()).not.toContain('?');
  });
});
