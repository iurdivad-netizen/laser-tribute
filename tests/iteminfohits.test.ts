import { describe, expect, it } from 'vitest';
import { defaultLoadout } from '../src/core/loadout';
import { NODES } from '../src/core/world/base';
import { itemOfNode } from '../src/core/world/iteminfo';
import { newWorld } from '../src/core/world/world';
import { NAME_W } from '../src/screens/baseinfo';
import { PANEL, PANEL_PAGE, panelHit, panelItem } from '../src/screens/basepanels';
import { EQ, equipmentHit, equipmentInfoHit, equipmentInfoRects } from '../src/screens/equipment';

const fresh = () => newWorld(1, 'calm');
const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
const GEAR = ['shotgun', 'smg', 'sniper', 'smoke', 'flash', 'incendiary', 'armour', 'scanner', 'scope'];

describe('panelItem', () => {
  it('is the nine gear items for the Market rows, in research-table order', () => {
    expect(NODES.filter((n) => GEAR.includes(n.id)).map((n) => n.id)).toEqual(GEAR);
    GEAR.forEach((id, i) => expect(panelItem('market', i), id).toEqual(itemOfNode(id)));
    expect(panelItem('market', 9)).toBeNull();
  });

  it('is the item of a Lab row when its node gives gear, null for upgrades, and follows the page', () => {
    NODES.forEach((n, i) => expect(panelItem('lab', i), n.id).toEqual(itemOfNode(n.id)));
    expect(panelItem('lab', 9)).toBeNull(); // beds1
    // the same absolute index whatever the page the row is drawn on
    expect(panelItem('lab', PANEL_PAGE)).toEqual(itemOfNode(NODES[PANEL_PAGE].id));
  });

  it('is null for every other panel', () => {
    for (const id of ['barracks', 'training', 'hospital', 'wait'] as const) expect(panelItem(id, 0), id).toBeNull();
  });
});

describe('the name area of Market and Lab gear rows', () => {
  it('opens the item from the name and keeps the rest of the row as a row', () => {
    const row = PANEL.rows[0];
    expect(panelHit('market', row.x + 10, row.y + 5, fresh(), 0)).toEqual({ kind: 'name', index: 0 });
    expect(panelHit('market', row.x + NAME_W + 1, row.y + 5, fresh(), 0)).toEqual({ kind: 'row', index: 0 });
    expect(panelHit('lab', row.x + 10, row.y + 5, fresh(), 0)).toEqual({ kind: 'name', index: 0 }); // the shotgun
    expect(panelHit('lab', row.x + 200, row.y + 5, fresh(), 0)).toEqual({ kind: 'row', index: 0 });
  });

  it('never gives a name hit to a Lab upgrade row', () => {
    const upgrade = PANEL.rows[9]; // beds1 on page 0
    expect(panelHit('lab', upgrade.x + 10, upgrade.y + 5, fresh(), 0)).toEqual({ kind: 'row', index: 9 });
  });

  it('follows the second page of the Lab', () => {
    for (let i = 0; i < NODES.length - PANEL_PAGE; i++) {
      const row = PANEL.rows[i];
      const hit = panelHit('lab', row.x + 10, row.y + 5, fresh(), 1);
      const node = NODES[PANEL_PAGE + i];
      expect(hit, node.id).toEqual({ kind: itemOfNode(node.id) ? 'name' : 'row', index: PANEL_PAGE + i });
    }
  });

  it('leaves the soldier name hits alone', () => {
    const row = PANEL.rows[0];
    expect(panelHit('barracks', row.x + 10, row.y + 5, fresh(), 0)).toEqual({ kind: 'name', index: 0 });
    expect(panelHit('hospital', row.x + 10, row.y + 5, fresh(), 0)?.kind).toBe('row');
  });
});

