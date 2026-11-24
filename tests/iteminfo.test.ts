import { describe, expect, it } from 'vitest';
import { ATTACHMENTS, GADGETS, GADGET_IDS, THROWABLES, THROWABLE_IDS, WEAPONS, WEAPON_IDS } from '../src/core/config';
import { attachmentPrice, gadgetPrice, throwablePrice, weaponPrice } from '../src/core/loadout';
import { NODES, storyGearRules } from '../src/core/world/base';
import { ALL_ITEMS, itemCard, itemOfNode, type ItemRef } from '../src/core/world/iteminfo';
import { newWorld, type World } from '../src/core/world/world';
import { unsupportedChars } from '../src/ui/font';

const fresh = () => newWorld(1, 'calm');
const withResearch = (done: string[]): World => ({ ...fresh(), research: { done, active: null } });
const value = (ref: ItemRef, label: string, w: World | null = null): string | undefined =>
  itemCard(ref, w).rows.find((r) => r[0] === label)?.[1];
const weapon = (id: (typeof WEAPON_IDS)[number]): ItemRef => ({ kind: 'weapon', id });
const throwable = (id: (typeof THROWABLE_IDS)[number]): ItemRef => ({ kind: 'throwable', id });
const gadget = (id: (typeof GADGET_IDS)[number]): ItemRef => ({ kind: 'gadget', id });
const SCOPE: ItemRef = { kind: 'scope' };

describe('the item list', () => {
  it('has the 13 items: 5 weapons, 4 grenades, 3 gadgets, the scope', () => {
    expect(ALL_ITEMS).toHaveLength(13);
    expect(ALL_ITEMS.map((i) => i.kind)).toEqual([
      'weapon', 'weapon', 'weapon', 'weapon', 'weapon', 'throwable', 'throwable', 'throwable', 'throwable', 'gadget', 'gadget', 'gadget', 'scope',
    ]);
  });
});

describe('every card', () => {
  it('has a title, 2 to 12 rows, a good-for line without numbers, short supported text', () => {
    for (const w of [null, fresh()]) {
      for (const ref of ALL_ITEMS) {
        const card = itemCard(ref, w);
        const name = JSON.stringify(ref);
        expect(card.title.length, name).toBeGreaterThan(0);
        expect(card.rows.length, name).toBeGreaterThanOrEqual(2); // the armour has one number besides its price
        expect(card.rows.length, name).toBeLessThanOrEqual(12);
        expect(card.goodFor.length, name).toBeGreaterThan(0);
        expect(card.goodFor, name).not.toMatch(/[0-9]/);
        for (const [label, v] of card.rows) {
          expect(label.length, `${name} ${label}`).toBeLessThanOrEqual(10);
          expect(v.length, `${name} ${v}`).toBeLessThanOrEqual(22);
          expect(unsupportedChars(label + v), `${name} ${label} ${v}`).toEqual([]);
        }
        expect(unsupportedChars(card.title + card.goodFor), name).toEqual([]);
      }
    }
  });
});

describe('weapon cards', () => {
  it('shows the rifle exactly', () => {
    const r = weapon('rifle');
    expect(value(r, 'DAMAGE')).toBe('30');
    expect(value(r, 'RANGE')).toBe('14');
    expect(value(r, 'SNAP AP')).toBe('15');
    expect(value(r, 'AIM AP')).toBe('30');
    expect(value(r, 'SNAP ACC')).toBe('50%');
    expect(value(r, 'AIM ACC')).toBe('85%');
    expect(value(r, 'MAGAZINE')).toBe('5');
    expect(value(r, 'FALLOFF')).toBe('50%');
    expect(value(r, 'PRICE')).toBe('25');
    expect(value(r, 'SIGHT')).toBeUndefined();
    expect(value(r, 'CLOSE')).toBeUndefined();
  });

  it('shows the burst, the falloffs, the sight and the close penalty', () => {
    expect(value(weapon('smg'), 'DAMAGE')).toBe('12x3');
    expect(value(weapon('pistol'), 'DAMAGE')).toBe('18');
    expect(value(weapon('shotgun'), 'FALLOFF')).toBe('90%');
    const sniper = weapon('sniper');
    expect(value(sniper, 'SIGHT')).toBe('14');
    expect(value(sniper, 'CLOSE')).toBe('x0.5 WITHIN 3');
    expect(value(sniper, 'FALLOFF')).toBe('20%');
  });

  it('matches the config table for every weapon', () => {
    for (const id of WEAPON_IDS) {
      const d = WEAPONS[id];
      const ref = weapon(id);
      expect(value(ref, 'DAMAGE'), id).toBe(d.burst && d.burst > 1 ? `${d.damage}x${d.burst}` : `${d.damage}`);
      expect(value(ref, 'RANGE'), id).toBe(`${d.range}`);
      expect(value(ref, 'SNAP AP'), id).toBe(`${d.snapAp}`);
      expect(value(ref, 'AIM AP'), id).toBe(`${d.aimedAp}`);
      expect(value(ref, 'SNAP ACC'), id).toBe(`${Math.round(d.snapAccuracy * 100)}%`);
      expect(value(ref, 'AIM ACC'), id).toBe(`${Math.round(d.aimedAccuracy * 100)}%`);
      expect(value(ref, 'MAGAZINE'), id).toBe(`${d.magazine}`);
      expect(value(ref, 'FALLOFF'), id).toBe(`${Math.round((d.falloff ?? 0.5) * 100)}%`);
      expect(value(ref, 'PRICE'), id).toBe(`${d.price}`);
      expect(itemCard(ref, null).title, id).toBe(d.name.toUpperCase());
    }
  });
});

describe('grenade, gadget and scope cards', () => {
  it('shows the grenades', () => {
    expect(value(throwable('frag'), 'AP')).toBe('24');
    expect(value(throwable('frag'), 'RANGE')).toBe('8');
    expect(value(throwable('frag'), 'BLAST')).toBe('3x3');
    expect(value(throwable('frag'), 'EFFECT')).toBe('40 DMG');
    expect(value(throwable('frag'), 'PRICE')).toBe('8');
    expect(value(throwable('smoke'), 'BLAST')).toBe('5x5');
    expect(value(throwable('smoke'), 'EFFECT')).toBe('SMOKE 3 TURNS');
    expect(value(throwable('flash'), 'EFFECT')).toBe('STUN 30 AP');
    expect(value(throwable('incendiary'), 'EFFECT')).toBe('15 DMG + FIRE 3 TURNS');
  });

  it('matches the config table for every grenade', () => {
    for (const id of THROWABLE_IDS) {
      const d = THROWABLES[id];
      const side = 2 * d.radius + 1;
      expect(value(throwable(id), 'AP'), id).toBe(`${d.apCost}`);
      expect(value(throwable(id), 'RANGE'), id).toBe(`${d.range}`);
      expect(value(throwable(id), 'BLAST'), id).toBe(`${side}x${side}`);
      expect(value(throwable(id), 'PRICE'), id).toBe(`${d.price}`);
    }
  });

  it('shows the gadgets and the scope', () => {
    expect(value(gadget('medkit'), 'HEAL')).toBe(`${GADGETS.medkit.heal}`);
    expect(value(gadget('medkit'), 'AP')).toBe(`${GADGETS.medkit.apCost}`);
    expect(value(gadget('armour'), 'DAMAGE')).toBe(`-${GADGETS.armour.reductionPct}%`);
    expect(value(gadget('scanner'), 'AP')).toBe(`${GADGETS.scanner.apCost}`);
    expect(value(gadget('scanner'), 'RADIUS')).toBe(`${GADGETS.scanner.radius}`);
    expect(value(SCOPE, 'ACCURACY')).toBe(`+${Math.round(ATTACHMENTS.scope.accuracy * 100)}%`);
    expect(value(SCOPE, 'CRIT')).toBe(`+${Math.round(ATTACHMENTS.scope.crit * 100)}%`);
    expect(value(SCOPE, 'PRICE')).toBe(`${ATTACHMENTS.scope.price}`);
    expect(itemCard(SCOPE, null).title).toBe('SCOPE');
  });
});