describe('the ? buttons on the equipment screen', () => {
  const kit = defaultLoadout().map((s, i) => (i === 0 ? { ...s, gadget: 'scanner' as const, attachment: 'scope' as const } : i === 1 ? { ...s, gadget: 'medkit' as const } : s));

  it('are three or four per soldier (the gadget one only when a gadget is set)', () => {
    const rects = equipmentInfoRects(kit);
    const per = (i: number) => rects.filter((r) => r.index === i).length;
    expect(rects).toHaveLength(14);
    expect([per(0), per(1), per(2), per(3)]).toEqual([4, 4, 3, 3]);
    expect([...new Set(rects.map((r) => r.kind))].sort()).toEqual(['gadget', 'scope', 'throwable', 'weapon']);
  });

  it('keeps clear of every equipment control, the labels and the net-cost text', () => {
    const rects = equipmentInfoRects(kit);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(480);
      expect(r.y + r.h).toBeLessThanOrEqual(400);
      // no pixel of a ? rectangle is on any existing button
      for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) expect(equipmentHit(x, y), `${x},${y}`).toBeNull();
      // the story's shifted labels ("Grenades", "Spare clips": x 196 to 262, 7 px tall at row y + 8) and the net cost (x 432 on, first row)
      const rowTop = EQ.rowTop + Math.floor((r.y - EQ.rowTop) / EQ.rowStep) * EQ.rowStep;
      expect(overlap(r, { x: 196, y: rowTop + 8, w: 48, h: 7 }), 'label row 1').toBe(false);
      expect(overlap(r, { x: 196, y: rowTop + EQ.clipDy + 8, w: 66, h: 7 }), 'label row 2').toBe(false);
      expect(overlap(r, { x: 432, y: rowTop + 8, w: 48, h: 7 }), 'net cost').toBe(false);
    }
    for (const a of rects) for (const b of rects) if (a !== b) expect(overlap(a, b)).toBe(false);
  });

  it('hit at their centre and give the item now in the kit', () => {
    const rects = equipmentInfoRects(kit);
    for (const r of rects) {
      const c = centre(r);
      const ref = equipmentInfoHit(c.x, c.y, kit);
      expect(ref, `${r.index} ${r.kind}`).not.toBeNull();
    }
    const weapon0 = rects.find((r) => r.index === 0 && r.kind === 'weapon')!;
    expect(equipmentInfoHit(centre(weapon0).x, centre(weapon0).y, kit)).toEqual({ kind: 'weapon', id: 'rifle' });
    const swapped = kit.map((s, i) => (i === 0 ? { ...s, weapon: 'smg' as const } : s));
    expect(equipmentInfoHit(centre(weapon0).x, centre(weapon0).y, swapped)).toEqual({ kind: 'weapon', id: 'smg' });
    const gadget0 = rects.find((r) => r.index === 0 && r.kind === 'gadget')!;
    expect(equipmentInfoHit(centre(gadget0).x, centre(gadget0).y, kit)).toEqual({ kind: 'gadget', id: 'scanner' });
    const scope0 = rects.find((r) => r.index === 0 && r.kind === 'scope')!;
    expect(equipmentInfoHit(centre(scope0).x, centre(scope0).y, kit)).toEqual({ kind: 'scope' });
    const grenade0 = rects.find((r) => r.index === 0 && r.kind === 'throwable')!;
    expect(equipmentInfoHit(centre(grenade0).x, centre(grenade0).y, kit)).toEqual({ kind: 'throwable', id: 'frag' });
  });

  it('are null elsewhere, give nothing for a missing gadget, and take a touch slop without stealing another control', () => {
    expect(equipmentInfoHit(5, 5, kit)).toBeNull();
    const noGadget = kit.map((s, i) => (i === 0 ? { ...s, gadget: undefined } : s));
    expect(equipmentInfoRects(noGadget).some((r) => r.index === 0 && r.kind === 'gadget')).toBe(false);
    const weapon0 = equipmentInfoRects(kit).find((r) => r.index === 0 && r.kind === 'weapon')!;
    // a point just outside the ? and not on any button counts with slop 3, not without
    const px = weapon0.x - 2;
    const py = weapon0.y + 12;
    expect(equipmentHit(px, py)).toBeNull();
    expect(equipmentInfoHit(px, py, kit, 0)).toBeNull();
    expect(equipmentInfoHit(px, py, kit, 3)).toEqual({ kind: 'weapon', id: 'rifle' });
    // inside the weapon button the slop never steals the tap
    const onButton = { x: EQ.weapon.x + EQ.weapon.w - 2, y: weapon0.y + 12 };
    expect(equipmentHit(onButton.x, onButton.y)?.kind).toBe('weapon');
    expect(equipmentInfoHit(onButton.x, onButton.y, kit, 3)).toBeNull();
  });
});