describe('the price status', () => {
  it('has no status row without a world', () => {
    for (const ref of ALL_ITEMS) expect(value(ref, 'STATUS', null), JSON.stringify(ref)).toBeUndefined();
  });

  it('says OWNED for the starting kit and the premium price for anything else', () => {
    const w = fresh();
    for (const ref of [weapon('pistol'), weapon('rifle'), throwable('frag'), gadget('medkit')]) {
      expect(value(ref, 'STATUS', w), JSON.stringify(ref)).toBe('OWNED');
    }
    expect(value(weapon('sniper'), 'STATUS', w)).toBe('PREMIUM 60 CR');
    expect(value(weapon('shotgun'), 'STATUS', w)).toBe('PREMIUM 33 CR');
  });

  it('turns to OWNED once researched, and always equals what the equipment screen charges', () => {
    const w = withResearch(['shotgun', 'scope']);
    expect(value(weapon('shotgun'), 'STATUS', w)).toBe('OWNED');
    expect(value(SCOPE, 'STATUS', w)).toBe('OWNED');
    expect(value(weapon('smg'), 'STATUS', w)).toMatch(/^PREMIUM /);
    for (const done of [[], ['shotgun', 'smoke', 'armour', 'scope']]) {
      const rules = storyGearRules(done);
      const world = withResearch(done);
      const premium = (n: number) => `PREMIUM ${n} CR`;
      const expectStatus = (ref: ItemRef, price: number, base: number) =>
        expect(value(ref, 'STATUS', world), JSON.stringify(ref)).toBe(price === base ? 'OWNED' : premium(price));
      for (const id of WEAPON_IDS) expectStatus(weapon(id), weaponPrice(id, rules), weaponPrice(id));
      for (const id of THROWABLE_IDS) expectStatus(throwable(id), throwablePrice({ throwable: id }, rules), throwablePrice({ throwable: id }));
      for (const id of GADGET_IDS) expectStatus(gadget(id), gadgetPrice(id, rules), gadgetPrice(id));
      expectStatus(SCOPE, attachmentPrice('scope', rules), attachmentPrice('scope'));
    }
  });
});

describe('itemOfNode', () => {
  it('maps the gear nodes to their item and everything else to null', () => {
    expect(itemOfNode('shotgun')).toEqual(weapon('shotgun'));
    expect(itemOfNode('smg')).toEqual(weapon('smg'));
    expect(itemOfNode('sniper')).toEqual(weapon('sniper'));
    expect(itemOfNode('smoke')).toEqual(throwable('smoke'));
    expect(itemOfNode('flash')).toEqual(throwable('flash'));
    expect(itemOfNode('incendiary')).toEqual(throwable('incendiary'));
    expect(itemOfNode('armour')).toEqual(gadget('armour'));
    expect(itemOfNode('scanner')).toEqual(gadget('scanner'));
    expect(itemOfNode('scope')).toEqual(SCOPE);
    for (const id of ['beds1', 'labs2', 'contracts3', 'hospital1', 'training2', 'nope']) expect(itemOfNode(id), id).toBeNull();
  });

  it('gives every gear node an item that is on the list', () => {
    for (const n of NODES) {
      const ref = itemOfNode(n.id);
      if (n.gives.weapon || n.gives.throwable || n.gives.gadget || n.gives.attachment) {
        expect(ref, n.id).not.toBeNull();
        expect(ALL_ITEMS).toContainEqual(ref);
      } else expect(ref, n.id).toBeNull();
    }
  });
});
